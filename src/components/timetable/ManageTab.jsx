// src/components/timetable/ManageTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Typography, Space, Button, Popconfirm,
  message, Drawer, Form, Select, Input, InputNumber, Empty, Modal, DatePicker, Checkbox, Radio
} from 'antd';
import {
  ClockCircleOutlined, BookOutlined, TeamOutlined, EditOutlined,
  PlusCircleOutlined, DeleteOutlined, CopyOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../../config/supabaseClient';

const { Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = { pending: '#9CA3AF', in_progress: '#F59E0B', completed: '#16A34A' };
const DURATION_OPTIONS = [30, 35, 40, 45, 50, 60];

/* ---------- Time helpers ---------- */
function toMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(n => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}
function fromMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}:00`;
}
function overlap(a1, a2, b1, b2) { return Math.max(a1, b1) < Math.min(a2, b2); }

/**
 * parseWorkdayTime:
 * Accepts inputs like "930", "9:30", "9.30", "9a", "2p", "12p", "12a", "13", "1330"
 * Returns { ok: true, d: dayjs, hhmmss: "HH:mm:00" } OR { ok: false, msg }
 */
function parseWorkdayTime(raw) {
  if (raw == null) return { ok: false, msg: 'Time required' };
  let s = String(raw).trim().toLowerCase();
  if (!s) return { ok: false, msg: 'Time required' };

  // detect am/pm
  const hasAm = /a/.test(s);
  const hasPm = /p/.test(s);
  // keep digits
  const digits = (s.match(/\d+/g) || []).join('');
  if (!digits) return { ok: false, msg: 'Invalid time' };

  let h = 0, m = 0;
  if (digits.length <= 2) {
    // "9" or "09" -> 9:00
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    // "930" -> 9:30
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    // take last 2 as minutes, rest as hour: "1230" -> 12:30, "0830" -> 08:30
    const mm = digits.slice(-2);
    const hh = digits.slice(0, -2);
    h = parseInt(hh, 10);
    m = parseInt(mm, 10);
  }

  if (Number.isNaN(h) || Number.isNaN(m)) return { ok: false, msg: 'Invalid time' };
  if (m < 0 || m > 59) return { ok: false, msg: 'Minutes must be 00–59' };

  // 12h adjustment when am/pm present
  if (hasAm || hasPm) {
    h = h % 12; // 12 -> 0 first
    if (hasPm) h += 12; // 1p -> 13, 12p -> 12 (since h was 0 after % 12, then +12 = 12)
  }
  if (h < 0 || h > 23) return { ok: false, msg: 'Hour must be 0–23' };

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const hhmmss = `${hh}:${mm}:00`;
  const d = dayjs(hhmmss, 'HH:mm:ss', true);
  if (!d.isValid()) return { ok: false, msg: 'Invalid time' };
  return { ok: true, d, hhmmss };
}

/* A compact, mobile-friendly "workday" time input */
function SmartTimeInput({ value, onChange, placeholder = 'e.g., 930 / 2p', width = 140 }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      style={{ width }}
      allowClear
    />
  );
}

export default function ManageTab({
  classId,
  date,                    // dayjs
  subjects = [],
  admins = [],
  daySlots = [],           // timetable_slots for that date
  chaptersById = new Map(),
  refreshDay,              // () => void
}) {
  const [msg, ctx] = message.useMessage();
  const dateStr = useMemo(() => date.format('YYYY-MM-DD'), [date]);

  // me (for created_by/school_code)
  const [me, setMe] = useState(null);
  useEffect(() => { (async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    const { data } = await supabase.from('admin').select('id, school_code').eq('id', auth.user.id).single();
    if (data) setMe(data);
  })(); }, []);

  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || '—';
  const adminName = (id) => admins.find(a => a.id === id)?.full_name || '—';

  const rows = useMemo(() => {
    const safe = Array.isArray(daySlots) ? daySlots : [];
    return [...safe].sort((a, b) => {
      const as = a?.start_time || '';
      const bs = b?.start_time || '';
      return as > bs ? 1 : as < bs ? -1 : 0;
    }).map(r => ({ key: r.id, ...r }));
  }, [daySlots]);

  /** ---------- Drawer (Add/Edit) ---------- **/
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [duration, setDuration] = useState(40); // minutes

  // Smart time strings (workday text input)
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  // compute a good "next gap"
  const suggestNextTime = () => {
    const sorted = [...(daySlots || [])].sort((a,b) => (a.start_time > b.start_time ? 1 : -1));
    const last = sorted.filter(s => s.end_time).slice(-1)[0];
    const nowStart = last ? toMin(last.end_time) : toMin('09:00:00');
    const nowEnd = nowStart + duration;
    return { start: fromMin(nowStart), end: fromMin(nowEnd) };
  };

  const openAdd = (type) => {
    setEditing(null);
    form.resetFields();
    const nextNo = (daySlots.reduce((m, it) => Math.max(m, it.period_number || 0), 0) || 0) + 1;
    const s = suggestNextTime();
    setStartStr(s.start.slice(0,5)); // "HH:mm"
    setEndStr(s.end.slice(0,5));
    form.setFieldsValue({
      slot_type: type,
      period_number: nextNo,
      name: type === 'break' ? 'Break' : undefined,
      subject_id: undefined,
      teacher_id: undefined,
      syllabus_item_id: undefined,
      plan_text: '',
    });
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setStartStr(String(row.start_time || '').slice(0,5));
    setEndStr(String(row.end_time || '').slice(0,5));
    form.setFieldsValue({
      slot_type: row.slot_type || 'period',
      period_number: row.period_number,
      name: row.name || undefined,
      subject_id: row.subject_id || undefined,
      teacher_id: row.teacher_id || undefined,
      syllabus_item_id: row.syllabus_item_id || undefined,
      plan_text: row.plan_text || '',
    });
    setDrawerOpen(true);
  };

  // Chapters (subject dependent)
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chapterOptions, setChapterOptions] = useState([]);
  const loadChapterOptions = async (subject_id) => {
    try {
      setChaptersLoading(true);
      
      // First try to get existing syllabus
      let { data: syl } = await supabase
        .from('syllabi').select('id').eq('class_instance_id', classId).eq('subject_id', subject_id).maybeSingle();
      
      // If no syllabus exists, create one automatically
      if (!syl) {
        try {
          const { data: newSyl, error: sylError } = await supabase
            .from('syllabi')
            .insert({
              class_instance_id: classId,
              subject_id: subject_id,
              created_by: me?.id
            })
            .select('id')
            .single();
          
          if (sylError) {
            console.error('Error creating syllabus:', sylError);
            setChapterOptions([]);
            return;
          }
          
          syl = newSyl;
        } catch (error) {
          console.error('Error creating syllabus:', error);
          setChapterOptions([]);
          return;
        }
      }
      
      // Get syllabus items
      const { data: items } = await supabase
        .from('syllabus_items').select('id, unit_no, title, status')
        .eq('syllabus_id', syl.id).order('unit_no').order('title');
      
      setChapterOptions((items || []).map(ch => ({
        value: ch.id, label: `Chapter ${ch.unit_no}: ${ch.title}`, status: ch.status
      })));
    } finally { setChaptersLoading(false); }
  };

  // When duration or start changes, recompute end (like “workday” behavior)
  useEffect(() => {
    const p = parseWorkdayTime(startStr);
    if (p.ok) {
      const sMin = toMin(p.hhmmss);
      const e = fromMin(sMin + Number(duration || 0));
      setEndStr(e.slice(0,5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const onStartChange = (val) => {
    setStartStr(val);
    const p = parseWorkdayTime(val);
    if (p.ok) {
      const sMin = toMin(p.hhmmss);
      const e = fromMin(sMin + Number(duration || 0));
      setEndStr(e.slice(0,5));
    }
  };

  const clickUseNextGap = () => {
    const s = suggestNextTime();
    setStartStr(s.start.slice(0,5));
    setEndStr(s.end.slice(0,5));
  };

  const saveSlot = async () => {
    try {
      const v = await form.validateFields();

      // parse start/end strings
      const ps = parseWorkdayTime(startStr);
      const pe = parseWorkdayTime(endStr);
      if (!ps.ok) { msg.error(`Start: ${ps.msg}`); return; }
      if (!pe.ok) { msg.error(`End: ${pe.msg}`); return; }

      if (pe.d.valueOf() <= ps.d.valueOf()) {
        msg.error('End time must be after Start time');
        return;
      }

      // overlap check (same date/class)
      const ns = ps.hhmmss, ne = pe.hhmmss;
      const sMin = toMin(ns), eMin = toMin(ne);
      const currentId = editing?.id;
      for (const r of daySlots) {
        if (currentId && r.id === currentId) continue;
        if (overlap(sMin, eMin, toMin(r.start_time), toMin(r.end_time))) {
          msg.error('Time overlaps an existing slot');
          return;
        }
      }

      if (!me?.school_code || !me?.id) {
        msg.error('User context missing. Re-login.');
        return;
      }

      const payload = {
        school_code: me.school_code,
        class_instance_id: classId,
        class_date: dateStr,
        period_number: Number(v.period_number),
        slot_type: v.slot_type,
        name: v.slot_type === 'break' ? (v.name || 'Break') : null,
        start_time: ns,
        end_time: ne,
        subject_id: v.slot_type === 'period' ? v.subject_id : null,
        teacher_id: v.slot_type === 'period' ? v.teacher_id : null,
        syllabus_item_id: v.slot_type === 'period' ? (v.syllabus_item_id || null) : null,
        plan_text: v.slot_type === 'period' ? (v.plan_text || null) : null,
        status: 'planned',
        created_by: me.id,
      };

      setDrawerBusy(true);
      if (editing?.id) {
        const { error } = await supabase.from('timetable_slots').update(payload).eq('id', editing.id);
        if (error) throw error;
        msg.success('Updated');
      } else {
        const { error } = await supabase
          .from('timetable_slots')
          .upsert(payload, { onConflict: 'class_instance_id,class_date,period_number' });
        if (error) throw error;
        msg.success('Added');
      }
      setDrawerOpen(false);
      refreshDay?.();
    } catch (e) {
      if (e?.errorFields) return; // form validation errors already displayed
      msg.error(e?.message || 'Save failed');
    } finally { setDrawerBusy(false); }
  };

  const removeSlot = async (row) => {
    try {
      const { error } = await supabase.from('timetable_slots').delete().eq('id', row.id);
      if (error) throw error;
      message.success('Deleted');
      refreshDay?.();
    } catch (e) { message.error(e?.message || 'Delete failed'); }
  };

  /** ---------- Copy From Date ---------- **/
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyForm] = Form.useForm();

  const openCopy = () => {
    copyForm.resetFields();
    copyForm.setFieldsValue({
      source_date: date.clone().subtract(1, 'day'),
      include_breaks: true,
      include_lessons: true,
      mode: 'replace',
    });
    setCopyOpen(true);
  };

  const doCopy = async () => {
    try {
      const v = await copyForm.validateFields();
      const src = v.source_date?.format('YYYY-MM-DD');
      if (!src) { msg.error('Pick a source date'); return; }

      setCopyBusy(true);
      // 1) fetch source
      const { data: srcRows, error: sErr } = await supabase
        .from('timetable_slots')
        .select(`
          id, school_code, class_instance_id, class_date, period_number,
          slot_type, name, start_time, end_time,
          subject_id, teacher_id, syllabus_item_id, plan_text, status
        `)
        .eq('class_instance_id', classId)
        .eq('class_date', src)
        .order('start_time', { ascending: true });
      if (sErr) throw sErr;

      const rows = (srcRows || []).filter(r => {
        if (r.slot_type === 'break') return !!v.include_breaks;
        return !!v.include_lessons;
      });

      if (!rows.length) { msg.info('Nothing to copy from source date'); setCopyOpen(false); return; }

      if (v.mode === 'replace') {
        const { error: delErr } = await supabase
          .from('timetable_slots').delete()
          .eq('class_instance_id', classId).eq('class_date', dateStr);
        if (delErr) throw delErr;
      }

      // 2) upsert rows for target date
      const payloads = rows.map(r => ({
        school_code: me?.school_code || r.school_code,
        class_instance_id: classId,
        class_date: dateStr,
        period_number: r.period_number,
        slot_type: r.slot_type,
        name: r.slot_type === 'break' ? (r.name || 'Break') : null,
        start_time: r.start_time,
        end_time: r.end_time,
        subject_id: r.slot_type === 'period' ? r.subject_id : null,
        teacher_id: r.slot_type === 'period' ? r.teacher_id : null,
        syllabus_item_id: r.slot_type === 'period' ? r.syllabus_item_id : null,
        plan_text: r.slot_type === 'period' ? r.plan_text : null,
        status: r.status || 'planned',
        created_by: me?.id || r.created_by || null,
      }));

      const { error: upErr } = await supabase
        .from('timetable_slots')
        .upsert(payloads, { onConflict: 'class_instance_id,class_date,period_number' });
      if (upErr) throw upErr;

      msg.success(`Copied ${payloads.length} slot(s)`);
      setCopyOpen(false);
      refreshDay?.();
    } catch (e) {
      if (e?.errorFields) return;
      msg.error(e?.message || 'Copy failed');
    } finally { setCopyBusy(false); }
  };

  /** ---------- Columns ---------- **/
  const columns = [
    {
      title: 'Slot', key: 'slot', width: 180,
      render: (_, r) => {
        if (r.slot_type === 'break') {
          return <Tag color="gold">{r.name || 'Break'}</Tag>;
        }
        return <Text strong>Period #{r.period_number}</Text>;
      }
    },
    {
      title: 'Time', key: 'time', width: 160,
      render: (_, r) => (<Space size={6}><ClockCircleOutlined /><span>{String(r.start_time).slice(0,5)}–{String(r.end_time).slice(0,5)}</span></Space>)
    },
    {
      title: 'Subject', key: 'subject', width: 220,
      render: (_, r) => r.slot_type === 'period'
        ? (r.subject_id ? <Space size={6}><BookOutlined /><span>{subjectName(r.subject_id)}</span></Space> : <Tag>Unassigned</Tag>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Teacher', key: 'teacher', width: 220,
      render: (_, r) => r.slot_type === 'period'
        ? (r.teacher_id ? <Space size={6}><TeamOutlined /><span>{adminName(r.teacher_id)}</span></Space> : <Text type="secondary">—</Text>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Chapter', key: 'chapter', width: 360,
      render: (_, r) => {
        if (r.slot_type === 'break') return <Text type="secondary">—</Text>;
        const chId = r.syllabus_item_id;
        if (!chId) return <Text type="secondary">—</Text>;
        const ch = chaptersById.get(chId);
        if (!ch) return <Text type="secondary">Chapter selected</Text>;
        const color = STATUS_COLOR[ch.status || 'pending'];
        return (
          <Space>
            <span style={{ width:8, height:8, borderRadius:'50%', background: color }} />
            <span>Chapter {ch.unit_no}: {ch.title}</span>
          </Space>
        );
      }
    },
    {
      title: 'Description', key: 'desc', width: 360,
      render: (_, r) => r.slot_type === 'period'
        ? (r.plan_text ? r.plan_text : <Text type="secondary">—</Text>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Actions', key: 'actions', width: 140,
      render: (_, r) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete slot?" onConfirm={() => removeSlot(r)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return classId ? (
    <>
      {ctx}
      <Card
        title="Manage (Date-Based)"
        extra={
          <Space wrap>
            <Button icon={<CopyOutlined />} onClick={openCopy}>Copy From…</Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => openAdd('period')}>Quick Add Period</Button>
            <Button icon={<PlusCircleOutlined />} onClick={() => openAdd('break')}>Add Break</Button>
          </Space>
        }
        style={{ marginTop: 8 }}
      >
        <Table
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          bordered
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="No slots yet for this date" /> }}
        />
      </Card>

      {/* Compact Drawer for Add/Edit */}
      <Drawer
        title={editing
          ? (editing.slot_type === 'break'
              ? `Edit Break • ${String(editing.start_time).slice(0,5)}–${String(editing.end_time).slice(0,5)}`
              : `Edit Period #${editing.period_number}`)
          : 'Add Slot'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={Math.min(480, Math.floor(window.innerWidth * 0.96))}
        destroyOnClose
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={drawerBusy} onClick={saveSlot}>Save</Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ slot_type: 'period', period_number: 1 }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Form.Item label="Type" name="slot_type" rules={[{ required: true }]} style={{ minWidth: 180 }}>
                <Select
                  options={[{ value: 'period', label: 'Period' }, { value: 'break', label: 'Break' }]}
                  onChange={() => {
                    // clear fields when switching types
                    form.setFieldsValue({ subject_id: undefined, teacher_id: undefined, syllabus_item_id: undefined, plan_text: '' });
                  }}
                />
              </Form.Item>
              <Form.Item label="Period #" name="period_number" rules={[{ required: true, message: 'Enter period number' }]} style={{ minWidth: 180 }}>
                <InputNumber min={1} style={{ width: 140 }} />
              </Form.Item>
            </Space>

            {/* Time row: Start | Duration | End + Quick Next (Workday inputs) */}
            <Space wrap align="end">
              <Form.Item label="Start" required style={{ minWidth: 180 }}>
                <SmartTimeInput value={startStr} onChange={onStartChange} placeholder="e.g., 930 / 2p" />
              </Form.Item>
              <Form.Item label="Duration (min)" style={{ minWidth: 160 }}>
                <Select
                  style={{ width: 140 }}
                  value={duration}
                  onChange={(v) => setDuration(v)}
                  options={DURATION_OPTIONS.map(x => ({ value: x, label: `${x}` }))}
                />
              </Form.Item>
              <Form.Item label="End" required style={{ minWidth: 180 }}>
                <SmartTimeInput value={endStr} onChange={setEndStr} placeholder="auto or edit" />
              </Form.Item>
              <Button onClick={clickUseNextGap}>Use next gap</Button>
            </Space>

            {/* Break-only */}
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('slot_type') === 'break' ? (
                  <Form.Item label="Break Name" name="name" rules={[{ required: true, message: 'Enter break name' }]}>
                    <Input placeholder="e.g., Lunch" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>

            {/* Period-only */}
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) =>
                getFieldValue('slot_type') === 'period' ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Form.Item label="Subject" name="subject_id" rules={[{ required: true, message: 'Select a subject' }]}>
                      <Select
                        showSearch placeholder="Select subject"
                        options={(subjects || []).map(s => ({ label: s.subject_name, value: s.id }))}
                        optionFilterProp="label"
                        onChange={async (sid) => {
                          form.setFieldValue('syllabus_item_id', undefined);
                          await loadChapterOptions(sid);
                        }}
                      />
                    </Form.Item>
                    <Form.Item label="Admin" name="teacher_id" rules={[{ required: true, message: 'Select an admin' }]}>
                                              <Select
                          showSearch placeholder="Select admin"
                                                  options={(admins || []).map(a => ({ label: a.full_name, value: a.id }))}
                        optionFilterProp="label"
                      />
                    </Form.Item>
                    <Form.Item label="Chapter (optional)" name="syllabus_item_id">
                      <Select
                        showSearch placeholder="Select chapter"
                        options={chapterOptions}
                        loading={chaptersLoading}
                        optionFilterProp="label"
                        notFoundContent="No chapters. Create in Syllabus."
                      />
                    </Form.Item>
                    <Form.Item label="Description" name="plan_text">
                      <TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder="Notes for this period" />
                    </Form.Item>
                  </Space>
                ) : null
              }
            </Form.Item>
          </Space>
        </Form>
      </Drawer>

      {/* Copy From Date modal */}
      <Modal
        title="Copy Timetable From Date"
        open={copyOpen}
        onCancel={() => setCopyOpen(false)}
        onOk={doCopy}
        okText="Copy"
        confirmLoading={copyBusy}
      >
        <Form
          form={copyForm}
          layout="vertical"
          initialValues={{ include_breaks: true, include_lessons: true, mode: 'replace' }}
        >
          <Form.Item label="Source date" name="source_date" rules={[{ required: true, message: 'Pick a date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="What to copy">
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical">
                <Form.Item name="include_lessons" valuePropName="checked" noStyle>
                  <Checkbox>Lessons (subject/teacher/chapter/description)</Checkbox>
                </Form.Item>
                <Form.Item name="include_breaks" valuePropName="checked" noStyle>
                  <Checkbox>Breaks</Checkbox>
                </Form.Item>
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item label="Conflict handling" name="mode">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="replace">Replace current day (clear then copy)</Radio>
                <Radio value="merge">Merge (update/insert by period number)</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  ) : (
    <Card style={{ marginTop: 12 }}><Text type="secondary">Select a class to manage this date.</Text></Card>
  );
}
