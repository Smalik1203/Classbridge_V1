// Attendance Status Color Configuration
// This file provides consistent colors for attendance statuses across all pages

export const ATTENDANCE_COLORS = {
  present: {
    primary: '#52c41a',    // Ant Design Success Green
    light: '#f6ffed',      // Light green background
    border: '#b7eb8f',     // Light green border
    text: '#389e0d',       // Dark green text
    tag: 'success'         // Ant Design tag color
  },
  absent: {
    primary: '#ff4d4f',    // Ant Design Error Red
    light: '#fff2f0',      // Light red background
    border: '#ffccc7',     // Light red border
    text: '#cf1322',       // Dark red text
    tag: 'error'           // Ant Design tag color
  },
  late: {
    primary: '#faad14',    // Ant Design Warning Orange
    light: '#fffbe6',      // Light orange background
    border: '#ffe58f',     // Light orange border
    text: '#d48806',       // Dark orange text
    tag: 'warning'         // Ant Design tag color
  },
  'no-data': {
    primary: '#d9d9d9',    // Ant Design Default Gray
    light: '#fafafa',      // Light gray background
    border: '#d9d9d9',     // Gray border
    text: '#8c8c8c',       // Gray text
    tag: 'default'         // Ant Design tag color
  }
};

// Helper function to get color for a status
export const getAttendanceColor = (status) => {
  return ATTENDANCE_COLORS[status] || ATTENDANCE_COLORS.absent;
};

// Helper function to get tag color for Ant Design Tag component
export const getAttendanceTagColor = (status) => {
  return getAttendanceColor(status).tag;
};

// Helper function to get background style for status cells
export const getAttendanceCellStyle = (status) => {
  const colors = getAttendanceColor(status);
  return {
    backgroundColor: colors.light,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    padding: '4px 8px',
    textAlign: 'center',
    fontWeight: '500',
    color: colors.text
  };
};

// Helper function to get select option style
export const getAttendanceSelectStyle = (status) => {
  const colors = getAttendanceColor(status);
  return {
    color: colors.primary,
    fontWeight: '500'
  };
};

// Helper function to get button style for status
export const getAttendanceButtonStyle = (status, isActive = false) => {
  const colors = getAttendanceColor(status);
  return {
    backgroundColor: isActive ? colors.primary : colors.light,
    borderColor: colors.border,
    color: isActive ? '#fff' : colors.text,
    fontWeight: '500'
  };
};

// Helper function to get progress bar color
export const getAttendanceProgressColor = (status) => {
  return getAttendanceColor(status).primary;
};

// Helper function to get chart colors for recharts
export const getAttendanceChartColors = () => {
  return {
    present: ATTENDANCE_COLORS.present.primary,
    absent: ATTENDANCE_COLORS.absent.primary,
    late: ATTENDANCE_COLORS.late.primary,
    noData: ATTENDANCE_COLORS['no-data'].primary
  };
};

// Helper function to get status display text
export const getAttendanceDisplayText = (status) => {
  const statusMap = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    'no-data': 'No data available'
  };
  return statusMap[status] || status;
};

// Helper function to get status icon (if needed in the future)
export const getAttendanceIcon = (status) => {
  const iconMap = {
    present: '✓',
    absent: '✗',
    late: '⏰'
  };
  return iconMap[status] || '';
};
