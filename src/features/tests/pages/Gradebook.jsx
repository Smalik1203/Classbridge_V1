import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Table, Modal, Form, Input, Select, DatePicker,
  message, Space, Typography, Row, Col, Tag, Empty, Spin, InputNumber, Divider,
} from 'antd';
import {
  PlusOutlined, FilePdfOutlined, DeleteOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import {
  listExamGroups, createExamGroup, deleteExamGroup,
  buildReportCardData,
  listSchoolSubjects, createSubjectTestForGroup,
} from '@/features/tests/services/gradebookService';
import ReportCardPreview from '@/features/tests/components/ReportCardPreview';
import MarksGrid from '@/features/tests/components/MarksGrid';

const { Title, Text } = Typography;

export default function Gradebook() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);

  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [classFilter, setClassFilter] = useState(null);
  const [yearFilter, setYearFilter] = useState(null);

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [activeGroup, setActiveGroup] = useState(null);
  const [gridRefresh, setGridRefresh] = useState(0);

  const [subjects, setSubjects] = useState([]);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [addSubjectForm] = Form.useForm();

  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadClassesAndYears = useCallback(async () => {
    if (!schoolCode) return;
    const [{ data: cls }, { data: ys }] = await Promise.all([
      supabase.from('class_instances').select('id, grade, section, academic_year_id')
        .eq('school_code', schoolCode).order('grade').order('section'),
      supabase.from('academic_years').select('id, year_start, year_end, is_active')
        .eq('school_code', schoolCode).order('year_start', { ascending: false }),
    ]);
    setClasses(cls || []);
    setYears(ys || []);
    const activeYear = (ys || []).find((y) => y.is_active) || (ys || [])[0];
    if (activeYear && !yearFilter) setYearFilter(activeYear.id);
  }, [schoolCode, yearFilter]);

  const loadGroups = useCallback(async () => {
    if (!schoolCode) return;
    setLoadingGroups(true);
    const res = await listExamGroups({ schoolCode, academicYearId: yearFilter, classInstanceId: classFilter });
    setLoadingGroups(false);
    if (res.success) setGroups(res.data);
    else message.error(res.error);
  }, [schoolCode, yearFilter, classFilter]);

  const loadSubjects = useCallback(async () => {
    if (!schoolCode) return;
    const r = await listSchoolSubjects(schoolCode);
    if (r.success) setSubjects(r.data);
  }, [schoolCode]);

  useEffect(() => { loadClassesAndYears(); loadSubjects(); }, [loadClassesAndYears, loadSubjects]);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const openCreate = () => {
    createForm.resetFields();
    if (yearFilter) createForm.setFieldValue('academic_year_id', yearFilter);
    if (classFilter) createForm.setFieldValue('class_instance_id', classFilter);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    try {
      const v = await createForm.validateFields();
      const payload = {
        school_code: schoolCode,
        academic_year_id: v.academic_year_id,
        class_instance_id: v.class_instance_id,
        name: v.name,
        exam_type: v.exam_type,
        weightage: v.weightage != null ? Number(v.weightage) / 100 : null,
        start_date: v.dates?.[0]?.format('YYYY-MM-DD') || null,
        end_date: v.dates?.[1]?.format('YYYY-MM-DD') || null,
        created_by: user?.id || null,
      };
      const res = await createExamGroup(payload);
      if (!res.success) return message.error(res.error);
      message.success('Exam group created. Now add subjects and enter marks.');
      setCreateOpen(false);
      loadGroups();
      setActiveGroup(res.data);
    } catch {}
  };

  const handleDelete = (group) => {
    Modal.confirm({
      title: `Delete "${group.name}"?`,
      content: 'This deletes the exam group, all its subject tests, and all marks for those tests.',
      okType: 'danger',
      onOk: async () => {
        const r = await deleteExamGroup(group.id);
        if (!r.success) return message.error(r.error);
        message.success('Deleted');
        if (activeGroup?.id === group.id) setActiveGroup(null);
        loadGroups();
      },
    });
  };

  const openAddSubject = () => {
    addSubjectForm.resetFields();
    addSubjectForm.setFieldValue('max_marks', 100);
    setAddSubjectOpen(true);
  };

  const submitAddSubject = async () => {
    try {
      const v = await addSubjectForm.validateFields();
      const subj = subjects.find((s) => s.id === v.subject_id);
      const r = await createSubjectTestForGroup({
        examGroup: activeGroup,
        subjectId: v.subject_id,
        title: v.title || `${activeGroup.name} — ${subj?.subject_name || 'Subject'}`,
        maxMarks: v.max_marks || 100,
        testDate: v.test_date?.format('YYYY-MM-DD') || null,
        createdBy: user?.id || null,
      });
      if (!r.success) return message.error(r.error);
      message.success('Subject added');
      setAddSubjectOpen(false);
      setGridRefresh((k) => k + 1);
    } catch {}
  };

  const generateReport = async (student) => {
    if (!activeGroup) return;
    setReportOpen(true);
    setReportLoading(true);
    setReportData(null);
    const r = await buildReportCardData({ examGroupId: activeGroup.id, studentId: student.id, schoolCode });
    setReportLoading(false);
    if (!r.success) return message.error(r.error);
    setReportData(r.data);
  };

  const groupColumns = [
    { title: 'Name', dataIndex: 'name', render: (v, r) => <a onClick={() => setActiveGroup(r)}>{v}</a> },
    { title: 'Type', dataIndex: 'exam_type', render: (v) => <Tag>{v}</Tag> },
    { title: 'Class', dataIndex: 'class_instance_id', render: (id) => {
        const c = classes.find((x) => x.id === id);
        return c ? `Grade ${c.grade}-${c.section}` : '—';
    } },
    { title: 'Dates', render: (_, r) => r.start_date ? `${r.start_date} → ${r.end_date || ''}` : '—' },
    { title: 'Weightage', dataIndex: 'weightage', render: (v) => v != null ? `${(v * 100).toFixed(0)}%` : '—' },
    {
      title: 'Actions',
      render: (_, r) => (
        <Space>
          <Button size="small" type="primary" onClick={() => setActiveGroup(r)}>Open</Button>
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(r)} />
        </Space>
      ),
    },
  ];

  // Detail view: a single exam group is opened
  if (activeGroup) {
    const cls = classes.find((c) => c.id === activeGroup.class_instance_id);
    return (
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveGroup(null)}>Back</Button>
          <Title level={3} style={{ margin: 0 }}>{activeGroup.name}</Title>
          <Tag>{activeGroup.exam_type}</Tag>
          {cls && <Tag color="blue">Grade {cls.grade}-{cls.section}</Tag>}
        </Space>
        <Card
          title="Marks Entry"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddSubject}>
              Add Subject
            </Button>
          }
        >
          <MarksGrid
            examGroup={activeGroup}
            refreshKey={gridRefresh}
            onGenerateReport={generateReport}
          />
        </Card>

        <Modal
          title="Add Subject to Exam"
          open={addSubjectOpen}
          onOk={submitAddSubject}
          onCancel={() => setAddSubjectOpen(false)}
          okText="Add Subject"
        >
          <Form form={addSubjectForm} layout="vertical">
            <Form.Item name="subject_id" label="Subject" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="Pick a subject"
                optionFilterProp="label"
                options={subjects.map((s) => ({ value: s.id, label: s.subject_name }))}
                notFoundContent="No subjects defined for this school. Add subjects in Subjects page first."
              />
            </Form.Item>
            <Form.Item name="title" label="Paper Title (optional)">
              <Input placeholder="Auto: Exam Name — Subject" />
            </Form.Item>
            <Form.Item name="max_marks" label="Max Marks" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="test_date" label="Test Date (optional)">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Report Card"
          open={reportOpen}
          onCancel={() => setReportOpen(false)}
          footer={null}
          width={900}
          destroyOnClose
        >
          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <ReportCardPreview data={reportData} />
          )}
        </Modal>
      </div>
    );
  }

  // List view
  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 4 }}>Gradebook & Report Cards</Title>
      <Text type="secondary">Create an exam (e.g., "Unit Test 1"), add subject papers, enter marks, and print branded report cards.</Text>

      <Card style={{ marginTop: 16 }}>
        <Row gutter={12} align="middle">
          <Col><Text strong>Academic Year:</Text></Col>
          <Col>
            <Select
              style={{ width: 180 }}
              placeholder="Year"
              value={yearFilter}
              onChange={(v) => { setYearFilter(v); setClassFilter(null); }}
              options={years.map((y) => ({ value: y.id, label: `${y.year_start}-${y.year_end}${y.is_active ? ' (active)' : ''}` }))}
              allowClear
            />
          </Col>
          <Col><Text strong>Class:</Text></Col>
          <Col>
            <Select
              style={{ width: 200 }}
              placeholder="All classes"
              value={classFilter}
              onChange={setClassFilter}
              options={classes
                .filter((c) => !yearFilter || c.academic_year_id === yearFilter)
                .map((c) => ({ value: c.id, label: `Grade ${c.grade}-${c.section}` }))}
              allowClear
            />
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Exam</Button>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          loading={loadingGroups}
          dataSource={groups}
          columns={groupColumns}
          locale={{ emptyText: <Empty description="No exams yet. Click 'New Exam' to start." /> }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="New Exam"
        open={createOpen}
        onOk={submitCreate}
        onCancel={() => setCreateOpen(false)}
        okText="Create"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="Exam Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., Unit Test 1" />
          </Form.Item>
          <Form.Item name="exam_type" label="Type" initialValue="unit_test" rules={[{ required: true }]}>
            <Select options={[
              { value: 'unit_test', label: 'Unit Test' },
              { value: 'midterm', label: 'Mid Term' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'half_yearly', label: 'Half Yearly' },
              { value: 'final', label: 'Final' },
              { value: 'annual', label: 'Annual' },
              { value: 'custom', label: 'Custom' },
            ]} />
          </Form.Item>
          <Form.Item name="academic_year_id" label="Academic Year" rules={[{ required: true }]}>
            <Select options={years.map((y) => ({ value: y.id, label: `${y.year_start}-${y.year_end}` }))} />
          </Form.Item>
          <Form.Item name="class_instance_id" label="Class" rules={[{ required: true }]}>
            <Select options={classes
              .filter((c) => !yearFilter || c.academic_year_id === yearFilter)
              .map((c) => ({ value: c.id, label: `Grade ${c.grade}-${c.section}` }))} />
          </Form.Item>
          <Form.Item name="dates" label="Date Range">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="weightage" label="Weightage % (optional)">
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="e.g., 20" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
