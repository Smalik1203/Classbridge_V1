import React, { useState } from 'react';
import { 
  Drawer, 
  Button, 
  Space, 
  Typography, 
  Upload, 
  Table, 
  Alert, 
  Progress, 
  Tag, 
  Divider,
  Card,
  Row,
  Col,
  Statistic,
  message
} from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import Papa from 'papaparse';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const CsvDrawer = ({ 
  visible, 
  onClose, 
  onUpload, 
  students = [], 
  testId, 
  maxMarks = 100 
}) => {
  const [csvData, setCsvData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewData, setPreviewData] = useState([]);

  const handleDownloadTemplate = () => {
    // Create template CSV with required columns
    const templateData = students.map(student => ({
      student_id: student.id,
      student_code: student.student_code,
      student_name: student.full_name,
      marks_obtained: '',
      absent: false,
      remarks: ''
    }));

    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `test_marks_template_${testId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const parsed = Papa.parse(csv, { 
          header: true, 
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase()
        });

        if (parsed.errors.length > 0) {
          message.error('CSV parsing errors: ' + parsed.errors.map(e => e.message).join(', '));
          return;
        }

        const data = parsed.data;
        const validation = validateCsvData(data);
        
        setCsvData(data);
        setValidationErrors(validation.errors);
        setPreviewData(validation.validData);
        
        if (validation.errors.length > 0) {
          message.warning(`${validation.errors.length} validation errors found`);
        } else {
          message.success('CSV file loaded successfully');
        }
      } catch (error) {
        message.error('Error parsing CSV: ' + error.message);
      }
    };
    reader.readAsText(file);
    return false; // Prevent default upload
  };

  const validateCsvData = (data) => {
    const errors = [];
    const validData = [];
    const studentMap = new Map(students.map(s => [s.id, s]));

    data.forEach((row, index) => {
      const rowErrors = [];
      const rowNumber = index + 2; // +2 because CSV is 1-indexed and has header

      // Check required fields
      if (!row.student_id && !row.student_code) {
        rowErrors.push('Either student_id or student_code is required');
      }

      // Validate student exists
      let student = null;
      if (row.student_id) {
        student = studentMap.get(row.student_id);
        if (!student) {
          rowErrors.push('Student ID not found in class');
        }
      } else if (row.student_code) {
        student = students.find(s => s.student_code === row.student_code);
        if (!student) {
          rowErrors.push('Student code not found in class');
        }
      }

      // Validate marks
      if (row.marks_obtained !== '' && row.marks_obtained !== null && row.marks_obtained !== undefined) {
        const marks = parseFloat(row.marks_obtained);
        if (isNaN(marks)) {
          rowErrors.push('Marks must be a valid number');
        } else if (marks < 0) {
          rowErrors.push('Marks cannot be negative');
        } else if (marks > maxMarks) {
          rowErrors.push(`Marks cannot exceed ${maxMarks}`);
        }
      }

      // Validate absent field
      if (row.absent !== '' && row.absent !== null && row.absent !== undefined) {
        const absent = row.absent.toString().toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(absent)) {
          rowErrors.push('Absent field must be true/false, 1/0, or yes/no');
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          student: row.student_name || row.student_code || 'Unknown',
          errors: rowErrors
        });
      } else {
        validData.push({
          ...row,
          student_id: student.id,
          marks_obtained: row.marks_obtained ? parseFloat(row.marks_obtained) : null,
          absent: ['true', '1', 'yes'].includes(row.absent?.toString().toLowerCase()),
          remarks: row.remarks || ''
        });
      }
    });

    return { errors, validData };
  };

  const handleBulkUpload = async () => {
    if (validationErrors.length > 0) {
      message.error('Please fix validation errors before uploading');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Simulate chunked upload with progress
      const chunkSize = 200;
      const chunks = [];
      
      for (let i = 0; i < previewData.length; i += chunkSize) {
        chunks.push(previewData.slice(i, i + chunkSize));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunkData = chunks[i];
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const progress = ((i + 1) / chunks.length) * 100;
        setUploadProgress(progress);
      }

      onUpload(previewData);
      message.success('Marks uploaded successfully');
      handleClose();
    } catch (error) {
      message.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setCsvData([]);
    setValidationErrors([]);
    setPreviewData([]);
    setUploadProgress(0);
    onClose();
  };

  const downloadErrorCsv = () => {
    if (validationErrors.length === 0) return;

    const errorData = validationErrors.map(error => ({
      row: error.row,
      student: error.student,
      errors: error.errors.join('; ')
    }));

    const csv = Papa.unparse(errorData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `validation_errors_${testId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSummaryStats = () => {
    const totalRows = csvData.length;
    const validRows = previewData.length;
    const errorRows = validationErrors.length;
    const marksEntered = previewData.filter(row => 
      row.marks_obtained !== null && row.marks_obtained !== undefined
    ).length;
    const absentCount = previewData.filter(row => row.absent).length;

    return {
      totalRows,
      validRows,
      errorRows,
      marksEntered,
      absentCount
    };
  };

  const stats = getSummaryStats();

  const errorColumns = [
    {
      title: 'Row',
      dataIndex: 'row',
      key: 'row',
      width: 60,
    },
    {
      title: 'Student',
      dataIndex: 'student',
      key: 'student',
      width: 150,
    },
    {
      title: 'Errors',
      dataIndex: 'errors',
      key: 'errors',
      render: (errors) => (
        <div>
          {errors.map((error, index) => (
            <Tag key={index} color="red" style={{ marginBottom: '4px' }}>
              {error}
            </Tag>
          ))}
        </div>
      ),
    },
  ];

  const previewColumns = [
    {
      title: 'Student',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 150,
    },
    {
      title: 'Student Code',
      dataIndex: 'student_code',
      key: 'student_code',
      width: 120,
    },
    {
      title: 'Marks',
      dataIndex: 'marks_obtained',
      key: 'marks_obtained',
      width: 100,
      render: (value) => value !== null ? value : '-',
    },
    {
      title: 'Absent',
      dataIndex: 'absent',
      key: 'absent',
      width: 80,
      render: (value) => (
        <Tag color={value ? 'red' : 'green'}>
          {value ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      render: (value) => value || '-',
    },
  ];

  return (
    <Drawer
      title="CSV Marks Upload"
      placement="right"
      width={800}
      open={visible}
      onClose={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleBulkUpload}
            loading={uploading}
            disabled={validationErrors.length > 0 || previewData.length === 0}
          >
            Upload Marks
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Template Download */}
        <Card size="small">
          <Title level={5}>Download Template</Title>
          <Text type="secondary">
            Download a CSV template with all students in this class. Fill in the marks and upload.
          </Text>
          <div style={{ marginTop: '12px' }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
            >
              Download Template
            </Button>
          </div>
        </Card>

        {/* File Upload */}
        <Card size="small">
          <Title level={5}>Upload CSV File</Title>
          <Dragger
            accept=".csv"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            disabled={uploading}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag CSV file to this area to upload
            </p>
            <p className="ant-upload-hint">
              Support for CSV files only. File should contain student_id/student_code, marks_obtained, absent, and remarks columns.
            </p>
          </Dragger>
        </Card>

        {/* Summary Stats */}
        {csvData.length > 0 && (
          <Card size="small">
            <Title level={5}>Upload Summary</Title>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Total Rows" value={stats.totalRows} />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="Valid Rows" 
                  value={stats.validRows} 
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="Error Rows" 
                  value={stats.errorRows} 
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic title="Marks Entered" value={stats.marksEntered} />
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: '12px' }}>
              <Col span={12}>
                <Statistic title="Absent Students" value={stats.absentCount} />
              </Col>
              <Col span={12}>
                <Statistic title="Max Marks" value={maxMarks} />
              </Col>
            </Row>
          </Card>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Title level={5} style={{ margin: 0, color: '#ff4d4f' }}>
                Validation Errors ({validationErrors.length})
              </Title>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={downloadErrorCsv}
              >
                Download Errors
              </Button>
            </div>
            <Table
              columns={errorColumns}
              dataSource={validationErrors}
              rowKey="row"
              size="small"
              pagination={{ pageSize: 5 }}
              scroll={{ y: 200 }}
            />
          </Card>
        )}

        {/* Preview Data */}
        {previewData.length > 0 && (
          <Card size="small">
            <Title level={5}>Preview Data ({previewData.length} valid rows)</Title>
            <Table
              columns={previewColumns}
              dataSource={previewData}
              rowKey="student_id"
              size="small"
              pagination={{ pageSize: 10 }}
              scroll={{ y: 300 }}
            />
          </Card>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Card size="small">
            <Title level={5}>Uploading Marks...</Title>
            <Progress percent={uploadProgress} status="active" />
            <Text type="secondary">
              Uploading marks in chunks for better performance...
            </Text>
          </Card>
        )}
      </Space>
    </Drawer>
  );
};

export default CsvDrawer;