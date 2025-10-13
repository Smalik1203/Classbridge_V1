import React from 'react';
import { Card, Select, Space, Typography, Row, Col, Spin, Alert } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';

const { Title } = Typography;
const { Option } = Select;

const SubjectFilter = ({ 
  subjects, 
  selectedSubject, 
  onSubjectChange, 
  selectedClass, 
  classes, 
  isStudent, 
  onClassChange,
  subjectsLoading = false,
  classesLoading = false 
}) => {
  const { theme: antdTheme } = useTheme();

  return (
    <Card style={{ marginBottom: antdTheme.token.marginMD }} bodyStyle={{ padding: antdTheme.token.paddingMD }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>Filters</Title>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Typography.Text strong>Class:</Typography.Text>
              <Select
                placeholder="Select a class"
                size="large"
                style={{ width: '100%' }}
                value={selectedClass}
                onChange={onClassChange}
                disabled={isStudent}
                loading={classesLoading}
                notFoundContent={classesLoading ? <Spin size="small" /> : "No classes available"}
              >
                <Option value="all">All Classes</Option>
                {classes.map(cls => (
                  <Option key={cls.id} value={cls.id}>
                    Grade {cls.grade} - {cls.section}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Typography.Text strong>Subject:</Typography.Text>
              <Select
                placeholder="All subjects"
                size="large"
                style={{ width: '100%' }}
                value={selectedSubject}
                onChange={onSubjectChange}
                allowClear
                loading={subjectsLoading}
                notFoundContent={subjectsLoading ? <Spin size="small" /> : "No subjects available"}
              >
                <Option value="all">All Subjects</Option>
                {subjects.map(subject => (
                  <Option key={subject.id} value={subject.id}>
                    {subject.subject_name}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
        </Row>
      </Space>
    </Card>
  );
};

export default SubjectFilter;
