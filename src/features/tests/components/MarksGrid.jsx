import React, { useEffect, useMemo, useState } from 'react';
import { Table, InputNumber, Button, Space, message, Tag, Popconfirm, Empty } from 'antd';
import { SaveOutlined, DeleteOutlined, FilePdfOutlined } from '@ant-design/icons';
import {
  getGroupTests, getStudentsForClass, getMarksForTests,
  bulkSaveMarks, deleteSubjectTest,
} from '@/features/tests/services/gradebookService';

/**
 * Inline marks-entry grid: rows = students, columns = subject tests.
 * Saves all dirty cells in a single upsert.
 */
export default function MarksGrid({ examGroup, onGenerateReport, refreshKey }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [groupTests, setGroupTests] = useState([]); // [{test_id, sequence, tests:{...}}]
  const [marks, setMarks] = useState({}); // key: `${test_id}:${student_id}` => marks_obtained
  const [dirty, setDirty] = useState({}); // same key shape

  const load = async () => {
    if (!examGroup) return;
    setLoading(true);
    const [stRes, gtRes] = await Promise.all([
      getStudentsForClass(examGroup.class_instance_id),
      getGroupTests(examGroup.id),
    ]);
    if (stRes.success) setStudents(stRes.data);
    if (gtRes.success) setGroupTests(gtRes.data);

    const testIds = (gtRes.data || []).map((g) => g.test_id);
    if (testIds.length > 0 && stRes.success) {
      const mRes = await getMarksForTests({ testIds, studentIds: stRes.data.map((s) => s.id) });
      if (mRes.success) {
        const map = {};
        mRes.data.forEach((m) => {
          map[`${m.test_id}:${m.student_id}`] = m.marks_obtained;
        });
        setMarks(map);
      }
    } else {
      setMarks({});
    }
    setDirty({});
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [examGroup?.id, refreshKey]);

  const setCell = (testId, studentId, value) => {
    const key = `${testId}:${studentId}`;
    setMarks((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => ({ ...prev, [key]: true }));
  };

  const handleSave = async () => {
    const dirtyKeys = Object.keys(dirty);
    if (dirtyKeys.length === 0) return message.info('No changes to save');
    setSaving(true);
    const rows = dirtyKeys.map((k) => {
      const [test_id, student_id] = k.split(':');
      const gt = groupTests.find((g) => g.test_id === test_id);
      const max = gt?.tests?.max_marks ?? 100;
      const v = marks[k];
      return {
        test_id,
        student_id,
        marks_obtained: v == null || v === '' ? 0 : Number(v),
        max_marks: max,
      };
    });
    const r = await bulkSaveMarks(rows);
    setSaving(false);
    if (!r.success) return message.error(r.error);
    message.success(`Saved ${rows.length} mark${rows.length === 1 ? '' : 's'}`);
    setDirty({});
  };

  const handleRemoveSubject = async (testId) => {
    const r = await deleteSubjectTest(testId);
    if (!r.success) return message.error(r.error);
    message.success('Subject removed');
    load();
  };

  const subjectColumns = useMemo(() => groupTests.map((gt) => {
    const subj = gt.tests?.subjects?.subject_name || gt.tests?.title || 'Subject';
    const max = gt.tests?.max_marks ?? 100;
    return {
      title: (
        <div style={{ minWidth: 110 }}>
          <div style={{ fontWeight: 600 }}>{subj}</div>
          <div style={{ fontSize: 11, color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>/ {max}</span>
            <Popconfirm title="Remove this subject from the exam?" onConfirm={() => handleRemoveSubject(gt.test_id)} okText="Remove" okButtonProps={{ danger: true }}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        </div>
      ),
      key: gt.test_id,
      width: 130,
      render: (_, student) => {
        const key = `${gt.test_id}:${student.id}`;
        return (
          <InputNumber
            size="small"
            min={0}
            max={max}
            value={marks[key]}
            onChange={(v) => setCell(gt.test_id, student.id, v)}
            style={{ width: 80, background: dirty[key] ? '#fffbe6' : undefined }}
            placeholder="–"
          />
        );
      },
    };
  }), [groupTests, marks, dirty]);

  const totalCol = {
    title: 'Total',
    key: '_total',
    width: 100,
    fixed: 'right',
    render: (_, student) => {
      let obt = 0, max = 0, hasAny = false;
      groupTests.forEach((gt) => {
        const v = marks[`${gt.test_id}:${student.id}`];
        if (v != null && v !== '') { obt += Number(v); hasAny = true; }
        max += Number(gt.tests?.max_marks ?? 100);
      });
      const pct = hasAny && max > 0 ? ((obt / max) * 100).toFixed(1) : null;
      return hasAny ? (
        <div>
          <div style={{ fontWeight: 600 }}>{obt}/{max}</div>
          <Tag color={pct >= 33 ? 'green' : 'red'} style={{ marginTop: 2 }}>{pct}%</Tag>
        </div>
      ) : <span style={{ color: '#bbb' }}>—</span>;
    },
  };

  const actionCol = {
    title: 'Report',
    key: '_action',
    width: 120,
    fixed: 'right',
    render: (_, student) => (
      <Button size="small" icon={<FilePdfOutlined />} onClick={() => onGenerateReport?.(student)}>
        Card
      </Button>
    ),
  };

  const columns = [
    { title: 'Code', dataIndex: 'student_code', width: 90, fixed: 'left' },
    { title: 'Student', dataIndex: 'full_name', width: 180, fixed: 'left' },
    ...subjectColumns,
    totalCol,
    actionCol,
  ];

  const dirtyCount = Object.keys(dirty).length;

  if (groupTests.length === 0 && !loading) {
    return <Empty description="No subjects added yet. Click 'Add Subject' above to start." />;
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Tag>{students.length} students</Tag>
          <Tag>{groupTests.length} subjects</Tag>
          {dirtyCount > 0 && <Tag color="gold">{dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}</Tag>}
        </div>
        <Space>
          <Button icon={<SaveOutlined />} type="primary" loading={saving} onClick={handleSave} disabled={dirtyCount === 0}>
            Save Marks
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={students}
        columns={columns}
        pagination={{ pageSize: 25 }}
        scroll={{ x: 'max-content' }}
        size="small"
        bordered
      />
    </div>
  );
}
