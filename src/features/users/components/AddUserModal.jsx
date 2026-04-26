import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, Select, Radio, Row, Col, App,
} from 'antd';
import {
  UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, IdcardOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getSchoolName } from '@/shared/utils/metadata';
import { usersService, ROLE_LABELS, invitableRoles } from '../services/usersService';

const { Option } = Select;

export default function AddUserModal({ open, onClose, onSaved, myRole }) {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const schoolName = getSchoolName(user);
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [schools, setSchools] = useState([]);

  const allowed = invitableRoles(myRole);
  const [role, setRole] = useState(allowed[0] || 'admin');

  useEffect(() => {
    if (!open) return;
    setRole(allowed[0] || 'admin');
    form.resetFields();
    if (schoolCode) {
      usersService.listClassInstances(schoolCode).then(setClasses).catch(() => setClasses([]));
    }
    if (myRole === 'cb_admin') {
      usersService.listSchools().then(setSchools).catch(() => setSchools([]));
    }
    // eslint-disable-next-line
  }, [open]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (role === 'admin') {
        await usersService.createAdmin(values);
      } else if (role === 'student') {
        await usersService.createStudent(values);
      } else if (role === 'superadmin') {
        const school = schools.find((s) => s.school_code === values.school_code);
        await usersService.createSuperAdmin({
          ...values,
          school_name: school?.school_name || schoolName || '',
        });
      }
      message.success(`${ROLE_LABELS[role]} added`);
      onSaved?.();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      title="Add User"
      okText={submitting ? 'Adding…' : 'Add User'}
      okButtonProps={{ loading: submitting }}
      width={600}
      destroyOnClose
    >
      {allowed.length > 1 && (
        <Radio.Group
          value={role}
          onChange={(e) => { setRole(e.target.value); form.resetFields(); }}
          style={{ marginBottom: 16 }}
        >
          {allowed.map((r) => <Radio.Button key={r} value={r}>{ROLE_LABELS[r]}</Radio.Button>)}
        </Radio.Group>
      )}

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="full_name" label="Full name" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
              <Input prefix={<MailOutlined />} autoComplete="off" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="password" label="Password" rules={[{ required: true }, { min: 6 }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
              <Input prefix={<PhoneOutlined />} />
            </Form.Item>
          </Col>

          {role === 'admin' && (
            <Col xs={24} md={12}>
              <Form.Item name="admin_code" label="Admin code" initialValue="A" rules={[{ required: true }]}>
                <Input prefix={<IdcardOutlined />} />
              </Form.Item>
            </Col>
          )}

          {role === 'superadmin' && (
            <>
              <Col xs={24} md={12}>
                <Form.Item name="super_admin_code" label="Super Admin code" initialValue="SA" rules={[{ required: true }]}>
                  <Input prefix={<IdcardOutlined />} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="school_code" label="School" rules={[{ required: true }]}>
                  <Select showSearch placeholder="Select school" optionFilterProp="children">
                    {schools.map((s) => (
                      <Option key={s.id} value={s.school_code}>
                        {s.school_name} ({s.school_code})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </>
          )}

          {role === 'student' && (
            <>
              <Col xs={24} md={12}>
                <Form.Item name="student_code" label="Student code" rules={[{ required: true }]}>
                  <Input prefix={<IdcardOutlined />} placeholder="e.g. S001" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="class_instance_id" label="Class" rules={[{ required: true }]}>
                  <Select showSearch placeholder="Select class" optionFilterProp="children">
                    {classes.map((ci) => (
                      <Option key={ci.id} value={ci.id}>
                        Grade {ci.class?.grade}-{ci.class?.section}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </>
          )}
        </Row>
      </Form>
    </Modal>
  );
}
