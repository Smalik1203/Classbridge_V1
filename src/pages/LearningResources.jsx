import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  message,
  Empty,
  Spin,
  Tabs,
  Progress,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import { 
  getLearningResources, 
  createLearningResource, 
  updateLearningResource, 
  deleteLearningResource 
} from '../services/resourceService';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const LearningResources = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [previewResource, setPreviewResource] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    resource_type: '',
    subject_id: '',
    class_instance_id: ''
  });

  const schoolCode = user?.user_metadata?.school_code;
  const userRole = user?.app_metadata?.role || 'student';

  const canEdit = ['superadmin', 'admin'].includes(userRole);

  useEffect(() => {
    if (schoolCode) {
      fetchResources();
    }
  }, [schoolCode, filters]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const result = await getLearningResources({
        school_code: schoolCode,
        ...filters,
        page: 1,
        limit: 50
      });
      setResources(result.data);
    } catch (error) {
      console.error('Error fetching resources:', error);
      message.error('Failed to fetch learning resources');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateResource = () => {
    setEditingResource(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditResource = (resource) => {
    setEditingResource(resource);
    form.setFieldsValue({
      title: resource.title,
      description: resource.description,
      resource_type: resource.resource_type,
      content_url: resource.content_url,
      class_instance_id: resource.class_instance_id,
      subject_id: resource.subject_id
    });
    setModalVisible(true);
  };

  const handleDeleteResource = async (resourceId) => {
    try {
      await deleteLearningResource(resourceId);
      message.success('Resource deleted successfully');
      fetchResources();
    } catch (error) {
      message.error('Failed to delete resource');
      console.error('Error deleting resource:', error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const resourceData = {
        ...values,
        school_code: schoolCode,
        uploaded_by: user.id
      };

      if (editingResource) {
        await updateLearningResource(editingResource.id, resourceData);
        message.success('Resource updated successfully');
      } else {
        await createLearningResource(resourceData);
        message.success('Resource created successfully');
      }

      setModalVisible(false);
      fetchResources();
    } catch (error) {
      message.error(editingResource ? 'Failed to update resource' : 'Failed to create resource');
      console.error('Error saving resource:', error);
    }
  };

  const handlePreview = (resource) => {
    setPreviewResource(resource);
    setPreviewVisible(true);
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'video':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      case 'pdf':
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case 'quiz':
        return <QuestionCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return <FileTextOutlined />;
    }
  };

  const getResourceTypeColor = (type) => {
    switch (type) {
      case 'video':
        return 'blue';
      case 'pdf':
        return 'green';
      case 'quiz':
        return 'orange';
      default:
        return 'default';
    }
  };

  const filteredResources = resources.filter(resource => {
    if (activeTab === 'all') return true;
    return resource.resource_type === activeTab;
  });

  const columns = [
    {
      title: 'Resource',
      key: 'resource',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getResourceIcon(record.resource_type)}
          <div>
            <Text strong>{record.title}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Text>
          </div>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'resource_type',
      key: 'resource_type',
      render: (type) => (
        <Tag color={getResourceTypeColor(type)}>
          {type.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Class',
      key: 'class',
      render: (_, record) => (
        record.class_instances ? 
          `Grade ${record.class_instances.grade} - ${record.class_instances.section}` : 
          'All Classes'
      )
    },
    {
      title: 'Subject',
      key: 'subject',
      render: (_, record) => (
        record.subjects ? record.subjects.subject_name : 'General'
      )
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString('en-IN')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          />
          {canEdit && (
            <>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEditResource(record)}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: 'Delete Resource',
                    content: 'Are you sure you want to delete this resource?',
                    onOk: () => handleDeleteResource(record.id)
                  });
                }}
              />
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: antdTheme.token.colorBgLayout, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, color: antdTheme.token.colorText }}>
          Learning Resources
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Manage and access educational content and materials
        </Text>
      </div>

      {/* Action Bar */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Select
              placeholder="Filter by Type"
              value={filters.resource_type}
              onChange={(value) => setFilters(prev => ({ ...prev, resource_type: value }))}
              style={{ width: 150 }}
              allowClear
            >
              <Option value="video">Videos</Option>
              <Option value="pdf">PDFs</Option>
              <Option value="quiz">Quizzes</Option>
            </Select>
          </Space>
          
          {canEdit && (
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateResource}
              >
                Add Resource
              </Button>
            </Space>
          )}
        </div>
      </Card>

      {/* Resource Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="All Resources" key="all">
            <Table
              columns={columns}
              dataSource={filteredResources}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} resources`
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No learning resources found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )
              }}
            />
          </TabPane>
          
          <TabPane tab="Videos" key="video">
            <Table
              columns={columns}
              dataSource={resources.filter(r => r.resource_type === 'video')}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane tab="PDFs" key="pdf">
            <Table
              columns={columns}
              dataSource={resources.filter(r => r.resource_type === 'pdf')}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane tab="Quizzes" key="quiz">
            <Table
              columns={columns}
              dataSource={resources.filter(r => r.resource_type === 'quiz')}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Create/Edit Resource Modal */}
      <Modal
        title={editingResource ? 'Edit Resource' : 'Add New Resource'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            resource_type: 'video'
          }}
        >
          <Form.Item
            name="title"
            label="Resource Title"
            rules={[{ required: true, message: 'Please enter resource title' }]}
          >
            <Input placeholder="Enter resource title" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={3}
              placeholder="Enter resource description"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="resource_type"
                label="Resource Type"
                rules={[{ required: true, message: 'Please select resource type' }]}
              >
                <Select placeholder="Select type">
                  <Option value="video">Video</Option>
                  <Option value="pdf">PDF Document</Option>
                  <Option value="quiz">Quiz</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="subject_id"
                label="Subject"
              >
                <Select placeholder="Select subject" allowClear>
                  {/* Subject options would be loaded from API */}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="content_url"
            label="Content URL"
            rules={[{ required: true, message: 'Please enter content URL' }]}
          >
            <Input placeholder="Enter URL or upload file" />
          </Form.Item>

          <Form.Item
            name="class_instance_id"
            label="Class (Optional)"
          >
            <Select placeholder="Select class" allowClear>
              {/* Class options would be loaded from API */}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingResource ? 'Update Resource' : 'Add Resource'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={previewResource?.title}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>
        ]}
        width="90%"
        style={{ top: 20 }}
      >
        {previewResource && (
          <div style={{ height: '70vh' }}>
            {previewResource.resource_type === 'video' && (
              <iframe
                src={previewResource.content_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={previewResource.title}
              />
            )}
            {previewResource.resource_type === 'pdf' && (
              <iframe
                src={previewResource.content_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={previewResource.title}
              />
            )}
            {previewResource.resource_type === 'quiz' && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <QuestionCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <Title level={4}>Quiz Preview</Title>
                <Text>Quiz functionality will be available soon</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LearningResources;