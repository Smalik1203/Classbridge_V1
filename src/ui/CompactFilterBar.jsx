// src/ui/CompactFilterBar.jsx
// Compact filter bar with IST timezone support for analytics

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, DatePicker, Button, Typography, Row, Col, Space } from 'antd';
import { CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configure dayjs for IST timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const IST_TIMEZONE = 'Asia/Kolkata';

const CompactFilterBar = ({
  dateRange,
  selectedClassId,
  classes = [],
  onDateRangeChange,
  onClassChange,
  onRefresh,
  loading = false,
  className = '',
  style = {}
}) => {
  const { isDarkMode, theme } = useTheme();
  const [debouncedDateRange, setDebouncedDateRange] = useState(dateRange);

  // Debounce date range changes (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedDateRange !== dateRange) {
        onDateRangeChange(debouncedDateRange);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedDateRange, dateRange, onDateRangeChange]);

  // Handle date range change with IST conversion
  const handleDateRangeChange = useCallback((dates) => {
    if (dates && dates[0] && dates[1]) {
      // Convert to IST timezone
      const startIST = dates[0].tz(IST_TIMEZONE);
      const endIST = dates[1].tz(IST_TIMEZONE);
      setDebouncedDateRange([startIST, endIST]);
    } else {
      setDebouncedDateRange(dates);
    }
  }, []);

  // Handle class change (no debounce needed)
  const handleClassChange = useCallback((classId) => {
    onClassChange(classId);
  }, [onClassChange]);

  // Handle refresh (immediate)
  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <Card 
      className={`compact-filter-bar ${className}`}
      style={{ 
        marginBottom: 20, 
        borderRadius: 12,
        background: theme.token.colorBgContainer,
        border: `1px solid ${theme.token.colorBorder}`,
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        ...style
      }}
      styles={{ body: { padding: '16px' } }}
    >
      <Row gutter={[16, 12]} align="middle">
        {/* Date Range */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <div>
            <Text strong style={{ 
              display: 'block', 
              marginBottom: 6,
              fontSize: '13px',
              color: theme.token.colorTextHeading
            }}>
              📅 Date Range
            </Text>
            <RangePicker
              value={debouncedDateRange}
              onChange={handleDateRangeChange}
              style={{ width: '100%' }}
              format="DD MMM YYYY"
              placeholder={['Start Date', 'End Date']}
              size="middle"
              allowClear={false}
              presets={[
                {
                  label: 'Last 7 days',
                  value: [dayjs().subtract(7, 'days'), dayjs()]
                },
                {
                  label: 'Last 30 days',
                  value: [dayjs().subtract(30, 'days'), dayjs()]
                },
                {
                  label: 'This month',
                  value: [dayjs().startOf('month'), dayjs().endOf('month')]
                },
                {
                  label: 'Last month',
                  value: [
                    dayjs().subtract(1, 'month').startOf('month'),
                    dayjs().subtract(1, 'month').endOf('month')
                  ]
                }
              ]}
            />
          </div>
        </Col>

        {/* Class Filter */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <div>
            <Text strong style={{ 
              display: 'block', 
              marginBottom: 6,
              fontSize: '13px',
              color: theme.token.colorTextHeading
            }}>
              🏫 Class
            </Text>
            <Select
              value={selectedClassId}
              onChange={handleClassChange}
              style={{ width: '100%' }}
              placeholder="Select Class"
              allowClear={selectedClassId !== 'all'}
              size="middle"
            >
              {classes.map(cls => (
                <Option key={cls.id} value={cls.id}>
                  {cls.id === 'all' ? '🏫 All Classes' : (cls.class_name || `${cls.grade}-${cls.section}`)}
                </Option>
              ))}
            </Select>
          </div>
        </Col>

        {/* Timezone Info */}
        <Col xs={24} sm={24} md={8} lg={6}>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ 
              fontSize: '12px',
              color: theme.token.colorTextSecondary
            }}>
              📍 Timezone: {IST_TIMEZONE}
            </Text>
          </div>
        </Col>

        {/* Refresh Button */}
        <Col xs={24} sm={24} md={8} lg={6}>
          <div style={{ 
            textAlign: window.innerWidth < 768 ? 'center' : 'right'
          }}>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              size="middle"
              style={{ 
                borderRadius: 8,
                minWidth: '100px',
                background: '#3b82f6',
                borderColor: '#3b82f6',
                width: window.innerWidth < 768 ? '100%' : 'auto'
              }}
              type="primary"
            >
              🔄 Refresh
            </Button>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default CompactFilterBar;
