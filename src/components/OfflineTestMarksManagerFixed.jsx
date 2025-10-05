/**
 * Fixed Offline Test Marks Manager
 * 
 * This version works without user metadata requirements
 * Use this until user metadata is properly set up
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Table,
  Button,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
  Alert,
  Progress,
  Statistic,
  Row,
  Col,
  Card,
  Tag,
  Tooltip,
  Upload,
  message,
  Spin,
  Divider,
  Badge
} from 'antd';
import {
  SaveOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useErrorHandler } from '../hooks/useErrorHandler';
import {
  getTestDetails,
  getStudentsForClass,
  getTestMarks,
  saveTestMarks
} from '../services/offlineTestServiceTemporary';

const { Title, Text } = Typography;

export default function OfflineTestMarksManagerFixed({ 
  open, 
  onClose, 
  testId, 
  onSaved 
}) {
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testDetails, setTestDetails] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [error, setError] = useState(null);
  
  // Load data when modal opens
  useEffect(() => {
    if (open && testId) {
      loadData();
    }
  }, [open, testId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Loading data for test:', testId);
      
      // Load test details
      const testResult = await getTestDetails(testId);
      if (!testResult.success) {
        throw new Error(testResult.error);
      }
      setTestDetails(testResult.data);
      
      // Load students
      const studentsResult = await getStudentsForClass(testResult.data.class_instance_id);
      if (!studentsResult.success) {
        throw new Error(studentsResult.error);
      }
      setStudents(studentsResult.data);
      
      // Load existing marks
      const marksResult = await getTestMarks(testId);
      if (!marksResult.success) {
        throw new Error(marksResult.error);
      }
      
      // Create marks data for all students
      const marksData = studentsResult.data.map(student => {
        const existingMark = marksResult.data.find(m => m.student_id === student.id);
        return {
          id: existingMark?.id,
          test_id: testId,
          student_id: student.id,
          student_code: student.student_code,
          student_name: student.full_name,
          marks_obtained: existingMark?.marks_obtained || null,
          max_marks: existingMark?.max_marks || 100, // Default to 100 if not specified
          remarks: existingMark?.remarks || '',
          is_absent: false
        };
      });
      
      setMarks(marksData);
      console.log('✅ Data loaded successfully');
      
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError(err.message);
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, field, value) => {
    setMarks(prev => prev.map(mark => 
      mark.student_id === studentId 
        ? { ...mark, [field]: value }
        : mark
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      console.log('💾 Saving marks:', marks);
      
      // Prepare data for saving
      const marksToSave = marks.map(mark => ({
        test_id: mark.test_id,
        student_id: mark.student_id,
        marks_obtained: mark.marks_obtained,
        max_marks: mark.max_marks,
        remarks: mark.remarks,
        is_absent: mark.is_absent
      }));
      
      const result = await saveTestMarks(marksToSave);
      if (!result.success) {
        throw new Error(result.error);
      }
      
      message.success(`Successfully saved ${result.count} marks`);
      onSaved?.(result.count);
      onClose?.();
      
    } catch (err) {
      console.error('❌ Error saving marks:', err);
      message.error(`Failed to save marks: ${err.message}`);
      handleError(err);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Student Code',
      dataIndex: 'student_code',
      key: 'student_code',
      width: 120,
      fixed: 'left'
    },
    {
      title: 'Student Name',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 200,
      fixed: 'left'
    },
    {
      title: 'Marks Obtained',
      dataIndex: 'marks_obtained',
      key: 'marks_obtained',
      width: 150,
      render: (value, record) => (
        <InputNumber
          value={value}
          onChange={(val) => handleMarkChange(record.student_id, 'marks_obtained', val)}
          min={0}
          max={record.max_marks}
          placeholder="Enter marks"
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Max Marks',
      dataIndex: 'max_marks',
      key: 'max_marks',
      width: 100,
      render: (value) => <Text strong>{value}</Text>
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 200,
      render: (value, record) => (
        <Input
          value={value}
          onChange={(e) => handleMarkChange(record.student_id, 'remarks', e.target.value)}
          placeholder="Enter remarks"
        />
      )
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.marks_obtained === null || record.marks_obtained === undefined) {
          return <Tag color="orange">Pending</Tag>;
        }
        const percentage = (record.marks_obtained / record.max_marks) * 100;
        if (percentage >= 80) return <Tag color="green">Excellent</Tag>;
        if (percentage >= 60) return <Tag color="blue">Good</Tag>;
        if (percentage >= 40) return <Tag color="orange">Average</Tag>;
        return <Tag color="red">Needs Improvement</Tag>;
      }
    }
  ];

  const stats = useMemo(() => {
    const totalStudents = marks.length;
    const marksEntered = marks.filter(m => m.marks_obtained !== null && m.marks_obtained !== undefined).length;
    const pending = totalStudents - marksEntered;
    
    return {
      totalStudents,
      marksEntered,
      pending,
      percentage: totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0
    };
  }, [marks]);

  if (!open) return null;

  return (
    <Modal
      title={
        <Space>
          <TrophyOutlined />
          <span>Offline Test Marks Manager</span>
          {testDetails && (
            <Tag color="blue">{testDetails.title}</Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width="90%"
      style={{ maxWidth: '1200px' }}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button 
          key="reload" 
          icon={<ReloadOutlined />} 
          onClick={loadData}
          loading={loading}
        >
          Reload
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          Save Marks
        </Button>
      ]}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>Loading test details and students...</Text>
          </div>
        </div>
      )}

      {error && (
        <Alert
          message="Error Loading Data"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {!loading && testDetails && (
        <>
          {/* Test Details */}
          <Card size="small" style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Test Title"
                  value={testDetails.title}
                  prefix={<TrophyOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Test Type"
                  value={testDetails.test_type || 'Offline Test'}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Students"
                  value={stats.totalStudents}
                  prefix={<UserOutlined />}
                />
              </Col>
            </Row>
          </Card>

          {/* Progress */}
          <Card size="small" style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Progress
                  percent={stats.percentage}
                  status={stats.percentage === 100 ? 'success' : 'active'}
                  format={() => `${stats.marksEntered}/${stats.totalStudents}`}
                />
              </Col>
              <Col span={12}>
                <Space>
                  <Badge count={stats.marksEntered} color="green" />
                  <Text>Marks Entered</Text>
                  <Badge count={stats.pending} color="orange" />
                  <Text>Pending</Text>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Marks Table */}
          <Table
            columns={columns}
            dataSource={marks}
            rowKey="student_id"
            pagination={false}
            scroll={{ x: 800, y: 400 }}
            size="small"
            bordered
          />
        </>
      )}
    </Modal>
  );
}
