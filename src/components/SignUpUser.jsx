import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Alert,
  Divider
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  LockOutlined, 
  PhoneOutlined, 
  IdcardOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { supabase } from '../config/supabaseClient';
import { useAuth } from "../AuthProvider";
import { Navigate } from "react-router-dom";

const { Title, Text } = Typography;
const { Option } = Select;


const SignUpUser = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const handleSignUp = async (values) => {
    setMessage(null);
    setError(null);
    setLoading(true);
    
    try {
      // Use the create-super-admin Edge Function for secure role assignment
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError('Not authenticated. Please log in first.');
        setLoading(false);
        return;
      }

      const response = await fetch('https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-super-admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          phone: values.phone_number,
          school_id: null, // CB admin doesn't have a specific school
          school_name: 'ClassBridge Platform',
          school_code: 'CB',
          role: values.role,
          super_admin_code: values.cb_admin_code,
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // If response is not JSON, get the text
        const textResponse = await response.text();
        setError(`Server error: ${textResponse} (Status: ${response.status})`);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(result.error || result.message || `Failed to create user. Status: ${response.status}`);
        setLoading(false);
        return;
      } else {
        setMessage('User created successfully! Please check your email to confirm your account.');
        form.resetFields();
      }
    } catch (err) {
      setError('An unexpected error occurred: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 500,
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          border: 'none'
        }}
        styles={{ body: { padding: '40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <CrownOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
          <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
            Create New User
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Sign up for ClassBridge Platform
          </Text>
        </div>

        {!user && (
          <Alert
            message="Authentication Required"
            description={
              <div>
                <p>You need to be logged in to create new users.</p>
                <p>Please <Button type="link" href="/login" style={{ padding: 0 }}>sign in first</Button> to access this feature.</p>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: '24px', borderRadius: '8px' }}
          />
        )}

        {user && !(user.app_metadata?.role === 'cb_admin' || user.user_metadata?.cb_admin_code) && (
          <Alert
            message="Insufficient Permissions"
            description={
              <div>
                <p>Only CB Admins can create new users.</p>
                <p>Your current role: <strong>{user.app_metadata?.role || (user.user_metadata?.cb_admin_code ? 'cb_admin' : user.user_metadata?.role) || 'Unknown'}</strong></p>
                <p>Please contact a CB Admin to create new users or upgrade your account.</p>
              </div>
            }
            type="error"
            showIcon
            style={{ marginBottom: '24px', borderRadius: '8px' }}
          />
        )}

        {message && (
          <Alert
            message="Success!"
            description={message}
            type="success"
            showIcon
            style={{ marginBottom: '24px', borderRadius: '8px' }}
          />
        )}

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: '24px', borderRadius: '8px' }}
          />
        )}

        <Form
          form={form}
          name="signup"
          onFinish={handleSignUp}
          layout="vertical"
          size="large"
          disabled={!user || (user && !(user.app_metadata?.role === 'cb_admin' || user.user_metadata?.cb_admin_code))}
          initialValues={{
            role: 'cb_admin',
            cb_admin_code: 'CB'
          }}
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[
              { required: true, message: 'Please enter your full name!' },
              { min: 2, message: 'Name must be at least 2 characters!' }
            ]}
          >
            <Input 
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter your full name"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label="Phone Number"
            rules={[
              { required: true, message: 'Please enter your phone number!' },
              { pattern: /^[0-9+\-\s()]+$/, message: 'Please enter a valid phone number!' }
            ]}
          >
            <Input 
              prefix={<PhoneOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter your phone number"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input 
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter your email address"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password!' },
              { min: 6, message: 'Password must be at least 6 characters!' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter your password"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="role"
            label="User Role"
            rules={[{ required: true, message: 'Please select a role!' }]}
          >
            <Select 
              placeholder="Select user role"
              style={{ borderRadius: '8px' }}
            >
              <Option value="cb_admin">
                <Space>
                  <CrownOutlined style={{ color: '#1890ff' }} />
                  CB Admin
                </Space>
              </Option>
              <Option value="super_admin">
                <Space>
                  <CrownOutlined style={{ color: '#faad14' }} />
                  Super Admin
                </Space>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="cb_admin_code"
            label="Admin Code"
            rules={[
              { required: true, message: 'Please enter the admin code!' },
              { min: 2, message: 'Admin code must be at least 2 characters!' }
            ]}
          >
            <Input 
              prefix={<IdcardOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Enter admin code"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              disabled={!user || (user && !(user.app_metadata?.role === 'cb_admin' || user.user_metadata?.cb_admin_code))}
              block
              size="large"
              style={{ 
                borderRadius: '8px',
                height: '48px',
                fontSize: '16px',
                fontWeight: '600',
                background: user ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d9d9d9',
                border: 'none',
                boxShadow: user ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none'
              }}
            >
              {loading ? 'Creating User...' : 
               !user ? 'Please Sign In First' : 
               !(user.app_metadata?.role === 'cb_admin' || user.user_metadata?.cb_admin_code) ? 'Insufficient Permissions' : 
               'Create User'}
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '24px 0' }}>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Already have an account? 
            <Button type="link" href="/login" style={{ padding: '0 4px' }}>
              Sign In
            </Button>
          </Text>
        </Divider>
      </Card>
    </div>
  );
};

export default SignUpUser; 