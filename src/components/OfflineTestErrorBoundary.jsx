/**
 * Error Boundary for Offline Test Components
 * 
 * Provides comprehensive error handling and recovery for offline test operations
 */

import React from 'react';
import { Alert, Button, Card, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

class OfflineTestErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: Date.now().toString()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('OfflineTestErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log to external service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.state.errorId);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { fallback, showDetails = false } = this.props;
      
      if (fallback) {
        return fallback(this.state.error, this.handleRetry);
      }

      return (
        <Card style={{ margin: '16px', textAlign: 'center' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <ExclamationCircleOutlined 
                style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} 
              />
              <Title level={3} style={{ color: '#ff4d4f', margin: 0 }}>
                Something went wrong
              </Title>
              <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
                An error occurred while managing offline test marks. Please try again.
              </Text>
            </div>

            <Alert
              message="Error Details"
              description={
                <div>
                  <Text code>Error ID: {this.state.errorId}</Text>
                  <br />
                  <Text code>Time: {new Date().toLocaleString()}</Text>
                  {showDetails && this.state.error && (
                    <>
                      <br />
                      <Text code>Message: {this.state.error.message}</Text>
                    </>
                  )}
                </div>
              }
              type="error"
              showIcon
              style={{ textAlign: 'left' }}
            />

            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
              >
                Try Again
              </Button>
              <Button onClick={this.handleReload}>
                Reload Page
              </Button>
            </Space>

            {showDetails && this.state.errorInfo && (
              <details style={{ textAlign: 'left', marginTop: '16px' }}>
                <summary>Technical Details</summary>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: '8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </Space>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default OfflineTestErrorBoundary;
