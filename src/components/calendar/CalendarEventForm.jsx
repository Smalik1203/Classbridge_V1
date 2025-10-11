import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, TimePicker, Switch, ColorPicker, Button, Space, message, Typography } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function CalendarEventForm({
  open,
  event,
  academicYearId,
  schoolCode,
  classes = [],
  isHoliday = false,
  user,
  onCancel,
  onSuccess
}) {
  const { theme } = useTheme();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isAllDay, setIsAllDay] = useState(true);

  // Debug: Log classes when they change
  useEffect(() => {
  }, [classes]);

  // Reset form when modal opens/closes or event changes
  useEffect(() => {
    if (open) {
      if (event) {
        // Edit mode
        form.setFieldsValue({
          title: event.title,
          description: event.description,
          event_type: event.event_type,
          class_instance_id: event.class_instance_id,
          start_date: dayjs(event.start_date),
          end_date: event.end_date ? dayjs(event.end_date) : null,
          is_all_day: event.is_all_day,
          start_time: event.start_time ? dayjs(event.start_time, 'HH:mm') : null,
          end_time: event.end_time ? dayjs(event.end_time, 'HH:mm') : null,
          color: event.color || theme.token.colorPrimary,
          is_active: event.is_active
        });
        setIsAllDay(event.is_all_day);
      } else {
        // Create mode
        form.resetFields();
        form.setFieldsValue({
          event_type: isHoliday ? 'holiday' : 'assembly',
          class_instance_id: null, // Default to school-wide
          start_date: dayjs(),
          is_all_day: true,
          color: isHoliday ? theme.token.colorError : theme.token.colorPrimary,
          is_active: true
        });
        setIsAllDay(true);
      }
    }
  }, [open, event, isHoliday, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const eventData = {
        school_code: schoolCode,
        academic_year_id: academicYearId,
        class_instance_id: values.class_instance_id || null,
        title: values.title,
        description: values.description,
        event_type: values.event_type,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : values.start_date.format('YYYY-MM-DD'),
        is_all_day: values.is_all_day,
        start_time: values.is_all_day ? null : (values.start_time ? values.start_time.format('HH:mm') : null),
        end_time: values.is_all_day ? null : (values.end_time ? values.end_time.format('HH:mm') : null),
        color: values.color,
        is_active: values.is_active,
        created_by: user?.id
      };

      // Check if this is an update operation (event has valid ID)
      const isUpdate = event && event.id && event.id !== 'undefined' && event.id !== undefined;
      
      if (isUpdate) {
        // Update existing event
        console.log('Updating calendar event:', event.id, eventData);
        const { error } = await (await import('../../config/supabaseClient')).supabase
          .from('school_calendar_events')
          .update(eventData)
          .eq('id', event.id);
        
        if (error) {
          console.error('Calendar event update error:', error);
          throw error;
        }
        console.log('Calendar event updated successfully');
        message.success('Event updated successfully');
      } else {
        // Create new event
        const { error } = await (await import('../../config/supabaseClient')).supabase
          .from('school_calendar_events')
          .insert([eventData]);
        
        if (error) throw error;
        message.success('Event created successfully');
      }

      onSuccess();
    } catch (error) {
      message.error('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleAllDayChange = (checked) => {
    setIsAllDay(checked);
    if (checked) {
      form.setFieldsValue({
        start_time: null,
        end_time: null
      });
    }
  };

  const getEventTypeColor = (eventType) => {
    // Default colors for common event types
    const colors = {
      holiday: theme.token.colorInfo,
      assembly: theme.token.colorPrimary,
      exam: theme.token.colorWarning,
      ptm: theme.token.colorSuccess,
      'sports day': theme.token.colorPrimary,
      'cultural event': theme.token.colorPrimary
    };
    return colors[eventType?.toLowerCase()] || theme.token.colorTextSecondary;
  };

  return (
    <Modal
      title={event ? 'Edit Event' : `New ${isHoliday ? 'Holiday' : 'Event'}`}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          event_type: isHoliday ? 'holiday' : 'assembly',
          is_all_day: true,
          is_active: true
        }}
      >
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Please enter event title' }]}
        >
          <Input placeholder="Enter event title" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
        >
          <TextArea 
            rows={3} 
            placeholder="Enter event description (optional)" 
          />
        </Form.Item>

        <Form.Item
          name="event_type"
          label="Event Type"
          rules={[{ required: true, message: 'Please enter event type' }]}
        >
          <Input placeholder="Enter event type (e.g., Assembly, Exam, PTM, Sports Day, etc.)" />
        </Form.Item>

        <Form.Item
          name="class_instance_id"
          label="Class (Optional)"
          tooltip="Leave empty for school-wide events, or select a specific class"
        >
          <Select
            placeholder="Select class (optional - leave empty for school-wide events)"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {classes.map(cls => (
              <Option key={cls.id} value={cls.id}>
                {`Grade ${cls.grade}${cls.section ? `-${cls.section}` : ''}`}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="start_date"
          label="Start Date"
          rules={[{ required: true, message: 'Please select start date' }]}
        >
          <DatePicker 
            style={{ width: '100%' }} 
            placeholder="Select start date"
          />
        </Form.Item>

        <Form.Item
          name="end_date"
          label="End Date"
        >
          <DatePicker 
            style={{ width: '100%' }} 
            placeholder="Select end date (optional)"
          />
        </Form.Item>

        <Form.Item
          name="is_all_day"
          label="All Day Event"
          valuePropName="checked"
        >
          <Switch 
            checked={isAllDay}
            onChange={handleAllDayChange}
          />
        </Form.Item>

        {!isAllDay && (
          <>
            <Form.Item
              name="start_time"
              label="Start Time"
            >
              <TimePicker 
                style={{ width: '100%' }} 
                format="HH:mm"
                placeholder="Select start time"
              />
            </Form.Item>

            <Form.Item
              name="end_time"
              label="End Time"
            >
              <TimePicker 
                style={{ width: '100%' }} 
                format="HH:mm"
                placeholder="Select end time"
              />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="color"
          label="Color"
        >
          <ColorPicker 
            showText 
            format="hex"
            presets={[
              {
                label: 'Event Colors',
                colors: ['#ff4d4f', '#1890ff', '#faad14', '#52c41a', '#722ed1', '#eb2f96', '#8c8c8c']
              }
            ]}
          />
        </Form.Item>

        <Form.Item
          name="is_active"
          label="Active"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {event ? 'Update' : 'Create'} Event
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
