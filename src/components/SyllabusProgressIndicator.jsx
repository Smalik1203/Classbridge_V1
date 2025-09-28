import React, { useState, useEffect } from 'react';
import { Tag, Tooltip, Space } from 'antd';
import { BookOutlined, FileTextOutlined } from '@ant-design/icons';
import { syllabusStructureService } from '../services/syllabusStructureService';

const STATUS_COLORS = {
  pending: '#9CA3AF',
  in_progress: '#F59E0B', 
  completed: '#16A34A'
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed'
};

export default function SyllabusProgressIndicator({
  classInstanceId,
  subjectId,
  syllabusItemId,
  itemType = 'topic', // 'chapter' or 'topic'
  onStatusChange,
  showProgress = true,
  status = 'pending'
}) {
  const [itemInfo, setItemInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (syllabusItemId) {
      loadItemInfo();
    }
  }, [syllabusItemId, itemType]);

  const loadItemInfo = async () => {
    try {
      setLoading(true);
      const info = await syllabusStructureService.resolveSyllabusItem(syllabusItemId, itemType);
      setItemInfo(info);
    } catch (error) {
      console.error('Error loading syllabus item info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusClick = () => {
    if (onStatusChange) {
      // Cycle through statuses: pending -> in_progress -> completed -> pending
      const statusOrder = ['pending', 'in_progress', 'completed'];
      const currentIndex = statusOrder.indexOf(status);
      const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
      onStatusChange(syllabusItemId, nextStatus);
    }
  };

  if (loading) {
    return <Tag>Loading...</Tag>;
  }

  if (!itemInfo) {
    return <Tag color="default">Unknown Item</Tag>;
  }

  const isClickable = !!onStatusChange;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.pending;

  return (
    <Space size="small">
      {itemType === 'chapter' ? (
        <BookOutlined style={{ color: '#1890ff' }} />
      ) : (
        <FileTextOutlined style={{ color: '#52c41a' }} />
      )}
      
      <Tooltip title={itemInfo.path}>
        <span style={{ fontSize: '12px', color: '#666' }}>
          {itemType === 'chapter' 
            ? `Ch ${itemInfo.chapter_no} • ${itemInfo.chapter_title}`
            : `Ch ${itemInfo.chapter_no} • ${itemInfo.chapter_title} → T${itemInfo.topic_no} • ${itemInfo.topic_title}`
          }
        </span>
      </Tooltip>
      
      <Tag
        color={statusColor}
        style={{ 
          cursor: isClickable ? 'pointer' : 'default',
          margin: 0
        }}
        onClick={isClickable ? handleStatusClick : undefined}
      >
        {statusLabel}
      </Tag>
    </Space>
  );
}