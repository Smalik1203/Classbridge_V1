import React, { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { Navigate } from 'react-router-dom';
import { Layout, Card, Form, Input, Button, Typography, Space, Alert, Avatar } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined, BookOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title, Text } = Typography;

const Login = () => {
  const { user } = useAuth();
  
  // Redirect if already logged in
  if (user) return <Navigate to="/dashboard" />;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle form submission
  const handleLogin = async (values) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Content style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '24px'
      }}>
        <Card
          style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <Avatar
              size={64}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                marginBottom: '16px',
                fontWeight: 600
              }}
              icon={<BookOutlined />}
            />
            <Title level={2} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>
              Welcome Back
            </Title>
            <Text style={{ fontSize: '16px', color: '#64748b' }}>
              Sign in to your ClassBridge account
            </Text>
          </div>

          {/* Login Form */}
          <Form
            name="login"
            onFinish={handleLogin}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please enter your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="Enter your email"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter your password!' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Enter your password"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>

            {/* Error Alert */}
            {error && (
              <Form.Item>
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  style={{ 
                    borderRadius: '8px',
                    padding: '10px 12px'
                  }}
                />
              </Form.Item>
            )}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<LoginOutlined />}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  background: '#6366f1',
                  borderColor: '#6366f1',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ color: '#64748b' }}>
              Don't have an account?{' '}
              <Text style={{ color: '#6366f1', fontWeight: '500' }}>
                Contact your administrator
              </Text>
            </Text>
          </div>

          {/* Additional Info */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Text style={{ fontSize: '12px', color: '#94a3b8' }}>
              Secure login powered by ClassBridge
            </Text>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default Login;