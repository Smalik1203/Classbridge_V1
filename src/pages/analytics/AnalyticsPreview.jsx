// src/pages/analytics/AnalyticsPreview.jsx
// Preview page to test AnalyticsCard components with mocked data

import React, { useState } from 'react';
import { Row, Col, Typography, Button, Space, Card } from 'antd';
import { useTheme } from '../../contexts/ThemeContext';
import AnalyticsCard from '../../ui/AnalyticsCard';

const { Title, Text } = Typography;

const AnalyticsPreview = () => {
  const { isDarkMode, theme } = useTheme();
  const [showError, setShowError] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  // Mock data for testing
  const mockData = {
    attendance: {
      primaryPercent: 85.7,
      primaryLabel: 'Present',
      secondaryPercent: 14.3,
      secondaryLabel: 'Absent',
      supporting: [
        { label: 'Students', value: '142' },
        { label: 'Working Days', value: '22' }
      ]
    },
    fees: {
      primaryPercent: 78.2,
      primaryLabel: 'Collected',
      secondaryPercent: 21.8,
      secondaryLabel: 'Outstanding',
      supporting: [
        { label: 'Students', value: '142' },
        { label: 'Total Amount', value: '₹3,26,200' }
      ]
    },
    exams: {
      primaryPercent: 72.5,
      primaryLabel: 'Pass',
      secondaryPercent: 27.5,
      secondaryLabel: 'Fail',
      supporting: [
        { label: 'Tests', value: '8' },
        { label: 'Avg Score', value: '68.4%' }
      ]
    },
    learning: {
      primaryPercent: 65.3,
      primaryLabel: 'Completed',
      secondaryPercent: 34.7,
      secondaryLabel: 'Pending',
      supporting: [
        { label: 'Resources', value: '24' },
        { label: 'Students', value: '142' }
      ]
    }
  };

  const handleViewDetails = (module) => {
    console.log(`View details for ${module}`);
  };

  return (
    <div style={{ 
      padding: '20px', 
      background: isDarkMode ? theme.token.colorBgLayout : '#fafafa', 
      minHeight: '100vh' 
    }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ 
          margin: 0, 
          color: theme.token.colorTextHeading,
          marginBottom: 8
        }}>
          🧪 Analytics Preview
        </Title>
        <Text type="secondary" style={{ 
          fontSize: '16px',
          color: theme.token.colorTextSecondary
        }}>
          Testing the unified AnalyticsCard components with mocked data
        </Text>
      </div>

      {/* Test Controls */}
      <Card style={{ marginBottom: 24 }}>
        <Space>
          <Button 
            type={showError ? 'primary' : 'default'}
            onClick={() => setShowError(!showError)}
          >
            Toggle Error State
          </Button>
          <Button 
            type={showLoading ? 'primary' : 'default'}
            onClick={() => setShowLoading(!showLoading)}
          >
            Toggle Loading State
          </Button>
        </Space>
      </Card>

      {/* Analytics Grid */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <AnalyticsCard
            title="Attendance"
            primaryPercent={mockData.attendance.primaryPercent}
            primaryLabel={mockData.attendance.primaryLabel}
            secondaryPercent={mockData.attendance.secondaryPercent}
            secondaryLabel={mockData.attendance.secondaryLabel}
            supporting={mockData.attendance.supporting}
            onViewDetails={() => handleViewDetails('attendance')}
            loading={showLoading}
            error={showError ? 'Failed to load attendance data' : null}
          />
        </Col>

        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <AnalyticsCard
            title="Fees"
            primaryPercent={mockData.fees.primaryPercent}
            primaryLabel={mockData.fees.primaryLabel}
            secondaryPercent={mockData.fees.secondaryPercent}
            secondaryLabel={mockData.fees.secondaryLabel}
            supporting={mockData.fees.supporting}
            onViewDetails={() => handleViewDetails('fees')}
            loading={showLoading}
            error={showError ? 'Failed to load fees data' : null}
          />
        </Col>

        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <AnalyticsCard
            title="Exams"
            primaryPercent={mockData.exams.primaryPercent}
            primaryLabel={mockData.exams.primaryLabel}
            secondaryPercent={mockData.exams.secondaryPercent}
            secondaryLabel={mockData.exams.secondaryLabel}
            supporting={mockData.exams.supporting}
            onViewDetails={() => handleViewDetails('exams')}
            loading={showLoading}
            error={showError ? 'Failed to load exams data' : null}
          />
        </Col>

        <Col xs={24} sm={24} md={12} lg={12} xl={12}>
          <AnalyticsCard
            title="Learning"
            primaryPercent={mockData.learning.primaryPercent}
            primaryLabel={mockData.learning.primaryLabel}
            secondaryPercent={mockData.learning.secondaryPercent}
            secondaryLabel={mockData.learning.secondaryLabel}
            supporting={mockData.learning.supporting}
            onViewDetails={() => handleViewDetails('learning')}
            loading={showLoading}
            error={showError ? 'Failed to load learning data' : null}
          />
        </Col>
      </Row>

      {/* Edge Cases Testing */}
      <div style={{ marginTop: 40 }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          Edge Cases Testing
        </Title>
        
        <Row gutter={[20, 20]}>
          <Col xs={24} sm={24} md={8}>
            <AnalyticsCard
              title="Zero Data"
              primaryPercent={0}
              primaryLabel="Present"
              secondaryPercent={0}
              secondaryLabel="Absent"
              supporting={[
                { label: 'Students', value: '0' },
                { label: 'Working Days', value: '0' }
              ]}
              onViewDetails={() => handleViewDetails('zero')}
            />
          </Col>

          <Col xs={24} sm={24} md={8}>
            <AnalyticsCard
              title="Perfect Score"
              primaryPercent={100}
              primaryLabel="Collected"
              secondaryPercent={0}
              secondaryLabel="Outstanding"
              supporting={[
                { label: 'Students', value: '50' },
                { label: 'Total Amount', value: '₹1,00,000' }
              ]}
              onViewDetails={() => handleViewDetails('perfect')}
            />
          </Col>

          <Col xs={24} sm={24} md={8}>
            <AnalyticsCard
              title="Decimal Precision"
              primaryPercent={33.7}
              primaryLabel="Pass"
              secondaryPercent={66.3}
              secondaryLabel="Fail"
              supporting={[
                { label: 'Tests', value: '3' },
                { label: 'Avg Score', value: '33.7%' }
              ]}
              onViewDetails={() => handleViewDetails('decimal')}
            />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default AnalyticsPreview;
