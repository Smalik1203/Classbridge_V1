import React, { useState } from 'react';
import { Table, Button, Space, Tag, Typography, Tooltip, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { confirm } = Modal;

export default function CalendarEventList({
  events,
  loading,
  onEventEdit,
  onEventDelete,
  getEventTypeColor,
  getEventTypeLabel
}) {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const handleEdit = (event) => {
    onEventEdit(event);
  };

  const handleDelete = (event) => {
    confirm({
      title: 'Delete Event',
      content: `Are you sure you want to delete "${event.title}"?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        onEventDelete(event);
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select events to delete');
      return;
    }

    confirm({
      title: 'Delete Selected Events',
      content: `Are you sure you want to delete ${selectedRowKeys.length} selected events?`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        selectedRowKeys.forEach(id => {
          const event = events.find(e => e.id === id);
          if (event) {
            onEventDelete(event);
          }
        });
        setSelectedRowKeys([]);
      },
    });
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.description && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.description}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 120,
      render: (type) => (
        <Tag color={getEventTypeColor(type)}>
          {getEventTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: (date, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CalendarOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
            <Text>{dayjs(date).format('MMM DD, YYYY')}</Text>
          </div>
          {record.end_date && record.end_date !== record.start_date && (
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
              to {dayjs(record.end_date).format('MMM DD, YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 100,
      render: (time, record) => {
        if (!time) return <Text type="secondary">All Day</Text>;
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ClockCircleOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
            <Text>{time}</Text>
            {record.end_time && record.end_time !== time && (
              <Text type="secondary">- {record.end_time}</Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit Event">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Delete Event">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              size="small"
              danger
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      name: record.title,
    }),
  };

  return (
    <div>
      {/* Bulk Actions */}
      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f0f0', borderRadius: '6px' }}>
          <Space>
            <Text strong>{selectedRowKeys.length} events selected</Text>
            <Button
              type="primary"
              danger
              size="small"
              onClick={handleBulkDelete}
            >
              Delete Selected
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedRowKeys([])}
            >
              Clear Selection
            </Button>
          </Space>
        </div>
      )}

      {/* Events Table */}
      <Table
        columns={columns}
        dataSource={events}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} events`,
        }}
        scroll={{ x: 800 }}
        size="small"
      />
    </div>
  );
}
