// src/ui/EntityDrawer.jsx
// Reusable entity drawer component

import React from 'react';
import { Drawer, Typography, Button, Space } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';

const { Title, Text } = Typography;

/**
 * Entity drawer component
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Drawer visibility
 * @param {string} props.title - Drawer title
 * @param {React.ReactNode} props.children - Drawer content
 * @param {React.ReactNode} props.extra - Extra content (actions, etc.)
 * @param {Function} props.onClose - Close handler
 * @param {string} props.placement - Drawer placement
 * @param {number} props.width - Drawer width
 * @param {boolean} props.closable - Whether drawer is closable
 * @param {string} props.className - Additional CSS class
 * @param {Object} props.style - Additional inline styles
 */
const EntityDrawer = ({
  visible,
  title,
  children,
  extra,
  onClose,
  placement = 'right',
  width = 520,
  closable = true,
  className = '',
  style = {},
}) => {
  const { theme: antdTheme } = useTheme();

  return (
    <Drawer
      open={visible}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title
            level={4}
            style={{
              margin: 0,
              color: antdTheme.token.colorTextHeading,
              fontWeight: 600,
            }}
          >
            {title}
          </Title>
          {extra && (
            <Space>
              {extra}
            </Space>
          )}
        </div>
      }
      onClose={onClose}
      placement={placement}
      width={width}
      closable={closable}
      className={`entity-drawer ${className}`}
      style={{
        borderRadius: antdTheme.token.borderRadiusLG,
        ...style,
      }}
      bodyStyle={{
        padding: antdTheme.token.paddingLG,
        color: antdTheme.token.colorText,
      }}
    >
      {children}
    </Drawer>
  );
};

export default EntityDrawer; 