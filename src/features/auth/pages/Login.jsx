import React, { useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { Navigate } from 'react-router-dom';
import { Layout, Card, Form, Input, Button, Typography, Space, Alert, Avatar } from 'antd';
import { MailOutlined, LockOutlined, LoginOutlined, BookOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title, Text } = Typography;

const Login = () => {
  const { user } = useAuth();
  
  // Redirect if already logged in
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (user) return <Navigate to="/dashboard" />;

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
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
      position: 'relative'
    }}>
      <Content style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '24px'
      }}>
        <div style={{ position: 'relative' }}>
          {/* Floating Logo */}
          <div style={{
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
            zIndex: 2
          }}>
            <BookOutlined style={{ fontSize: '28px', color: 'white' }} />
          </div>

          <Card
            style={{
              width: '100%',
              maxWidth: '420px',
              borderRadius: '20px',
              boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
            }}
            bodyStyle={{ padding: '48px 40px' }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '40px', marginTop: '16px' }}>
              <Title level={2} style={{ 
                margin: 0, 
                color: '#1e293b', 
                fontWeight: 700, 
                fontSize: '26px',
                letterSpacing: '-0.025em'
              }}>
                Sign in to ClassBridge
              </Title>
              <Text style={{ 
                fontSize: '15px', 
                color: '#64748b', 
                marginTop: '8px'
              }}>
                Welcome back
              </Text>
            </div>

            {/* Login Form */}
            <Form
              name="login"
              onFinish={handleLogin}
              layout="vertical"
              size="middle"
            >
              <Form.Item
                name="email"
                label={<span style={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>Email Address</span>}
                rules={[
                  { required: true, message: 'Please enter your email!' },
                  { type: 'email', message: 'Please enter a valid email!' }
                ]}
                style={{ marginBottom: '20px' }}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="Enter your email"
                  style={{ 
                    borderRadius: '12px',
                    height: '48px',
                    border: '1px solid #e5e7eb',
                    fontSize: '15px'
                  }}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span style={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>Password</span>}
                rules={[
                  { required: true, message: 'Please enter your password!' }
                ]}
                style={{ marginBottom: '16px' }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="Enter your password"
                  style={{ 
                    borderRadius: '12px',
                    height: '48px',
                    border: '1px solid #e5e7eb',
                    fontSize: '15px'
                  }}
                />
              </Form.Item>

              {/* Forgot Password Link */}
              <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                <Text style={{ 
                  color: '#6b7280', 
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}>
                  Forgot password?
                </Text>
              </div>

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

              <Form.Item style={{ marginBottom: '32px' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    border: 'none',
                    boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 6px 20px 0 rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 14px 0 rgba(99, 102, 241, 0.3)';
                  }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </Form.Item>
            </Form>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Text style={{ color: '#64748b', fontSize: '14px' }}>
                Don't have an account?{' '}
                <Text style={{ color: '#6366F1', fontWeight: '500', cursor: 'pointer' }}>
                  Contact administrator
                </Text>
              </Text>
            </div>
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default Login;