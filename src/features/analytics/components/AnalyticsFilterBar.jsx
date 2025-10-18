// src/ui/AnalyticsFilterBar.jsx
// Shared global filters component for analytics

import React from 'react';
import { Card, Select, DatePicker, Button, Typography, Row, Col, Space } from 'antd';
import { CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AnalyticsFilterBar = ({
  // Filter values
  dateRange,
  selectedClassId,
  selectedSchoolCode,
  academicYear,
  
  // Filter options
  classes = [],
  schools = [],
  academicYears = [],
  
  // Handlers
  onDateRangeChange,
  onClassChange,
  onSchoolChange,
  onAcademicYearChange,
  onRefresh,
  
  // UI props
  loading = false,
  showSchoolFilter = false,
  showClassFilter = true,
  showAcademicYearFilter = false,
  className = '',
  style = {}
}) => {
  const { isDarkMode, theme } = useTheme();
  
  return (
    <Card 
      className={`analytics-filter-bar ${className}`}
      style={{ 
        marginBottom: 24, 
        borderRadius: 12,
        background: theme.token.colorBgContainer,
        border: `1px solid ${theme.token.colorBorder}`,
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        width: '100%',
        ...style
      }}
      styles={{ body: { padding: window.innerWidth < 768 ? '16px' : '20px' } }}
    >
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ 
          margin: 0, 
          color: theme.token.colorTextHeading,
          fontSize: window.innerWidth < 768 ? 16 : 18
        }}>
          📊 Filter Analytics
        </Title>
        <Text type="secondary" style={{ 
          fontSize: window.innerWidth < 768 ? '12px' : '14px', 
          color: theme.token.colorTextSecondary,
          lineHeight: 1.4
        }}>
          Select filters to view analytics data
        </Text>
      </div>
      
      <Row gutter={[12, 16]} align="middle">
        {/* Date Range */}
        <Col xs={24} sm={24} md={12} lg={6}>
          <div>
            <Text strong style={{ 
              display: 'block', 
              marginBottom: 8,
              fontSize: window.innerWidth < 768 ? '13px' : '14px'
            }}>
              📅 Date Range
            </Text>
            <RangePicker
              value={dateRange}
              onChange={onDateRangeChange}
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Start Date', 'End Date']}
              size={window.innerWidth < 768 ? "middle" : "large"}
            />
          </div>
        </Col>

        {/* School Filter */}
        {showSchoolFilter && (
          <Col xs={24} sm={24} md={12} lg={6}>
            <div>
              <Text strong style={{ 
                display: 'block', 
                marginBottom: 8,
                fontSize: window.innerWidth < 768 ? '13px' : '14px'
              }}>
                🏫 School
              </Text>
              <Select
                value={selectedSchoolCode}
                onChange={onSchoolChange}
                style={{ width: '100%' }}
                placeholder="Select School"
                allowClear
                size={window.innerWidth < 768 ? "middle" : "large"}
              >
                {schools.map(school => (
                  <Option key={school.code} value={school.code}>
                    {school.name}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
        )}

        {/* Class Filter */}
        {showClassFilter && (
          <Col xs={24} sm={24} md={12} lg={6}>
            <div>
              <Text strong style={{ 
                display: 'block', 
                marginBottom: 8,
                fontSize: window.innerWidth < 768 ? '13px' : '14px'
              }}>
                🏫 Class
              </Text>
              <Select
                value={selectedClassId}
                onChange={onClassChange}
                style={{ width: '100%' }}
                placeholder="Select Class"
                allowClear={selectedClassId !== 'all'}
                size={window.innerWidth < 768 ? "middle" : "large"}
              >
                {classes.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    {cls.id === 'all' ? '🏫 All Classes' : (cls.class_name || `${cls.grade}-${cls.section}`)}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
        )}

        {/* Academic Year Filter */}
        {showAcademicYearFilter && (
          <Col xs={24} sm={24} md={12} lg={6}>
            <div>
              <Text strong style={{ 
                display: 'block', 
                marginBottom: 8,
                fontSize: window.innerWidth < 768 ? '13px' : '14px'
              }}>
                📚 Academic Year
              </Text>
              <Select
                value={academicYear}
                onChange={onAcademicYearChange}
                style={{ width: '100%' }}
                placeholder="Select Academic Year"
                allowClear
                size={window.innerWidth < 768 ? "middle" : "large"}
              >
                {academicYears.map(year => (
                  <Option key={year.id} value={year.id}>
                    {year.name}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
        )}

        {/* Refresh Button */}
        <Col xs={24} sm={24} md={12} lg={6}>
          <div style={{ 
            textAlign: window.innerWidth < 768 ? 'center' : 'right',
            marginTop: window.innerWidth < 768 ? 8 : 0
          }}>
            <Button 
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              loading={loading}
              size={window.innerWidth < 768 ? "middle" : "large"}
              style={{ 
                borderRadius: 8,
                minWidth: window.innerWidth < 768 ? '100px' : '120px',
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

export default AnalyticsFilterBar;
