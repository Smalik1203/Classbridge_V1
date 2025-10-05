// src/ui/AttendanceKPICard.jsx
// Modern KPI card component specifically designed for attendance analytics

import React from 'react';
import { Card, Statistic, Typography } from 'antd';
import { useTheme } from '../contexts/ThemeContext';
import { designTokens } from './theme';

const { Text } = Typography;

/**
 * Attendance-specific KPI card with modern design and attendance color coding
 * @param {Object} props - Component props
 * @param {string} props.title - KPI title
 * @param {number|string} props.value - KPI value
 * @param {string} props.suffix - Value suffix (%, students, etc.)
 * @param {React.ReactNode} props.prefix - Icon or prefix element
 * @param {string} props.status - Status type: 'success', 'warning', 'error', 'info'
 * @param {React.ReactNode} props.trend - Trend indicator
 * @param {boolean} props.loading - Loading state
 * @param {string} props.attendanceType - Type of attendance: 'present', 'absent', 'late', 'total'
 */
const AttendanceKPICard = ({
  title,
  value,
  suffix = '',
  prefix,
  status = 'info',
  trend,
  loading = false,
  attendanceType = 'total',
  ...props
}) => {
  const { antdTheme } = useTheme();

  // Attendance-specific color mapping
  const getAttendanceColors = (type, status) => {
    const baseColors = {
      present: {
        primary: '#10b981', // green-500
        light: '#d1fae5',   // green-100
        dark: '#059669'     // green-600
      },
      absent: {
        primary: '#ef4444', // red-500
        light: '#fee2e2',   // red-100
        dark: '#dc2626'     // red-600
      },
      late: {
        primary: '#f59e0b', // amber-500
        light: '#fef3c7',   // amber-100
        dark: '#d97706'     // amber-600
      },
      total: {
        primary: '#8B5CF6', // purple-500
        light: '#f3e8ff',   // purple-100
        dark: '#6366F1'     // indigo-500
      }
    };

    const statusColors = {
      success: baseColors.present,
      warning: baseColors.late,
      error: baseColors.absent,
      info: baseColors.total
    };

    return statusColors[status] || baseColors[type] || baseColors.total;
  };

  const colors = getAttendanceColors(attendanceType, status);

  return (
    <Card
      style={{
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        boxShadow: 'none',
        background: '#ffffff',
        transition: 'all 0.2s ease-in-out',
        height: '100%'
      }}
      bodyStyle={{
        padding: '16px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
      hoverable
      {...props}
    >
      <div>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 6,
            display: 'block'
          }}
        >
          {title}
        </Text>
        
        <Statistic
          value={value}
          suffix={suffix}
          prefix={prefix}
          loading={loading}
          valueStyle={{
            fontSize: 20,
            fontWeight: 600,
            color: colors.primary,
            lineHeight: 1.2,
            marginBottom: 0
          }}
        />
      </div>

      {trend && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          {trend}
        </div>
      )}
    </Card>
  );
};

export default AttendanceKPICard;
