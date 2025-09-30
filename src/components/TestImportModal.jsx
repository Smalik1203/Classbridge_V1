import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Table,
  Alert,
  Typography,
  Space,
  Tag,
  message,
  Divider,
  Row,
  Col,
  Card,
  Select,
  Form
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { parseTests, generateSampleCSV, generateSampleJSON, generateSampleText } from '../services/testImportService';
import { createTest } from '../services/testService';

const { Title, Text } = Typography;
const { Option } = Select;

const TestImportModal = ({ visible, onClose, onImportComplete, classInstances, subjects, schoolCode, userId }) => {
  const { theme: antdTheme } = useTheme();
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState('');
  const [parsedTests, setParsedTests] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [form] = Form.useForm();

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        setFileContent(content);
        
        // Determine file type
        const fileName = file.name.toLowerCase();
        let type = 'txt';
        if (fileName.endsWith('.csv')) type = 'csv';
        else if (fileName.endsWith('.json')) type = 'json';
        else if (fileName.endsWith('.txt')) type = 'txt';
        
        setFileType(type);
        
        // Parse the content
        const { tests, errors } = parseTests(content, type);
        setParsedTests(tests);
        setValidationErrors(errors);
        
        if (tests.length > 0) {
          message.success(`Successfully parsed ${tests.length} tests`);
        }
        if (errors.length > 0) {
          message.warning(`Found ${errors.length} validation errors`);
        }
      } catch (error) {
        console.error('Error processing file:', error);
        message.error('Error processing file: ' + error.message);
      }
    };
    reader.onerror = () => {
      console.error('FileReader error');
      message.error('Failed to read file');
    };
    reader.readAsText(file);
    return false; // Prevent auto upload
  };

  const handleDownloadTemplate = (format) => {
    let content = '';
    let filename = '';
    let mimeType = '';
    
    switch (format) {
      case 'csv':
        content = generateSampleCSV();
        filename = 'test_template.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = generateSampleJSON();
        filename = 'test_template.json';
        mimeType = 'application/json';
        break;
      case 'txt':
        content = generateSampleText();
        filename = 'test_template.txt';
        mimeType = 'text/plain';
        break;
      default:
        return;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!selectedClass) {
      message.error('Please select a class first');
      return;
    }
    
    if (validationErrors.length > 0) {
      message.error('Please fix validation errors before importing');
      return;
    }
    
    if (parsedTests.length === 0) {
      message.error('No valid tests to import');
      return;
    }

    // Show confirmation dialog
    Modal.confirm({
      title: 'Import Tests',
      content: `Are you sure you want to import ${parsedTests.length} tests for ${selectedClass.grade} ${selectedClass.section}?`,
      onOk: async () => {
        setImporting(true);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const test of parsedTests) {
          try {
            // Use the selected class instead of trying to match

            // Find matching subject - handle case insensitive matching
            const subject = subjects.find(
              sub => sub.subject_name.toLowerCase() === test.subject_name.toLowerCase()
            );
            
            if (!subject) {
              const errorMsg = `Test "${test.title}": No matching subject found for "${test.subject_name}". Available subjects: ${subjects.map(s => s.subject_name).join(', ')}`;
              console.error(errorMsg);
              errors.push(errorMsg);
              errorCount++;
              continue;
            }

            // Create test
            const testData = {
              title: test.title,
              description: test.description,
              test_type: test.test_type,
              class_instance_id: selectedClass.id,
              subject_id: subject.id,
              time_limit_seconds: test.time_limit_seconds,
              // passing_score removed - using correct answers instead
              school_code: schoolCode,
              created_by: userId
            };

            await createTest(testData);
            successCount++;
          } catch (error) {
            console.error('Error creating test:', error);
            errors.push(`Test "${test.title}": ${error.message}`);
            errorCount++;
          }
        }

        setImporting(false);

        if (successCount > 0) {
          message.success(`Successfully imported ${successCount} tests for ${selectedClass.grade} ${selectedClass.section}`);
          onImportComplete();
          onClose();
        }

        if (errorCount > 0) {
          message.error(`Failed to import ${errorCount} tests. Check console for details.`);
          console.error('Import errors:', errors);
        }
      }
    });
  };

  const handleClose = () => {
    setFileContent('');
    setFileType('');
    setParsedTests([]);
    setValidationErrors([]);
    setImporting(false);
    setSelectedClass(null);
    form.resetFields();
    onClose();
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Type',
      dataIndex: 'test_type',
      key: 'test_type',
      render: (type) => (
        <Tag color="blue" style={{ textTransform: 'capitalize' }}>
          {type.replace('_', ' ')}
        </Tag>
      )
    },
    {
      title: 'Subject',
      dataIndex: 'subject_name',
      key: 'subject_name'
    },
    {
      title: 'Time Limit',
      dataIndex: 'time_limit_seconds',
      key: 'time_limit_seconds',
      render: (seconds) => (
        <Text>{seconds ? `${Math.floor(seconds / 60)}m` : 'No limit'}</Text>
      )
    },
    // Passing score column removed - using correct answers instead
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileTextOutlined style={{ color: antdTheme.token.colorPrimary }} />
          <Title level={4} style={{ margin: 0 }}>
            Import Tests
          </Title>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={null}
      style={{ top: 20 }}
    >
      <div style={{ padding: '16px 0' }}>
        {/* Class Selection */}
        <Card
          title="Select Class"
          size="small"
          style={{ marginBottom: '16px' }}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              label="Class"
              name="class"
              rules={[{ required: true, message: 'Please select a class' }]}
            >
              <Select
                placeholder="Select a class for all imported tests"
                value={selectedClass?.id}
                onChange={(value) => {
                  const classInstance = classInstances.find(cls => cls.id === value);
                  setSelectedClass(classInstance);
                }}
                size="large"
                style={{ width: '100%' }}
              >
                {classInstances.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    Grade {cls.grade} {cls.section}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Card>

        {/* File Upload Section */}
        <Card
          title="Upload File"
          size="small"
          style={{ marginBottom: '16px' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Upload
              beforeUpload={handleFileUpload}
              showUploadList={true}
              maxCount={1}
              accept=".csv,.json,.txt"
              fileList={[]}
              multiple={false}
              disabled={importing || !selectedClass}
            >
              <Button 
                icon={<UploadOutlined />} 
                style={{ width: '100%' }}
                disabled={importing || !selectedClass}
              >
                Choose File (CSV, JSON, or TXT)
              </Button>
            </Upload>
            
            {!selectedClass && (
              <Alert
                message="Please select a class first"
                type="warning"
                showIcon
                style={{ marginTop: '8px' }}
              />
            )}
            
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">or</Text>
            </div>
            
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadTemplate('csv')}
                size="small"
              >
                Download CSV Template
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadTemplate('json')}
                size="small"
              >
                Download JSON Template
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadTemplate('txt')}
                size="small"
              >
                Download Text Template
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert
            message="Validation Errors"
            description={
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* Preview Section */}
        {parsedTests.length > 0 && selectedClass && (
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircleOutlined style={{ color: antdTheme.token.colorSuccess }} />
                <span>Preview ({parsedTests.length} tests for Grade {selectedClass.grade} {selectedClass.section})</span>
              </div>
            }
            size="small"
            style={{ marginBottom: '16px' }}
          >
            <Table
              columns={columns}
              dataSource={parsedTests}
              rowKey={(record, index) => index}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        )}

        {/* Import Button */}
        {parsedTests.length > 0 && selectedClass && (
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleImport}
                loading={importing}
                disabled={validationErrors.length > 0}
                icon={<CheckCircleOutlined />}
              >
                Import {parsedTests.length} Tests
              </Button>
            </Space>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TestImportModal;