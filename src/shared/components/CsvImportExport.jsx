/**
 * Production-Grade CSV Import/Export Component
 * 
 * Unified component for CSV operations with:
 * - File validation
 * - Data parsing and validation
 * - Error handling
 * - Progress tracking
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  Upload,
  Button,
  Alert,
  Progress,
  Typography,
  Space,
  Table,
  Tag,
  Divider,
  message
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

/**
 * Props:
 * @param {boolean} open - Whether modal is open
 * @param {Function} onClose - Close handler
 * @param {Function} onImport - Import handler
 * @param {Function} onExport - Export handler
 * @param {Array} sampleData - Sample data for preview
 * @param {string} testTitle - Test title for export filename
 */
export default function CsvImportExport({
  open,
  onClose,
  onImport,
  onExport,
  sampleData = [],
  testTitle = 'test'
}) {
  const [importStep, setImportStep] = useState('upload'); // upload, preview, importing, complete
  const [importData, setImportData] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setImportStep('upload');
      setImportData(null);
      setImportErrors([]);
      setImportWarnings([]);
      setImportProgress(0);
      setIsImporting(false);
    }
  }, [open]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file) => {
    try {
      setImportStep('preview');
      
      // Validate file type
      const isValidType = file.type === 'text/csv' || 
                         file.name.toLowerCase().endsWith('.csv') ||
                         file.type === 'application/vnd.ms-excel';
      
      if (!isValidType) {
        message.error('Please upload a CSV file');
        return false;
      }

      // Read file content
      const text = await file.text();
      const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        message.error('CSV file is empty');
        return false;
      }

      // Parse CSV
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredColumns = ['student_id', 'marks_obtained'];
      
      // Check required columns
      const missingColumns = requiredColumns.filter(col => !header.includes(col));
      if (missingColumns.length > 0) {
        message.error(`CSV missing required columns: ${missingColumns.join(', ')}`);
        return false;
      }

      // Parse data
      const columnIndex = Object.fromEntries(header.map((h, i) => [h, i]));
      const parsedData = [];
      const errors = [];
      const warnings = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const columns = line.split(',');
        
        const studentId = columns[columnIndex.student_id]?.trim();
        if (!studentId) continue;

        const marksObtained = columns[columnIndex.marks_obtained]?.trim();
        const maxMarks = columnIndex.max_marks !== undefined ? 
          columns[columnIndex.max_marks]?.trim() : null;
        const remarks = columnIndex.remarks !== undefined ? 
          columns[columnIndex.remarks]?.trim() : '';
        const isAbsent = columnIndex.is_absent !== undefined ? 
          columns[columnIndex.is_absent]?.trim() : '';

        const isAbsentBool = ['1', 'true', 'yes', 'y'].includes(isAbsent.toLowerCase());
        
        // Validate marks
        if (marksObtained !== '' && marksObtained !== null && marksObtained !== undefined) {
          const marksNum = Number(marksObtained);
          if (isNaN(marksNum) || marksNum < 0) {
            errors.push(`Row ${i + 1}: Invalid marks value "${marksObtained}"`);
          }
        }

        parsedData.push({
          row: i + 1,
          student_id: studentId,
          marks_obtained: isAbsentBool ? 0 : (marksObtained === '' ? null : Number(marksObtained)),
          max_marks: maxMarks ? Number(maxMarks) : 100,
          remarks: remarks || '',
          is_absent: isAbsentBool
        });
      }

      setImportData(parsedData);
      setImportErrors(errors);
      setImportWarnings(warnings);
      
      if (errors.length > 0) {
        message.error(`Found ${errors.length} errors in CSV data`);
      } else {
        message.success(`Parsed ${parsedData.length} records from CSV`);
      }

      return false; // Prevent default upload
    } catch (error) {
      console.error('Error parsing CSV:', error);
      message.error('Failed to parse CSV file');
      return false;
    }
  }, []);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!importData || importErrors.length > 0) return;

    try {
      setIsImporting(true);
      setImportStep('importing');
      setImportProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Call import handler
      const result = await onImport(importData);
      
      clearInterval(progressInterval);
      setImportProgress(100);

      if (result.success) {
        setImportStep('complete');
        message.success(`Successfully imported ${result.count} records`);
      } else {
        message.error(result.error);
        setImportStep('preview');
      }
    } catch (error) {
      console.error('Error importing data:', error);
      message.error('Failed to import data');
      setImportStep('preview');
    } finally {
      setIsImporting(false);
    }
  }, [importData, importErrors, onImport]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      const result = await onExport();
      
      if (result.success) {
        // Download CSV
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${testTitle}_marks.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        message.success('CSV exported successfully');
        onClose();
      } else {
        message.error(result.error);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      message.error('Failed to export data');
    }
  }, [onExport, testTitle, onClose]);

  // Preview table columns
  const previewColumns = [
    {
      title: 'Row',
      dataIndex: 'row',
      key: 'row',
      width: 60
    },
    {
      title: 'Student ID',
      dataIndex: 'student_id',
      key: 'student_id',
      width: 120
    },
    {
      title: 'Marks',
      dataIndex: 'marks_obtained',
      key: 'marks_obtained',
      width: 80,
      render: (value) => value !== null ? value : '-'
    },
    {
      title: 'Max Marks',
      dataIndex: 'max_marks',
      key: 'max_marks',
      width: 80
    },
    {
      title: 'Absent',
      dataIndex: 'is_absent',
      key: 'is_absent',
      width: 80,
      render: (value) => (
        <Tag color={value ? 'red' : 'green'}>
          {value ? 'Yes' : 'No'}
        </Tag>
      )
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileExcelOutlined />
          <span>CSV Import/Export</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <div style={{ marginBottom: '16px' }}>
        <Title level={5}>Import Test Marks from CSV</Title>
        <Text type="secondary">
          Upload a CSV file with student marks data. Required columns: student_id, marks_obtained
        </Text>
      </div>

      {importStep === 'upload' && (
        <div>
          <Upload.Dragger
            accept=".csv"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            style={{ marginBottom: '16px' }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
            <p className="ant-upload-hint">
              Support for CSV files only. Required columns: student_id, marks_obtained
            </p>
          </Upload.Dragger>

          <Alert
            message="CSV Format Requirements"
            description={
              <div>
                <p><strong>Required columns:</strong></p>
                <ul>
                  <li><code>student_id</code> - Student ID (required)</li>
                  <li><code>marks_obtained</code> - Marks obtained (required)</li>
                </ul>
                <p><strong>Optional columns:</strong></p>
                <ul>
                  <li><code>max_marks</code> - Maximum marks (default: 100)</li>
                  <li><code>remarks</code> - Remarks</li>
                  <li><code>is_absent</code> - Absent status (1/true/yes/y for absent)</li>
                </ul>
              </div>
            }
            type="info"
            showIcon
          />
        </div>
      )}

      {importStep === 'preview' && importData && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <Space>
              <Button
                type="primary"
                onClick={handleImport}
                disabled={importErrors.length > 0}
                loading={isImporting}
              >
                Import {importData.length} Records
              </Button>
              <Button onClick={() => setImportStep('upload')}>
                Upload Different File
              </Button>
            </Space>
          </div>

          {importErrors.length > 0 && (
            <Alert
              message={`${importErrors.length} Errors Found`}
              description={
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {importErrors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {importErrors.length > 5 && (
                    <li>... and {importErrors.length - 5} more errors</li>
                  )}
                </ul>
              }
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}

          {importWarnings.length > 0 && (
            <Alert
              message={`${importWarnings.length} Warnings`}
              description={
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {importWarnings.slice(0, 3).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                  {importWarnings.length > 3 && (
                    <li>... and {importWarnings.length - 3} more warnings</li>
                  )}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}

          <Table
            columns={previewColumns}
            dataSource={importData.slice(0, 10)}
            rowKey="row"
            pagination={false}
            size="small"
            scroll={{ y: 200 }}
          />
          
          {importData.length > 10 && (
            <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
              Showing first 10 rows of {importData.length} total records
            </Text>
          )}
        </div>
      )}

      {importStep === 'importing' && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Progress
            percent={importProgress}
            status="active"
            style={{ marginBottom: '16px' }}
          />
          <Text>Importing marks data...</Text>
        </div>
      )}

      {importStep === 'complete' && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
          <Title level={4} style={{ color: '#52c41a' }}>Import Complete!</Title>
          <Text>Successfully imported marks data.</Text>
          <div style={{ marginTop: '16px' }}>
            <Button type="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      <Divider />

      <div>
        <Title level={5}>Export Test Marks to CSV</Title>
        <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
          Download current marks data as a CSV file
        </Text>
        <Button
          type="default"
          icon={<DownloadOutlined />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>
    </Modal>
  );
}
