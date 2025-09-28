import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Select,
  Typography,
  Card,
  Table,
  Space,
  Alert,
  Divider,
  message,
  Row,
  Col,
  Tag,
  Progress,
  Spin
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import {
  parseCSVQuestions,
  parseJSONQuestions,
  parseTextQuestions,
  validateQuestions,
  importQuestionsToTest,
  generateCSVTemplate,
  generateJSONTemplate,
  generateTextTemplate
} from '../services/importService';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const ImportQuestionsModal = ({ visible, test, onClose, onImportComplete }) => {
  const { theme: antdTheme } = useTheme();
  
  // State management
  const [importFormat, setImportFormat] = useState('csv');
  const [fileContent, setFileContent] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [fileList, setFileList] = useState([]);

  // Handle file upload
  const handleFileUpload = (info) => {
    const { file, fileList: newFileList } = info;
    
    console.log('File upload info:', info);
    console.log('File object:', file);
    console.log('File list:', newFileList);
    
    // Update file list
    setFileList(newFileList);
    
    // Get the actual file object (could be file.originFileObj or file itself)
    const actualFile = file.originFileObj || file;
    
    if (actualFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        console.log('File content length:', content.length);
        setFileContent(content);
        parseQuestions(content);
      };
      reader.onerror = (error) => {
        console.error('File reading error:', error);
        message.error('Failed to read file');
      };
      reader.readAsText(actualFile);
    } else {
      console.error('No file object found');
      message.error('No file selected');
    }
  };

  // Parse questions based on selected format
  const parseQuestions = (content) => {
    try {
      // Basic file format validation
      if (!content || content.trim().length === 0) {
        throw new Error('File is empty');
      }

      let questions = [];
      
      switch (importFormat) {
        case 'csv':
          // Validate CSV format
          if (!content.includes(',') && !content.includes('"')) {
            throw new Error('Invalid CSV format. File should contain comma-separated values.');
          }
          questions = parseCSVQuestions(content);
          break;
        case 'json':
          // Validate JSON format
          if (!content.trim().startsWith('[') && !content.trim().startsWith('{')) {
            throw new Error('Invalid JSON format. File should start with [ or {');
          }
          questions = parseJSONQuestions(content);
          break;
        case 'text':
          // Validate text format
          if (!content.includes('Q:') && !content.includes('T:')) {
            throw new Error('Invalid text format. File should contain Q: and T: markers.');
          }
          questions = parseTextQuestions(content);
          break;
        default:
          throw new Error('Unsupported format');
      }
      
      console.log('Parsed questions:', questions);
      console.log('Number of questions:', questions.length);
      
      // Check if any questions were parsed
      if (questions.length === 0) {
        throw new Error('No valid questions found in the file. Please check the format.');
      }
      
      setParsedQuestions(questions);
      
      // Validate questions
      const errors = validateQuestions(questions);
      setValidationErrors(errors);
      
      if (errors.length === 0) {
        message.success(`Successfully parsed ${questions.length} questions`);
      } else {
        message.warning(`Parsed ${questions.length} questions with ${errors.length} validation errors`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      message.error(`Failed to parse file: ${error.message}`);
      setParsedQuestions([]);
      setValidationErrors([]);
    }
  };

  // Handle format change
  const handleFormatChange = (format) => {
    setImportFormat(format);
    if (fileContent) {
      parseQuestions(fileContent);
    }
  };

  // Handle modal close
  const handleClose = () => {
    setParsedQuestions([]);
    setValidationErrors([]);
    setFileContent('');
    setFileList([]);
    setImporting(false);
    setImportProgress(0);
    onClose();
  };

  // Handle import
  const handleImport = async () => {
    if (!test || parsedQuestions.length === 0) return;
    
    // Validate file format before importing
    if (validationErrors.length > 0) {
      message.error('Please fix validation errors before importing');
      return;
    }
    
    // Confirm import with question count
    Modal.confirm({
      title: 'Confirm Import',
      content: `Are you sure you want to import ${parsedQuestions.length} questions to "${test.title}"?`,
      okText: 'Import',
      cancelText: 'Cancel',
      onOk: async () => {
        setImporting(true);
        setImportProgress(0);
        
        try {
          const results = await importQuestionsToTest(test.id, parsedQuestions);
          
          setImportProgress(100);
          
          if (results.failed === 0) {
            message.success(`Successfully imported ${results.success} questions`);
            onImportComplete?.();
            onClose();
          } else {
            message.warning(`Imported ${results.success} questions, ${results.failed} failed`);
            console.error('Import errors:', results.errors);
            // Still close modal even if some failed
            onImportComplete?.();
            onClose();
          }
        } catch (error) {
          message.error('Import failed: ' + error.message);
        } finally {
          setImporting(false);
        }
      }
    });
  };

  // Download template
  const downloadTemplate = () => {
    let content = '';
    let filename = '';
    let mimeType = '';
    
    switch (importFormat) {
      case 'csv':
        content = generateCSVTemplate();
        filename = 'questions_template.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = generateJSONTemplate();
        filename = 'questions_template.json';
        mimeType = 'application/json';
        break;
      case 'text':
        content = generateTextTemplate();
        filename = 'questions_template.txt';
        mimeType = 'text/plain';
        break;
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

  // Table columns for preview
  const columns = [
    {
      title: 'Question',
      dataIndex: 'question_text',
      key: 'question_text',
      render: (text) => (
        <Text style={{ fontSize: '12px' }}>
          {text.length > 50 ? `${text.substring(0, 50)}...` : text}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'question_type',
      key: 'question_type',
      render: (type) => {
        const colors = {
          mcq: 'blue',
          one_word: 'green',
          long_answer: 'orange'
        };
        return (
          <Tag color={colors[type] || 'default'}>
            {type.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Options',
      key: 'options',
      render: (_, record) => {
        if (record.question_type === 'mcq') {
          return (
            <Text style={{ fontSize: '12px' }}>
              {record.options?.length || 0} options
            </Text>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record, index) => {
        const hasError = validationErrors.some(error => 
          error.includes(`Question ${index + 1}`)
        );
        return hasError ? (
          <CloseCircleOutlined style={{ color: antdTheme.token.colorError }} />
        ) : (
          <CheckCircleOutlined style={{ color: antdTheme.token.colorSuccess }} />
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UploadOutlined style={{ marginRight: '8px' }} />
          Import Questions
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={1000}
      style={{ top: 20 }}
      footer={null}
    >
      <div style={{ marginTop: '20px' }}>
        {/* Test Info */}
        {test && (
          <Alert
            message={`Importing to: ${test.title}`}
            description={`Grade ${test.class_instances?.grade} ${test.class_instances?.section} - ${test.subjects?.subject_name}`}
            type="info"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        )}

        <Row gutter={24}>
          {/* Left Column - Import Options */}
          <Col xs={24} lg={12}>
            <Card title="Import Options" style={{ height: '100%' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text strong>Import Format</Text>
                  <Select
                    value={importFormat}
                    onChange={handleFormatChange}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    <Option value="csv">CSV (Excel compatible)</Option>
                    <Option value="json">JSON</Option>
                    <Option value="text">Text Format</Option>
                  </Select>
                </div>

                <div>
                  <Text strong>Upload File</Text>
                  <Upload
                    accept={importFormat === 'csv' ? '.csv' : importFormat === 'json' ? '.json' : '.txt'}
                    showUploadList={true}
                    beforeUpload={() => false}
                    onChange={handleFileUpload}
                    fileList={fileList}
                    style={{ marginTop: '8px' }}
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />} block>
                      Choose File
                    </Button>
                  </Upload>
                  {fileContent && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        File loaded: {fileContent.length} characters
                      </Text>
                    </div>
                  )}
                </div>

                <Divider />

                <div>
                  <Text strong>Download Template</Text>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={downloadTemplate}
                    style={{ 
                      width: '100%', 
                      marginTop: '8px',
                      background: antdTheme.token.colorPrimary,
                      borderColor: antdTheme.token.colorPrimary,
                    }}
                  >
                    Download {importFormat.toUpperCase()} Template
                  </Button>
                </div>

                {/* Format Instructions */}
                <div>
                  <Text strong>Format Instructions</Text>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    {importFormat === 'csv' && (
                      <div>
                        <Text>CSV Format: Question Text, Type, Correct Answer, Option 1, Option 2, ...</Text>
                        <br />
                        <Text>Example: "What is 2+2?", "mcq", "4", "3", "4", "5", "6"</Text>
                      </div>
                    )}
                    {importFormat === 'json' && (
                      <div>
                        <Text>JSON Format: Array of question objects with question_text, question_type, options, correct_index</Text>
                      </div>
                    )}
                    {importFormat === 'text' && (
                      <div>
                        <Text>Text Format: Use Q: for question, T: for type, A: for answer, O: for options</Text>
                      </div>
                    )}
                  </div>
                </div>
              </Space>
            </Card>
          </Col>

          {/* Right Column - Preview */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Preview ({parsedQuestions.length} questions)</span>
                  {parsedQuestions.length > 0 && (
                    <Button
                      type="primary"
                      onClick={handleImport}
                      loading={importing}
                      disabled={validationErrors.length > 0}
                      style={{
                        background: antdTheme.token.colorPrimary,
                        borderColor: antdTheme.token.colorPrimary,
                      }}
                    >
                      Import {parsedQuestions.length} Questions
                    </Button>
                  )}
                </div>
              }
              style={{ height: '100%' }}
            >
              {importing && (
                <div style={{ marginBottom: '16px' }}>
                  <Progress percent={importProgress} />
                </div>
              )}

              {validationErrors.length > 0 && (
                <Alert
                  message="Validation Errors"
                  description={
                    <div>
                      {validationErrors.slice(0, 3).map((error, index) => (
                        <div key={index} style={{ fontSize: '12px' }}>
                          • {error}
                        </div>
                      ))}
                      {validationErrors.length > 3 && (
                        <div style={{ fontSize: '12px' }}>
                          ... and {validationErrors.length - 3} more errors
                        </div>
                      )}
                    </div>
                  }
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}

              {parsedQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <QuestionCircleOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                  <div style={{ marginTop: '16px', color: '#999' }}>
                    Upload a file to preview questions
                  </div>
                </div>
              ) : (
                <Table
                  columns={columns}
                  dataSource={parsedQuestions.map((q, index) => ({ ...q, key: index }))}
                  pagination={{ pageSize: 5, size: 'small' }}
                  size="small"
                  scroll={{ y: 300 }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </Modal>
  );
};

export default ImportQuestionsModal;
