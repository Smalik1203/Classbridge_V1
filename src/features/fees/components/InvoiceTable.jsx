import React, { useMemo, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, DatePicker, Tooltip, Dropdown } from 'antd';
import { MoneyCollectOutlined, EyeOutlined, FilePdfOutlined, MoreOutlined, MailOutlined, BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fmtRupees } from '../utils/money';

const { RangePicker } = DatePicker;

const STATUS_COLORS = { paid: 'green', partial: 'gold', pending: 'red', overdue: 'volcano' };

function deriveStatus(inv) {
  const t = Number(inv.total_amount || 0);
  const p = Number(inv.paid_amount || 0);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  if (inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day')) return 'overdue';
  return 'pending';
}

export default function InvoiceTable({
  data = [],
  loading,
  selectable = true,
  selectedKeys = [],
  onSelectChange,
  onOpenDetail,
  onRecordPayment,
  onViewDocument,
  onSendReminder,
  showStudent = true,
  classes = [],
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = [...(data || [])];
    if (search.trim()) {
      const needle = search.toLowerCase();
      rows = rows.filter((r) =>
        r.student?.full_name?.toLowerCase().includes(needle) ||
        r.student?.student_code?.toLowerCase().includes(needle) ||
        r.billing_period?.toLowerCase().includes(needle),
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => deriveStatus(r) === statusFilter);
    }
    if (classFilter !== 'all') {
      rows = rows.filter((r) => r.student?.class_instance_id === classFilter);
    }
    if (dateRange?.length === 2) {
      const [from, to] = dateRange;
      rows = rows.filter((r) => {
        if (!r.due_date) return true;
        const d = dayjs(r.due_date);
        return (!from || d.isAfter(from.subtract(1, 'day'))) && (!to || d.isBefore(to.add(1, 'day')));
      });
    }
    return rows;
  }, [data, search, statusFilter, classFilter, dateRange]);

  const columns = [
    showStudent && {
      title: 'Student',
      dataIndex: ['student', 'full_name'],
      sorter: (a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || ''),
      render: (val, r) => (
        <div>
          <div>{val || '—'}</div>
          {r.student?.student_code && <div style={{ color: '#888', fontSize: 12 }}>{r.student.student_code}</div>}
        </div>
      ),
    },
    {
      title: 'Period',
      dataIndex: 'billing_period',
      width: 120,
      sorter: (a, b) => (a.billing_period || '').localeCompare(b.billing_period || ''),
    },
    {
      title: 'Due',
      dataIndex: 'due_date',
      width: 130,
      sorter: (a, b) => (a.due_date || '').localeCompare(b.due_date || ''),
      render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      align: 'right',
      width: 130,
      sorter: (a, b) => Number(a.total_amount || 0) - Number(b.total_amount || 0),
      render: (v) => fmtRupees(v),
    },
    {
      title: 'Paid',
      dataIndex: 'paid_amount',
      align: 'right',
      width: 130,
      sorter: (a, b) => Number(a.paid_amount || 0) - Number(b.paid_amount || 0),
      render: (v) => <span style={{ color: '#1677ff' }}>{fmtRupees(v)}</span>,
    },
    {
      title: 'Balance',
      align: 'right',
      width: 130,
      sorter: (a, b) =>
        (Number(a.total_amount || 0) - Number(a.paid_amount || 0)) -
        (Number(b.total_amount || 0) - Number(b.paid_amount || 0)),
      render: (_, r) => {
        const b = Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0));
        return <b style={{ color: b > 0 ? '#cf1322' : '#3f8600' }}>{fmtRupees(b)}</b>;
      },
    },
    {
      title: 'Status',
      width: 120,
      filters: [
        { text: 'Paid', value: 'paid' },
        { text: 'Partial', value: 'partial' },
        { text: 'Pending', value: 'pending' },
        { text: 'Overdue', value: 'overdue' },
      ],
      onFilter: (val, r) => deriveStatus(r) === val,
      render: (_, r) => {
        const s = deriveStatus(r);
        return <Tag color={STATUS_COLORS[s]}>{s.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, r) => {
        const balance = Math.max(0, Number(r.total_amount || 0) - Number(r.paid_amount || 0));
        return (
          <Space size={4}>
            <Tooltip title="Open detail">
              <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => onOpenDetail?.(r)} />
            </Tooltip>
            {balance > 0 && (
              <Tooltip title="Record payment">
                <Button size="small" type="text" icon={<MoneyCollectOutlined />} onClick={() => onRecordPayment?.(r)} />
              </Tooltip>
            )}
            <Dropdown
              menu={{
                items: [
                  { key: 'doc', label: 'View document', icon: <FilePdfOutlined />, onClick: () => onViewDocument?.(r) },
                  { key: 'remind', label: 'Send reminder', icon: <MailOutlined />, onClick: () => onSendReminder?.(r) },
                ],
              }}
            >
              <Button size="small" type="text" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ].filter(Boolean);

  const rowSelection = selectable
    ? {
      selectedRowKeys: selectedKeys,
      onChange: onSelectChange,
    }
    : undefined;

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Search student / code / period"
          allowClear
          onSearch={setSearch}
          onChange={(e) => !e.target.value && setSearch('')}
          style={{ width: 260 }}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'partial', label: 'Partial' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' },
          ]}
          style={{ width: 160 }}
        />
        <Select
          value={classFilter}
          onChange={setClassFilter}
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          options={[
            { value: 'all', label: 'All classes' },
            ...(classes || []).map((c) => ({
              value: c.id,
              label: `Grade ${c.grade ?? '-'}${c.section ? ` ${c.section}` : ''}`,
            })),
          ]}
        />
        <RangePicker value={dateRange} onChange={setDateRange} format="DD MMM YYYY" placeholder={['Due from', 'Due to']} />
        {selectedKeys?.length > 0 && (
          <Tag color="purple">{selectedKeys.length} selected</Tag>
        )}
      </Space>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        rowSelection={rowSelection}
        pagination={{
          current: currentPage,
          pageSize,
          showSizeChanger: true,
          pageSizeOptions: [10, 15, 25, 50, 100],
          showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
          position: ['bottomRight'],
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== pageSize) setPageSize(size);
          },
          onShowSizeChange: (_, size) => {
            setPageSize(size);
            setCurrentPage(1);
          },
        }}
        scroll={{ x: 1100 }}
      />
    </>
  );
}
