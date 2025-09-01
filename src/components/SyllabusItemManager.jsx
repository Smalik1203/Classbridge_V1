import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Table,
  Tag,
  message,
  Modal,
  Popconfirm,
  Select,
  InputNumber,
  Alert
} from 'antd';
import {
  BookOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { supabase } from '../config/supabaseClient';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SyllabusItemManager = () => {
  const { user } = useAuth();
  const { school_code } = user.user_metadata || {};
  
  const [form] = Form.useForm();
  const [syllabi, setSyllabi] = useState([]);
  const [syllabusItems, setSyllabusItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedSyllabus, setSelectedSyllabus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (school_code) {
      fetchSyllabi();
    }
  }, [school_code]);

  const fetchSyllabi = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('syllabi')
        .select(`
          id,
          class_instance_id,
          subject_id,
          academic_year_id,
          class_instances!inner(grade, section),
          subjects!inner(subject_name),
          academic_years!inner(year_start, year_end)
        `)
        .eq('school_code', school_code)
        .order('class_instances.grade')
        .order('class_instances.section')
        .order('subjects.subject_name');
      
      if (error) {
        console.error('Error fetching syllabi:', error);
        setError('Failed to load syllabi: ' + error.message);
        return;
      }
      
      setSyllabi(data || []);
    } catch (error) {
      console.error('Error fetching syllabi:', error);
      setError('Failed to load syllabi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyllabusItems = async (syllabusId) => {
    if (!syllabusId) {
      setSyllabusItems([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('syllabus_items')
        .select('*')
        .eq('syllabus_id', syllabusId)
        .order('unit_no');
      
      if (error) {
        console.error('Error fetching syllabus items:', error);
        message.error('Failed to load syllabus items: ' + error.message);
        return;
      }
      
      setSyllabusItems(data || []);
    } catch (error) {
      console.error('Error fetching syllabus items:', error);
      message.error('Failed to load syllabus items: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const itemData = {
        syllabus_id: selectedSyllabus,
        unit_no: values.unit_no,
        title: values.title,
        description: values.description || null,
        status: values.status || 'pending',
        school_code: school_code,
        created_by: user.id
      };

      if (editingItem) {
        const { error } = await supabase
          .from('syllabus_items')
          .update(itemData)
          .eq('id', editingItem.id);
        
        if (error) {
          console.error('Error updating syllabus item:', error);
          message.error('Failed to update chapter: ' + error.message);
          return;
        }
        message.success('Chapter updated successfully');
      } else {
        const { error } = await supabase
          .from('syllabus_items')
          .insert(itemData);
        
        if (error) {
          console.error('Error creating syllabus item:', error);
          message.error('Failed to create chapter: ' + error.message);
          return;
        }
        message.success('Chapter created successfully');
      }

      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      fetchSyllabusItems(selectedSyllabus);
    } catch (error) {
      console.error('Error saving syllabus item:', error);
      message.error('Failed to save chapter: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      unit_no: record.unit_no,
      title: record.title,
      description: record.description,
      status: record.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('syllabus_items')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting syllabus item:', error);
        message.error('Failed to delete chapter: ' + error.message);
        return;
      }
      message.success('Chapter deleted successfully');
      fetchSyllabusItems(selectedSyllabus);
    } catch (error) {
      console.error('Error deleting syllabus item:', error);
      message.error('Failed to delete chapter: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'orange';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Unit',
      dataIndex: 'unit_no',
      key: 'unit_no',
      width: 80,
      render: (text) => <Text strong>#{text}</Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status?.replace('_', ' ') || 'Unknown'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this chapter?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <BookOutlined />
            <Title level={3} style={{ margin: 0 }}>
              Syllabus Chapter Management
            </Title>
          </Space>
        }
      >
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" onClick={fetchSyllabi}>
                Retry
              </Button>
            }
          />
        )}

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Syllabus Selector */}
          <div>
            <Text strong>Select Syllabus:</Text>
            <Select
              style={{ width: 400, marginLeft: 16 }}
              placeholder="Choose a class-subject combination"
              onChange={(value) => {
                setSelectedSyllabus(value);
                fetchSyllabusItems(value);
              }}
              loading={loading}
              options={syllabi.map(syl => ({
                value: syl.id,
                label: `Grade ${syl.class_instances.grade} - ${syl.class_instances.section} | ${syl.subjects.subject_name} (${syl.academic_years.year_start}-${syl.academic_years.year_end})`
              }))}
            />
          </div>

          {/* Syllabus Items Table */}
          {selectedSyllabus && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text strong>Chapters:</Text>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingItem(null);
                    form.resetFields();
                    setModalVisible(true);
                  }}
                >
                  Add Chapter
                </Button>
              </div>
              <Table
                columns={columns}
                dataSource={syllabusItems}
                rowKey="id"
                pagination={false}
                size="middle"
                loading={loading}
              />
            </div>
          )}
        </Space>
      </Card>

      <Modal
        title={editingItem ? 'Edit Chapter' : 'Add Chapter'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingItem(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="unit_no"
            label="Unit Number"
            rules={[{ required: true, message: 'Please enter unit number' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="e.g., 1"
              min={1}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="Chapter Title"
            rules={[{ required: true, message: 'Please enter chapter title' }]}
          >
            <Input placeholder="e.g., Introduction to Algebra" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description (optional)"
          >
            <TextArea
              placeholder="Brief description of the chapter content"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            initialValue="pending"
          >
            <Select
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' }
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
              >
                {editingItem ? 'Update' : 'Create'}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingItem(null);
                  form.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SyllabusItemManager;
