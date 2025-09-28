import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Row, 
  Col, 
  Card, 
  Typography, 
  Button, 
  Space, 
  Input, 
  Select, 
  Tabs, 
  Pagination,
  Modal,
  Form,
  message,
  Empty,
  Spin,
  Tag,
  Tooltip
} from 'antd';
import {
  PlusOutlined, 
  SearchOutlined, 
  FilterOutlined,
  BookOutlined,
  PlayCircleOutlined,
  FilePdfOutlined,
  QuestionCircleOutlined,
  UploadOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  SortAscendingOutlined,
  RightOutlined,
  LinkOutlined,
  DownloadOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { getSchoolCode, getUserRole, getStudentCode } from '../utils/metadata';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabaseClient';
import { 
  getLearningResources, 
  getStudentResources, 
  createLearningResource, 
  updateLearningResource, 
  deleteLearningResource 
} from '../services/resourceService';
import VideoResource from '../components/resources/VideoResource';
import PDFResource from '../components/resources/PDFResource';
import QuizResource from '../components/resources/QuizResource';
import ErrorBoundary from '../components/ErrorBoundary';
import ClassDetailView from '../components/ClassDetailView';
import SubjectFilter from '../components/SubjectFilter';
import VideoPlayer from '../components/VideoPlayer';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
// Removed TabPane - using items prop in Tabs component

const LearningResources = () => {
  // Configuration
  const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'Lms';
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const [form] = Form.useForm();

  // State management
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [error, setError] = useState(null);
  
  // Filters and search
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'popular', 'alphabetical'
  const [subjectStats, setSubjectStats] = useState({}); // { [subjectId]: { video, pdf, quiz, total } }
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // In-app preview modal state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewResource, setPreviewResource] = useState(null);
  // (Removed Google Docs URL normalization to revert behavior)
  
  // User context
  const userRole = getUserRole(user);
  const isStudent = userRole === 'student';
  const canEdit = userRole === 'superadmin' || userRole === 'admin';

  // Real data from database
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  // Load subjects from database
  const loadSubjects = async () => {
    try {
      setSubjectsLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .eq('school_code', getSchoolCode(user))
        .order('subject_name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
      message.error('Failed to load subjects');
    } finally {
      setSubjectsLoading(false);
    }
  };

  // Load classes from database
  const loadClasses = async () => {
    try {
      setClassesLoading(true);
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section, school_code, academic_year_id')
        .eq('school_code', getSchoolCode(user))
        .order('grade')
        .order('section');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error);
      message.error('Failed to load classes');
    } finally {
      setClassesLoading(false);
    }
  };

  // Build lightweight stats per subject for chapter cards/sidebar
  const loadSubjectStats = async () => {
    try {
      if (!getSchoolCode(user)) return;
      let query = supabase
        .from('learning_resources')
        .select('subject_id, resource_type')
        .eq('school_code', getSchoolCode(user));
      if (selectedClass !== 'all') {
        query = query.eq('class_instance_id', selectedClass);
      }
      const { data, error } = await query;
      if (error) throw error;
      const statsMap = {};
      (data || []).forEach((r) => {
        if (!r.subject_id) return;
        if (!statsMap[r.subject_id]) {
          statsMap[r.subject_id] = { video: 0, pdf: 0, quiz: 0, total: 0 };
        }
        if (r.resource_type === 'video') statsMap[r.subject_id].video += 1;
        if (r.resource_type === 'pdf') statsMap[r.subject_id].pdf += 1;
        if (r.resource_type === 'quiz') statsMap[r.subject_id].quiz += 1;
        statsMap[r.subject_id].total += 1;
      });
      setSubjectStats(statsMap);
    } catch (error) {
      console.error('Error loading subject stats:', error);
    }
  };

  // Determine student's class and lock filters
  const loadStudentClass = async () => {
    try {
      if (!isStudent || !user) return;
      const schoolCode = getSchoolCode(user);
      if (!schoolCode) return;
      const studentCode = getStudentCode(user);
      let base = supabase.from('student').select('class_instance_id, school_code, student_code, email').eq('school_code', schoolCode);
      const { data, error } = await (studentCode
        ? base.eq('student_code', studentCode)
        : base.eq('email', user.email)).maybeSingle();
      if (error) throw error;
      if (data?.class_instance_id) {
        setSelectedClass(data.class_instance_id);
      }
    } catch (err) {
      console.error('Error determining student class:', err);
    }
  };


  // Academic years are already linked to class_instances, no need to load separately

  // Load resources
  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is available
      if (!user) {
        console.warn('User not available for loading resources');
        setError('User not authenticated');
        return;
      }

      const schoolCode = getSchoolCode(user);
      if (!schoolCode) {
        setError('School information not found');
        return;
      }

      console.log('Loading resources for user:', user);

      const filters = {
        page: currentPage,
        limit: pageSize,
        search: searchText || undefined,
        resource_type: selectedType !== 'all' ? selectedType : undefined,
        subject_id: selectedSubject !== 'all' ? selectedSubject : undefined,
        class_instance_id: selectedClass !== 'all' ? selectedClass : undefined,
        school_code: schoolCode,
      };

      console.log('Filters:', filters);

      let result;
      if (isStudent) {
        result = await getStudentResources(user.id, filters);
      } else {
        result = await getLearningResources(filters);
      }

      console.log('Resources loaded:', result);
      setResources(result?.data || []);
      setTotalCount(result?.count || 0);
    } catch (error) {
      console.error('Error loading resources:', error);
      setError(error.message || 'Failed to load resources');
      setResources([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSubjects();
      loadClasses();
      loadStudentClass();
      loadSubjectStats();
      loadResources();
    }
  }, [user]);

  useEffect(() => {
    loadResources();
    loadSubjectStats();
  }, [currentPage, pageSize, searchText, selectedType, selectedSubject, selectedClass]);

  // (Removed Google Docs access check to revert behavior)

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'type':
        setSelectedType(value);
        break;
      case 'subject':
        setSelectedSubject(value);
        break;
      case 'class':
        setSelectedClass(value);
        break;
    }
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  // Handle resource creation/editing
  const handleSubmit = async (values) => {
    try {
      setUploading(true);
      
      console.log('Form values:', values);
      console.log('User data:', user);
      
      // Validate required fields
      const schoolCode = getSchoolCode(user);
      if (!schoolCode) {
        message.error('User school information not found. Please contact administrator.');
        return;
      }
      
      if (!values.subject_id || !values.class_instance_id) {
        message.error('Please select both subject and class');
        return;
      }

      // Get academic_year_id from the selected class_instance
      const selectedClass = classes.find(cls => cls.id === values.class_instance_id);
      const academicYearId = selectedClass?.academic_year_id;
      
      // If file upload is selected, upload to Supabase Storage first
      let contentUrl = values.content_url;
      if (useFileUpload && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${schoolCode}/${values.class_instance_id}/${values.subject_id}/${Date.now()}.${fileExt}`;
        const bucket = STORAGE_BUCKET;

        const { error: uploadError } = await supabase
          .storage
          .from(bucket)
          .upload(filePath, selectedFile, { upsert: true, cacheControl: '3600', contentType: selectedFile.type });
        if (uploadError) {
          // Provide a clearer message for missing bucket
          if ((uploadError.message || '').toLowerCase().includes('not found')) {
            throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase (Storage → Buckets) and try again.`);
          }
          throw uploadError;
        }

        const { data: publicUrlData } = supabase
          .storage
          .from(bucket)
          .getPublicUrl(filePath);
        contentUrl = publicUrlData?.publicUrl || contentUrl;
      }

      // (Reverted) Do not rewrite Google Docs links; save as provided

      const resourceData = {
        title: values.title,
        description: values.description,
        resource_type: values.resource_type,
        content_url: contentUrl,
        school_code: getSchoolCode(user),
        subject_id: values.subject_id,
        class_instance_id: values.class_instance_id,
        uploaded_by: user.id
      };

      console.log('Resource data to be saved:', resourceData);

      if (editingResource) {
        await updateLearningResource(editingResource.id, resourceData);
        message.success('Resource updated successfully');
      } else {
        await createLearningResource(resourceData);
        message.success('Resource created successfully');
      }

      setModalVisible(false);
      setEditingResource(null);
      form.resetFields();
      setUseFileUpload(false);
      setSelectedFile(null);
      loadResources();
    } catch (error) {
      console.error('Error saving resource:', error);
      message.error(`Failed to save resource: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle resource deletion
  const handleDelete = async (resourceId) => {
    Modal.confirm({
      title: 'Delete Resource',
      content: 'Are you sure you want to delete this resource? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteLearningResource(resourceId);
          message.success('Resource deleted successfully');
          loadResources();
        } catch (error) {
          console.error('Error deleting resource:', error);
          message.error('Failed to delete resource');
        }
      }
    });
  };

  // Handle edit
  const handleEdit = (resource) => {
    setEditingResource(resource);
    form.setFieldsValue({
      title: resource.title,
      description: resource.description,
      resource_type: resource.resource_type,
      subject_id: resource.subject_id,
      class_instance_id: resource.class_instance_id,
      content_url: resource.content_url
    });
    setModalVisible(true);
  };

  // Render resource card based on type
  const renderResourceCard = (resource) => {
    if (!resource || !resource.id) {
      console.warn('Invalid resource data:', resource);
      return null;
    }

    const commonProps = {
      resource,
      canEdit,
      onEdit: () => handleEdit(resource),
      onDelete: () => handleDelete(resource.id)
    };

    switch (resource.resource_type) {
      case 'video':
        console.log('Rendering VideoResource for:', resource);
        return <VideoResource key={resource.id} {...commonProps} />;
      case 'pdf':
        return <PDFResource key={resource.id} {...commonProps} />;
      case 'quiz':
        return <QuizResource key={resource.id} {...commonProps} />;
      default:
        console.warn('Unknown resource type:', resource.resource_type);
        return null;
    }
  };

  // Handle primary action for list view
  const handlePrimaryAction = (resource) => {
    switch (resource.resource_type) {
      case 'video':
        // Open in-app preview modal
        setPreviewResource(resource);
        setPreviewVisible(true);
        break;
      case 'pdf':
        // Open in-app preview modal
        setPreviewResource(resource);
        setPreviewVisible(true);
        break;
      case 'quiz':
        // For quizzes, we could trigger a quiz modal here
        // For now, just open the content URL
        window.open(resource.content_url, '_blank');
        break;
      default:
        window.open(resource.content_url, '_blank');
    }
  };

  // Helpers for preview modal
  const isDirectVideoSource = (url) => {
    if (!url) return false;
    const videoExt = /(\.mp4|\.webm|\.ogg|\.ogv|\.mov|\.m4v)(\?|$)/i;
    return videoExt.test(url);
  };

  // Render resource list item for compact view
  const renderResourceListItem = (resource) => {
    if (!resource || !resource.id) return null;

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const onRowPrimary = () => handlePrimaryAction(resource);

    return (
      <Card
        key={resource.id}
        size="small"
        hoverable
        onClick={onRowPrimary}
        style={{ 
          marginBottom: 12, 
          cursor: 'pointer',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
        bodyStyle={{ padding: 16 }}
        className="resource-row"
      >
        <Row align="middle" gutter={16}>
          {/* Left: Thumbnail */}
          <Col flex="none">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: resource.resource_type === 'video' ? '#F3F0FF' : 
                                resource.resource_type === 'pdf' ? '#EFF6FF' : '#FFFBEB',
                border: `2px solid ${resource.resource_type === 'video' ? '#DDD6FE' : 
                                   resource.resource_type === 'pdf' ? '#BFDBFE' : '#FDE68A'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  color: resource.resource_type === 'video' ? '#8B5CF6' : 
                         resource.resource_type === 'pdf' ? '#3B82F6' : '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {resource.resource_type === 'video' ? <PlayCircleOutlined /> :
                 resource.resource_type === 'pdf' ? <FilePdfOutlined /> : <QuestionCircleOutlined />}
              </div>
            </div>
          </Col>
          
          {/* Middle: Content */}
          <Col flex="auto" style={{ minWidth: 0 }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Tooltip title={resource.title}>
                <Title level={5} style={{ 
                  margin: 0, 
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#1F2937',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {resource.title}
                </Title>
              </Tooltip>
              {resource.description && (
                <Tooltip title={resource.description}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#6B7280',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '18px'
                    }}
                  >
                    {resource.description}
                  </Text>
                </Tooltip>
              )}
              <Text type="secondary" style={{ fontSize: 11, color: '#9CA3AF' }}>
                {resource.class_instances ? `Grade ${resource.class_instances.grade}${resource.class_instances.section ? ' - ' + resource.class_instances.section : ''}` : ''}
                {resource.class_instances ? ' • ' : ''}
                {formatDate(resource.created_at)}
              </Text>
            </Space>
          </Col>
          
          {/* Right: Actions */}
          <Col flex="none">
            <Space size={8} align="center">
              {/* Type Badge */}
              <div
                style={{
                  backgroundColor: resource.resource_type === 'video' ? '#F3F0FF' : 
                                  resource.resource_type === 'pdf' ? '#EFF6FF' : '#FFFBEB',
                  color: resource.resource_type === 'video' ? '#8B5CF6' : 
                         resource.resource_type === 'pdf' ? '#3B82F6' : '#F59E0B',
                  border: `1px solid ${resource.resource_type === 'video' ? '#DDD6FE' : 
                                   resource.resource_type === 'pdf' ? '#BFDBFE' : '#FDE68A'}`,
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  height: 18,
                  lineHeight: '14px',
                  margin: 0
                }}
              >
                {resource.resource_type.toUpperCase()}
              </div>
              
              {/* Action Buttons */}
              {canEdit && (
                <Space size={4}>
                  <Tooltip title="Edit">
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<EditOutlined />} 
                      onClick={(e) => { e.stopPropagation(); handleEdit(resource); }}
                      style={{ color: '#6B7280', padding: '4px' }}
                    />
                  </Tooltip>
                  <Tooltip title="Delete">
                    <Button 
                      type="text" 
                      size="small" 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={(e) => { e.stopPropagation(); handleDelete(resource.id); }}
                      style={{ padding: '4px' }}
                    />
                  </Tooltip>
                </Space>
              )}
              <Button 
                type="primary" 
                size="small"
                onClick={(e) => { e.stopPropagation(); handlePrimaryAction(resource); }}
                style={{ 
                  fontWeight: 500,
                  minWidth: 70,
                  height: 28
                }}
              >
                {resource.resource_type === 'video' ? 'Watch' : 
                 resource.resource_type === 'pdf' ? 'Read' : 'Attempt'}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  // Get resources by type for tabs
  const getResourcesByType = (type) => {
    if (!Array.isArray(resources)) return [];
    if (type === 'all') return resources;
    return resources.filter(resource => resource?.resource_type === type);
  };

  // Handle tab change and sync with filters
  const handleTabChange = (activeKey) => {
    setSelectedType(activeKey);
    setCurrentPage(1);
  };

  // Sort resources based on selected sort option
  const getSortedResources = (resourceList) => {
    if (!Array.isArray(resourceList)) return [];
    
    const sorted = [...resourceList];
    switch (sortBy) {
      case 'alphabetical':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'popular':
        // For now, sort by creation date (newest first)
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'recent':
      default:
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  };

  // Resource type icons
  const getResourceTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return <PlayCircleOutlined />;
      case 'pdf':
        return <FilePdfOutlined />;
      case 'quiz':
        return <QuestionCircleOutlined />;
      default:
        return <BookOutlined />;
    }
  };

  // Lightweight hover style via inline <style> tag to avoid global CSS edits
  const RowHoverStyle = () => (
    <style>
      {`
        .resource-row:hover { 
          background: #f8fafc !important; 
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          transform: translateY(-1px);
        }
        .resource-row {
          transition: all 0.2s ease;
        }
      `}
    </style>
  );

  // Resource type colors
  const getResourceTypeColor = (type) => {
    switch (type) {
      case 'video':
        return 'red';
      case 'pdf':
        return 'red';
      case 'quiz':
        return 'purple';
      default:
        return 'blue';
    }
  };

  // Handler functions for components
  const handleClassChange = (classId) => {
    handleFilterChange('class', classId);
  };

  return (
    <ErrorBoundary>
      <Content style={{ 
        padding: antdTheme.token.paddingLG, 
        background: antdTheme.token.colorBgLayout, 
        minHeight: '100vh' 
      }}>
      <RowHoverStyle />
      {/* Header Section */}
      <div style={{ marginBottom: antdTheme.token.marginLG }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ 
              margin: 0, 
              color: antdTheme.token.colorTextHeading, 
              fontWeight: 600 
            }}>
              Learning Resources
            </Title>
            <Text type="secondary" style={{ fontSize: antdTheme.token.fontSizeLG }}>
              Access educational materials, videos, documents, and interactive quizzes
            </Text>
          </Col>
          {canEdit && (
            <Col>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingResource(null);
                  form.resetFields();
                  setModalVisible(true);
                }}
                style={{ 
                  background: antdTheme.token.colorPrimary, 
                  borderColor: antdTheme.token.colorPrimary,
                  borderRadius: antdTheme.token.borderRadius,
                  fontWeight: 500
                }}
              >
                Add Resource
              </Button>
            </Col>
          )}
        </Row>
      </div>

        {/* Filters and Resources */}
        <SubjectFilter 
          subjects={subjects}
          selectedSubject={selectedSubject}
          onSubjectChange={(value) => handleFilterChange('subject', value)}
          selectedClass={selectedClass}
          classes={classes}
          isStudent={isStudent}
          onClassChange={handleClassChange}
          subjectsLoading={subjectsLoading}
          classesLoading={classesLoading}
        />
        <ClassDetailView
          selectedType={selectedType}
          onTypeChange={(k) => handleFilterChange('type', k)}
          renderResourceListItem={renderResourceListItem}
          getResourcesByType={getResourcesByType}
          getSortedResources={getSortedResources}
          loading={loading}
          error={error}
          canEdit={canEdit}
          onAddResource={() => {
            setEditingResource(null);
            form.resetFields();
            setModalVisible(true);
          }}
          onRefresh={loadResources}
          onClearFilters={() => {
            setSearchText('');
            setSelectedType('all');
            setSelectedSubject('all');
            setSelectedClass('all');
            setCurrentPage(1);
          }}
        />

      {/* In-app Preview Modal for Videos & PDFs */}
      <Modal
        title={previewResource ? (
          <Space>
            {previewResource.resource_type === 'video' ? <PlayCircleOutlined /> : <FilePdfOutlined />}
            {previewResource.title}
          </Space>
        ) : 'Preview'}
        open={previewVisible}
        destroyOnClose
        onCancel={() => { setPreviewVisible(false); setPreviewResource(null); }}
        footer={[
          previewResource?.resource_type === 'pdf' && (
            <Button key="download" icon={<DownloadOutlined />} onClick={() => window.open(previewResource.content_url, '_blank')}>
              Download
            </Button>
          ),
          <Button key="close" onClick={() => { setPreviewVisible(false); setPreviewResource(null); }}>
            Close
          </Button>
        ].filter(Boolean)}
        centered
        width="min(1200px, 96vw)"
        style={{ top: 12, maxWidth: '96vw' }}
        bodyStyle={{ padding: 0, height: 'calc(100dvh - 160px)' }}
      >
        {previewResource && (
          previewResource.resource_type === 'video' ? (
            <VideoPlayer url={previewResource.content_url} title={previewResource.title} />
          ) : (
            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
              <iframe
                src={`${previewResource.content_url}#toolbar=0&navpanes=0&scrollbar=1`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                title={previewResource.title}
              />
            </div>
          )
        )}
      </Modal>

      {/* Add/Edit Resource Modal */}
      <Modal
        title={editingResource ? 'Edit Resource' : 'Add New Resource'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingResource(null);
          form.resetFields();
        }}
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
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="Enter resource title" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter a description' }]}
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Enter resource description" 
            />
          </Form.Item>

          <Form.Item
            name="resource_type"
            label="Resource Type"
            rules={[{ required: true, message: 'Please select a resource type' }]}
          >
            <Select placeholder="Select resource type">
              <Option value="video">Video</Option>
              <Option value="pdf">PDF Document</Option>
              <Option value="quiz">Interactive Quiz</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="subject_id"
            label="Subject"
            rules={[{ required: true, message: 'Please select a subject' }]}
          >
            <Select placeholder="Select subject" loading={subjects.length === 0}>
              {subjects.length === 0 ? (
                <Option disabled value="">No subjects available</Option>
              ) : (
                subjects.map(subject => (
                  <Option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </Option>
                ))
              )}
            </Select>
          </Form.Item>

          <Form.Item
            name="class_instance_id"
            label="Class"
            rules={[{ required: true, message: 'Please select a class' }]}
          >
            <Select placeholder="Select class" loading={classes.length === 0}>
              {classes.length === 0 ? (
                <Option disabled value="">No classes available</Option>
              ) : (
                classes.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    Grade {cls.grade} - {cls.section}
                  </Option>
                ))
              )}
            </Select>
          </Form.Item>


          <Form.Item label="Content Source">
            <Space>
              <Button type={useFileUpload ? 'default' : 'primary'} onClick={() => setUseFileUpload(false)}>Use URL</Button>
              <Button type={useFileUpload ? 'primary' : 'default'} onClick={() => setUseFileUpload(true)}>Upload File</Button>
            </Space>
          </Form.Item>

          {!useFileUpload ? (
            <Form.Item
              name="content_url"
              label="Content URL"
              rules={[{ required: true, message: 'Please enter content URL' }]}
            >
              <Input placeholder="Enter URL to video, PDF, or quiz content" />
            </Form.Item>
          ) : (
            <Form.Item label="Upload File" required>
              <input
                type="file"
                accept="video/*,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={{ color: antdTheme.token.colorText }}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Supported: Videos (mp4 etc.), PDFs. File will be stored in Supabase Storage.
              </Text>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={uploading}
                icon={<UploadOutlined />}
              >
                {editingResource ? 'Update Resource' : 'Create Resource'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingResource(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      </Content>
    </ErrorBoundary>
  );
};

export default LearningResources;
