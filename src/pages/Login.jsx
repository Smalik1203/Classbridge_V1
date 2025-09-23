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

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      position: 'relative'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }}></div>

      {/* Login Card */}
      <div className="cb-card cb-glass" style={{ 
        width: '100%',
        maxWidth: '440px',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="cb-card-body cb-card-body-lg">
          {/* Header */}
          <div className="cb-text-center cb-mb-8">
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-2xl)',
              background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              fontSize: 'var(--text-3xl)',
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--color-white)'
            }}>
              🎓
            </div>
            <h1 className="cb-heading-2 cb-mb-2">
              {getWelcomeMessage()}
            </h1>
            <p className="cb-text-caption">
              Sign in to your ClassBridge account to continue
            </p>
          </div>

          {/* Login Form */}
          <Form
            name="login"
            onFinish={handleLogin}
            layout="vertical"
            size="large"
            className="cb-form"
          >
            <div className="cb-form-group">
              <label className="cb-label cb-label-required">Email Address</label>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email!' },
                  { type: 'email', message: 'Please enter a valid email!' }
                ]}
                style={{ marginBottom: 0 }}
              >
                <div className="cb-input-group">
                  <span className="cb-input-icon">📧</span>
                  <Input
                    className="cb-input cb-input-with-icon"
                    placeholder="Enter your email"
                  />
                </div>
              </Form.Item>
            </div>

            <div className="cb-form-group">
              <label className="cb-label cb-label-required">Password</label>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Please enter your password!' }
                ]}
                style={{ marginBottom: 0 }}
              >
                <div className="cb-input-group">
                  <span className="cb-input-icon">🔒</span>
                  <Input.Password
                    className="cb-input cb-input-with-icon"
                    placeholder="Enter your password"
                  />
                </div>
              </Form.Item>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="cb-alert cb-alert-error">
                <div className="cb-alert-icon">⚠️</div>
                <div className="cb-alert-content">
                  <div className="cb-alert-title">Sign In Failed</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="cb-button cb-button-primary cb-button-lg"
              style={{ width: '100%', marginBottom: 'var(--space-6)' }}
            >
              {loading ? (
                <>
                  <div className="cb-spinner"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Sign In</span>
                </>
              )}
            </Button>
          </Form>

          {/* Footer */}
          <div className="cb-text-center">
            <p className="cb-text-caption-sm">
              Don't have an account?{' '}
              <span style={{ 
                color: 'var(--color-primary-600)', 
                fontWeight: 'var(--font-medium)' 
              }}>
                Contact your administrator
              </span>
            </p>
            <div className="cb-mt-4">
              <p className="cb-text-caption-sm" style={{ color: 'var(--color-text-quaternary)' }}>
                🔒 Secure login powered by ClassBridge
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
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
                size="middle"
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '8px',
                  fontSize: '14px',
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