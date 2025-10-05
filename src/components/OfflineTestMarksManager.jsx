/**
 * Production-Grade Offline Test Marks Manager
 * 
 * Unified component for managing offline test marks with:
 * - RLS-safe operations
 * - Comprehensive error handling
 * - CSV import/export
 * - Real-time validation
 * - Transaction safety
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  bulkSaveTestMarks,
  parseCsvData,
  exportTestMarksToCsv,
  getTestStatistics
} from '../services/offlineTestService';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Props:
 * @param {boolean} open - Whether modal is open
 * @param {Function} onClose - Close handler
 * @param {string} testId - Test ID
 * @param {Function} onSaved - Callback when marks are saved
 */
export default function OfflineTestMarksManager({ open, onClose, testId, onSaved }) {
  const { user } = useAuth();
  const { showError, showSuccess } = useErrorHandler();

  // State management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [statistics, setStatistics] = useState(null);
  const [dirtyRows, setDirtyRows] = useState(new Set());
  const [errorRows, setErrorRows] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all, present, absent, missing

  // Derived state
  const visibleStudents = useMemo(() => {
    if (!students.length) return [];
    
    switch (filter) {
      case 'present':
        return students.filter(s => marks[s.id]?.is_absent === false);
      case 'absent':
        return students.filter(s => marks[s.id]?.is_absent === true);
      case 'missing':
        return students.filter(s => 
          marks[s.id]?.marks_obtained === undefined || 
          marks[s.id]?.marks_obtained === null
        );
      default:
        return students;
    }
  }, [students, marks, filter]);

  const hasChanges = useMemo(() => dirtyRows.size > 0, [dirtyRows]);

  // Load data when modal opens
  const loadData = useCallback(async () => {
    if (!open || !testId || !user) return;

    setLoading(true);
    try {
      // Load test details
      const testResult = await getTestDetails(testId, user);
      if (!testResult.success) {
        showError(testResult.error);
        return;
      }
      setTest(testResult.data);

      // Load students and marks in parallel
      const [studentsResult, marksResult, statsResult] = await Promise.all([
        getStudentsForClass(testResult.data.class_instance_id, user),
        getTestMarks(testId, user),
        getTestStatistics(testId, user)
      ]);

      if (!studentsResult.success) {
        showError(studentsResult.error);
        return;
      }
      setStudents(studentsResult.data);

      if (!marksResult.success) {
        showError(marksResult.error);
        return;
      }

      // Convert marks array to object for easy lookup
      const marksObj = {};
      marksResult.data.forEach(mark => {
        marksObj[mark.student_id] = {
          id: mark.id,
          marks_obtained: mark.marks_obtained,
          max_marks: mark.max_marks,
          remarks: mark.remarks || '',
          is_absent: mark.is_absent
        };
      });
      setMarks(marksObj);

      if (statsResult.success) {
        setStatistics(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load test data');
    } finally {
      setLoading(false);
    }
  }, [open, testId, user, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle field changes
  const handleFieldChange = useCallback((studentId, field, value) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));

    // Mark row as dirty
    setDirtyRows(prev => new Set([...prev, studentId]));

    // Clear any errors for this row
    setErrorRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });
  }, []);

  // Toggle absent status
  const toggleAbsent = useCallback((studentId) => {
    const currentMark = marks[studentId];
    const isAbsent = currentMark?.is_absent || false;
    
    handleFieldChange(studentId, 'is_absent', !isAbsent);
    if (!isAbsent) {
      // Marking absent, clear marks
      handleFieldChange(studentId, 'marks_obtained', null);
    }
  }, [marks, handleFieldChange]);

  // Save marks
  const handleSave = useCallback(async () => {
    if (!test || !user) return;

    setSaving(true);
    try {
      // Prepare marks data
      const marksData = students.map(student => {
        const mark = marks[student.id] || {};
        return {
          test_id: test.id,
          student_id: student.id,
          marks_obtained: mark.marks_obtained,
          max_marks: mark.max_marks || test.max_marks,
          remarks: mark.remarks || '',
          is_absent: mark.is_absent || false,
          class_instance_id: test.class_instance_id
        };
      });

      // Use bulk save for better performance
      const result = await bulkSaveTestMarks(marksData, user, { chunkSize: 50 });
      
      if (!result.success) {
        showError(result.error);
        return;
      }

      showSuccess(`Successfully saved ${result.count} marks`);
      setDirtyRows(new Set());
      onSaved?.(result.count);
      
      // Reload statistics
      const statsResult = await getTestStatistics(testId, user);
      if (statsResult.success) {
        setStatistics(statsResult.data);
      }
    } catch (error) {
      console.error('Error saving marks:', error);
      showError('Failed to save marks');
    } finally {
      setSaving(false);
    }
  }, [test, user, students, marks, testId, showError, showSuccess, onSaved]);

  // CSV import
  const handleCsvImport = useCallback(async (file) => {
    try {
      const text = await file.text();
      const validStudentIds = students.map(s => s.id);
      
      const result = await parseCsvData(text, validStudentIds, test?.max_marks || 100);
      
      if (!result.success) {
        showError(result.error);
        return;
      }

      // Update marks with CSV data
      const newMarks = { ...marks };
      result.data.forEach(csvMark => {
        newMarks[csvMark.student_id] = {
          ...newMarks[csvMark.student_id],
          ...csvMark
        };
      });
      
      setMarks(newMarks);
      setDirtyRows(new Set(result.data.map(m => m.student_id)));
      
      showSuccess(`Imported ${result.count} marks from CSV`);
      
      if (result.warnings?.length > 0) {
        message.warning(`${result.warnings.length} warnings: ${result.warnings.join(', ')}`);
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      showError('Failed to import CSV');
    }
  }, [students, test, marks, showError, showSuccess]);

  // CSV export
  const handleCsvExport = useCallback(async () => {
    try {
      const marksData = students.map(student => {
        const mark = marks[student.id] || {};
        return {
          student_id: student.id,
          marks_obtained: mark.marks_obtained,
          max_marks: mark.max_marks || test?.max_marks || 100,
          remarks: mark.remarks || '',
          is_absent: mark.is_absent || false
        };
      });

      const result = await exportTestMarksToCsv(marksData, students);
      
      if (!result.success) {
        showError(result.error);
        return;
      }

      // Download CSV
      const blob = new Blob([result.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test_marks_${test?.title || testId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showError('Failed to export CSV');
    }
  }, [students, marks, test, testId, showError, showSuccess]);

  // Table columns
  const columns = [
    {
      title: 'Roll No',
      dataIndex: 'roll_no',
      key: 'roll_no',
      width: 80,
      render: (text) => text || '-'
    },
    {
      title: 'Student',
      dataIndex: 'full_name',
      key: 'student_name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.student_code}
          </div>
        </div>
      )
    },
    {
      title: 'Marks',
      key: 'marks',
      width: 200,
      render: (_, record) => {
        const mark = marks[record.id] || {};
        const isAbsent = mark.is_absent;
        
        return (
          <Space>
            <InputNumber
              min={0}
              max={mark.max_marks || test?.max_marks || 100}
              value={isAbsent ? 0 : mark.marks_obtained}
              disabled={isAbsent}
              onChange={(value) => handleFieldChange(record.id, 'marks_obtained', value)}
              style={{ width: 80 }}
              placeholder="Marks"
            />
            <Text type="secondary">/</Text>
            <InputNumber
              min={1}
              max={1000}
              value={mark.max_marks || test?.max_marks || 100}
              onChange={(value) => handleFieldChange(record.id, 'max_marks', value)}
              style={{ width: 80 }}
            />
          </Space>
        );
      }
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const mark = marks[record.id] || {};
        const isAbsent = mark.is_absent;
        
        return (
          <Space>
            <Tag color={isAbsent ? 'red' : 'green'}>
              {isAbsent ? 'Absent' : 'Present'}
            </Tag>
            <Button
              size="small"
              type={isAbsent ? 'default' : 'dashed'}
              danger={isAbsent}
              onClick={() => toggleAbsent(record.id)}
            >
              {isAbsent ? 'Present' : 'Absent'}
            </Button>
          </Space>
        );
      }
    },
    {
      title: 'Remarks',
      key: 'remarks',
      render: (_, record) => {
        const mark = marks[record.id] || {};
        return (
          <Input
            value={mark.remarks || ''}
            onChange={(e) => handleFieldChange(record.id, 'remarks', e.target.value)}
            placeholder="Optional remarks"
            maxLength={200}
          />
        );
      }
    }
  ];

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {test ? test.title : 'Offline Test Marks'}
          </Title>
          {test && (
            <Text type="secondary">
              {test.description} • Max Marks: {test.max_marks}
            </Text>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      width={1200}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="export"
          icon={<DownloadOutlined />}
          onClick={handleCsvExport}
        >
          Export CSV
        </Button>,
        <Upload
          key="import"
          accept=".csv"
          showUploadList={false}
          beforeUpload={(file) => {
            handleCsvImport(file);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>
            Import CSV
          </Button>
        </Upload>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
          disabled={!hasChanges}
        >
          Save All Changes
        </Button>
      ]}
    >
      {/* Statistics */}
      {statistics && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Total Students"
                value={statistics.totalStudents}
                prefix={<UserOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Present"
                value={statistics.presentStudents}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Absent"
                value={statistics.absentStudents}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Marks Entered"
                value={statistics.marksEntered}
                prefix={<TrophyOutlined />}
              />
            </Col>
          </Row>
          {statistics.averageScore > 0 && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={8}>
                <Statistic
                  title="Average Score"
                  value={statistics.averageScore.toFixed(1)}
                  suffix="%"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Highest Score"
                  value={statistics.highestScore}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Lowest Score"
                  value={statistics.lowestScore}
                />
              </Col>
            </Row>
          )}
        </Card>
      )}

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            value={filter}
            onChange={setFilter}
            style={{ width: 150 }}
          >
            <Option value="all">All Students</Option>
            <Option value="present">Present Only</Option>
            <Option value="absent">Absent Only</Option>
            <Option value="missing">Missing Marks</Option>
          </Select>
          
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            Refresh
          </Button>
          
          {hasChanges && (
            <Badge count={dirtyRows.size}>
              <Tag color="orange">Unsaved Changes</Tag>
            </Badge>
          )}
        </Space>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={visibleStudents}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} students`
        }}
        scroll={{ x: 800, y: 400 }}
        size="small"
      />
    </Modal>
  );
}