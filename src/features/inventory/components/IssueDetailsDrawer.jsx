import React, { useMemo } from 'react';
import { Drawer, Tag, Button, Space, Typography, Statistic, Row, Col, Empty, Table, Tooltip } from 'antd';
import { RollbackOutlined, BarcodeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

/**
 * Drawer showing every active issuance for one inventory item, with one-click
 * Return per row. Replaces mobile's IssueDetailsModal — adds a sortable table
 * and a per-row action column (web pattern).
 */
export default function IssueDetailsDrawer({
  open, onClose, itemName, issues = [], canManage, onReturnPress,
}) {
  const stats = useMemo(() => {
    const totalQty = issues.reduce((s, i) => s + i.quantity, 0);
    const overdue = issues.filter(i => i.expected_return_date && new Date(i.expected_return_date) < new Date()).length;
    const totalCharge = issues.reduce((s, i) => s + ((i.charge_amount || 0) * i.quantity), 0);
    return { totalQty, overdue, totalCharge };
  }, [issues]);

  const columns = [
    {
      title: 'Recipient',
      dataIndex: 'issued_to_name',
      key: 'name',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'capitalize' }}>
            {r.issued_to_type}
          </Text>
        </Space>
      ),
      sorter: (a, b) => (a.issued_to_name || '').localeCompare(b.issued_to_name || ''),
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'qty',
      width: 70,
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Issued',
      dataIndex: 'issue_date',
      key: 'date',
      width: 110,
      render: v => dayjs(v).format('DD MMM YYYY'),
      sorter: (a, b) => new Date(a.issue_date) - new Date(b.issue_date),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Return by',
      dataIndex: 'expected_return_date',
      key: 'return',
      width: 130,
      render: v => {
        if (!v) return <Text type="secondary">—</Text>;
        const overdue = new Date(v) < new Date();
        return (
          <Space size={4}>
            {dayjs(v).format('DD MMM YYYY')}
            {overdue && <Tag color="red" style={{ margin: 0 }}>Overdue</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Charge',
      dataIndex: 'charge_amount',
      key: 'charge',
      width: 110,
      render: (v, r) => v != null
        ? <Text>₹{v} {r.charge_type === 'deposit' && <Tag style={{ marginLeft: 4 }}>dep</Tag>}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Serial #',
      dataIndex: 'serial_number',
      key: 'sn',
      width: 130,
      render: v => v ? <Space size={4}><BarcodeOutlined /> <Text code>{v}</Text></Space> : <Text type="secondary">—</Text>,
    },
    ...(canManage ? [{
      title: '',
      key: 'action',
      width: 100,
      render: (_, r) => (
        <Tooltip title="Return / Mark Lost">
          <Button size="small" icon={<RollbackOutlined />} onClick={() => onReturnPress?.(r)}>
            Return
          </Button>
        </Tooltip>
      ),
    }] : []),
  ];

  return (
    <Drawer
      title={<Space><Text strong>{itemName}</Text><Tag color="blue">{issues.length} active</Tag></Space>}
      open={open}
      onClose={onClose}
      width={Math.min(900, window.innerWidth - 24)}
      destroyOnClose
    >
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <div style={{ background: '#EEF2FF', padding: 12, borderRadius: 8 }}>
            <Statistic title="Units out" value={stats.totalQty} valueStyle={{ color: '#6366f1' }} />
          </div>
        </Col>
        <Col span={8}>
          <div style={{ background: stats.overdue ? '#FEE2E2' : '#F1F5F9', padding: 12, borderRadius: 8 }}>
            <Statistic
              title="Overdue"
              value={stats.overdue}
              valueStyle={{ color: stats.overdue ? '#ef4444' : '#64748b' }}
            />
          </div>
        </Col>
        <Col span={8}>
          <div style={{ background: '#D1FAE5', padding: 12, borderRadius: 8 }}>
            <Statistic
              title="Charged"
              value={stats.totalCharge}
              precision={0}
              prefix="₹"
              valueStyle={{ color: '#059669' }}
            />
          </div>
        </Col>
      </Row>

      {issues.length === 0 ? (
        <Empty description="No active issuances" />
      ) : (
        <Table
          rowKey="id"
          size="small"
          dataSource={issues}
          columns={columns}
          pagination={issues.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          scroll={{ x: 700 }}
        />
      )}
    </Drawer>
  );
}
