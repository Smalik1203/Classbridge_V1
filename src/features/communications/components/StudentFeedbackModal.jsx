import React, { useEffect, useMemo, useState } from 'react';
import { Form, Select, Input, Radio, App } from 'antd';
import { FormModal, validators } from '../../../shared/components/forms';
import { feedbackService, STUDENT_REMARK_CATEGORIES, CATEGORY_LABELS } from '../services/communicationsService';

const { TextArea } = Input;

export default function StudentFeedbackModal({ open, onClose, onSaved, schoolCode, fromUserId }) {
  const { message } = App.useApp();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState();

  useEffect(() => {
    if (!open) return;
    setSelectedClass(undefined);
    Promise.all([
      feedbackService.listStudents(schoolCode),
      feedbackService.listClasses(schoolCode),
    ])
      .then(([s, c]) => { setStudents(s); setClasses(c); })
      .catch((e) => message.error(e.message || 'Failed to load students'));
  }, [open, schoolCode, message]);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return students;
    return students.filter((s) => s.class_instance_id === selectedClass);
  }, [students, selectedClass]);

  const handleSubmit = async (v) => {
    return feedbackService.sendStudentFeedback({
      from_user_id: fromUserId,
      to_user_id: v.to_user_id,
      class_instance_id: v.class_instance_id || null,
      category: v.category,
      content: v.content,
      school_code: schoolCode,
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Send Feedback to Student"
      okText="Send feedback"
      width={600}
      requiredMark="optional"
      getInitialValues={() => ({ category: 'observation' })}
      onSubmit={handleSubmit}
      onSaved={onSaved}
      successMessage="Feedback sent to student"
      errorMessage="Failed to send"
      formProps={{
        onValuesChange: (c) => { if ('class_instance_id' in c) setSelectedClass(c.class_instance_id); },
      }}
    >
      {() => (<>
        <Form.Item label="Class (filter)" name="class_instance_id">
          <Select
            allowClear
            placeholder="All classes"
            options={classes.map((c) => ({ value: c.id, label: `Grade ${c.grade}-${c.section}` }))}
          />
        </Form.Item>
        <Form.Item label="Student" name="to_user_id" rules={[{ required: true, message: 'Select a student' }]}>
          <Select
            showSearch
            placeholder="Choose a student"
            optionFilterProp="label"
            options={filteredStudents.map((s) => ({ value: s.id, label: s.full_name }))}
          />
        </Form.Item>
        <Form.Item label="Category" name="category" rules={[validators.required('Category')]}>
          <Radio.Group buttonStyle="solid" optionType="button">
            {STUDENT_REMARK_CATEGORIES.map((c) => (
              <Radio.Button key={c} value={c}>{CATEGORY_LABELS[c]}</Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item label="Feedback" name="content" rules={[{ required: true, whitespace: true }]}>
          <TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="Share remark, appreciation or improvement note…" />
        </Form.Item>
      </>)}
    </FormModal>
  );
}
