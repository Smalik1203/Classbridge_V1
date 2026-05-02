/**
 * Reusable Auth Layout Component
 * Provides consistent styling and structure for auth pages
 */

import React from 'react';
import { Layout, Card } from 'antd';
import { BookOutlined } from '@ant-design/icons';

const { Content } = Layout;

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <Layout
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        zIndex: 1000,
      }}
    >
      <Content
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* Floating Logo */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
              zIndex: 2,
            }}
          >
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
            {(title || subtitle) && (
              <div
                style={{
                  textAlign: 'center',
                  marginBottom: '40px',
                  marginTop: '16px',
                }}
              >
                {title && (
                  <h2
                    style={{
                      margin: 0,
                      color: '#1e293b',
                      fontWeight: 700,
                      fontSize: '26px',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p
                    style={{
                      fontSize: '15px',
                      color: '#64748b',
                      marginTop: '8px',
                      marginBottom: 0,
                    }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Content */}
            {children}
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default AuthLayout;

