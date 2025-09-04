// src/insidepages/results.jsx
import React, { useState } from 'react';
import { 
  Layout, 
  Card, 
  Row, 
  Col, 
  Tabs, 
  Typography, 
  Space,
  Badge
} from 'antd';
import {
  TrophyOutlined,
  BookOutlined,
  BarChartOutlined,
  EditOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';
import ExamManagement from '../components/ExamManagement';
import ResultEntry from '../components/ResultEntry';
import ResultsAnalytics from '../components/ResultsAnalytics';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const Results = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('results');

  const userRole = user?.app_metadata?.role || 'user';
  const userName = user?.user_metadata?.full_name || 'User';

  // Role-based permissions (no teacher role in the app)
  const permissions = {
    canManageExams: ['superadmin', 'admin'].includes(userRole),
    canEnterResults: ['superadmin', 'admin'].includes(userRole),
    canViewAnalytics: ['superadmin', 'admin'].includes(userRole),
    canViewResults: ['superadmin', 'admin', 'student'].includes(userRole)
  };

  // Get available tabs based on user role
  const getAvailableTabs = () => {
    const tabs = [];

    if (permissions.canManageExams) {
      tabs.push({
        key: 'exams',
        label: (
          <Space>
            <BookOutlined />
            Exam Management
          </Space>
        ),
        children: <ExamManagement />
      });
    }

    if (permissions.canEnterResults) {
      tabs.push({
        key: 'results',
        label: (
          <Space>
            <EditOutlined />
            Result Entry
          </Space>
        ),
        children: <ResultEntry />
      });
    }

    if (permissions.canViewAnalytics) {
      tabs.push({
        key: 'analytics',
        label: (
          <Space>
            <BarChartOutlined />
            Analytics
          </Space>
        ),
        children: <ResultsAnalytics />
      });
    }

    return tabs;
  };

  const availableTabs = getAvailableTabs();

  // Set default active tab if current tab is not available
  if (!availableTabs.find(tab => tab.key === activeTab)) {
    setActiveTab(availableTabs[0]?.key || 'results');
  }

  return (
    <Content className="page-container">
      {/* Header */}
      <div className="page-header">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0, color: antdTheme.token.colorText }}>
              Results Management
            </Title>
            <Text type="secondary" style={{ fontSize: '16px', color: antdTheme.token.colorTextSecondary }}>
              {userRole === 'student' && 'View your exam results and academic performance'}
              {['admin', 'superadmin'].includes(userRole) && 'Manage exams, enter results, and analyze performance'}
            </Text>
          </Col>
          <Col>
            <Badge 
              color="#1890ff" 
              text={`${userRole.toUpperCase()} - ${userName}`} 
            />
          </Col>
        </Row>
      </div>

      {/* Tab Content */}
      {availableTabs.length > 0 ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="large"
          style={{ marginTop: '16px' }}
        >
          {availableTabs.map(tab => (
            <TabPane
              tab={tab.label}
              key={tab.key}
            >
              {tab.children}
            </TabPane>
          ))}
        </Tabs>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <TrophyOutlined style={{ fontSize: '48px', color: antdTheme.token.colorTextSecondary, marginBottom: '16px' }} />
            <Title level={4} style={{ color: antdTheme.token.colorTextSecondary }}>
              Access Restricted
            </Title>
            <Text type="secondary" style={{ color: antdTheme.token.colorTextSecondary }}>
              You don't have permission to access the Results Management system.
            </Text>
          </div>
        </Card>
      )}
    </Content>
  );
};

export default Results;