import React, { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, Spin } from 'antd';
import { 
  FileOutlined, 
  DownloadOutlined, 
  FilePdfOutlined, 
  FileImageOutlined, 
  FileTextOutlined 
} from '@ant-design/icons';
import { TaskService } from '../services/taskService';

const { Text } = Typography;

/**
 * AttachmentPreview Component
 * Renders preview for different file types (image/pdf/text/other)
 * Cleans up object URLs on unmount
 * Optional download button with signed URL (5 min TTL)
 */
export default function AttachmentPreview({ 
  attachment, 
  open, 
  onClose,
  showDownload = true 
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  // Get preview URL and content
  useEffect(() => {
    if (!attachment || !open) return;

    let objectUrl = null;

    const loadPreview = async () => {
      setLoading(true);
      try {
        // If attachment has bucket and path (from Supabase Storage)
        if (attachment.bucket && attachment.path) {
          // Get signed URL for preview
          const signedUrl = await TaskService.signDownloadURL(attachment, 300); // 5 min TTL
          setPreviewUrl(signedUrl);
          setDownloadUrl(signedUrl);

          // For text files, fetch and read content
          if (attachment.mime?.includes('text/') || attachment.name?.endsWith('.txt')) {
            try {
              const response = await fetch(signedUrl);
              const text = await response.text();
              setTextContent(text);
            } catch (error) {
              console.error('Error reading text file:', error);
            }
          }
        } 
        // If attachment has originFileObj (local file before upload)
        else if (attachment.originFileObj) {
          objectUrl = URL.createObjectURL(attachment.originFileObj);
          setPreviewUrl(objectUrl);

          // Read text content for text files
          if (attachment.mime?.includes('text/') || attachment.name?.endsWith('.txt')) {
            try {
              const text = await attachment.originFileObj.text();
              setTextContent(text);
            } catch (error) {
              console.error('Error reading text file:', error);
            }
          }
        }
        // If attachment has direct URL (legacy)
        else if (attachment.url) {
          setPreviewUrl(attachment.url);
          setDownloadUrl(attachment.url);
        }
        // If attachment has preview blob URL
        else if (attachment.preview) {
          setPreviewUrl(attachment.preview);
        }
      } catch (error) {
        console.error('Error loading attachment preview:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();

    // Cleanup function
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setPreviewUrl(null);
      setTextContent(null);
      setDownloadUrl(null);
    };
  }, [attachment, open]);

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = attachment.name || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderPreview = () => {
    // Check if attachment exists first
    if (!attachment) {
      return (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Text type="secondary">No attachment selected</Text>
        </div>
      );
    }

    if (loading) {
      return (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Spin size="large" />
        </div>
      );
    }

    if (!previewUrl && !textContent) {
      return (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Text type="secondary">No preview available</Text>
        </div>
      );
    }

    const mime = attachment.mime || attachment.type || '';

    // Image preview
    if (mime.startsWith('image/')) {
      return (
        <div style={{ 
          height: '100%', 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: 20
        }}>
          <img
            src={previewUrl}
            alt={attachment.name}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain' 
            }}
            onError={(e) => {
              console.error('Image failed to load:', e);
            }}
          />
        </div>
      );
    }

    // PDF preview
    if (mime === 'application/pdf' || attachment.name?.endsWith('.pdf')) {
      return (
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          title={attachment.name}
        />
      );
    }

    // Text file preview
    if (mime.includes('text/') || attachment.name?.endsWith('.txt')) {
      return (
        <div style={{ 
          height: '100%', 
          width: '100%', 
          padding: 20, 
          overflow: 'auto',
          backgroundColor: '#f5f5f5'
        }}>
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            wordWrap: 'break-word',
            fontFamily: 'monospace',
            fontSize: '14px',
            lineHeight: '1.5',
            margin: 0,
            color: '#000'
          }}>
            {textContent || 'Loading text content...'}
          </pre>
        </div>
      );
    }

    // Generic file (no preview available)
    return (
      <div style={{ 
        height: '100%', 
        width: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          {mime === 'application/pdf' ? (
            <FilePdfOutlined style={{ fontSize: 64, color: '#d32f2f', marginBottom: 16 }} />
          ) : mime.startsWith('image/') ? (
            <FileImageOutlined style={{ fontSize: 64, color: '#1976d2', marginBottom: 16 }} />
          ) : mime.includes('text/') ? (
            <FileTextOutlined style={{ fontSize: 64, color: '#388e3c', marginBottom: 16 }} />
          ) : (
            <FileOutlined style={{ fontSize: 64, color: '#999', marginBottom: 16 }} />
          )}
          <div style={{ fontSize: 16, color: '#666', marginBottom: 8 }}>
            Preview not available for this file type
          </div>
          <div style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>
            {attachment.name}
          </div>
          {attachment.size && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Size: {(attachment.size / 1024).toFixed(2)} KB
            </Text>
          )}
          {showDownload && downloadUrl && (
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleDownload}
            >
              Download File
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <FileOutlined />
          {attachment?.name || 'File Preview'}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width="90%"
      style={{ top: 20 }}
      styles={{ body: { padding: 0, height: '80vh' } }}
      footer={[
        showDownload && downloadUrl && (
          <Button 
            key="download" 
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            Download
          </Button>
        ),
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ].filter(Boolean)}
      centered
    >
      {renderPreview()}
    </Modal>
  );
}

