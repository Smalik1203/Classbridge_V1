// src/components/timetable/ViewTab.jsx
import React, { useMemo } from 'react';
import { Card, Table, Tag, Typography, Space } from 'antd';
import { ClockCircleOutlined, BookOutlined } from '@ant-design/icons';
import SyllabusProgressIndicator from '../SyllabusProgressIndicator';
import EmptyState from '../../ui/EmptyState';

const { Text } = Typography;
const STATUS_COLOR = { pending: '#9CA3AF', in_progress: '#F59E0B', completed: '#16A34A' };

export default function ViewTab({
  classId,
  date,            // dayjs (not used in render)
  subjects = [],
  admins = [],
  daySlots = [],   // timetable_slots of that date
  chaptersById = new Map(),
  syllabusContentMap = new Map(), // For resolving new syllabus structure names
  onSyllabusStatusChange,
}) {
  const subjectName = (id) => subjects.find(s => s.id === id)?.subject_name || '—';
  const adminName = (id) => admins.find(a => a.id === id)?.full_name || '—';

  const rows = useMemo(() => {
    const safe = Array.isArray(daySlots) ? daySlots : [];
    return [...safe].sort((a, b) => {
      const as = a?.start_time || '';
      const bs = b?.start_time || '';
      return as > bs ? 1 : as < bs ? -1 : 0;
    }).map(r => ({ key: r.id, ...r }));
  }, [daySlots]);

  const columns = [
    {
      title: 'Slot', key: 'slot', width: 180,
      responsive: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => r.slot_type === 'break'
        ? <Tag color="gold">{r.name || 'Break'}</Tag>
        : <Text strong>Period #{r.period_number}</Text>
    },
    {
      title: 'Time', key: 'time', width: 140,
      responsive: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => (<Space size={6}><ClockCircleOutlined /><span>{String(r.start_time).slice(0,5)}–{String(r.end_time).slice(0,5)}</span></Space>)
    },
    {
      title: 'Subject', key: 'subject', width: 220,
      responsive: ['sm', 'md', 'lg', 'xl', 'xxl'],
      render: (_, r) => r.slot_type === 'period'
        ? (r.subject_id ? <Space size={6}><BookOutlined /><span>{subjectName(r.subject_id)}</span></Space> : <Tag>Unassigned</Tag>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Teacher', key: 'teacher', width: 220,
      responsive: ['md', 'lg', 'xl', 'xxl'],
      render: (_, r) => r.slot_type === 'period'
        ? (r.teacher_id ? <span>{adminName(r.teacher_id)}</span> : <Text type="secondary">—</Text>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Chapter', key: 'chapter', width: 200,
      responsive: ['md', 'lg', 'xl', 'xxl'],
      render: (_, r) => {
        if (r.slot_type === 'break') return <Text type="secondary">—</Text>;
        
        // Check for new syllabus structure first
        if (r.syllabus_topic_id) {
          const topicContent = syllabusContentMap.get(`topic_${r.syllabus_topic_id}`);
          if (topicContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{topicContent.chapterNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
                  {topicContent.chapterTitle}
                </Text>
              </div>
            );
          }
          return <Tag color="orange">Content not loaded</Tag>;
        } else if (r.syllabus_chapter_id) {
          const chapterContent = syllabusContentMap.get(`chapter_${r.syllabus_chapter_id}`);
          if (chapterContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{chapterContent.chapterNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
                  {chapterContent.title}
                </Text>
              </div>
            );
          }
          return <Tag color="orange">Chapter not loaded</Tag>;
        }
        
        // Fallback to old structure
        const chId = r.syllabus_item_id;
        if (!chId) {
          return (
            <Tag color="red" style={{ fontSize: '11px' }}>
              Not assigned
            </Tag>
          );
        }
        const ch = chaptersById.get(chId);
        if (!ch) return <Tag color="red">Chapter Missing</Tag>;
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag color="green" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>Ch{ch.unit_no}</Tag>
            <Text style={{ fontSize: '11px', color: '#1890ff', fontWeight: 500 }}>
              {ch.title}
            </Text>
          </div>
        );
      }
    },
    {
      title: 'Sub Topic', key: 'subtopic', width: 200,
      responsive: ['lg', 'xl', 'xxl'],
      render: (_, r) => {
        if (r.slot_type === 'break') return <Text type="secondary">—</Text>;
        
        // Check for new syllabus structure first
        if (r.syllabus_topic_id) {
          const topicContent = syllabusContentMap.get(`topic_${r.syllabus_topic_id}`);
          if (topicContent) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag color="blue" style={{ fontSize: '9px', margin: 0, padding: '1px 6px', lineHeight: '16px' }}>T{topicContent.topicNo}</Tag>
                <Text style={{ fontSize: '11px', color: '#52c41a' }}>
                  {topicContent.title}
                </Text>
              </div>
            );
          }
          return <Tag color="orange">Content not loaded</Tag>;
        } else if (r.syllabus_chapter_id) {
          return <Text style={{ fontSize: '10px', color: '#999' }}>No specific topic</Text>;
        }
        
        // Fallback to old structure
        if (r.syllabus_item_id) {
          return <Text style={{ fontSize: '10px', color: '#999' }}>No subtopics (old structure)</Text>;
        }
        return <Text style={{ fontSize: '10px', color: '#999' }}>No Topic</Text>;
      }
    },
  ];

  return classId ? (
    <div style={{ marginTop: 8 }}>
      {rows.length > 0 ? (
        <Table
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          bordered
          scroll={{ x: 1200 }}
          rowClassName={(r, index) => {
            if (r.slot_type === 'break') return 'row-break';
            return index % 2 === 0 ? 'row-period-even' : 'row-period-odd';
          }}
          size="small"
          responsive={true}
        />
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <EmptyState
            type="timetable"
            title="No timetable created yet"
            description="Switch to the Manage tab to create your first timetable with periods, breaks, and syllabus content."
            icon="📅"
          />
        </Card>
      )}
      <style>{`
        /* Reduce row height */
        .ant-table-tbody > tr > td {
          padding: 8px 12px !important;
          height: 40px !important;
        }
        .ant-table-thead > tr > th {
          padding: 8px 12px !important;
          height: 40px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #666 !important;
        }
        
        /* Zebra striping */
        .row-period-even td { 
          background: #fafafa !important; 
        }
        .row-period-odd td { 
          background: #ffffff !important; 
        }
        .row-break td { 
          background: #fff7e6 !important; 
          border-bottom: 2px solid #f0f0f0 !important;
        }
        
        /* Hover effects */
        .row-period-even:hover td {
          background-color: #f0f9ff !important;
          border-color: #91d5ff !important;
        }
        .row-period-odd:hover td {
          background-color: #f0f9ff !important;
          border-color: #91d5ff !important;
        }
        .row-break:hover td {
          background-color: #fff7e6 !important;
          border-color: #ffd591 !important;
        }
      `}</style>
    </div>
  ) : (
    <Card style={{ marginTop: 12, textAlign: 'center', padding: '40px 20px' }}>
      <EmptyState
        title="Loading your class schedule..."
        description="Please wait while we load your timetable data."
        icon="⏳"
      />
    </Card>
  );
}
