// src/components/timetable/ViewTab.jsx
import React, { useMemo } from 'react';
import { Card, Table, Tag, Typography, Space, Empty } from 'antd';
import { ClockCircleOutlined, BookOutlined } from '@ant-design/icons';
import SyllabusProgressIndicator from '../SyllabusProgressIndicator';

const { Text } = Typography;
const STATUS_COLOR = { pending: '#9CA3AF', in_progress: '#F59E0B', completed: '#16A34A' };

export default function ViewTab({
  classId,
  date,            // dayjs (not used in render)
  subjects = [],
  admins = [],
  daySlots = [],   // timetable_slots of that date
  chaptersById = new Map(),
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
      render: (_, r) => r.slot_type === 'break'
        ? <Tag color="gold">{r.name || 'Break'}</Tag>
        : <Text strong>Period #{r.period_number}</Text>
    },
    {
      title: 'Time', key: 'time', width: 140,
      render: (_, r) => (<Space size={6}><ClockCircleOutlined /><span>{String(r.start_time).slice(0,5)}–{String(r.end_time).slice(0,5)}</span></Space>)
    },
    {
      title: 'Subject', key: 'subject', width: 220,
      render: (_, r) => r.slot_type === 'period'
        ? (r.subject_id ? <Space size={6}><BookOutlined /><span>{subjectName(r.subject_id)}</span></Space> : <Tag>Unassigned</Tag>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Admin', key: 'admin', width: 220,
      render: (_, r) => r.slot_type === 'period'
        ? (r.teacher_id ? <span>{adminName(r.teacher_id)}</span> : <Text type="secondary">—</Text>)
        : <Text type="secondary">—</Text>
    },
    {
      title: 'Chapter & Progress', key: 'chapter', width: 400,
      render: (_, r) => {
        if (r.slot_type === 'break') return <Text type="secondary">—</Text>;
        const chId = r.syllabus_item_id;
        if (!chId) return <Text type="secondary">—</Text>;
        const ch = chaptersById.get(chId);
        if (!ch) return <Text type="secondary">Chapter selected</Text>;
        
        return (
          <SyllabusProgressIndicator
            classInstanceId={classId}
            subjectId={r.subject_id}
            syllabusItemId={chId}
            onStatusChange={onSyllabusStatusChange}
            showProgress={false}
          />
        );
      }
    },
    {
      title: 'Description', key: 'desc', width: 360,
      render: (_, r) => r.slot_type === 'period'
        ? (r.plan_text ? r.plan_text : <Text type="secondary">—</Text>)
        : <Text type="secondary">—</Text>
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
          rowClassName={(r) => r.slot_type === 'break' ? 'row-break' : ''}
          size="middle"
        />
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Empty 
            description={
              <div>
                <Text type="secondary" style={{ fontSize: '16px' }}>
                  No schedule available for this date
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Check back later or contact your teacher
                </Text>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
      <style>{`
        .row-break td { 
          background: #fffbe6 !important; 
          border-bottom: 2px solid #f0f0f0 !important;
        }
        .ant-table-tbody > tr:hover > td {
          background-color: #f5f5f5 !important;
        }
      `}</style>
    </div>
  ) : (
    <Card style={{ marginTop: 12, textAlign: 'center', padding: '40px 20px' }}>
      <Empty 
        description={
          <div>
            <Text type="secondary" style={{ fontSize: '16px' }}>
              Loading your class schedule...
            </Text>
          </div>
        }
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </Card>
  );
}
