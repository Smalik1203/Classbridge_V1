import React from 'react';
import { Table, Tag, Typography, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { chartTheme, getStatusBadge, getCollectionRateColor } from '../charts/chartTheme';
import { fmtINR } from '@/features/fees/utils/money';

const { Text } = Typography;

const EnhancedStudentTable = ({ 
  data, 
  loading = false, 
  onRowClick,
  style = {},
  ...props 
}) => {
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircleOutlined style={{ color: chartTheme.colors.success }} />;
      case 'partiallyPaid':
        return <ClockCircleOutlined style={{ color: chartTheme.colors.warning }} />;
      case 'unpaid':
        return <CloseCircleOutlined style={{ color: chartTheme.colors.error }} />;
      default:
        return <ExclamationCircleOutlined style={{ color: chartTheme.colors.textSecondary }} />;
    }
  };

  const getStatusTag = (status, amount = 0) => {
    const badge = getStatusBadge(status, amount);
    
    return (
      <Tag 
        color={badge.color} 
        icon={getStatusIcon(status)}
        style={{ 
          borderRadius: '12px',
          padding: '2px 8px',
          fontSize: '12px',
          fontWeight: 500
        }}
      >
        {badge.text}
      </Tag>
    );
  };

  const getCollectionRateDisplay = (rate, amount) => {
    if (amount === 0) return <Text type="secondary">—</Text>;
    
    const color = getCollectionRateColor(rate);
    return (
      <Text 
        style={{ 
          color, 
          fontWeight: 600,
          fontSize: '13px'
        }}
      >
        {rate.toFixed(1)}%
      </Text>
    );
  };

  const formatAmount = (amount) => {
    if (amount === 0) return <Text type="secondary">—</Text>;
    return (
      <Text style={{ fontWeight: 500 }}>
        {fmtINR(amount)}
      </Text>
    );
  };

  const columns = [
    {
      title: 'Student Name',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 200,
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>
            {text}
          </Text>
          {record.student_code && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.student_code}
              </Text>
            </div>
          )}
        </div>
      ),
      sorter: (a, b) => a.student_name.localeCompare(b.student_name),
    },
    {
      title: 'Class',
      dataIndex: 'class_name',
      key: 'class_name',
      width: 120,
      render: (text) => (
        <Tag color="blue" style={{ borderRadius: '8px' }}>
          {text}
        </Tag>
      ),
      filters: [...new Set(data.map(item => item.class_name))].map(name => ({
        text: name,
        value: name,
      })),
      onFilter: (value, record) => record.class_name === value,
    },
    {
      title: 'Total Fee',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      align: 'right',
      render: formatAmount,
      sorter: (a, b) => a.total_amount - b.total_amount,
    },
    {
      title: 'Collected',
      dataIndex: 'collected_amount',
      key: 'collected_amount',
      width: 120,
      align: 'right',
      render: formatAmount,
      sorter: (a, b) => a.collected_amount - b.collected_amount,
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding_amount',
      key: 'outstanding_amount',
      width: 120,
      align: 'right',
      render: (amount) => {
        if (amount === 0) return <Text type="secondary">—</Text>;
        return (
          <Text 
            style={{ 
              color: chartTheme.colors.error,
              fontWeight: 600
            }}
          >
            {fmtINR(amount)}
          </Text>
        );
      },
      sorter: (a, b) => a.outstanding_amount - b.outstanding_amount,
    },
    {
      title: 'Collection Rate',
      dataIndex: 'collection_rate',
      key: 'collection_rate',
      width: 120,
      align: 'center',
      render: (rate, record) => getCollectionRateDisplay(rate, record.total_amount),
      sorter: (a, b) => a.collection_rate - b.collection_rate,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      align: 'center',
      render: (status, record) => {
        // Determine status based on collection rate and amounts
        let actualStatus = status;
        if (record.total_amount === 0) {
          actualStatus = 'noPlan';
        } else if (record.collection_rate === 100) {
          actualStatus = 'paid';
        } else if (record.collection_rate > 0) {
          actualStatus = 'partiallyPaid';
        } else {
          actualStatus = 'unpaid';
        }
        
        return getStatusTag(actualStatus, record.total_amount);
      },
      filters: [
        { text: 'Paid', value: 'paid' },
        { text: 'Partially Paid', value: 'partiallyPaid' },
        { text: 'Unpaid', value: 'unpaid' },
        { text: 'No Plan', value: 'noPlan' },
      ],
      onFilter: (value, record) => {
        if (record.total_amount === 0) return value === 'noPlan';
        if (record.collection_rate === 100) return value === 'paid';
        if (record.collection_rate > 0) return value === 'partiallyPaid';
        return value === 'unpaid';
      },
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      loading={loading}
      rowKey="student_id"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => 
          `${range[0]}-${range[1]} of ${total} students`,
        pageSizeOptions: ['10', '20', '50', '100'],
      }}
      scroll={{ x: 800 }}
      style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        ...style
      }}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record),
        style: { cursor: onRowClick ? 'pointer' : 'default' }
      })}
      {...props}
    />
  );
};

export default EnhancedStudentTable;
