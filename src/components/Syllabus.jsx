import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Divider, Input, InputNumber, List, Select,
  Space, Typography, Popconfirm, Tooltip, Modal, Form, message, Skeleton
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';

const { Title, Text } = Typography;
const STATUS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function byText(field) {
  return (a, b) => String(a[field]).localeCompare(String(b[field]));
}

export default function SyllabusPage() {
  const [msg, ctx] = message.useMessage();

  // Query params
  const params = new URLSearchParams(window.location.search);
  const qpSubjectId = params.get('subjectId');
  const qpClassInstanceId = params.get('classInstanceId');

  // State
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [classInstances, setClassInstances] = useState([]);
  const [subjectId, setSubjectId] = useState(qpSubjectId || undefined);
  const [classInstanceId, setClassInstanceId] = useState(qpClassInstanceId || undefined);

  const [syllabus, setSyllabus] = useState(null);
  const [chapters, setChapters] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addForm] = Form.useForm();

  const canEdit = me?.role === 'admin' || me?.role === 'superadmin';

  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) throw new Error('Not signed in');
        const { data: meRow, error: meErr } = await supabase
          .from('users').select('id, role, school_code').eq('id', auth.user.id).single();
        if (meErr || !meRow) throw meErr ?? new Error('User profile not found');
        setMe(meRow);

        const [{ data: subs, error: subErr }, { data: cis, error: ciErr }] = await Promise.all([
          supabase.from('subjects').select('id, subject_name').order('subject_name'),
          supabase.from('class_instances').select('id, grade, section').order('grade').order('section'),
        ]);
        if (subErr) throw subErr;
        if (ciErr) throw ciErr;

        setSubjects(subs || []);
        setClassInstances(cis || []);
      } catch (e) {
        setError(e?.message || 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load syllabus + chapters
  useEffect(() => {
    if (!subjectId || !classInstanceId) {
      setSyllabus(null); setChapters([]); return;
    }
    (async () => {
      try {
        setBusy(true); setError(null);
        const { data: syl, error: se } = await supabase
          .from('syllabi')
          .select('id, subject_id, class_instance_id')
          .eq('subject_id', subjectId)
          .eq('class_instance_id', classInstanceId)
          .maybeSingle();
        if (se) throw se;
        if (!syl) { setSyllabus(null); setChapters([]); return; }
        setSyllabus(syl);

        const { data: its, error: ie } = await supabase
          .from('syllabus_items')
          .select('id, unit_no, title, status')
          .eq('syllabus_id', syl.id)
          .order('unit_no').order('title');
        if (ie) throw ie;
        setChapters(its || []);
      } catch (e) {
        setError(e?.message || 'Failed to load syllabus');
      } finally {
        setBusy(false);
      }
    })();
  }, [subjectId, classInstanceId]);

  const subjectOptions = useMemo(
    () => subjects.map(s => ({ label: s.subject_name, value: s.id })).sort(byText('label')),
    [subjects]
  );
  const classInstanceOptions = useMemo(
    () => classInstances.map(c => ({ label: `Grade ${c.grade ?? ''}${c.section ? '-' + c.section : ''}`, value: c.id })).sort(byText('label')),
    [classInstances]
  );

  // Create syllabus if missing
  const ensureSyllabus = async () => {
    if (!canEdit) return;
    if (!me?.school_code || !subjectId || !classInstanceId) return msg.error('Select Class & Subject first');
    try {
      setBusy(true);
      const { data, error } = await supabase
        .from('syllabi')
        .insert({ school_code: me.school_code, subject_id: subjectId, class_instance_id: classInstanceId, created_by: me.id })
        .select('id, subject_id, class_instance_id').single();
      if (error) {
        if (error.code === '23505') {
          const { data: exists } = await supabase
            .from('syllabi')
            .select('id, subject_id, class_instance_id')
            .eq('subject_id', subjectId).eq('class_instance_id', classInstanceId).single();
          setSyllabus(exists);
          msg.info('Syllabus already existed. Loaded it.');
        } else throw error;
      } else {
        setSyllabus(data); msg.success('Syllabus created');
      }
    } catch (e) { msg.error(e?.message || 'Failed to create syllabus'); }
    finally { setBusy(false); }
  };

  // Update chapter fields (optimistic)
  const updateChapter = async (id, patch) => {
    if (!id) return;
    setChapters(prev => prev.map(ch => ch.id === id ? { ...ch, ...patch } : ch)
      .sort((a,b)=>a.unit_no-b.unit_no||a.title.localeCompare(b.title)));
    try {
      const { error } = await supabase.from('syllabus_items').update(patch).eq('id', id);
      if (error) throw error;
    } catch (e) {
      msg.error(e?.message || 'Update failed');
      // reload this row
      try {
        const { data } = await supabase.from('syllabus_items').select('id, unit_no, title, status').eq('id', id).single();
        if (data) setChapters(prev => prev.map(ch => ch.id === id ? data : ch));
      } catch {}
    }
  };

  // Delete chapter
  const removeChapter = async (id) => {
    const before = chapters;
    setChapters(prev => prev.filter(c => c.id !== id));
    try {
      const { error } = await supabase.from('syllabus_items').delete().eq('id', id);
      if (error) throw error;
      msg.success('Deleted');
    } catch (e) { setChapters(before); msg.error(e?.message || 'Delete failed'); }
  };

  // Add chapter (modal, no blanks)
  const openAdd = () => { addForm.resetFields(); setAddOpen(true); };
  const submitAdd = async () => {
    try {
      const v = await addForm.validateFields(); // {unit_no,title,status}
      setAddBusy(true);
      const { data, error } = await supabase
        .from('syllabus_items')
        .insert({
          syllabus_id: syllabus.id,
          unit_no: Number(v.unit_no),
          title: v.title.trim(),
          status: v.status,
          created_by: me.id
        })
        .select('id, unit_no, title, status').single();
      if (error) throw error;
      setChapters(prev => [...prev, data].sort((a,b)=>a.unit_no-b.unit_no||a.title.localeCompare(b.title)));
      msg.success('Chapter added');
      setAddOpen(false);
    } catch (e) {
      if (!e?.errorFields) msg.error(e?.message || 'Failed to add');
    } finally { setAddBusy(false); }
  };

  return (
    <Card title={<Title level={4} style={{ margin: 0 }}>Syllabus</Title>}>
      {ctx}
      {error && <Alert type="error" showIcon message="Error" description={error} style={{ marginBottom: 12 }} />}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <div>
            <Text strong>Subject</Text><br />
            <Select style={{ width: 320 }} showSearch placeholder="Select subject"
              value={subjectId} onChange={setSubjectId}
              options={subjectOptions} optionFilterProp="label" />
          </div>
          <div>
            <Text strong>Class Instance</Text><br />
            <Select style={{ width: 320 }} showSearch placeholder="Select class instance"
              value={classInstanceId} onChange={setClassInstanceId}
              options={classInstanceOptions} optionFilterProp="label" />
          </div>
          {!syllabus && (
            <Tooltip title={!canEdit ? 'No edit permission' : 'Create syllabus for this Class × Subject'}>
              <span>
                <Button type="primary" icon={<PlusOutlined />} disabled={!canEdit || !subjectId || !classInstanceId || busy}
                  onClick={ensureSyllabus}>Create Syllabus</Button>
              </span>
            </Tooltip>
          )}
        </Space>

        {busy && !syllabus ? <Skeleton active paragraph={{ rows: 4 }} /> : null}

        {syllabus && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Title level={5} style={{ margin: 0 }}>Chapters</Title>
              <Button icon={<PlusOutlined />} onClick={openAdd} disabled={!canEdit}>Add Chapter</Button>
            </Space>

            {chapters.length === 0 ? (
              <Alert type="info" message="No chapters yet. Click 'Add Chapter'." />
            ) : (
              <List
                dataSource={chapters}
                rowKey="id"
                renderItem={(ch) => (
                  <List.Item
                    actions={[
                      <Popconfirm key="del" title="Remove this chapter?" onConfirm={() => removeChapter(ch.id)} okButtonProps={{ danger: true }}>
                        <Button danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ]}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space wrap>
                        <InputNumber
                          min={1} addonBefore="Chapter #"
                          value={ch.unit_no}
                          onChange={(v) => updateChapter(ch.id, { unit_no: Number(v || 1) })}
                          disabled={!canEdit}
                        />
                        <Select
                          style={{ width: 180 }}
                          value={ch.status}
                          onChange={(v) => updateChapter(ch.id, { status: v })}
                          options={STATUS}
                          disabled={!canEdit}
                        />
                      </Space>
                      <Input
                        placeholder="Chapter Name"
                        value={ch.title}
                        onChange={(e) => updateChapter(ch.id, { title: e.target.value })}
                        disabled={!canEdit}
                      />
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Space>

      {/* Add Chapter Modal */}
      <Modal title="Add Chapter" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submitAdd}
        okText="Add" confirmLoading={addBusy}>
        <Form form={addForm} layout="vertical" initialValues={{ status: 'pending' }}>
          <Form.Item label="Chapter #" name="unit_no" rules={[{ required: true, message: 'Enter chapter number' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Chapter Name" name="title" rules={[{ required: true, message: 'Enter chapter name' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select options={STATUS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
