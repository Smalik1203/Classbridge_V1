import React, { useState, useEffect } from 'react';
import { Alert, Button, Space, Typography, Tooltip } from 'antd';
import { CalendarOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CalendarService from '../../services/calendarService';

const { Text } = Typography;

/**
 * HolidayChecker Component
 * Displays holiday information and blocks timetable operations on holidays
 */
export default function HolidayChecker({ 
  schoolCode, 
  date, 
  classInstanceId = null,
  onHolidayClick,
  showAsAlert = true,
  showAsButton = false,
  style = {}
}) {
  const [holidayInfo, setHolidayInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);

  useEffect(() => {
    if (schoolCode && date) {
      checkHoliday();
    }
  }, [schoolCode, date, classInstanceId]);

  const checkHoliday = async () => {
    if (!schoolCode || !date) return;
    
    setLoading(true);
    try {
      const dateStr = dayjs(date).format('YYYY-MM-DD');
      const currentDate = dayjs(date);
      
      // Check if it's a Sunday
      const isSunday = currentDate.day() === 0;
      
      if (isSunday) {
        setHolidayInfo({
          title: 'Sunday',
          description: 'Sunday is a weekend day. No timetable can be scheduled.',
          event_type: 'holiday'
        });
        setIsHoliday(true);
        return;
      }
      
      // Check for explicit holidays in the database
      const holiday = await CalendarService.getHolidayInfo(schoolCode, dateStr, classInstanceId);
      
      setHolidayInfo(holiday);
      setIsHoliday(!!holiday);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleHolidayClick = () => {
    if (onHolidayClick) {
      onHolidayClick(holidayInfo);
    }
  };

  if (!isHoliday) {
    return null;
  }

  if (showAsAlert) {
    return (
      <Alert
        message={
          <Space>
            <CalendarOutlined />
            <Text strong>{holidayInfo?.title || 'Holiday'}</Text>
          </Space>
        }
        description={
          <div>
            <Text type="secondary">
              {holidayInfo?.description || 'This is a holiday. Timetable entries cannot be created or modified.'}
            </Text>
            {onHolidayClick && (
              <div style={{ marginTop: '8px' }}>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={handleHolidayClick}
                  style={{ padding: 0 }}
                >
                  View Calendar
                </Button>
              </div>
            )}
          </div>
        }
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        style={{
          marginBottom: '16px',
          ...style
        }}
      />
    );
  }

  if (showAsButton) {
    return (
      <Tooltip title={holidayInfo?.description || 'This is a holiday'}>
        <Button
          type="primary"
          danger
          icon={<CalendarOutlined />}
          onClick={handleHolidayClick}
          loading={loading}
          style={style}
        >
          {holidayInfo?.title || 'Holiday'}
        </Button>
      </Tooltip>
    );
  }

  return (
    <div style={{ 
      padding: '8px 12px', 
      background: '#fff7e6', 
      border: '1px solid #ffd591',
      borderRadius: '6px',
      marginBottom: '12px',
      ...style
    }}>
      <Space>
        <InfoCircleOutlined style={{ color: '#faad14' }} />
        <Text strong style={{ color: '#d46b08' }}>
          {holidayInfo?.title || 'Holiday'}
        </Text>
        {onHolidayClick && (
          <Button 
            type="link" 
            size="small" 
            onClick={handleHolidayClick}
            style={{ padding: 0, color: '#d46b08' }}
          >
            View Details
          </Button>
        )}
      </Space>
    </div>
  );
}

/**
 * Hook to check if a date is a holiday
 * @param {string} schoolCode - School code
 * @param {string|Date} date - Date to check
 * @returns {Object} - { isHoliday, holidayInfo, loading }
 */
export function useHolidayCheck(schoolCode, date, classInstanceId = null) {
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolCode || !date) {
      setIsHoliday(false);
      setHolidayInfo(null);
      return;
    }

    const checkHoliday = async () => {
      setLoading(true);
      try {
        const dateStr = dayjs(date).format('YYYY-MM-DD');
        const currentDate = dayjs(date);
        
        // Check if it's a Sunday
        const isSunday = currentDate.day() === 0;
        
        if (isSunday) {
          setHolidayInfo({
            title: 'Sunday',
            description: 'Sunday is a weekend day. No timetable can be scheduled.',
            event_type: 'holiday'
          });
          setIsHoliday(true);
          return;
        }
        
        // Check for explicit holidays in the database
        const holiday = await CalendarService.getHolidayInfo(schoolCode, dateStr, classInstanceId);
        
        setHolidayInfo(holiday);
        setIsHoliday(!!holiday);
      } catch (error) {
        setIsHoliday(false);
        setHolidayInfo(null);
      } finally {
        setLoading(false);
      }
    };

    checkHoliday();
  }, [schoolCode, date, classInstanceId]);

  return { isHoliday, holidayInfo, loading };
}
