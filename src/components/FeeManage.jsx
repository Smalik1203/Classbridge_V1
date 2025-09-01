// src/components/FeeManage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card, Table, Space, Button, Typography, Select, Drawer,
  Row, Col, message, Empty, InputNumber, Spin, Alert, Tooltip, Divider
} from "antd";
import { EditOutlined, PlusOutlined, TeamOutlined, ExclamationCircleOutlined, DollarOutlined } from "@ant-design/icons";
import { supabase } from "../config/supabaseClient";
import { Page, EmptyState } from "../ui";
import { fmtINR, toPaise } from "../utils/money";

const { Title, Text } = Typography;

// ---- small helpers ----
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const parseINR = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/₹\s?|(,*)/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export default function FeeManage() {
  // User context
  const [me, setMe] = useState({ id: null, role: "", school_code: null });
  const canWrite = useMemo(() => ["admin", "superadmin"].includes(me.role || ""), [me.role]);

  // Class data (with academic year for fee plans)
  const [activeYear, setActiveYear] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);

  // Catalog and table data
  const [catalog, setCatalog] = useState([]); // fee_component_types
  const [rows, setRows] = useState([]); // students + totals
  const [boot, setBoot] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rlsHint, setRlsHint] = useState(false);

  // Student Drawer editor state
  const [drawer, setDrawer] = useState({
    open: false,
    student: null,   // { id, name, code }
    planId: null,
    items: []        // [{ component_type_id, amount_inr }]
  });
  const [saving, setSaving] = useState(false);

  // Class Plan Drawer state (NEW)
  const [classDrawer, setClassDrawer] = useState({
    open: false,
    items: [] // [{ component_type_id, amount_inr }]
  });
  const [savingClass, setSavingClass] = useState(false);



  // ---------- bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) throw new Error("Not authenticated");

        const { data: urec, error: uErr } = await supabase
          .from("users")
          .select("role, school_code")
          .eq("id", user.id)
          .single();
        if (uErr) throw uErr;

        const role = urec?.role || "";
        const school_code = urec?.school_code || null;
        setMe({ id: user.id, role, school_code });

        if (!school_code) {
          message.error("No school code found for user");
          return;
        }

        // Active academic year
        const { data: ay, error: ayErr } = await supabase
          .from("academic_years")
          .select("id, year_start, year_end, is_active")
          .eq("school_code", school_code)
          .eq("is_active", true)
          .single();
        if (!ayErr && ay) setActiveYear(ay);

        // All class instances for the school
        const { data: cls, error: cErr } = await supabase
          .from("class_instances")
          .select("id, grade, section")
          .eq("school_code", school_code)
          .order("grade")
          .order("section");
        if (cErr) throw cErr;

        const classOptions = (cls || []).map(c => ({
          value: c.id,
          label: `Grade ${c.grade ?? "-"} - ${c.section ?? "-"}`
        }));
        setClasses(classOptions);

        // Auto-select first class
        if (classOptions.length > 0) {
          setClassId(classOptions[0].value);
        }

        // Component catalog
        const { data: comp, error: compErr } = await supabase
          .from("fee_component_types")
          .select("id, name, default_amount_paise")
          .eq("school_code", school_code)
          .order("name");
        if (compErr) throw compErr;
        setCatalog(comp || []);
      } catch (e) {
        console.error("Bootstrap error:", e);
        message.error(e.message || "Failed to init");
      } finally {
        setBoot(false);
      }
    })();
  }, []);

  // ---------- load table for selected class ----------
  const loadStudentsAndTotals = useCallback(async (cid) => {
    if (!cid || !me.school_code) return;
    setLoading(true);
    setRlsHint(false);

    try {
      // Students in class
      const { data: students, error: sErr } = await supabase
        .from("student")
        .select("id, full_name, student_code, class_instance_id")
        .eq("class_instance_id", cid)
        .eq("school_code", me.school_code)
        .order("full_name");
      if (sErr) throw sErr;
      const studentList = students || [];

      if (me.role === "admin" && studentList.length === 0) {
        setRlsHint(true);
      }

      // Plans for class
      const { data: plans, error: pErr } = await supabase
        .from("fee_student_plans")
        .select("id, student_id")
        .eq("class_instance_id", cid)
        .eq("school_code", me.school_code);
      if (pErr) throw pErr;

      const planByStudent = new Map((plans || []).map(p => [p.student_id, p.id]));
      const planIds = plans?.map(p => p.id) || [];

      // Items and totals
      const totalByPlan = new Map();
      if (planIds.length > 0) {
        const { data: items, error: iErr } = await supabase
          .from("fee_student_plan_items")
          .select("plan_id, amount_paise")
          .in("plan_id", planIds);
        if (iErr) throw iErr;
        for (const it of items || []) {
          totalByPlan.set(it.plan_id, (totalByPlan.get(it.plan_id) || 0) + Number(it.amount_paise || 0));
        }
      }

      setRows(studentList.map(st => {
        const pid = planByStudent.get(st.id) || null;
        const total = pid ? (totalByPlan.get(pid) || 0) : 0;
        return {
          key: st.id,
          student_id: st.id,
          student_name: st.full_name,
          student_code: st.student_code,
          plan_id: pid,
          total_paise: total
        };
      }));
    } catch (e) {
      console.error("Error loading students:", e);
      message.error(e.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [me.school_code, me.role]);

  // Load students when class changes
  useEffect(() => {
    if (classId) {
      loadStudentsAndTotals(classId);
    }
  }, [classId, loadStudentsAndTotals]);

  // ---------- open student drawer ----------
  const openEditor = async (row) => {
    try {
      let planId = row.plan_id;

      // create plan if missing
      if (!planId) {
        if (!activeYear) {
          message.error("No active academic year found. Please set up an active academic year first.");
          return;
        }

        const { data: ins, error: iErr } = await supabase
          .from("fee_student_plans")
          .insert({
            school_code: me.school_code,
            student_id: row.student_id,
            class_instance_id: classId,
            academic_year_id: activeYear.id,
            created_by: me.id
          })
          .select("id")
          .single();
        if (iErr) throw iErr;
        planId = ins.id;
      }

      // load existing items
      const { data: items, error: itemsErr } = await supabase
        .from("fee_student_plan_items")
        .select("component_type_id, amount_paise")
        .eq("plan_id", planId);
      if (itemsErr) throw itemsErr;

      setDrawer({
        open: true,
        student: { id: row.student_id, name: row.student_name, code: row.student_code },
        planId,
        items: (items || []).map(it => ({
          component_type_id: it.component_type_id,
          amount_inr: (Number(it.amount_paise || 0) / 100)
        }))
      });
    } catch (e) {
      console.error("Error opening editor:", e);
      message.error(e.message || "Failed to open editor");
    }
  };

  // ---------- save student plan ----------
  const savePlan = async () => {
    if (!drawer.planId) return;
    setSaving(true);
    try {
      // get existing items to compare
      const { data: existing, error: existingErr } = await supabase
        .from("fee_student_plan_items")
        .select("component_type_id")
        .eq("plan_id", drawer.planId);
      if (existingErr) throw existingErr;

      const existingIds = new Set((existing || []).map(e => e.component_type_id));
      const newIds = new Set(drawer.items.map(i => i.component_type_id));

      // delete removed items
      const toDelete = Array.from(existingIds).filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("fee_student_plan_items")
          .delete()
          .eq("plan_id", drawer.planId)
          .in("component_type_id", toDelete);
        if (delErr) throw delErr;
      }

      // upsert new/updated items
      const toUpsert = drawer.items.map(item => ({
        plan_id: drawer.planId,
        component_type_id: item.component_type_id,
        amount_paise: toPaise(parseINR(item.amount_inr))
      }));

      if (toUpsert.length > 0) {
        const { error: upsertErr } = await supabase
          .from("fee_student_plan_items")
          .upsert(toUpsert, { onConflict: "plan_id,component_type_id" });
        if (upsertErr) throw upsertErr;
      }

      message.success("Plan saved successfully");
      setDrawer({ open: false, student: null, planId: null, items: [] });
      loadStudentsAndTotals(classId);
    } catch (e) {
      console.error("Error saving plan:", e);
      message.error(e.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  // ---------- drawer helpers (shared) ----------
  const addItem = (setter) => {
    setter(prev => ({
      ...prev,
      items: [...prev.items, { component_type_id: null, amount_inr: 0 }]
    }));
  };
  const removeItem = (setter, index) => {
    setter(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };
  const updateItem = (state, setter, index, field, value) => {
    setter(prev => {
      const newItems = [...prev.items];

      if (field === "component_type_id" && value) {
        // prevent duplicate components
        const already = newItems.some((it, i) => i !== index && it.component_type_id === value);
        if (already) {
          message.warning("This component is already added.");
          return prev;
        }
      }

      newItems[index] = { ...newItems[index], [field]: value };

      // auto-set amount if component has default
      if (field === "component_type_id" && value) {
        const component = catalog.find(c => c.id === value);
        if (component?.default_amount_paise) {
          newItems[index].amount_inr = component.default_amount_paise / 100;
        }
      }
      return { ...prev, items: newItems };
    });
  };



  // ---------- CLASS PLAN (NEW) ----------
  const openClassEditor = () => {
    // Seed with components that have defaults, otherwise empty
    const defaults = (catalog || [])
      .filter(c => Number(c.default_amount_paise || 0) > 0)
      .map(c => ({ component_type_id: c.id, amount_inr: Number(c.default_amount_paise) / 100 }));

    setClassDrawer({
      open: true,
      items: defaults.length > 0 ? defaults : [{ component_type_id: null, amount_inr: 0 }]
    });
  };

  const applyClassPlanToAll = async () => {
    if (!classDrawer.items || classDrawer.items.length === 0) {
      message.warning("Add at least one component to apply.");
      return;
    }
    if (!classId) {
      message.error("Select a class first.");
      return;
    }
    if (!canWrite) {
      message.error("You don't have permission to modify fee plans.");
      return;
    }
    if (!activeYear) {
      message.error("No active academic year found. Please set up an active academic year first.");
      return;
    }

    const targetStudents = rows.map(r => ({ id: r.student_id, plan_id: r.plan_id })).filter(Boolean);
    if (rows.length === 0) {
      message.info("No students in this class. Nothing to apply.");
      return;
    }

    setSavingClass(true);
    try {
      // 1) Ensure plans exist for all students
      const missing = rows.filter(r => !r.plan_id).map(r => r.student_id);

      let newPlans = [];
      if (missing.length > 0) {
        const toInsert = missing.map(sid => ({
          school_code: me.school_code,
          student_id: sid,
          class_instance_id: classId,
          academic_year_id: activeYear.id,
          created_by: me.id
        }));
        // bulk insert (select ids back)
        const { data: inserted, error: insErr } = await supabase
          .from("fee_student_plans")
          .insert(toInsert)
          .select("id, student_id");
        if (insErr) throw insErr;
        newPlans = inserted || [];
      }

      // Build final plan_id list for all students
      const existingPlans = rows.filter(r => r.plan_id).map(r => ({ id: r.plan_id, student_id: r.student_id }));
      const allPlans = [...existingPlans, ...newPlans]; // [{id, student_id}]

      const planIds = allPlans.map(p => p.id);
      if (planIds.length === 0) {
        message.info("No plans to update.");
        return;
      }

      // 2) Delete existing items for these plans (chunked)
      for (const ids of chunk(planIds, 200)) {
        const { error: delErr } = await supabase
          .from("fee_student_plan_items")
          .delete()
          .in("plan_id", ids);
        if (delErr) throw delErr;
      }

      // 3) Insert new items for each plan (chunked)
      const baseItems = classDrawer.items.map(i => ({
        component_type_id: i.component_type_id,
        amount_paise: toPaise(parseINR(i.amount_inr))
      }));

      const allItems = [];
      for (const pid of planIds) {
        for (const bi of baseItems) {
          if (!bi.component_type_id) continue; // skip incomplete rows
          allItems.push({
            plan_id: pid,
            component_type_id: bi.component_type_id,
            amount_paise: bi.amount_paise
          });
        }
      }
      if (allItems.length === 0) {
        message.warning("Your class plan has no valid components.");
        return;
      }

      for (const batch of chunk(allItems, 800)) {
        const { error: insItemsErr } = await supabase
          .from("fee_student_plan_items")
          .insert(batch);
        if (insItemsErr) throw insItemsErr;
      }

      message.success(`Applied class plan to ${planIds.length} student${planIds.length > 1 ? "s" : ""}.`);
      setClassDrawer({ open: false, items: [] });
      // Reload to recalc totals
      await loadStudentsAndTotals(classId);
    } catch (e) {
      console.error("Error applying class plan:", e);
      message.error(e.message || "Failed to apply class plan");
    } finally {
      setSavingClass(false);
    }
  };

  // ---------- UI ----------
  const columns = [
    {
      title: "Student",
      key: "student",
      render: (_, record) => (
        <div>
          <div><strong>{record.student_name}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.student_code}</div>
        </div>
      )
    },
    {
      title: "Total Fee",
      key: "total",
      align: "right",
      render: (_, record) => (
        <Text strong>{fmtINR(record.total_paise)}</Text>
      )
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => openEditor(record)}
            disabled={!canWrite}
          >
            Edit Plan
          </Button>
        </Space>
      )
    }
  ];

  if (boot) {
    return (
      <Page title="Fee Management" loading={true}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '20px' }}>Loading...</div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Fee Management"
      extra={
        <Space>
          <Select
            placeholder="Select Class"
            value={classId}
            onChange={setClassId}
            style={{ width: 300 }}
            options={classes}
          />
          <Tooltip title="Edit one plan and apply it to every student in the selected class">
            <Button
              icon={<TeamOutlined />}
              type="primary"
              disabled={!classId || !canWrite}
              onClick={openClassEditor}
            >
              Class Plan
            </Button>
          </Tooltip>

        </Space>
      }
    >
      {rlsHint && (
        <Alert
          message="No students found"
          description="You may not have permission to view students in this class. Please contact your administrator."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={false}
          locale={{
            emptyText: (
              <EmptyState
                title="No students found"
                description={
                  classId
                    ? "No students are assigned to this class."
                    : "Please select a class to view students."
                }
              />
            )
          }}
        />
      </Card>

      {/* Student Drawer Editor */}
      <Drawer
        title={`Edit Fee Plan - ${drawer.student?.name ?? ""}`}
        open={drawer.open}
        onClose={() => setDrawer({ open: false, student: null, planId: null, items: [] })}
        width={600}
        footer={
          <Space>
            <Button onClick={() => setDrawer({ open: false, student: null, planId: null, items: [] })}>
              Cancel
            </Button>
            <Button type="primary" onClick={savePlan} loading={saving}>
              Save Plan
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="dashed" onClick={() => addItem(setDrawer)} block icon={<PlusOutlined />}>
            Add Component
          </Button>
        </div>

        {drawer.items.map((item, index) => (
          <Card key={index} size="small" style={{ marginBottom: 8 }}>
            <Row gutter={8} align="middle">
              <Col span={12}>
                <Select
                  placeholder="Select component"
                  value={item.component_type_id}
                  onChange={(value) => updateItem(drawer, setDrawer, index, 'component_type_id', value)}
                  style={{ width: '100%' }}
                  options={catalog.map(c => ({ value: c.id, label: c.name }))}
                  aria-label={`Component ${index + 1}`}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  placeholder="Amount"
                  value={item.amount_inr}
                  onChange={(value) => updateItem(drawer, setDrawer, index, 'amount_inr', parseINR(value))}
                  formatter={(value) => `₹ ${value ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => parseINR(value)}
                  style={{ width: '100%' }}
                  inputMode="decimal"
                  min={0}
                  aria-label={`Amount for component ${index + 1}`}
                />
              </Col>
              <Col span={4}>
                <Button
                  type="text"
                  danger
                  onClick={() => removeItem(setDrawer, index)}
                  disabled={drawer.items.length <= 1}
                >
                  Remove
                </Button>
              </Col>
            </Row>
          </Card>
        ))}

        {drawer.items.length === 0 && (
          <Empty description="No components added" />
        )}
      </Drawer>

      {/* Class Plan Drawer (NEW) */}
      <Drawer
        title={
          <Space>
            <TeamOutlined />
            <span>Class Plan — Apply to Entire Class</span>
          </Space>
        }
        open={classDrawer.open}
        onClose={() => setClassDrawer({ open: false, items: [] })}
        width={640}
        footer={
          <Space>
            <Button onClick={() => setClassDrawer({ open: false, items: [] })}>
              Cancel
            </Button>
            <Tooltip title="This will replace existing fee items for every student in this class.">
              <Button
                type="primary"
                onClick={applyClassPlanToAll}
                loading={savingClass}
                disabled={savingClass || classDrawer.items.length === 0}
                icon={<ExclamationCircleOutlined />}
              >
                Apply to Whole Class
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <Alert
          type="warning"
          showIcon
          message="Bulk update warning"
          description="Applying the class plan replaces each student's current fee items with the items below. Plans will be created for students who don't have one."
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Button type="dashed" onClick={() => addItem(setClassDrawer)} block icon={<PlusOutlined />}>
            Add Component
          </Button>
        </div>

        {classDrawer.items.map((item, index) => (
          <Card key={index} size="small" style={{ marginBottom: 8 }}>
            <Row gutter={8} align="middle">
              <Col span={12}>
                <Select
                  placeholder="Select component"
                  value={item.component_type_id}
                  onChange={(value) => updateItem(classDrawer, setClassDrawer, index, 'component_type_id', value)}
                  style={{ width: '100%' }}
                  options={catalog.map(c => ({ value: c.id, label: c.name }))}
                  aria-label={`Class component ${index + 1}`}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  placeholder="Amount"
                  value={item.amount_inr}
                  onChange={(value) => updateItem(classDrawer, setClassDrawer, index, 'amount_inr', parseINR(value))}
                  formatter={(value) => `₹ ${value ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => parseINR(value)}
                  style={{ width: '100%' }}
                  inputMode="decimal"
                  min={0}
                  aria-label={`Amount for class component ${index + 1}`}
                />
              </Col>
              <Col span={4}>
                <Button
                  type="text"
                  danger
                  onClick={() => removeItem(setClassDrawer, index)}
                  disabled={classDrawer.items.length <= 1}
                >
                  Remove
                </Button>
              </Col>
            </Row>
          </Card>
        ))}

        {classDrawer.items.length === 0 && (
          <Empty description="No components added" />
        )}

        <Divider />
        <Text type="secondary">
          Tip: Components with default amounts (if defined) are pre-loaded. You can still add, remove, or change them here.
        </Text>
      </Drawer>


      
    </Page>
  );
}
