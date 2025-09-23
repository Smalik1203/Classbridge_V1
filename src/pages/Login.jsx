import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Space, Avatar, Spin } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../AuthProvider';
import { getUserRole } from '../routeAccess';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: antdTheme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user && !authLoading) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, from]);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        message.error(error.message);
        return;
      }

      if (data.user) {
        message.success('Login successful!');
        navigate(from, { replace: true });
      }
    } catch (error) {
      message.error('An unexpected error occurred');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          border: 'none',
          background: antdTheme.token.colorBgContainer
        }}
        bodyStyle={{ padding: '40px' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Avatar
            size={64}
            style={{
              backgroundColor: antdTheme.token.colorPrimary,
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '16px'
            }}
          >
            CB
          </Avatar>
          <Title level={2} style={{ 
            margin: 0, 
            color: antdTheme.token.colorText,
            fontWeight: 700,
            marginBottom: '8px'
          }}>
            Welcome Back
          </Title>
          <Text style={{ 
            fontSize: '16px', 
            color: antdTheme.token.colorTextSecondary 
          }}>
            Sign in to ClassBridge
          </Text>
        </div>

        {/* Login Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          size="large"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: antdTheme.token.colorTextTertiary }} />}
              placeholder="Enter your email"
              style={{
                borderRadius: '8px',
                height: '48px',
                fontSize: '16px'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: antdTheme.token.colorTextTertiary }} />}
              placeholder="Enter your password"
              style={{
                borderRadius: '8px',
                height: '48px',
                fontSize: '16px'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '24px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: '48px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                background: antdTheme.token.colorPrimary,
                borderColor: antdTheme.token.colorPrimary
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <Text style={{ 
            fontSize: '14px', 
            color: antdTheme.token.colorTextTertiary 
          }}>
            © 2025 ClassBridge. All rights reserved.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;