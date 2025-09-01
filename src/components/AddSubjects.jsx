import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, message, Typography, Table, Popconfirm, Card, Select, Input, Space, Tag, Tooltip, Empty } from 'antd';
import { Trash2 } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';

const { Title, Text } = Typography;
const { Option } = Select;



// Normalizer mirroring subject_name_norm (lower + btrim + collapse spaces)
const normalize = (s = '') => s.trim().replace(/\s+/g, ' ').toLowerCase();

const AddSubjects = ({ canWrite: canWriteProp } = {}) => {
  const { user } = useAuth();
  const [form] = Form.useForm();

  const role = user?.app_metadata?.role;
  const schoolCode = user?.user_metadata?.school_code;
  // use auth.uid(); if no user, disallow writes
  const createdBy = user?.id || null;

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Prefer deriving write access from backend settings/RLS; fallback to role check.
  const canWrite = typeof canWriteProp === 'boolean' ? canWriteProp : role === 'superadmin';

  const fetchSubjects = async () => {
    if (!schoolCode) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .eq('school_code', schoolCode)
        .order('subject_name'); // sorted by name for UX

      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.error(err);
      message.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolCode]);

  const existingNormSet = useMemo(() => {
    const set = new Set();
    subjects.forEach((s) => set.add(normalize(s.subject_name)));
    return set;
  }, [subjects]);

  const handleDelete = async (subjectId) => {
    if (!canWrite) return message.error('Only superadmins can delete subjects.');
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
      if (error) throw error;
      message.success('Subject deleted');
      fetchSubjects();
    } catch (err) {
      console.error(err);
      message.error('Failed to delete subject');
    }
  };

  const onFinish = async ({ subject_names }) => {
    if (!canWrite) return message.error('Access denied. Only permitted roles can create subjects.');

    if (!createdBy) return message.error('Not signed in.');

    // Clean + de-dup within input
    const cleaned = (subject_names || [])
      .map((n) => n?.toString?.() ?? '')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const uniqueByNorm = Array.from(
      cleaned.reduce((map, name) => map.set(normalize(name), name), new Map())
      .values()
    );

    // Filter out subjects that already exist in this school
    const toInsert = uniqueByNorm
      .filter((name) => !existingNormSet.has(normalize(name)))
      .map((name) => ({ subject_name: name, school_code: schoolCode, created_by: createdBy }));

    if (toInsert.length === 0) {
      return message.warning('All entered subjects already exist for this school.');
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('subjects').insert(toInsert);
      if (error) throw error;
      message.success(`${toInsert.length} subject(s) created`);
      form.resetFields();
      fetchSubjects();
    } catch (err) {
      // Handle race-condition duplicate inserts gracefully
      const code = err?.code || err?.details || '';
      if (String(code).includes('23505')) {
        message.warning('Some subjects were duplicates and were skipped.');
        fetchSubjects();
      } else {
        console.error(err);
        message.error('Failed to create subjects');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = normalize(search);
    if (!q) return subjects;
    return subjects.filter((s) => normalize(s.subject_name).includes(q));
  }, [subjects, search]);

  const columns = [
    {
      title: 'Subject',
      dataIndex: 'subject_name',
      key: 'subject_name',
      sorter: (a, b) => a.subject_name.localeCompare(b.subject_name),
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          {/* Hook up to a separate syllabus page when available */}
          {/* <Button onClick={() => navigate(`/syllabus/${record.id}`)}>Manage Syllabus</Button> */}
          <Popconfirm
            title="Delete this subject?"
            okText="Yes"
            cancelText="No"
            placement="left"
            onConfirm={() => handleDelete(record.id)}
            disabled={!canWrite}
          >
            <Button type="text" danger icon={<Trash2 size={18} />} disabled={!canWrite} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        Subjects (School‑wide)
      </Title>
    {canWrite && (
      <Card
        style={{ marginBottom: 24 }}
        bodyStyle={{ padding: 16 }}
      >
      
            
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={!canWrite}
        >
          <Form.Item
            label={
              <Space>
                <Text strong>Add subjects</Text>
                <Tooltip title="Subjects are unique per school (case/space insensitive).">
                  <Tag color="blue">School scope</Tag>
                </Tooltip>
              </Space>
            }
            name="subject_names"
            rules={[{ required: true, message: 'Enter at least one subject' }]}
          >
            <Select
              mode="tags"
              placeholder="Type subjects, press Enter or , to add"
              tokenSeparators={[',']}
              open={false}
              dropdownStyle={{ display: 'none' }}
              notFoundContent={null}
              suffixIcon={null}
              listHeight={0}
            >
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Add Subjects
            </Button>
          </Form.Item>
        </Form>

      </Card>
    )}

      <Card
        title={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong>All subjects</Text>
            <Input.Search
              allowClear
              placeholder="Search subjects"
              onSearch={setSearch}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 260 }}
            />
          </Space>
        }
        bodyStyle={{ padding: 0 }}
      >
        {filteredSubjects.length === 0 && !loading ? (
          <div style={{ padding: 32 }}>
            <Empty description="No subjects yet" />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredSubjects}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        )}
      </Card>
    </div>
  );
};

export default AddSubjects;
