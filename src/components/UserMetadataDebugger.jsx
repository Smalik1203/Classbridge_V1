/**
 * User Metadata Debugger Component
 * 
 * Use this component to debug user metadata and RLS issues
 * Add this temporarily to your app to troubleshoot server errors
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Typography, Space, Collapse, Tag, Divider } from 'antd';
import { BugOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthProvider';
import { debugUserMetadata, validateUserForOfflineTests, testRLSAccess } from '../utils/debugUserMetadata';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

export default function UserMetadataDebugger() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState(null);
  const [validation, setValidation] = useState(null);
  const [rlsTest, setRlsTest] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const debug = debugUserMetadata(user);
      const validationResult = validateUserForOfflineTests(user);
      setDebugInfo(debug);
      setValidation(validationResult);
    }
  }, [user]);

  const testRLS = async () => {
    setLoading(true);
    try {
      const result = await testRLSAccess(user);
      setRlsTest(result);
    } catch (error) {
      setRlsTest({
        success: false,
        error: error.message,
        canAccess: false
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card title="🔍 User Metadata Debugger" size="small">
        <Alert
          message="No User Session"
          description="User is not authenticated. Please log in first."
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card 
      title={
        <Space>
          <BugOutlined />
          <span>User Metadata Debugger</span>
        </Space>
      }
      size="small"
      style={{ margin: '16px 0' }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* Basic Info */}
        <div>
          <Title level={5}>Basic Information</Title>
          <Space wrap>
            <Tag>ID: {debugInfo?.userId}</Tag>
            <Tag>Email: {debugInfo?.email}</Tag>
            <Tag color={validation?.isValid ? 'green' : 'red'}>
              {validation?.isValid ? 'Valid' : 'Invalid'}
            </Tag>
          </Space>
        </div>

        {/* Validation Results */}
        {validation && (
          <Alert
            message={validation.isValid ? 'User Metadata Valid' : 'User Metadata Issues'}
            description={
              validation.isValid 
                ? 'All required metadata fields are present'
                : validation.error
            }
            type={validation.isValid ? 'success' : 'error'}
            showIcon
            icon={validation.isValid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          />
        )}

        {/* Missing Fields */}
        {validation?.missing?.length > 0 && (
          <Alert
            message="Missing Required Fields"
            description={
              <div>
                <Text>The following fields are missing from user metadata:</Text>
                <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                  {validation.missing.map(field => (
                    <li key={field}>
                      <Text code>{field}</Text>
                    </li>
                  ))}
                </ul>
              </div>
            }
            type="error"
            showIcon
          />
        )}

        {/* Warnings */}
        {validation?.warnings?.length > 0 && (
          <Alert
            message="Warnings"
            description={
              <ul style={{ margin: 0 }}>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
          />
        )}

        {/* RLS Test */}
        <div>
          <Space>
            <Button 
              type="primary" 
              onClick={testRLS} 
              loading={loading}
              icon={<BugOutlined />}
            >
              Test RLS Access
            </Button>
            {rlsTest && (
              <Tag color={rlsTest.success ? 'green' : 'red'}>
                {rlsTest.success ? 'RLS OK' : 'RLS Error'}
              </Tag>
            )}
          </Space>
          
          {rlsTest && !rlsTest.success && (
            <Alert
              message="RLS Access Failed"
              description={rlsTest.error}
              type="error"
              style={{ marginTop: '8px' }}
            />
          )}
        </div>

        {/* Detailed Metadata */}
        <Collapse>
          <Panel header="Detailed Metadata Structure" key="metadata">
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '300px'
            }}>
              {JSON.stringify(debugInfo?.metadata, null, 2)}
            </pre>
          </Panel>
          
          <Panel header="Extracted Values" key="extracted">
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {JSON.stringify(debugInfo?.extracted, null, 2)}
            </pre>
          </Panel>
          
          <Panel header="Validation Details" key="validation">
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {JSON.stringify(validation, null, 2)}
            </pre>
          </Panel>
        </Collapse>

        {/* Fix Suggestions */}
        {!validation?.isValid && (
          <Alert
            message="How to Fix"
            description={
              <div>
                <Paragraph>
                  To fix the server error, you need to ensure the user has the required metadata:
                </Paragraph>
                <ul>
                  <li><Text code>role</Text> - Must be 'admin', 'student', 'superadmin', or 'cb_admin'</li>
                  <li><Text code>school_code</Text> - Required for admin users</li>
                  <li><Text code>student_code</Text> - Required for student users</li>
                </ul>
                <Paragraph>
                  The metadata should be in either <Text code>app_metadata</Text> or <Text code>user_metadata</Text>.
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
}
