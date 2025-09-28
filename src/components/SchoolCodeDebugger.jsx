import React, { useState, useEffect } from 'react';
import { Card, Typography, Space, Button, Alert, Divider } from 'antd';
import { useAuth } from '../AuthProvider';
import { getSchoolCode, getSchoolName, getUserRole } from '../utils/metadata';
import { supabase } from '../config/supabaseClient';

const { Title, Text, Paragraph } = Typography;

const SchoolCodeDebugger = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDebugInfo = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get user metadata
      const userRole = getUserRole(user);
      const schoolCode = getSchoolCode(user);
      const schoolName = getSchoolName(user);

      // Get school information from database
      let dbSchoolInfo = null;
      if (schoolCode) {
        const { data, error } = await supabase
          .from('schools')
          .select('*')
          .eq('school_code', schoolCode)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching school info:', error);
        } else {
          dbSchoolInfo = data;
        }
      }

      // Get all schools (for superadmin)
      let allSchools = null;
      if (userRole === 'superadmin') {
        const { data, error } = await supabase
          .from('schools')
          .select('school_code, school_name, display_name')
          .order('school_code');
        
        if (error) {
          console.error('Error fetching all schools:', error);
        } else {
          allSchools = data;
        }
      }

      setDebugInfo({
        user: {
          id: user.id,
          email: user.email,
          role: userRole,
          schoolCode,
          schoolName
        },
        metadata: {
          raw_app_meta_data: user.raw_app_meta_data,
          app_metadata: user.app_metadata,
          raw_user_meta_data: user.raw_user_meta_data,
          user_metadata: user.user_metadata
        },
        dbSchoolInfo,
        allSchools
      });
    } catch (error) {
      console.error('Error fetching debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, [user]);

  if (!user) {
    return <Alert message="Please log in to see debug information" type="warning" />;
  }

  return (
    <Card title="School Code Debug Information" style={{ margin: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button onClick={fetchDebugInfo} loading={loading}>
          Refresh Debug Info
        </Button>
        
        {debugInfo && (
          <>
            <Divider>User Information</Divider>
            <div>
              <Text strong>User ID:</Text> {debugInfo.user.id}<br/>
              <Text strong>Email:</Text> {debugInfo.user.email}<br/>
              <Text strong>Role:</Text> {debugInfo.user.role}<br/>
              <Text strong>School Code (from metadata):</Text> {debugInfo.user.schoolCode || 'Not found'}<br/>
              <Text strong>School Name (from metadata):</Text> {debugInfo.user.schoolName || 'Not found'}
            </div>

            <Divider>Raw Metadata</Divider>
            <div>
              <Title level={5}>raw_app_meta_data:</Title>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(debugInfo.metadata.raw_app_meta_data, null, 2)}
              </pre>
              
              <Title level={5}>app_metadata:</Title>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(debugInfo.metadata.app_metadata, null, 2)}
              </pre>
              
              <Title level={5}>raw_user_meta_data:</Title>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(debugInfo.metadata.raw_user_meta_data, null, 2)}
              </pre>
              
              <Title level={5}>user_metadata:</Title>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(debugInfo.metadata.user_metadata, null, 2)}
              </pre>
            </div>

            <Divider>Database School Information</Divider>
            {debugInfo.dbSchoolInfo ? (
              <div>
                <Text strong>Found in database:</Text><br/>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(debugInfo.dbSchoolInfo, null, 2)}
                </pre>
              </div>
            ) : (
              <Alert 
                message="No school found in database with this school code" 
                type="warning" 
              />
            )}

            {debugInfo.allSchools && (
              <>
                <Divider>All Schools in Database</Divider>
                <div>
                  <Text strong>Available schools:</Text>
                  <ul>
                    {debugInfo.allSchools.map((school, index) => (
                      <li key={index}>
                        <Text strong>Code:</Text> {school.school_code} | 
                        <Text strong> Name:</Text> {school.school_name} | 
                        <Text strong> Display:</Text> {school.display_name}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </Space>
    </Card>
  );
};

export default SchoolCodeDebugger;
