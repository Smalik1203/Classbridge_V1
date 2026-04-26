import React from 'react';
import { Form, Input, Select, DatePicker, TimePicker, Switch, ColorPicker } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { FormModal, validators, toDayjs, fromDayjs } from '../../../shared/components/forms';

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
  onSuccess,
}) {
  const { theme } = useTheme();
  const isUpdate = !!(event?.id && event.id !== 'undefined');

  const getInitialValues = (editing) => editing ? {
    title: editing.title,
    description: editing.description,
    event_type: editing.event_type,
    class_instance_id: editing.class_instance_id,
    start_date: toDayjs(editing.start_date),
    end_date: toDayjs(editing.end_date),
    is_all_day: editing.is_all_day,
    start_time: editing.start_time ? toDayjs(`1970-01-01T${editing.start_time}`) : null,
    end_time: editing.end_time ? toDayjs(`1970-01-01T${editing.end_time}`) : null,
    color: editing.color || theme.token.colorPrimary,
    is_active: editing.is_active,
  } : {
    event_type: isHoliday ? 'holiday' : 'assembly',
    class_instance_id: null,
    start_date: toDayjs(new Date()),
    is_all_day: true,
    color: isHoliday ? theme.token.colorError : theme.token.colorPrimary,
    is_active: true,
  };

  const handleSubmit = async (values) => {
    const eventData = {
      school_code: schoolCode,
      academic_year_id: academicYearId,
      class_instance_id: values.class_instance_id || null,
      title: values.title,
      description: values.description,
      event_type: values.event_type,
      start_date: fromDayjs(values.start_date),
      end_date: fromDayjs(values.end_date) || fromDayjs(values.start_date),
      is_all_day: values.is_all_day,
      start_time: values.is_all_day ? null : (values.start_time ? values.start_time.format('HH:mm') : null),
      end_time: values.is_all_day ? null : (values.end_time ? values.end_time.format('HH:mm') : null),
      color: typeof values.color === 'string' ? values.color : values.color?.toHexString?.() || values.color,
      is_active: values.is_active,
      created_by: user?.id,
    };

    const { supabase } = await import('@/config/supabaseClient');
    if (isUpdate) {
      const { error } = await supabase.from('school_calendar_events').update(eventData).eq('id', event.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('school_calendar_events').insert([eventData]);
      if (error) throw error;
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onCancel}
      title={event ? 'Edit Event' : `New ${isHoliday ? 'Holiday' : 'Event'}`}
      okText={event ? 'Update Event' : 'Create Event'}
      width={600}
      requiredMark="optional"
      editing={event}
      getInitialValues={getInitialValues}
      onSubmit={handleSubmit}
      onSaved={onSuccess}
      successMessage={isUpdate ? 'Event updated successfully' : 'Event created successfully'}
      errorMessage="Failed to save event"
    >
      {(form) => <CalendarEventBody form={form} classes={classes} />}
    </FormModal>
  );
}

function CalendarEventBody({ form, classes }) {
  const isAllDay = Form.useWatch('is_all_day', form);

  const handleAllDayChange = (checked) => {
    if (checked) form.setFieldsValue({ start_time: null, end_time: null });
  };

  return (
    <>
      <Form.Item name="title" label="Title" rules={[validators.required('Title')]}>
        <Input placeholder="Enter event title" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <TextArea rows={3} placeholder="Enter event description (optional)" />
      </Form.Item>

      <Form.Item name="event_type" label="Event Type" rules={[validators.required('Event type')]}>
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

      <Form.Item name="start_date" label="Start Date" rules={[validators.required('Start date')]}>
        <DatePicker style={{ width: '100%' }} placeholder="Select start date" />
      </Form.Item>

      <Form.Item name="end_date" label="End Date">
        <DatePicker style={{ width: '100%' }} placeholder="Select end date (optional)" />
      </Form.Item>

      <Form.Item name="is_all_day" label="All Day Event" valuePropName="checked">
        <Switch onChange={handleAllDayChange} />
      </Form.Item>

      {!isAllDay && (
        <>
          <Form.Item name="start_time" label="Start Time">
            <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="Select start time" />
          </Form.Item>

          <Form.Item name="end_time" label="End Time">
            <TimePicker style={{ width: '100%' }} format="HH:mm" placeholder="Select end time" />
          </Form.Item>
        </>
      )}

      <Form.Item name="color" label="Color">
        <ColorPicker
          showText
          format="hex"
          presets={[{
            label: 'Event Colors',
            colors: ['#ff4d4f', '#1890ff', '#faad14', '#52c41a', '#722ed1', '#eb2f96', '#8c8c8c'],
          }]}
        />
      </Form.Item>

      <Form.Item name="is_active" label="Active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}
