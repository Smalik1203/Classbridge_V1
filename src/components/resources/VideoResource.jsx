// src/components/resources/VideoResource.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Button, Modal, Space, Typography, Tag, Tooltip, Spin, Row, Col } from 'antd';
import { PlayCircleOutlined, LinkOutlined, EyeOutlined, DownloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import VideoPlayer from '../VideoPlayer'; // adjust path if necessary
import { supabase } from '../../config/supabaseClient'; // adjust path if necessary
import { useAuth } from '../../AuthProvider'; // optional: your auth hook
import ResourceThumbnail from './ResourceThumbnail';
import ResourceTypeBadge from './ResourceTypeBadge';

const { Title, Text } = Typography;

/**
 * VideoResource component:
 * - resource: { id, title, description, content_url, created_at, subject_id, subjects, class_instances }
 * - onEdit, onDelete optional callbacks
 */
export default function VideoResource({ resource, canEdit = false, onEdit = () => {}, onDelete = () => {} }) {
  const { user } = useAuth();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(null); // last known progress (object)
  const timerRef = useRef(null); // debounce timer id
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Debounced schedule: trailing save after 10s of inactivity
  const scheduleSave = useCallback((payload) => {
    // payload: { userId, resourceId, currentSeconds, durationSeconds }
    pendingRef.current = payload;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const p = pendingRef.current;
      if (!p || !p.userId || !p.resourceId) return;
      try {
        setSaving(true);
        await upsertProgress(p.userId, p.resourceId, Math.floor(p.currentSeconds || 0), Math.floor(p.durationSeconds || 0));
        // saved, clear pending
        pendingRef.current = null;
      } catch (err) {
      } finally {
        if (!isUnmountedRef.current) setSaving(false);
      }
    }, 10000); // 10s
  }, []);

  // Flush immediately (used on pause / ended / close)
  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = pendingRef.current;
    if (!p || !p.userId || !p.resourceId) return;
    try {
      setSaving(true);
      await upsertProgress(p.userId, p.resourceId, Math.floor(p.currentSeconds || 0), Math.floor(p.durationSeconds || 0));
      pendingRef.current = null;
    } catch (err) {
    } finally {
      if (!isUnmountedRef.current) setSaving(false);
    }
  }, []);

  // onProgress from VideoPlayer -> schedule debounced save
  const handleProgress = useCallback((current, duration, meta = {}) => {
    const userId = (meta && meta.userId) || (user && user.id);
    const resourceId = (meta && meta.resourceId) || resource.id;
    if (!userId || !resourceId) return;
    scheduleSave({ userId, resourceId, currentSeconds: current, durationSeconds: duration });
  }, [resource, scheduleSave, user]);

  // onStateChange e.g., PAUSED/ENDED -> flush immediately
  const handleStateChange = useCallback((state, meta = {}) => {
    if (state === 'PAUSED' || state === 'ENDED') {
      flushSave();
    }
  }, [flushSave]);

  // open/close handlers
  const openPreview = useCallback((e) => { e && e.preventDefault(); setPreviewVisible(true); }, []);
  const closePreview = useCallback(async () => {
    // flush pending then close
    await flushSave();
    setPreviewVisible(false);
  }, [flushSave]);

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
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
            <ResourceThumbnail type="video" size="medium" />
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
              </Text>
            </Space>
          </Col>
          
          {/* Right: Actions */}
          <Col flex="none">
            <Space direction="vertical" size={8} align="end">
              {/* Type Badge */}
              <ResourceTypeBadge type="video" size="small" />
              
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
                  icon={<PlayCircleOutlined />}
                  onClick={openPreview}
                  style={{ 
                    fontWeight: 500,
                    minWidth: 80
                  }}
                >
                  Watch
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      <Modal
        title={<Space><PlayCircleOutlined />{resource.title}</Space>}
        open={previewVisible}
        onCancel={() => { closePreview(); }}
        centered
        destroyOnClose
        width="min(1000px, 92vw)"
        bodyStyle={{ padding: 0, height: 'calc(100dvh - 200px)' }}
        footer={[
          <div key="status" style={{ marginRight: 'auto', paddingLeft: 12 }}>
            {saving ? <Space><Spin size="small" /> <Text>Saving progress...</Text></Space> : null}
          </div>,
          <Button key="external" icon={<LinkOutlined />} onClick={() => window.open(resource.content_url, '_blank')}>Open in New Tab</Button>,
          resource.content_url && /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i.test(resource.content_url) && (
            <Button key="download" icon={<DownloadOutlined />} onClick={() => window.open(resource.content_url, '_blank')}>Download</Button>
          ),
          <Button key="close" onClick={async () => { await closePreview(); }}>Close</Button>
        ]}
      >
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
          <VideoPlayer
            url={resource.content_url}
            title={resource.title}
            onProgress={(cur, dur, meta) => handleProgress(cur, dur, meta)}
            onStateChange={(state, meta) => handleStateChange(state, meta)}
          />
        </div>
      </Modal>
    </>
  );
}

VideoResource.propTypes = {
  resource: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};

// helper: upsert into video_progress (user_id, resource_id) primary key
async function upsertProgress(userId, resourceId, currentTimeSec, durationSec) {
  if (!userId || !resourceId) throw new Error('missing keys for progress');
  const payload = {
    user_id: userId,
    resource_id: resourceId,
    current_time: currentTimeSec || 0,
    duration: durationSec || 0,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('video_progress').upsert(payload, { onConflict: ['user_id', 'resource_id'] });
  if (error) throw error;
  return true;
}
