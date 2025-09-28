import React, { useState } from 'react';
import { Card, Button, Typography, Space, Alert, List, Tag } from 'antd';
import { DatabaseOutlined, SearchOutlined } from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';

const { Title, Text } = Typography;

const DatabaseDebugger = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);

  const checkTables = async () => {
    setLoading(true);
    setError(null);
    const tableResults = {};

    const tablesToCheck = [
      'schools',
      'super_admin', 
      'users',
      'student',
      'class_instances'
    ];

    for (const tableName of tablesToCheck) {
      try {
        console.log(`Checking table: ${tableName}`);
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(5);

        if (error) {
          tableResults[tableName] = {
            exists: false,
            error: error.message,
            code: error.code
          };
        } else {
          tableResults[tableName] = {
            exists: true,
            count: count || 0,
            sampleData: data || [],
            columns: data && data.length > 0 ? Object.keys(data[0]) : []
          };
        }
      } catch (err) {
        tableResults[tableName] = {
          exists: false,
          error: err.message
        };
      }
    }

    setResults(tableResults);
    setLoading(false);
  };

  const checkSuperAdminsInAuth = async () => {
    setLoading(true);
    try {
      // Check for super admins in both tables
      const [superAdminResult, usersResult] = await Promise.all([
        supabase.from('super_admin').select('*', { count: 'exact' }),
        supabase.from('users').select('*', { count: 'exact' }).eq('role', 'superadmin')
      ]);

      setResults(prev => ({
        ...prev,
        superAdminCheck: {
          super_admin_table: {
            count: superAdminResult.count || 0,
            data: superAdminResult.data || [],
            error: superAdminResult.error
          },
          users_table_superadmins: {
            count: usersResult.count || 0,
            data: usersResult.data || [],
            error: usersResult.error
          }
        }
      }));
    } catch (err) {
      setError('Error checking super admins: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          <span>Database Debugger</span>
        </Space>
      }
      style={{ marginBottom: '24px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Button 
            type="primary" 
            icon={<SearchOutlined />}
            onClick={checkTables}
            loading={loading}
          >
            Check All Tables
          </Button>
          <Button 
            icon={<DatabaseOutlined />}
            onClick={checkSuperAdminsInAuth}
            loading={loading}
          >
            Check Super Admins
          </Button>
        </Space>

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
          />
        )}

        {Object.keys(results).length > 0 && (
          <div>
            <Title level={4}>Table Status:</Title>
            {Object.entries(results).map(([tableName, result]) => (
              <Card key={tableName} size="small" style={{ marginBottom: '8px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>{tableName}</Text>
                    <Tag color={result.exists ? 'green' : 'red'} style={{ marginLeft: '8px' }}>
                      {result.exists ? 'EXISTS' : 'NOT FOUND'}
                    </Tag>
                  </div>
                  
                  {result.exists ? (
                    <div>
                      <Text type="secondary">Count: {result.count}</Text>
                      {result.columns && result.columns.length > 0 && (
                        <div>
                          <Text type="secondary">Columns: </Text>
                          {result.columns.map(col => (
                            <Tag key={col} size="small">{col}</Tag>
                          ))}
                        </div>
                      )}
                      {result.sampleData && result.sampleData.length > 0 && (
                        <div>
                          <Text type="secondary">Sample data:</Text>
                          <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '8px', marginTop: '4px' }}>
                            {JSON.stringify(result.sampleData[0], null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text type="secondary">Error: {result.error} (Code: {result.code})</Text>
                  )}
                </Space>
              </Card>
            ))}
          </div>
        )}

        {results.superAdminCheck && (
          <div>
            <Title level={4}>Super Admin Check:</Title>
            <Card size="small" style={{ marginBottom: '8px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>super_admin table</Text>
                  <Tag color={results.superAdminCheck.super_admin_table.error ? 'red' : 'green'} style={{ marginLeft: '8px' }}>
                    {results.superAdminCheck.super_admin_table.error ? 'ERROR' : `${results.superAdminCheck.super_admin_table.count} records`}
                  </Tag>
                </div>
                {results.superAdminCheck.super_admin_table.error && (
                  <Text type="secondary">Error: {results.superAdminCheck.super_admin_table.error.message}</Text>
                )}
                {results.superAdminCheck.super_admin_table.data.length > 0 && (
                  <div>
                    <Text type="secondary">Sample data:</Text>
                    <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '8px', marginTop: '4px' }}>
                      {JSON.stringify(results.superAdminCheck.super_admin_table.data[0], null, 2)}
                    </pre>
                  </div>
                )}
              </Space>
            </Card>
            
            <Card size="small" style={{ marginBottom: '8px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>users table (role=superadmin)</Text>
                  <Tag color={results.superAdminCheck.users_table_superadmins.error ? 'red' : 'green'} style={{ marginLeft: '8px' }}>
                    {results.superAdminCheck.users_table_superadmins.error ? 'ERROR' : `${results.superAdminCheck.users_table_superadmins.count} records`}
                  </Tag>
                </div>
                {results.superAdminCheck.users_table_superadmins.error && (
                  <Text type="secondary">Error: {results.superAdminCheck.users_table_superadmins.error.message}</Text>
                )}
                {results.superAdminCheck.users_table_superadmins.data.length > 0 && (
                  <div>
                    <Text type="secondary">Sample data:</Text>
                    <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '8px', marginTop: '4px' }}>
                      {JSON.stringify(results.superAdminCheck.users_table_superadmins.data[0], null, 2)}
                    </pre>
                  </div>
                )}
              </Space>
            </Card>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default DatabaseDebugger;
