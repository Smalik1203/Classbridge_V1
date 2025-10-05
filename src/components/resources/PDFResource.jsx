import React, { useState } from 'react';
import { Card, Button, Modal, Space, Typography, Tag, Tooltip, message, Row, Col } from 'antd';
import { FilePdfOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import ResourceThumbnail from './ResourceThumbnail';
import ResourceTypeBadge from './ResourceTypeBadge';

const { Text, Title } = Typography;

const PDFResource = ({ resource, canEdit = false, onEdit, onDelete }) => {
  const { theme: antdTheme } = useTheme();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const response = await fetch(resource.content_url);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resource.title + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('PDF downloaded successfully');
    } catch (error) {
      message.error('Failed to download PDF');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Card
        hoverable
        style={{ 
          height: '100%', 
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease'
        }}
        bodyStyle={{ padding: 20 }}
      >
        <Row gutter={16} align="middle">
          {/* Left: Thumbnail */}
          <Col flex="none">
            <ResourceThumbnail type="pdf" size="medium" />
          </Col>
          
          {/* Middle: Content */}
          <Col flex="auto" style={{ minWidth: 0 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {/* Title */}
              <Tooltip title={resource.title}>
                <Title 
                  level={4} 
                  style={{ 
                    margin: 0, 
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1F2937',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {resource.title}
                </Title>
              </Tooltip>
              
              {/* Description */}
              {resource.description && (
                <Tooltip title={resource.description}>
                  <Text 
                    type="secondary" 
                    style={{ 
                      fontSize: 14,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '20px'
                    }}
                  >
                    {resource.description}
                  </Text>
                </Tooltip>
              )}
              
              {/* Metadata */}
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: 12,
                  color: '#6B7280'
                }}
              >
                {resource.class_instances ? `Grade ${resource.class_instances.grade}${resource.class_instances.section ? ' - ' + resource.class_instances.section : ''}` : ''}
                {resource.class_instances ? ' • ' : ''}
                {formatDate(resource.created_at)}
                {resource.file_size && ` • ${formatFileSize(resource.file_size)}`}
              </Text>
            </Space>
          </Col>
          
          {/* Right: Actions */}
          <Col flex="none">
            <Space direction="vertical" size={8} align="end">
              {/* Type Badge */}
              <ResourceTypeBadge type="pdf" size="small" />
              
              {/* Action Buttons */}
              <Space size={4}>
                {canEdit && (
                  <>
                    <Tooltip title="Edit">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined />} 
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        style={{ color: '#6B7280' }}
                      />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <Button 
                        type="text" 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      />
                    </Tooltip>
                  </>
                )}
                <Button 
                  type="primary" 
                  size="small"
                  icon={<FilePdfOutlined />}
                  onClick={() => setPreviewVisible(true)}
                  style={{ 
                    fontWeight: 500,
                    minWidth: 80
                  }}
                >
                  Read
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* PDF Preview Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {resource.title}
          </Space>
        }
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={handleDownload} loading={loading}>
            Download
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>
        ]}
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ padding: 0, height: '80vh' }}
      >
        <div style={{ height: '100%', width: '100%' }}>
          <iframe
            src={`${resource.content_url}#toolbar=0&navpanes=0&scrollbar=1`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title={resource.title}
          />
        </div>
      </Modal>
    </>
  );
};

export default PDFResource;
