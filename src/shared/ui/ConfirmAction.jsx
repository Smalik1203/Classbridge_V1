// src/ui/ConfirmAction.jsx
// Reusable confirmation dialog component

import React from 'react';
import { Modal, Button, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';

const { Text } = Typography;

/**
 * Confirmation dialog component
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Modal visibility
 * @param {string} props.title - Modal title
 * @param {string} props.message - Confirmation message
 * @param {string} props.okText - OK button text
 * @param {string} props.cancelText - Cancel button text
 * @param {string} props.type - Action type (danger, warning, info)
 * @param {Function} props.onOk - OK button handler
 * @param {Function} props.onCancel - Cancel button handler
 * @param {boolean} props.loading - Loading state for OK button
 */
const ConfirmAction = ({
  visible,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  okText = 'OK',
  cancelText = 'Cancel',
  type = 'warning',
  onOk,
  onCancel,
  loading = false,
}) => {
  const { theme: antdTheme } = useTheme();

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return antdTheme.token.colorError;
      case 'warning':
        return antdTheme.token.colorWarning;
      case 'info':
        return antdTheme.token.colorInfo;
      default:
        return antdTheme.token.colorWarning;
    }
  };

  const getOkButtonProps = () => {
    switch (type) {
      case 'danger':
        return { danger: true };
      case 'warning':
        return { type: 'primary' };
      case 'info':
        return { type: 'primary' };
      default:
        return { type: 'primary' };
    }
  };

  return (
    <Modal
      open={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: antdTheme.token.marginXS }}>
          <ExclamationCircleOutlined 
            style={{ 
              color: getIconColor(),
              fontSize: antdTheme.token.fontSizeLG 
            }} 
          />
          <span>{title}</span>
        </div>
      }
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={getOkButtonProps()}
      centered
      style={{
        borderRadius: antdTheme.token.borderRadiusLG,
      }}
    >
      <Text style={{ color: antdTheme.token.colorText }}>
        {message}
      </Text>
    </Modal>
  );
};

export default ConfirmAction; 