import React, { useState, useEffect } from 'react';
import { Card, Statistic, Spin, Alert, Typography } from 'antd';
import { UserOutlined, CrownOutlined } from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';

const { Title, Text } = Typography;

const SuperAdminCounter = () => {
  const [loading, setLoading] = useState(true);
  const [superAdminCount, setSuperAdminCount] = useState(0);
  const [error, setError] = useState(null);
  const [superAdmins, setSuperAdmins] = useState([]);

  useEffect(() => {
    countSuperAdmins();
  }, []);

  const countSuperAdmins = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First, try to get super admins from the users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, role, full_name, school_code, created_at')
        .eq('role', 'superadmin');

      if (usersError) {
        // If users table doesn't exist or has no data, try admin table
        const { data: adminData, error: adminError } = await supabase
          .from('admin')
          .select('id, email, role, full_name, school_code, created_at')
          .eq('role', 'superadmin');

        if (adminError) {
          setError('Could not query super admin data. This might require service role access.');
        } else {
          setSuperAdminCount(adminData?.length || 0);
          setSuperAdmins(adminData || []);
        }
      } else {
        setSuperAdminCount(usersData?.length || 0);
        setSuperAdmins(usersData || []);
      }
    } catch (err) {
      console.error('Error counting super admins:', err);
      setError('Failed to count super admins: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>Counting super admins...</Text>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Super Admin Count</Title>
      
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      <Card style={{ marginBottom: '24px' }}>
        <Statistic
          title="Total Super Admins"
          value={superAdminCount}
          prefix={<CrownOutlined style={{ color: '#faad14' }} />}
          valueStyle={{ color: '#faad14', fontSize: '48px' }}
        />
      </Card>

      {superAdmins.length > 0 && (
        <Card title="Super Admin Details">
          <div style={{ display: 'grid', gap: '16px' }}>
            {superAdmins.map((admin, index) => (
              <Card key={admin.id} size="small" style={{ backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {admin.full_name || 'Unknown Name'}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      {admin.email}
                    </div>
                    <div style={{ color: '#999', fontSize: '12px' }}>
                      School: {admin.school_code || 'N/A'} | 
                      Created: {new Date(admin.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {superAdminCount === 0 && !error && (
        <Alert
          message="No Super Admins Found"
          description="No super admins were found in the database. This could mean they are stored in the auth system rather than the database tables."
          type="info"
          showIcon
        />
      )}
    </div>
  );
};

export default SuperAdminCounter;
