import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Space, Tag, Row, Col, Input, Select, Button,
  Empty, Spin, Alert, Modal, Tooltip
} from 'antd';
import {
  PlayCircleOutlined, FilePdfOutlined, BookOutlined,
  SearchOutlined, FilterOutlined, DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getStudentCode, getSchoolCode } from '@/shared/utils/metadata';
import { useTheme } from '@/contexts/ThemeContext';
import EmptyState from '@/shared/ui/EmptyState';
import VideoPlayer from '@/features/learning-resources/components/VideoPlayer';

const { Title, Text } = Typography;
const { Search } = Input;

const StudentLearningResources = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [resources, setResources] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [alert, setAlert] = useState(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Fetch student data
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const studentCode = getStudentCode(user);
        const schoolCode = getSchoolCode(user);

        if (!schoolCode) {
          throw new Error('School information not found. Please ensure your account is properly set up.');
        }

        // Try to find student by auth_user_id first (most reliable)
        let { data, error } = await supabase
          .from('student')
          .select('id, full_name, student_code, class_instance_id, school_code')
          .eq('auth_user_id', user.id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // If not found by auth_user_id, try by student_code or email
        if (!data && !error) {
          let query = supabase
            .from('student')
            .select('id, full_name, student_code, class_instance_id, school_code')
            .eq('school_code', schoolCode);

          if (studentCode) {
            query = query.eq('student_code', studentCode);
          } else if (user.email) {
            query = query.eq('email', user.email);
          }

          const result = await query.maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) throw error;
        if (!data) {
          throw new Error('Student record not found. Please contact your administrator to link your account.');
        }

        setStudent(data);

        // Clear any previous alerts on success
        setAlert(null);

        // Fetch resources and subjects
        await Promise.all([
          fetchResources(data),
          fetchSubjects(data.school_code)
        ]);
      } catch (err) {
        console.error('Failed to fetch student:', err);
        setAlert({ 
          type: 'error', 
          message: err.message || 'Failed to load student data. Please contact support.' 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [user]);

  const fetchResources = async (studentData) => {
    try {
      const { data, error } = await supabase
        .from('learning_resources')
        .select(`
          id,
          title,
          description,
          resource_type,
          content_url,
          file_size,
          created_at,
          subjects(id, subject_name)
        `)
        .eq('school_code', studentData.school_code)
        .eq('class_instance_id', studentData.class_instance_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setResources(data || []);
      setFilteredResources(data || []);
    } catch (err) {
      console.error('Failed to fetch resources:', err);
    }
  };

  const fetchSubjects = async (schoolCode) => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name')
        .eq('school_code', schoolCode)
        .order('subject_name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  // Filter resources
  useEffect(() => {
    let filtered = resources;

    // Filter by subject
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(r => r.subjects?.id === selectedSubject);
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.resource_type === selectedType);
    }

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredResources(filtered);
  }, [selectedSubject, selectedType, searchText, resources]);

  const getResourceIcon = (type) => {
    switch (type) {
      case 'video':
        return <PlayCircleOutlined style={{ fontSize: 32, color: theme.token.colorPrimary }} />;
      case 'pdf':
        return <FilePdfOutlined style={{ fontSize: 32, color: theme.token.colorError }} />;
      case 'quiz':
        return <BookOutlined style={{ fontSize: 32, color: theme.token.colorSuccess }} />;
      default:
        return <BookOutlined style={{ fontSize: 32, color: theme.token.colorTextSecondary }} />;
    }
  };

  const getResourceTypeTag = (type) => {
    const typeConfig = {
      video: { color: 'blue', text: 'Video' },
      pdf: { color: 'red', text: 'PDF' },
      quiz: { color: 'green', text: 'Quiz' }
    };
    const config = typeConfig[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleViewResource = (resource) => {
    if (resource.resource_type === 'video') {
      setSelectedVideo(resource);
      setVideoModalVisible(true);
    } else if (resource.resource_type === 'pdf') {
      window.open(resource.content_url, '_blank');
    } else if (resource.resource_type === 'quiz') {
      // Handle quiz viewing
      window.open(resource.content_url, '_blank');
    }
  };

  const handleDownloadResource = async (resource) => {
    try {
      window.open(resource.content_url, '_blank');
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to download resource' });
    }
  };

  const renderResourceCard = (resource) => {
    return (
      <Card
        key={resource.id}
        hoverable
        style={{
          borderRadius: 8,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Icon and Type */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            {getResourceIcon(resource.resource_type)}
            <div style={{ marginTop: 8 }}>
              {getResourceTypeTag(resource.resource_type)}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 8, flex: 1 }}>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>
              {resource.title}
            </Text>
            {resource.description && (
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                {resource.description.length > 100
                  ? `${resource.description.substring(0, 100)}...`
                  : resource.description}
              </Text>
            )}
          </div>

          {/* Meta Info */}
          <div style={{ marginBottom: 12 }}>
            {resource.subjects && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                {resource.subjects.subject_name}
              </Tag>
            )}
            {resource.file_size && (
              <Tag style={{ fontSize: 11 }}>
                {formatFileSize(resource.file_size)}
              </Tag>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => handleViewResource(resource)}
              block
            >
              View
            </Button>
            {resource.resource_type !== 'quiz' && (
              <Tooltip title="Download">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadResource(resource)}
                />
              </Tooltip>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (!student && !loading) {
    return (
      <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
        <Card>
          <Alert
            type="error"
            message="Student data not found"
            description="Unable to load your student information. Please contact support."
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
            Learning Resources
          </Title>
          {student && (
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Access videos, PDFs, and other study materials
            </Text>
          )}
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            showIcon
            closable
            onClose={() => setAlert(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Filters */}
        <Card style={{ marginBottom: 24, borderRadius: 8 }} bodyStyle={{ padding: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="Search resources..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="Filter by Subject"
                style={{ width: '100%' }}
                value={selectedSubject}
                onChange={setSelectedSubject}
              >
                <Select.Option value="all">All Subjects</Select.Option>
                {subjects.map(subject => (
                  <Select.Option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="Filter by Type"
                style={{ width: '100%' }}
                value={selectedType}
                onChange={setSelectedType}
              >
                <Select.Option value="all">All Types</Select.Option>
                <Select.Option value="video">Videos</Select.Option>
                <Select.Option value="pdf">PDFs</Select.Option>
                <Select.Option value="quiz">Quizzes</Select.Option>
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Resources Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : filteredResources.length > 0 ? (
          <Row gutter={[16, 16]}>
            {filteredResources.map(resource => (
              <Col xs={24} sm={12} md={8} lg={6} key={resource.id}>
                {renderResourceCard(resource)}
              </Col>
            ))}
          </Row>
        ) : (
          <Card>
            <EmptyState
              icon={<BookOutlined />}
              title="No resources found"
              description={
                searchText || selectedSubject !== 'all' || selectedType !== 'all'
                  ? "No resources match your search criteria. Try adjusting your filters."
                  : "No learning resources have been uploaded yet. Check back later!"
              }
            />
          </Card>
        )}

        {/* Video Player Modal */}
        <Modal
          open={videoModalVisible}
          onCancel={() => {
            setVideoModalVisible(false);
            setSelectedVideo(null);
          }}
          footer={null}
          width="90%"
          style={{ maxWidth: 1200, top: 20 }}
          destroyOnClose
        >
          {selectedVideo && (
            <div>
              <Title level={4} style={{ marginBottom: 16 }}>
                {selectedVideo.title}
              </Title>
              <VideoPlayer
                url={selectedVideo.content_url}
                title={selectedVideo.title}
              />
              {selectedVideo.description && (
                <div style={{ marginTop: 16, padding: 16, background: theme.token.colorBgLayout, borderRadius: 8 }}>
                  <Text>{selectedVideo.description}</Text>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default StudentLearningResources;

