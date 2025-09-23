import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { useAuth } from '../AuthProvider';

const { Title, Text } = Typography;

const AnalyticsPage = () => {
  const { user } = useAuth();
  const role = user?.app_metadata?.role;

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Title level={2}>Analytics Dashboard</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
            Analytics features are coming soon for {role} users.
          </Text>
          <Empty 
            description="Analytics dashboard will be available in the next update"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsPage;