import React, { useState, useEffect } from 'react';
import { Tag, Tooltip, Progress, Space, Typography, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { syllabusService } from '../services/syllabusService';
import { supabase } from '../config/supabaseClient';

const { Text } = Typography;

const SyllabusProgressIndicator = ({ 
  classInstanceId, 
  subjectId, 
  syllabusItemId, 
  onStatusChange,
  showProgress = true 
}) => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syllabusItem, setSyllabusItem] = useState(null);

  // Load subject progress
  useEffect(() => {
    if (classInstanceId && subjectId) {
      loadSubjectProgress();
    }
  }, [classInstanceId, subjectId]);

  // Load syllabus item details if provided
  useEffect(() => {
    if (syllabusItemId) {
      loadSyllabusItem();
    }
  }, [syllabusItemId]);

  const loadSubjectProgress = async () => {
    try {
      setLoading(true);
      const data = await syllabusService.getSubjectProgress(classInstanceId, subjectId);
      setProgress(data);
    } catch (error) {
      console.error('Error loading subject progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyllabusItem = async () => {
    try {
      const { data, error } = await supabase
        .from('syllabus_items')
        .select(`
          id,
          unit_no,
          title,
          status,
          completed_by,
          completed_at,
          admin!syllabus_items_completed_by_fkey(full_name)
        `)
        .eq('id', syllabusItemId)
        .single();

      if (error) throw error;
      setSyllabusItem(data);
    } catch (error) {
      console.error('Error loading syllabus item:', error);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!syllabusItemId) return;

    try {
      setLoading(true);
      await syllabusService.markItemStatus(syllabusItemId, newStatus);
      
      // Update local state
      setSyllabusItem(prev => ({ ...prev, status: newStatus }));
      
      // Reload progress
      await loadSubjectProgress();
      
      // Notify parent
      if (onStatusChange) {
        onStatusChange(syllabusItemId, newStatus);
      }
      
      message.success(`Chapter marked as ${newStatus}`);
    } catch (error) {
      message.error(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'processing';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined />;
      case 'in_progress': return <PlayCircleOutlined />;
      case 'pending': return <ClockCircleOutlined />;
      default: return <ClockCircleOutlined />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  };

  if (!progress && !syllabusItem) {
    return null;
  }

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {/* Subject Progress */}
      {showProgress && progress && (
        <div>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Progress: {progress.completed}/{progress.total} ({progress.percentage}%)
            </Text>
            <Progress 
              percent={progress.percentage} 
              size="small" 
              showInfo={false}
              strokeColor={progress.percentage === 100 ? '#52c41a' : '#1890ff'}
            />
          </Space>
        </div>
      )}

      {/* Syllabus Item Status */}
      {syllabusItem && (
        <div>
          <Tooltip 
            title={
              <div>
                <div><strong>Chapter {syllabusItem.unit_no}: {syllabusItem.title}</strong></div>
                {syllabusItem.completed_by && (
                  <div>Completed by: {syllabusItem.admin?.full_name || 'Unknown'}</div>
                )}
                {syllabusItem.completed_at && (
                  <div>Completed: {new Date(syllabusItem.completed_at).toLocaleDateString()}</div>
                )}
              </div>
            }
          >
            <Tag
              color={getStatusColor(syllabusItem.status)}
              icon={getStatusIcon(syllabusItem.status)}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                // Cycle through statuses: pending -> in_progress -> completed -> pending
                const statusOrder = ['pending', 'in_progress', 'completed'];
                const currentIndex = statusOrder.indexOf(syllabusItem.status);
                const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
                handleStatusChange(nextStatus);
              }}
            >
              {getStatusText(syllabusItem.status)}
            </Tag>
          </Tooltip>
        </div>
      )}

      {/* Quick Status Buttons for Syllabus Item */}
      {syllabusItem && (
        <Space size="small">
          <Tag
            size="small"
            color={syllabusItem.status === 'pending' ? 'blue' : 'default'}
            style={{ cursor: 'pointer' }}
            onClick={() => handleStatusChange('pending')}
          >
            Pending
          </Tag>
          <Tag
            size="small"
            color={syllabusItem.status === 'in_progress' ? 'orange' : 'default'}
            style={{ cursor: 'pointer' }}
            onClick={() => handleStatusChange('in_progress')}
          >
            In Progress
          </Tag>
          <Tag
            size="small"
            color={syllabusItem.status === 'completed' ? 'green' : 'default'}
            style={{ cursor: 'pointer' }}
            onClick={() => handleStatusChange('completed')}
          >
            Completed
          </Tag>
        </Space>
      )}
    </Space>
  );
};

export default SyllabusProgressIndicator;
