import { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  message,
  Space,
  Row,
  Col,
} from 'antd';
import {
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  NumberOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

export const AddSchools = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .insert([
          {
            school_name: values.school_name,
            school_address: values.school_address,
            school_phone: values.school_phone,
            school_email: values.school_email,
            school_code: values.school_code,
          },
        ])
        .select();

      if (error) {
        message.error('Failed to add school: ' + error.message);
      } else {
        message.success('School added successfully');
        form.resetFields();
      }
    } catch (err) {
      message.error('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '24px', 
      background: '#f8fafc' 
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        width: '100%'
      }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8c8c8c' }}>
                <span>Home</span>
                <span>/</span>
                <span>Add School</span>
              </div>
            </div>
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
                  name="school_name"
                  label="School Name"
                  rules={[{ required: true, message: 'Please enter school name' }]}
                >
                  <Input prefix={<BankOutlined />} placeholder="Enter school name" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="school_code"
                  label="School Code"
                  initialValue="SCH"
                  rules={[{ required: true, message: 'Please enter school code' }]}
                >
                  <Input  placeholder="Enter school code" />
                </Form.Item>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="school_address"
                  label="School Address"
                  rules={[{ required: true, message: 'Please enter school address' }]}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Enter full address"
                    prefix={<HomeOutlined />}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="school_phone"
                  label="Phone Number"
                  rules={[
                    { required: true, message: 'Please enter phone number' },
                    { pattern: /^[0-9+\-\s()]+$/, message: 'Please enter a valid phone number' },
                  ]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="Enter contact number" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="school_email"
                  label="Email Address"
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter a valid email address' },
                  ]}
                >
                  <Input prefix={<MailOutlined />} placeholder="Enter email address" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
                size="large"
                style={{
                  fontSize: '14px',
                  height: '40px',
                  background: '#8B5CF6',
                  borderColor: '#8B5CF6',
                  borderRadius: '8px',
                  fontWeight: 500,
                }}
                block
              >
                {loading ? 'Adding...' : 'Add School'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default AddSchools;