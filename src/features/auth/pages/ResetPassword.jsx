/**
 * Reset Password Page
 * User lands here via email link after Supabase verifies the token
 * Note: Supabase automatically creates a session when user clicks reset link
 * Validates session, allows password update, then signs out and redirects
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Space } from 'antd';
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import AuthLayout from '../components/AuthLayout';
import { checkResetSession, updatePassword, signOut } from '../services/authService';

const { Text } = Typography;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const [form] = Form.useForm();

  // Note: When user clicks reset link, Supabase automatically logs them in
  // This is expected behavior - we validate the session and allow password reset

  // Check session on mount
  useEffect(() => {
    const validateSession = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await checkResetSession();

        if (result.hasSession) {
          setSessionValid(true);
        } else {
          setError(result.error);
          setSessionValid(false);
        }
      } catch (err) {
        setError({
          message: 'An unexpected error occurred. Please try again.',
          type: 'unknown',
          retryable: true,
        });
        setSessionValid(false);
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const handleSubmit = async (values) => {
    if (values.password !== values.confirmPassword) {
      form.setFields([
        {
          name: 'confirmPassword',
          errors: ['Passwords do not match'],
        },
      ]);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Update password
      const updateResult = await updatePassword(values.password);

      if (!updateResult.success) {
        setError(updateResult.error);
        setSubmitting(false);
        return;
      }

      // Sign out user after password update
      await signOut();

      // Show success message
      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successful. Please sign in with your new password.' },
        });
      }, 2000);
    } catch (err) {
      setError({
        message: 'An unexpected error occurred. Please try again.',
        type: 'unknown',
        retryable: true,
      });
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <AuthLayout title="Verifying reset link..." subtitle="Please wait">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text style={{ color: '#64748b' }}>Checking your reset link...</Text>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password Reset Successful" subtitle="Redirecting to login...">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircleOutlined
            style={{ fontSize: '64px', color: '#10b981', marginBottom: '24px' }}
          />
          <Alert
            message="Password updated successfully"
            description="You'll be redirected to the login page shortly."
            type="success"
            showIcon
            style={{
              borderRadius: '8px',
            }}
          />
        </div>
      </AuthLayout>
    );
  }

  if (!sessionValid) {
    return (
      <AuthLayout title="Invalid Reset Link" subtitle="This link is no longer valid">
        <div>
          <Alert
            message={error?.message || 'This link is invalid or expired'}
            description={
              error?.type === 'session_missing' || error?.type === 'otp_expired'
                ? 'Password reset links expire after a short time for security. Please request a new one.'
                : 'Please request a new password reset link.'
            }
            type="error"
            showIcon
            style={{
              borderRadius: '8px',
              marginBottom: '24px',
            }}
            action={
              <Button
                size="small"
                onClick={() => navigate('/forgot-password')}
                style={{ marginTop: '8px' }}
              >
                Request New Link
              </Button>
            }
          />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Button
              type="link"
              onClick={() => navigate('/login')}
              style={{
                color: '#6366F1',
                fontWeight: '500',
                fontSize: '14px',
              }}
            >
              Back to login
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set New Password"
      subtitle="Enter your new password below"
    >
      <Form
        form={form}
        name="reset-password"
        onFinish={handleSubmit}
        layout="vertical"
        size="middle"
        autoComplete="off"
      >
        <Form.Item
          name="password"
          label={
            <span style={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>
              New Password
            </span>
          }
          rules={[
            { required: true, message: 'Please enter a new password!' },
            { min: 6, message: 'Password must be at least 6 characters!' },
          ]}
          style={{ marginBottom: '20px' }}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
            placeholder="Enter new password"
            style={{
              borderRadius: '12px',
              height: '48px',
              border: '1px solid #e5e7eb',
              fontSize: '15px',
            }}
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label={
            <span style={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>
              Confirm Password
            </span>
          }
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password!' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Passwords do not match!'));
              },
            }),
          ]}
          style={{ marginBottom: '20px' }}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
            placeholder="Confirm new password"
            style={{
              borderRadius: '12px',
              height: '48px',
              border: '1px solid #e5e7eb',
              fontSize: '15px',
            }}
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
            loading={submitting}
            size="large"
            disabled={submitting || loading}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
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
            {submitting ? 'Updating Password...' : 'Update Password'}
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
};

export default ResetPassword;

