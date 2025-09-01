import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Typography,
  Space,
  message,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  LockOutlined,
  ApartmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

const AddSuperAdmin = () => {
  const [form] = Form.useForm();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSchools = async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, school_name, school_code');
      if (error) {
        message.error('Failed to fetch schools: ' + error.message);
      } else {
        setSchools(data || []);
      }
    };
    fetchSchools();
  }, []);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        message.error("Not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const selectedSchool = schools.find(
        (school) => school.school_code === values.school_code
      );

      const response = await fetch(
        "https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-super-admin",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            full_name: values.full_name,
            phone: values.phone,
            role: 'superadmin',
            super_admin_code: values.super_admin_code,
            school_code: values.school_code,
            school_name: selectedSchool?.school_name || '',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        message.error(result.error || "Failed to create Super Admin");
      } else {
        message.success("Super Admin created successfully!");
        form.resetFields();
      }
    } catch (err) {
      message.error("Unexpected error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '24px', background: '#f8fafc' }}>
      <div className="max-w-3xl mx-auto">
        <Card
          title={
            <Space>
              <TeamOutlined />
              <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 600 }}>
                Add Super Admin
              </Title>
            </Space>
          }
          style={{
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            background: '#ffffff',
          }}
          headStyle={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="full_name"
                  label="Full Name"
                  rules={[{ required: true, message: 'Please enter full name' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Enter full name" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="phone"
                  label="Phone Number"
                  rules={[
                    { required: true, message: 'Please enter phone number' },
                    { pattern: /^[0-9+\-\s()]+$/, message: 'Please enter a valid phone number' },
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="Enter phone number" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label="Email Address"
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter a valid email' },
                  ]}
                >
                  <Input prefix={<MailOutlined />} placeholder="Enter email address" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="password"
                  label="Password"
                  rules={[
                    { required: true, message: 'Please enter password' },
                    { min: 6, message: 'Password must be at least 6 characters' },
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Enter password" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="super_admin_code"
                  label="Super Admin Code"
                  initialValue="SA"
                  rules={[{ required: true, message: 'Please enter super admin code' }]}
                >
                  <Input placeholder="Enter Super Admin Code" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="school_code"
                  label="Select School"
                  rules={[{ required: true, message: 'Please select a school' }]}
                >
                  <Select
                    placeholder="Select school by code"
                    showSearch
                    optionFilterProp="children"
                    suffixIcon={<ApartmentOutlined />}
                  >
                    {schools.map((school) => (
                      <Option key={school.id} value={school.school_code}>
                        {school.school_name} ({school.school_code})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                style={{
                  background: '#6366f1',
                  borderColor: '#6366f1',
                  borderRadius: '8px',
                  fontWeight: 500,
                  height: '48px',
                }}
                block
              >
                {loading ? 'Creating...' : 'Add Super Admin'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default AddSuperAdmin;
