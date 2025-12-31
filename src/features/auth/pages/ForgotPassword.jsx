/**
 * Forgot Password Page
 * Allows users to request a password reset email
 * Follows security best practices: no user enumeration
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Space } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import AuthLayout from '../components/AuthLayout';
import { requestPasswordReset } from '../services/authService';

const { Text } = Typography;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await requestPasswordReset(values.email);

      if (result.success) {
        // Always show success message (no user enumeration)
        setSuccess(true);
        form.resetFields();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError({
        message: 'An unexpected error occurred. Please try again.',
        type: 'unknown',
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email address and we'll send you a reset link"
    >
      {success ? (
        <div>
          <Alert
            message="Check your email"
            description="If an account exists with this email, you'll receive a password reset link shortly."
            type="success"
            showIcon
            style={{
              borderRadius: '8px',
              marginBottom: '24px',
            }}
          />
          <div style={{ textAlign: 'center' }}>
            <Button
              type="link"
              onClick={() => {
                setSuccess(false);
                form.resetFields();
              }}
              style={{ padding: 0 }}
            >
              Send another email
            </Button>
          </div>
        </div>
      ) : (
        <Form
          form={form}
          name="forgot-password"
          onFinish={handleSubmit}
          layout="vertical"
          size="middle"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label={
              <span style={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>
                Email Address
              </span>
            }
            rules={[
              { required: true, message: 'Please enter your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
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
                fontSize: '15px',
              }}
              autoFocus
            />
          </Form.Item>

          {error && (
            <Form.Item style={{ marginBottom: '16px' }}>
              <Alert
                message={error.message}
                type="error"
                showIcon
                style={{
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
                action={
                  error.retryable && (
                    <Button
                      size="small"
                      onClick={() => {
                        setError(null);
                        form.submit();
                      }}
                    >
                      Retry
                    </Button>
                  )
                }
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              disabled={loading}
              style={{
                width: '100%',
                height: '52px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                border: 'none',
                boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.3)',
                transition: 'all 0.2s ease',
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Space>
              <ArrowLeftOutlined style={{ color: '#64748b' }} />
              <Link
                to="/login"
                style={{
                  color: '#6366F1',
                  fontWeight: '500',
                  fontSize: '14px',
                  textDecoration: 'none',
                }}
              >
                Back to login
              </Link>
            </Space>
          </div>
        </Form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;

