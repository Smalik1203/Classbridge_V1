import React, { useState } from 'react';
import { Badge, Tooltip, Button, Space, Typography, Tag, Dropdown, Menu, DatePicker } from 'antd';
import { LeftOutlined, RightOutlined, CalendarOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import localeData from 'dayjs/plugin/localeData';
import 'dayjs/locale/en-in';

// Configure dayjs to start week from Monday
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(localeData);

// Use Indian locale with Monday as first day of week
dayjs.locale('en-in');

const { Text } = Typography;

export default function CalendarMonthView({
  currentDate,
  events,
  loading,
  onDateChange,
  onEventClick,
  onEventDelete,
  onQuickAddEvent,
  onQuickAddHoliday,
  onDateClick,
  getEventTypeColor,
  getEventTypeLabel
}) {
  
  // Group events by date
  const getEventsByDate = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    return events.filter(event => {
      const eventStart = dayjs(event.start_date);
      const eventEnd = event.end_date ? dayjs(event.end_date) : eventStart;
      return eventStart.isSameOrBefore(date, 'day') && eventEnd.isSameOrAfter(date, 'day');
    });
  };

  // Check if a date is a holiday (excluding Sundays - only explicit holidays)
  const isHolidayDate = (date) => {
    // Check if there are any holiday events for this date
    const dayEvents = getEventsByDate(date);
    const hasHolidayEvent = dayEvents.some(event => event.event_type === 'holiday');
    
    return hasHolidayEvent;
  };

  // Check if a date is a weekend (Sunday only)
  const isWeekendDate = (date) => {
    // Use isoWeekday: Monday = 1, Sunday = 7
    const isoDay = date.isoWeekday();
    // Only Sunday (7) should be treated as weekend
    return isoDay === 7;
  };

  // Get events for a specific date
  const getListData = (value) => {
    const dateEvents = getEventsByDate(value);
    return dateEvents.map(event => ({
      type: event.event_type,
      content: event.title,
      event: event
    }));
  };

  // Generate calendar days starting from Monday
  const getCalendarDays = () => {
    const startOfMonth = currentDate.startOf('month');
    const endOfMonth = currentDate.endOf('month');
    
    // Use isoWeek which always starts on Monday
    const startOfWeek = startOfMonth.startOf('isoWeek');
    
    // Get the Sunday of the week containing the last day of the month
    const endOfWeek = endOfMonth.endOf('isoWeek');
    
    const days = [];
    let currentDay = startOfWeek;
    
    while (currentDay.isSameOrBefore(endOfWeek)) {
      days.push(currentDay);
      currentDay = currentDay.add(1, 'day');
    }
    
    return days;
  };

  // Custom date cell renderer
  const dateCellRender = (value) => {
    const listData = getListData(value);
    const isHoliday = listData.some(item => item.type === 'holiday');
    
    return (
      <div style={{ height: '100%', position: 'relative' }}>
        {listData.map((item, index) => (
          <Tooltip
            key={index}
            title={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {item.content}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {getEventTypeLabel(item.type)}
                </div>
                {item.event.description && (
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    {item.event.description}
                  </div>
                )}
              </div>
            }
          >
            <div
              style={{
                fontSize: '10px',
                padding: '1px 4px',
                margin: '1px 0',
                borderRadius: '2px',
                backgroundColor: getEventTypeColor(item.type),
                color: 'white',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(item.event);
              }}
            >
              {item.content}
            </div>
          </Tooltip>
        ))}
        
        {/* Holiday overlay */}
        {isHoliday && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 77, 79, 0.1)',
              border: '1px solid rgba(255, 77, 79, 0.3)',
              borderRadius: '4px',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    );
  };

  // Custom month cell renderer
  const monthCellRender = (value) => {
    const monthEvents = events.filter(event => {
      const eventDate = dayjs(event.start_date);
      return eventDate.isSame(value, 'month');
    });
    
    if (monthEvents.length === 0) return null;
    
    return (
      <div style={{ textAlign: 'center' }}>
        <Badge count={monthEvents.length} style={{ backgroundColor: '#1890ff' }} />
      </div>
    );
  };

  // Handle date selection
  const handleSelect = (value) => {
    onDateChange(value);
  };

  // Create quick action menu for date clicks
  const createQuickActionMenu = (date) => {
    const menuItems = [
      {
        key: 'add-event',
        icon: <PlusOutlined />,
        label: 'Add Event',
        onClick: () => onQuickAddEvent && onQuickAddEvent(date)
      },
      {
        key: 'add-holiday',
        icon: <CalendarOutlined />,
        label: 'Add Holiday',
        onClick: () => onQuickAddHoliday && onQuickAddHoliday(date)
      }
    ];

    return {
      items: menuItems,
      onClick: ({ key }) => {
        const item = menuItems.find(item => item.key === key);
        if (item && item.onClick) {
          item.onClick();
        }
      }
    };
  };

  // Handle panel change (month navigation)
  const handlePanelChange = (value, mode) => {
    if (mode === 'date') {
      onDateChange(value);
    }
  };

  return (
    <div>
      {/* Calendar Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px 16px',
        background: '#fafafa',
        borderRadius: '8px'
      }}>
        <Space>
          <Button
            icon={<LeftOutlined />}
            onClick={() => onDateChange(currentDate.subtract(1, 'month'))}
            size="small"
          />
          <Button
            icon={<RightOutlined />}
            onClick={() => onDateChange(currentDate.add(1, 'month'))}
            size="small"
          />
          <Button
            icon={<CalendarOutlined />}
            onClick={() => onDateChange(dayjs())}
            size="small"
          >
            Today
          </Button>
        </Space>
        
        <Text strong style={{ fontSize: '16px' }}>
          {currentDate.format('MMMM YYYY')}
        </Text>
        
        <Space>
          <DatePicker
            value={currentDate}
            onChange={onDateChange}
            format="DD-MM-YYYY"
            style={{ minWidth: 140 }}
            placeholder="Select Date"
            showToday
            allowClear={false}
            size="small"
          />
          <Text type="secondary">Total Events: {events.length}</Text>
        </Space>
      </div>


      {/* Custom Calendar Grid */}
      <div style={{
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}>
        {/* Week Headers - Monday to Sunday */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          backgroundColor: '#fafafa',
          borderBottom: '1px solid #d9d9d9'
        }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} style={{
              padding: '12px 8px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '14px',
              color: day === 'Sun' ? '#1890ff' : '#666',
              backgroundColor: day === 'Sun' ? '#e6f7ff' : 'transparent',
              borderRight: '1px solid #f0f0f0'
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {getCalendarDays().map((day, index) => {
            const isCurrentMonth = day.isSame(currentDate, 'month');
            const isToday = day.isSame(dayjs(), 'day');
            const isSelected = day.isSame(currentDate, 'day');
            const dayEvents = getEventsByDate(day);
            const isHoliday = isHolidayDate(day);
            const isWeekend = isWeekendDate(day);
            const holidayEvents = dayEvents.filter(event => event.event_type === 'holiday');
            const regularEvents = dayEvents.filter(event => event.event_type !== 'holiday');

            // Debug logging for Saturday and Sunday
            if (day.format('dddd') === 'Saturday' || day.format('dddd') === 'Sunday') {
              // Debug logging removed
            }

            return (
              <Dropdown
                key={index}
                menu={createQuickActionMenu(day)}
                trigger={['click']}
                placement="bottomLeft"
              >
                <div
                  style={{
                    minHeight: '120px',
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '1px solid #f0f0f0',
                    padding: '8px',
                    backgroundColor: isSelected ? '#e6f7ff' : isToday ? '#fff7e6' : isWeekend ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: '#f5f5f5'
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? '#e6f7ff' : isToday ? '#fff7e6' : isWeekend ? '#f0f9ff' : '#fff';
                  }}
                  onClick={() => onDateClick && onDateClick(day)}
                >
                {/* Date Number */}
                <div style={{
                  fontSize: '14px',
                  fontWeight: isToday ? 'bold' : 'normal',
                  color: isCurrentMonth ? (isToday ? '#1890ff' : (isWeekend ? '#1890ff' : '#000')) : '#ccc',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>{day.format('D')}</span>
                  {isWeekend && isCurrentMonth && (
                    <span style={{
                      fontSize: '10px',
                      color: '#52c41a',
                      fontWeight: 'normal'
                    }}>
                      ☀️
                    </span>
                  )}
                  {isHoliday && (
                    <span style={{
                      fontSize: '8px',
                      color: '#fff',
                      backgroundColor: '#0369a1',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontWeight: 'bold'
                    }}>
                      🎉
                    </span>
                  )}
                </div>

                {/* Events */}
                <div style={{ maxHeight: '80px', overflow: 'hidden' }}>
                  {/* Show holidays first with special styling */}
                  {holidayEvents.slice(0, 2).map((event, eventIndex) => (
                    <Tooltip
                      key={`holiday-${eventIndex}`}
                      title={
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#0369a1' }}>
                            🎉 {event.title}
                          </div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>
                            Holiday
                          </div>
                          {event.description && (
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                              {event.description}
                            </div>
                          )}
                        </div>
                      }
                    >
                      <div
                        style={{
                          fontSize: '9px',
                          padding: '2px 6px',
                          margin: '1px 0',
                          borderRadius: '12px',
                          backgroundColor: '#0369a1',
                          color: 'white',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 'bold',
                          border: '1px solid #0369a1'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        🎉 {event.title}
                      </div>
                    </Tooltip>
                  ))}
                  
                  {/* Show regular events with different styling */}
                  {regularEvents.slice(0, 2).map((event, eventIndex) => (
                    <Tooltip
                      key={`event-${eventIndex}`}
                      title={
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                            {event.title}
                          </div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>
                            {getEventTypeLabel(event.event_type)}
                          </div>
                          {event.description && (
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>
                              {event.description}
                            </div>
                          )}
                        </div>
                      }
                    >
                      <div
                        style={{
                          fontSize: '9px',
                          padding: '1px 4px',
                          margin: '1px 0',
                          borderRadius: '2px',
                          backgroundColor: getEventTypeColor(event.event_type),
                          color: 'white',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        {event.title}
                      </div>
                    </Tooltip>
                  ))}
                  
                  {dayEvents.length > 4 && (
                    <div style={{
                      fontSize: '9px',
                      color: '#666',
                      textAlign: 'center',
                      marginTop: '2px'
                    }}>
                      +{dayEvents.length - 4} more
                    </div>
                  )}
                </div>

                
                {/* Holiday Overlay */}
                {isHoliday && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(3, 105, 161, 0.08)',
                      borderRadius: '4px',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                </div>
              </Dropdown>
            );
          })}
        </div>
      </div>
    </div>
  );
}
