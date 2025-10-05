/**
 * Correct Offline Test Marks Manager
 * 
 * This version uses the actual database schema and proper queries
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
  getTestWithStudentsAndMarks,
  saveTestMarks
} from '../services/offlineTestServiceCorrect';

const { Title, Text } = Typography;

export default function OfflineTestMarksManagerCorrect({ 
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
  const [testData, setTestData] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [error, setError] = useState(null);
  
  // Load data when modal opens
  useEffect(() => {
    if (open && testId) {
      loadData();
    }
  }, [open, testId]);

  // Handle ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && open) {
        onClose?.();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [open, onClose]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Loading data for test:', testId);
      
      const result = await getTestWithStudentsAndMarks(testId);
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setTestData(result.data.test);
      setStudents(result.data.students);
      
      // Create marks data for editing
      const marksData = result.data.students.map(student => ({
        id: student.id,
        test_id: testId,
        student_id: student.id,
        student_code: student.student_code,
        student_name: student.full_name,
        marks_obtained: student.marks_obtained,
        max_marks: student.max_marks,
        remarks: student.remarks,
        has_marks: student.has_marks
      }));
      
      setMarks(marksData);
      console.log('✅ Data loaded successfully:', {
        test: result.data.test,
        studentsCount: result.data.students.length,
        marksCount: marksData.length
      });
      
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError(err.message);
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, field, value) => {
    // Strict validation for marks_obtained
    if (field === 'marks_obtained') {
      const studentMark = marks.find(m => m.student_id === studentId);
      
      // Don't allow null/undefined values to be set if they're invalid
      if (value !== null && value !== undefined) {
        if (value > studentMark.max_marks) {
          message.warning(`Marks cannot exceed ${studentMark.max_marks}`);
          return; // Don't update if exceeds max
        }
        if (value < 0) {
          message.warning('Marks cannot be negative');
          return; // Don't update if negative
        }
      }
    }
    
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
      
      // Validate all marks before saving
      const invalidMarks = marks.filter(mark => 
        mark.marks_obtained !== null && 
        mark.marks_obtained !== undefined && 
        (mark.marks_obtained > mark.max_marks || mark.marks_obtained < 0)
      );
      
      if (invalidMarks.length > 0) {
        message.error(`Please fix invalid marks. Some marks exceed maximum or are negative.`);
        setSaving(false);
        return;
      }
      
      // Prepare data for saving - only include fields that exist in database
      const marksToSave = marks
        .filter(mark => mark.marks_obtained !== null && mark.marks_obtained !== undefined)
        .map(mark => ({
          test_id: mark.test_id,
          student_id: mark.student_id,
          marks_obtained: mark.marks_obtained,
          max_marks: mark.max_marks,
          remarks: mark.remarks || null,
          created_by: user?.id || null
        }));
      
      if (marksToSave.length === 0) {
        message.warning('No marks to save. Please enter at least one mark.');
        setSaving(false);
        return;
      }
      
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
          onChange={(val) => {
            // Prevent input if value exceeds max marks
            if (val !== null && val > record.max_marks) {
              message.warning(`Marks cannot exceed ${record.max_marks}`);
              return; // Don't update the value
            }
            if (val !== null && val < 0) {
              message.warning('Marks cannot be negative');
              return; // Don't update the value
            }
            handleMarkChange(record.student_id, 'marks_obtained', val);
          }}
          min={0}
          max={record.max_marks}
          placeholder={`0-${record.max_marks}`}
          style={{ width: '100%' }}
          status={value > record.max_marks ? 'error' : ''}
          onKeyDown={(e) => {
            // Allow backspace, delete, arrow keys, etc.
            if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
              return;
            }
            
            // Allow only numbers and decimal point
            if (!/[\d.]/.test(e.key)) {
              e.preventDefault();
              return;
            }
            
            // Prevent typing if it would result in invalid value
            const currentValue = parseFloat(e.target.value) || 0;
            const newValue = parseFloat(e.target.value + e.key);
            
            if (e.key >= '0' && e.key <= '9' && newValue > record.max_marks) {
              e.preventDefault();
              message.warning(`Marks cannot exceed ${record.max_marks}`);
            }
          }}
          onPaste={(e) => {
            // Prevent pasting values that exceed max marks
            const pastedText = e.clipboardData.getData('text');
            const pastedValue = parseFloat(pastedText);
            
            if (!isNaN(pastedValue) && pastedValue > record.max_marks) {
              e.preventDefault();
              message.warning(`Cannot paste value ${pastedValue}. Maximum allowed is ${record.max_marks}`);
            }
          }}
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
      width: 120,
      render: (_, record) => {
        if (record.marks_obtained === null || record.marks_obtained === undefined) {
          return <Tag color="orange">Pending</Tag>;
        }
        
        // Check for invalid marks
        if (record.marks_obtained > record.max_marks) {
          return <Tag color="red">Invalid (Exceeds Max)</Tag>;
        }
        if (record.marks_obtained < 0) {
          return <Tag color="red">Invalid (Negative)</Tag>;
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
          {testData && (
            <Tag color="blue">{testData.title}</Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={onClose}
      width="90%"
      style={{ maxWidth: '1200px' }}
      maskClosable={true}
      keyboard={true}
      destroyOnHidden={true}
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

      {!loading && testData && (
        <>
          {/* Test Details */}
          <Card size="small" style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Test Title"
                  value={testData.title}
                  prefix={<TrophyOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Test Type"
                  value={testData.test_type || 'Offline Test'}
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
            {testData.description && (
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary">{testData.description}</Text>
              </div>
            )}
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
