import React, { useState } from 'react';
import { Card, Tag, Typography, Empty, Space, Tooltip } from 'antd';
import { PhoneOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ENQUIRY_STATUSES, STATUS_META, PRIORITIES } from '../services/admissionsService';

dayjs.extend(relativeTime);
const { Text } = Typography;

const COLUMNS = ENQUIRY_STATUSES; // new, contacted, follow_up, admitted, rejected

function priorityDot(p) {
  const m = PRIORITIES.find(x => x.value === p);
  return m ? <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: m.color, marginRight: 6, verticalAlign: 'middle'
  }} /> : null;
}

/**
 * Drag-and-drop kanban board, web-native enhancement.
 * Uses HTML5 drag API (no extra deps) so we stay light.
 */
export default function KanbanBoard({ enquiries, onCardClick, onMove, canManage }) {
  const [dragOver, setDragOver] = useState(null);

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = enquiries.filter(e => e.status === col);
    return acc;
  }, {});

  const onDragStart = (e, item) => {
    if (!canManage) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, status: item.status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setDragOver(null);
    if (!canManage) return;
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (payload.status !== status) onMove?.(payload.id, status);
    } catch { /* noop */ }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`,
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 8,
    }}>
      {COLUMNS.map(col => {
        const meta = STATUS_META[col];
        const items = grouped[col];
        return (
          <div
            key={col}
            onDragOver={e => { if (canManage) { e.preventDefault(); setDragOver(col); } }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => onDrop(e, col)}
            style={{
              background: dragOver === col ? meta.bg : '#F9FAFB',
              border: `1px dashed ${dragOver === col ? meta.color : '#E5E7EB'}`,
              borderRadius: 10,
              padding: 10,
              minHeight: 320,
              transition: 'background 0.15s',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 4px 8px', borderBottom: `2px solid ${meta.color}`,
              marginBottom: 8,
            }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: meta.text }}>{meta.label}</span>
              <Tag color={meta.color} style={{ borderRadius: 12, border: 'none', color: '#fff', minWidth: 28, textAlign: 'center' }}>
                {items.length}
              </Tag>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: 12 }}>
                {canManage ? 'Drag here' : 'No items'}
              </div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {items.map(item => (
                  <Card
                    key={item.id}
                    size="small"
                    hoverable
                    draggable={canManage}
                    onDragStart={e => onDragStart(e, item)}
                    onClick={() => onCardClick?.(item)}
                    style={{
                      cursor: canManage ? 'grab' : 'pointer',
                      borderLeft: `3px solid ${meta.color}`,
                    }}
                    styles={{ body: { padding: 10 } }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {priorityDot(item.priority)}
                      {item.student_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                      Class {item.class_applying_for}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      <UserOutlined style={{ marginRight: 4 }} />
                      {item.parent_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      <PhoneOutlined style={{ marginRight: 4 }} />
                      {item.parent_phone}
                    </div>
                    <Tooltip title={dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {dayjs(item.created_at).fromNow()}
                      </Text>
                    </Tooltip>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        );
      })}
    </div>
  );
}
