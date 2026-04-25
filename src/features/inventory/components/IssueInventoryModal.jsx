import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Form, Radio, Select, InputNumber, Input, Tag, Space, Typography,
  Alert, Divider, App, Spin, Switch,
} from 'antd';
import { UserOutlined, TeamOutlined, BarcodeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { inventoryIssuesService, inventoryRefService, inventoryBulkService } from '../services/inventoryService';

const { Text, Title } = Typography;

/**
 * Issue an inventory item — single recipient OR batch issuance to a class
 * (web-native enhancement). Mirror of mobile IssueInventoryModal plus a
 * "Batch issue to class" toggle.
 */
export default function IssueInventoryModal({
  open, onClose, schoolCode, userId, item, onIssued,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [issuedToType, setIssuedToType] = useState(
    item?.issue_to === 'both' ? 'student' : (item?.issue_to || 'student')
  );

  // Batch mode (web enhancement): issue to entire class at once
  const [batchMode, setBatchMode] = useState(false);
  const [batchResults, setBatchResults] = useState(null);

  // Reference data
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const selectedClassId = Form.useWatch('class_id', form);
  const selectedStudentIds = Form.useWatch('student_ids', form);
  const selectedStudentId = Form.useWatch('student_id', form);
  const selectedStaffId = Form.useWatch('staff_id', form);
  const quantity = Form.useWatch('quantity', form) ?? 1;
  const overrideAmount = Form.useWatch('charge_amount_override', form);
  const serialNumber = Form.useWatch('serial_number', form);

  useEffect(() => {
    if (!open || !item) return;
    setIssuedToType(item.issue_to === 'both' ? 'student' : (item.issue_to || 'student'));
    setBatchMode(false);
    setBatchResults(null);
    form.resetFields();
    form.setFieldsValue({ quantity: 1 });

    (async () => {
      try {
        setLoadingRef(true);
        const [cls, st] = await Promise.all([
          inventoryRefService.listClasses(schoolCode),
          inventoryRefService.listStaff(schoolCode),
        ]);
        setClasses(cls);
        setStaff(st);
      } catch (e) {
        message.error(e.message || 'Failed to load reference data');
      } finally {
        setLoadingRef(false);
      }
    })();
  }, [open, item, schoolCode, form, message]);

  // Load students when class changes
  useEffect(() => {
    if (!selectedClassId) { setStudents([]); return; }
    (async () => {
      try {
        setLoadingStudents(true);
        const list = await inventoryRefService.listStudentsByClass(schoolCode, selectedClassId);
        setStudents(list);
      } catch (e) {
        message.error(e.message || 'Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [selectedClassId, schoolCode, message]);

  const expectedReturnDate = useMemo(() => {
    if (!item?.must_be_returned || !item?.return_duration_days) return null;
    return dayjs().add(item.return_duration_days, 'day').format('DD MMM YYYY');
  }, [item]);

  const totalCharge = useMemo(() => {
    if (!item?.is_chargeable || !item?.charge_amount) return null;
    const qty = Number(quantity) || 1;
    const amt = overrideAmount != null && overrideAmount !== '' ? Number(overrideAmount) : Number(item.charge_amount);
    if (!amt) return null;
    if (batchMode && issuedToType === 'student') {
      return amt * qty * (selectedStudentIds?.length || 0);
    }
    return amt * qty;
  }, [item, quantity, overrideAmount, batchMode, selectedStudentIds, issuedToType]);

  const studentOptions = useMemo(
    () => students.map(s => ({
      label: `${s.full_name}${s.student_code ? ` (${s.student_code})` : ''}`,
      value: s.id,
    })),
    [students]
  );
  const staffOptions = useMemo(
    () => staff.map(s => ({
      label: `${s.full_name} — ${s.role}`,
      value: s.id,
    })),
    [staff]
  );
  const classOptions = useMemo(
    () => classes.map(c => ({ label: `Grade ${c.grade} – ${c.section}`, value: c.id })),
    [classes]
  );

  if (!item) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      setBatchResults(null);

      const baseQty = Number(values.quantity);
      const override = values.charge_amount_override != null && values.charge_amount_override !== ''
        ? Number(values.charge_amount_override) : undefined;

      if (item.track_serially && baseQty > 1) {
        message.error('Serial-tracked items can only be issued one at a time');
        return;
      }
      if (item.track_quantity && item.current_quantity != null) {
        // For batch mode this is per-recipient — capacity check is total
        const need = batchMode && issuedToType === 'student' ? baseQty * (values.student_ids?.length || 0) : baseQty;
        if (need > Number(item.current_quantity)) {
          message.error(`Insufficient stock. Available: ${item.current_quantity}, need: ${need}`);
          return;
        }
      }

      // ── Batch path
      if (batchMode && issuedToType === 'student') {
        if (!values.student_ids?.length) {
          message.error('Select at least one student');
          return;
        }
        const recipients = students
          .filter(s => values.student_ids.includes(s.id))
          .map(s => ({ id: s.id, name: s.full_name }));

        const results = await inventoryBulkService.batchIssue(schoolCode, userId, {
          inventory_item_id: item.id,
          issued_to_type: 'student',
          quantity: baseQty,
          charge_amount_override: override,
          recipients,
        });
        setBatchResults(results);
        const ok = results.filter(r => r.ok).length;
        const fail = results.length - ok;
        if (fail === 0) {
          message.success(`Issued to ${ok} students`);
          onIssued?.();
          onClose();
        } else {
          message.warning(`${ok} succeeded, ${fail} failed — see details below`);
          onIssued?.();
        }
        return;
      }

      // ── Single path
      const recipientId = issuedToType === 'student' ? values.student_id : values.staff_id;
      if (!recipientId) {
        message.error(issuedToType === 'student' ? 'Select a student' : 'Select a staff member');
        return;
      }

      await inventoryIssuesService.issue(schoolCode, userId, {
        inventory_item_id: item.id,
        issued_to_type: issuedToType,
        issued_to_id: recipientId,
        quantity: baseQty,
        serial_number: item.track_serially ? values.serial_number?.trim() : undefined,
        charge_amount_override: override,
      });
      message.success('Item issued');
      onIssued?.();
      onClose();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to issue item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={submitting ? 'Issuing…' : (batchMode ? 'Issue to all' : 'Issue Item')}
      confirmLoading={submitting}
      width={640}
      title="Issue Inventory Item"
      destroyOnClose
    >
      <Spin spinning={loadingRef}>
        {/* ── Item header ── */}
        <div style={{
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderLeft: '4px solid #6366f1', borderRadius: 8,
          padding: 12, marginBottom: 12,
        }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
            <div>
              <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
              <div>
                <Text type="secondary">
                  {item.category}
                  {item.track_quantity && item.current_quantity != null
                    ? ` · ${item.current_quantity} available`
                    : ''}
                  {item.is_chargeable && item.charge_amount != null
                    ? ` · ₹${item.charge_amount}${item.charge_type === 'deposit' ? ' deposit' : ''}`
                    : ''}
                </Text>
              </div>
            </div>
            {item.track_quantity && item.current_quantity != null && (
              <Tag color="blue">{item.current_quantity}</Tag>
            )}
          </Space>
        </div>

        <Form form={form} layout="vertical" requiredMark={false}>
          {/* Recipient type */}
          {item.issue_to === 'both' && (
            <Form.Item label="Issue To">
              <Radio.Group
                value={issuedToType}
                onChange={e => {
                  setIssuedToType(e.target.value);
                  form.resetFields(['student_id', 'student_ids', 'staff_id', 'class_id']);
                  setBatchMode(false);
                }}
                optionType="button"
                buttonStyle="solid"
                options={[
                  { label: <><UserOutlined /> Student</>, value: 'student' },
                  { label: <><TeamOutlined /> Staff</>, value: 'staff' },
                ]}
              />
            </Form.Item>
          )}

          {issuedToType === 'student' && (
            <>
              <Form.Item label="Batch issue to a whole class (web only)">
                <Switch
                  checked={batchMode}
                  onChange={v => {
                    setBatchMode(v);
                    form.resetFields(['student_id', 'student_ids']);
                  }}
                  disabled={item.track_serially}
                  checkedChildren="Batch"
                  unCheckedChildren="Single"
                />
                {item.track_serially && (
                  <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                    Disabled because this item has serial tracking
                  </Text>
                )}
              </Form.Item>

              <Form.Item
                label="Class"
                name="class_id"
                rules={[{ required: true, message: 'Select a class' }]}
              >
                <Select options={classOptions} placeholder="Pick a class" showSearch
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>

              {!batchMode ? (
                <Form.Item
                  label="Student"
                  name="student_id"
                  rules={[{ required: true, message: 'Select a student' }]}
                >
                  <Select
                    options={studentOptions}
                    placeholder={selectedClassId ? 'Select student' : 'Pick a class first'}
                    disabled={!selectedClassId}
                    loading={loadingStudents}
                    showSearch
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  label={`Students (${selectedStudentIds?.length || 0} selected)`}
                  name="student_ids"
                  rules={[{ required: true, message: 'Select at least one student' }]}
                >
                  <Select
                    mode="multiple"
                    options={studentOptions}
                    placeholder={selectedClassId ? 'Select students' : 'Pick a class first'}
                    disabled={!selectedClassId}
                    loading={loadingStudents}
                    showSearch
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                    maxTagCount="responsive"
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ padding: '0 8px 8px' }}>
                          <a onClick={() => form.setFieldsValue({ student_ids: students.map(s => s.id) })}>
                            Select all in class
                          </a>
                          {' · '}
                          <a onClick={() => form.setFieldsValue({ student_ids: [] })}>
                            Clear
                          </a>
                        </div>
                      </>
                    )}
                  />
                </Form.Item>
              )}
            </>
          )}

          {issuedToType === 'staff' && (
            <Form.Item
              label="Staff Member"
              name="staff_id"
              rules={[{ required: true, message: 'Select a staff member' }]}
            >
              <Select
                options={staffOptions}
                placeholder="Search by name or role"
                showSearch
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          )}

          <Divider style={{ margin: '12px 0' }} />

          <Form.Item
            label={item.track_serially ? 'Quantity (fixed at 1 — serial tracking)' : 'Quantity'}
            name="quantity"
            initialValue={1}
            rules={[{ required: true, message: 'Quantity required' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} disabled={item.track_serially} />
          </Form.Item>

          {item.track_serially && (
            <Form.Item
              label={<><BarcodeOutlined /> Serial Number</>}
              name="serial_number"
              rules={[{ required: true, message: 'Serial number required for serial-tracked items' }]}
            >
              <Input placeholder="e.g. LAPTOP-A12345" />
            </Form.Item>
          )}

          {item.is_chargeable && (
            <>
              <Form.Item
                label={`Per-unit charge${item.charge_type === 'deposit' ? ' (refundable deposit)' : ''}`}
                name="charge_amount_override"
                tooltip={item.allow_price_override ? 'Override the default charge for this issuance' : 'Price override not allowed for this item'}
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={String(item.charge_amount ?? 0)}
                  disabled={!item.allow_price_override}
                  prefix="₹"
                />
              </Form.Item>

              {totalCharge != null && totalCharge !== 0 && (
                <Alert
                  type="info"
                  showIcon
                  message={
                    <Space>
                      <Text strong>Total charge:</Text>
                      <Text>₹{totalCharge.toFixed(2)}</Text>
                      {item.auto_add_to_fees && issuedToType === 'student' && (
                        <Text type="secondary">
                          → auto-added to {batchMode ? 'each student\u2019s' : 'student\u2019s'} fee invoice
                        </Text>
                      )}
                    </Space>
                  }
                  style={{ marginBottom: 12 }}
                />
              )}
            </>
          )}

          {expectedReturnDate && (
            <Alert
              type="warning"
              showIcon
              message={`Expected return date: ${expectedReturnDate}`}
              style={{ marginBottom: 12 }}
            />
          )}

          {batchResults && (
            <Alert
              type={batchResults.every(r => r.ok) ? 'success' : 'warning'}
              showIcon
              message="Batch issue results"
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {batchResults.map(r => (
                    <li key={r.id}>
                      <Text>{r.name}: </Text>
                      {r.ok ? <Tag color="green">issued</Tag> : <Tag color="red">{r.error}</Tag>}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </Form>
      </Spin>
    </Modal>
  );
}
