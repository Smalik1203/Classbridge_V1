import React from 'react';
import { Tag, Badge } from 'antd';
import { 
  getAttendanceColor, 
  getAttendanceTagColor, 
  getAttendanceDisplayText,
  getAttendanceIcon 
} from '../utils/attendanceColors';

// Attendance Status Indicator Component
// Provides consistent styling for attendance statuses across all pages

export const AttendanceStatusIndicator = ({ 
  status, 
  variant = 'tag', // 'tag', 'badge', 'text', 'cell'
  size = 'default',
  showIcon = false,
  style = {}
}) => {
  const colors = getAttendanceColor(status);
  const displayText = getAttendanceDisplayText(status);
  const icon = showIcon ? getAttendanceIcon(status) : '';

  switch (variant) {
    case 'badge':
      return (
        <Badge 
          status={getAttendanceTagColor(status)} 
          text={displayText}
          style={{ fontWeight: '500', ...style }}
        />
      );

    case 'text':
      return (
        <span 
          style={{ 
            color: colors.text,
            fontWeight: '500',
            ...style 
          }}
        >
          {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
          {displayText}
        </span>
      );

    case 'cell':
      return (
        <div 
          style={{
            backgroundColor: colors.light,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            padding: '6px 12px',
            textAlign: 'center',
            fontWeight: '500',
            color: colors.text,
            display: 'inline-block',
            minWidth: '80px',
            ...style
          }}
        >
          {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
          {displayText}
        </div>
      );

    case 'tag':
    default:
      return (
        <Tag 
          color={getAttendanceTagColor(status)} 
          style={{ 
            fontWeight: '500',
            fontSize: size === 'small' ? '12px' : '14px',
            padding: size === 'small' ? '2px 6px' : '4px 8px',
            ...style 
          }}
        >
          {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
          {displayText}
        </Tag>
      );
  }
};

// Quick access components for common use cases
export const AttendanceTag = (props) => <AttendanceStatusIndicator variant="tag" {...props} />;
export const AttendanceBadge = (props) => <AttendanceStatusIndicator variant="badge" {...props} />;
export const AttendanceText = (props) => <AttendanceStatusIndicator variant="text" {...props} />;
export const AttendanceCell = (props) => <AttendanceStatusIndicator variant="cell" {...props} />;

export default AttendanceStatusIndicator;
