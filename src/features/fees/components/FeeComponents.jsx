// src/componets/FeeComponents.jsx
// Catalog for fee_component_types.
// UI shows: Name, Amount (INR). School/code are hidden.
// Inserts include school_code from public.users so NOT NULL is satisfied.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card, Table, Form, Input, InputNumber, Button, Space, Typography,
  Modal, message, Popconfirm, Tooltip
} from "antd";
import { PlusOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { supabase } from '@/config/supabaseClient';
import { getUserRole, getSchoolCode } from '@/shared/utils/metadata';
import { Page, EmptyState, ConfirmAction } from '@/shared/ui/index';
import { fmtINR, toPaise } from '@/features/fees/utils/money';
import { fmtDateIST } from '@/shared/utils/time';

const { Title, Text } = Typography;

const slug = (s) =>
  (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 40);

export default function FeeComponents() {
  const [me, setMe] = useState({ role: "", school_code: null });
  const isWriter = useMemo(() => ["admin", "superadmin"].includes(me.role || ""), [me.role]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editModal, setEditModal] = useState({ open: false, id: null });
  const [deleteModal, setDeleteModal] = useState({ visible: false, record: null });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) throw new Error("Not authenticated");
        
        const role = getUserRole(user) || "";
        const school_code = getSchoolCode(user) || null;
        
        
        setMe({
          role,
          school_code,
        });
      } catch (e) { 
        message.error(e.message || "Failed to load user context"); 
      }
    })();
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      // Only proceed if we have the necessary user context
      if (!me.role) {
        setLoading(false);
        return;
      }

      let q = supabase.from("fee_component_types")
        .select("id, name, default_amount_paise, created_at, school_code")
        .order("name", { ascending: true });
      
      // Always filter by school_code for non-superadmin users
      if (me.role !== "superadmin") {
        if (!me.school_code) {
          message.error("School information not found. Please contact administrator.");
          setLoading(false);
          return;
        }
        q = q.eq("school_code", me.school_code);
      } else {
      }
      
      const { data, error } = await q;
      
      if (error) throw error;
      
      
      setRows(data || []);
    } catch (e) { 
      message.error(e.message || "Failed to load components"); 
    }
    finally { setLoading(false); }
  }, [me.role, me.school_code]);

  useEffect(() => { if (me.role) fetchRows(); }, [me.role, fetchRows]);

  const addComponent = async (vals) => {
    if (!isWriter) return message.error("No permission");
    if (!me.school_code) return message.error("Your user has no school_code in public.users");
    const code = slug(vals.name) || `comp-${Date.now()}`;
    const payload = {
      school_code: me.school_code,
      code,
      name: vals.name.trim(),
      default_amount_paise: vals.amount_inr == null || vals.amount_inr === "" ? null : toPaise(vals.amount_inr),
      is_recurring: true,
      period: "annual",
    };
    try {
      let { error } = await supabase.from("fee_component_types").insert(payload);
      if (error && error.code === "23505") {
        ({ error } = await supabase.from("fee_component_types").insert({ ...payload, code: `${code}-${Math.floor(Math.random()*900+100)}` }));
      }
      if (error) throw error;
      message.success("Component added");
      addForm.resetFields();
      fetchRows();
    } catch (e) { message.error(e.message || "Add failed"); }
  };

  const openEdit = (row) => {
    setEditModal({ open: true, id: row.id });
    editForm.setFieldsValue({
      name: row.name,
      amount_inr: row.default_amount_paise == null ? null : row.default_amount_paise / 100,
    });
  };

  const saveEdit = async () => {
    if (!isWriter) return message.error("No permission");
    const vals = await editForm.validateFields();
    const payload = {
      name: vals.name.trim(),
      default_amount_paise: vals.amount_inr == null || vals.amount_inr === "" ? null : toPaise(vals.amount_inr),
    };
    try {
      const { error } = await supabase.from("fee_component_types").update(payload).eq("id", editModal.id);
      if (error) throw error;
      message.success("Updated");
      setEditModal({ open: false, id: null });
      fetchRows();
    } catch (e) { message.error(e.message || "Update failed"); }
  };

  const remove = async (row) => {
    if (!isWriter) return message.error("No permission");
    try {
      const { error } = await supabase.from("fee_component_types").delete().eq("id", row.id);
      if (error) throw error;
      message.success("Deleted");
      fetchRows();
    } catch (e) { message.error(e.message || "Delete failed"); }
  };

  const columns = [
    { 
      title: "Name", 
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <div>
          <Text strong style={{ color: '#1e293b' }}>
            {name}
          </Text>
        </div>
      )
    },
    { 
      title: "Amount", 
      key: "amount",
      render: (_, r) => (
        r.default_amount_paise == null ? 
          <Text type="secondary">—</Text> : 
          <Text strong style={{ color: '#059669' }}>
            {fmtINR(r.default_amount_paise)}
          </Text>
      )
    },
    { 
      title: "Created", 
      dataIndex: "created_at", 
      key: "created_at",
      render: (v) => fmtDateIST(v), 
      responsive: ["lg"] 
    },
    isWriter ? {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Button 
            size="small" 
            onClick={() => openEdit(r)}
            style={{ borderRadius: 6 }}
          >
            Edit
          </Button>
          <Button 
            size="small" 
            danger 
            onClick={() => setDeleteModal({ visible: true, record: r })}
            style={{ borderRadius: 6 }}
          >
            Delete
          </Button>
        </Space>
      )
    } : null,
  ].filter(Boolean);

  return (
    <Page
      title="Fee Components"
      loading={loading}
    >
      <Card 
        title={isWriter ? "Add Component" : "Components"}
        style={{ borderRadius: 12, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
      >
        {isWriter && (
          <Form layout="inline" form={addForm} onFinish={addComponent} style={{ marginBottom: 16 }}>
            <Form.Item 
              name="name" 
              rules={[{ required: true, whitespace: true, message: "Name is required" }]}
            >
              <Input 
                placeholder="Name (e.g. Tuition, Transport, Lab)" 
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item name="amount_inr">
              <InputNumber 
                min={0} 
                step="0.01" 
                placeholder="Amount (INR) — optional"
                style={{ width: 150 }}
              />
            </Form.Item>
            <Form.Item>
              <Tooltip title="If set, this amount pre-fills when assigning to a student. You can override it per student.">
                <InfoCircleOutlined style={{ marginRight: 8, color: '#64748b' }} />
              </Tooltip>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<PlusOutlined />}
                style={{ borderRadius: 8 }}
              >
                Add Component
              </Button>
            </Form.Item>
          </Form>
        )}

        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} components`
          }}
          size="middle"
          locale={{
            emptyText: (
              <EmptyState
                type="fees"
                onAction={() => addForm.submit()}
              />
            )
          }}
          scroll={{ x: 600 }}
        />
      </Card>

      <Modal
        open={editModal.open}
        title="Edit Component"
        onCancel={() => setEditModal({ open: false, id: null })}
        onOk={saveEdit}
        okText="Save Changes"
        cancelText="Cancel"
        destroyOnClose
        centered
        styles={{
          header: { borderBottom: '1px solid #e2e8f0' },
          body: { padding: '24px' },
          footer: { borderTop: '1px solid #e2e8f0' }
        }}
      >
        <Form layout="vertical" form={editForm}>
          <Form.Item 
            name="name" 
            label="Component Name" 
            rules={[{ required: true, whitespace: true, message: "Name is required" }]}
          >
            <Input placeholder="Enter component name" />
          </Form.Item>
          <Form.Item 
            name="amount_inr" 
            label="Default Amount (INR)"
            help="This amount pre-fills when assigning to students, but can be overridden per student."
          >
            <InputNumber 
              min={0} 
              step="0.01" 
              style={{ width: "100%" }}
              placeholder="0.00"
            />
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmAction
        visible={deleteModal.visible}
        title="Delete Fee Component"
        message={`Are you sure you want to delete "${deleteModal.record?.name}"? This action cannot be undone.`}
        okText="Delete Component"
        cancelText="Cancel"
        dangerous={true}
        onOk={() => {
          remove(deleteModal.record);
          setDeleteModal({ visible: false, record: null });
        }}
        onCancel={() => setDeleteModal({ visible: false, record: null })}
      />
    </Page>
  );
}
