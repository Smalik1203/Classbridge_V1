import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Typography, Button, Space, Statistic } from 'antd';
import { 
  TeamOutlined, 
  BookOutlined, 
  TrophyOutlined, 
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../contexts/ThemeContext';

const { Content } = Layout;
const { Title, Text } = Typography;

const Dashboard = () => {
  const { user } = useAuth();
  const { theme: antdTheme } = useTheme();
  
  const [stats, setStats] = useState([
    {
      title: 'Total Students',
      value: 0,
      icon: <TeamOutlined />,
      color: '#3b82f6',
      trend: 12,
      suffix: ''
    },
    {
      title: 'Total Classes',
      value: 0,
      icon: <BookOutlined />,
      color: '#10b981',
      trend: 8,
      suffix: ''
    },
    {
      title: 'Average Score',
      value: 0,
      icon: <TrophyOutlined />,
      color: '#f59e0b',
      trend: -2,
      suffix: '%'
    },
    {
      title: 'Events This Month',
      value: 0,
      icon: <CalendarOutlined />,
      color: '#8b5cf6',
      trend: 15,
      suffix: ''
    }
  ]);

  const userName = user?.user_metadata?.full_name || 'User';
  const role = user?.app_metadata?.role || 'user';

  const getRoleDisplay = (role) => {
    const roles = {
      'cb_admin': 'CB Admin',
      'superadmin': 'Super Admin',
      'admin': 'Admin',
      'teacher': 'Teacher',
      'student': 'Student',
      // 'parent': 'Parent' // Parent functionality not implemented yet
    };
    return roles[role] || 'User';
  };

  const getWelcomeMessage = (role) => {
    const messages = {
      'cb_admin': 'Manage schools and administrators across the platform',
      'superadmin': 'Set up and manage your school system',
      'admin': 'Manage classes, students, and daily operations',
      'student': 'Track your progress and stay updated with your classes',
      // 'parent': 'Monitor your children\'s academic progress' // Parent functionality not implemented yet
    };
    return messages[role] || 'Welcome to ClassBridge';
  };

  return (
    <Content style={{ 
      padding: antdTheme.token.paddingLG, 
      background: antdTheme.token.colorBgLayout, 
      minHeight: '100vh' 
    }}>
      {/* Header Section */}
      <div style={{ marginBottom: antdTheme.token.marginLG }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ 
              margin: 0, 
              color: antdTheme.token.colorTextHeading, 
              fontWeight: 600 
            }}>
              Welcome back, {userName}!
            </Title>
            <Text type="secondary" style={{ fontSize: antdTheme.token.fontSizeLG }}>
              {getWelcomeMessage(role)}
            </Text>
          </Col>
          <Col>
            <Space>
              <Button 
                type="primary" 
                style={{ 
                  background: antdTheme.token.colorPrimary, 
                  borderColor: antdTheme.token.colorPrimary,
                  borderRadius: antdTheme.token.borderRadius,
                  fontWeight: 500
                }}
              >
                {getRoleDisplay(role)}
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: antdTheme.token.marginLG }}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card 
              style={{ 
                borderRadius: antdTheme.token.borderRadiusLG,
                height: '100%',
                border: `1px solid ${antdTheme.token.colorBorder}`,
                boxShadow: antdTheme.token.boxShadowSecondary,
                background: antdTheme.token.colorBgContainer,
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ 
                  fontSize: '48px', 
                  color: stat.color, 
                  marginBottom: antdTheme.token.margin 
                }}>
                  {stat.icon}
                </div>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  suffix={stat.suffix}
                  valueStyle={{ color: stat.color }}
                  titleStyle={{ color: antdTheme.token.colorTextSecondary, fontWeight: 500 }}
                />
                <div style={{ marginTop: antdTheme.token.marginXS }}>
                  <Text style={{ fontSize: antdTheme.token.fontSizeSM, color: antdTheme.token.colorTextSecondary }}>
                    {stat.trend > 0 ? (
                      <Space>
                        <ArrowUpOutlined style={{ color: antdTheme.token.colorSuccess }} />
                        <span style={{ color: antdTheme.token.colorSuccess }}>+{stat.trend}%</span>
                      </Space>
                    ) : stat.trend < 0 ? (
                      <Space>
                        <ArrowDownOutlined style={{ color: antdTheme.token.colorError }} />
                        <span style={{ color: antdTheme.token.colorError }}>{stat.trend}%</span>
                      </Space>
                    ) : (
                      <span>No change</span>
                    )}
                    <span style={{ marginLeft: antdTheme.token.marginXS }}>from last month</span>
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Content>
  );
};

export default Dashboard;