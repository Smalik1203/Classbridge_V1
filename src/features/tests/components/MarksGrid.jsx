import React, { useEffect, useMemo, useState } from 'react';
import { Table, InputNumber, Button, Space, message, Tag, Popconfirm, Empty, Tooltip } from 'antd';
import { SaveOutlined, MoreOutlined, FilePdfOutlined } from '@ant-design/icons';
import {
  getGroupTests, getStudentsForClass, getMarksForTests,
  bulkSaveMarks, deleteSubjectTest,
  getGradingScale, getDefaultGradingScale,
} from '@/features/tests/services/gradebookService';
import { getGrade } from '@/features/tests/utils/grading';

const ROW_STYLE = `
.marks-grid-row .marks-row-action { opacity: 0.35; transition: opacity 0.15s; }
.marks-grid-row:hover .marks-row-action { opacity: 1; }
.marks-grid-subject-menu { opacity: 0.4; transition: opacity 0.15s; }
.marks-grid-subject-header:hover .marks-grid-subject-menu { opacity: 1; }
`;

/**
 * Inline marks-entry grid: rows = students, columns = subject tests.
 * Saves all dirty cells in a single upsert.
 */
export default function MarksGrid({ examGroup, selectedClassId, onGenerateReport, refreshKey }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [groupTests, setGroupTests] = useState([]);
  const [marks, setMarks] = useState({});
  const [dirty, setDirty] = useState({});
  const [scale, setScale] = useState(null);

  const load = async () => {
    if (!examGroup) return;
    const classId = selectedClassId || examGroup.class_instance_id;
    if (!classId) return;
    setLoading(true);
    const [stRes, gtRes, scaleRes] = await Promise.all([
      getStudentsForClass(classId),
      getGroupTests(examGroup.id, classId),
      examGroup.grading_scale_id
        ? getGradingScale(examGroup.grading_scale_id)
        : getDefaultGradingScale(examGroup.school_code),
    ]);
    if (stRes.success) setStudents(stRes.data);
    if (gtRes.success) setGroupTests(gtRes.data);
    setScale(scaleRes?.success ? scaleRes.data : null);

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [examGroup?.id, selectedClassId, refreshKey]);

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
        <div className="marks-grid-subject-header" style={{ minWidth: 86 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subj}
            </span>
            <Popconfirm
              title="Remove this subject from the exam?"
              onConfirm={() => handleRemoveSubject(gt.test_id)}
              okText="Remove"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Subject options">
                <Button
                  size="small"
                  type="text"
                  icon={<MoreOutlined />}
                  className="marks-grid-subject-menu"
                  style={{ width: 18, height: 18, padding: 0, minWidth: 18, flexShrink: 0 }}
                />
              </Tooltip>
            </Popconfirm>
          </div>
          <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>/ {max}</div>
        </div>
      ),
      key: gt.test_id,
      width: 100,
      render: (_, student) => {
        const key = `${gt.test_id}:${student.id}`;
        return (
          <InputNumber
            size="small"
            min={0}
            max={max}
            value={marks[key]}
            onChange={(v) => setCell(gt.test_id, student.id, v)}
            style={{ width: 72, background: dirty[key] ? '#fffbe6' : undefined }}
            placeholder="–"
          />
        );
      },
    };
  }), [groupTests, marks, dirty]);

  const totalColCellStyle = {
    borderLeft: '2px solid #d9d9d9',
    background: '#fafafa',
  };
  const computeTotals = (student) => {
    let obt = 0, max = 0, hasAny = false;
    groupTests.forEach((gt) => {
      const v = marks[`${gt.test_id}:${student.id}`];
      if (v != null && v !== '') { obt += Number(v); hasAny = true; }
      max += Number(gt.tests?.max_marks ?? 100);
    });
    return { obt, max, hasAny };
  };

  const totalCol = {
    title: 'Total',
    key: '_total',
    width: 100,
    fixed: 'right',
    onHeaderCell: () => ({ style: { ...totalColCellStyle, background: '#f0f0f0' } }),
    onCell: () => ({ style: totalColCellStyle }),
    render: (_, student) => {
      const { obt, max, hasAny } = computeTotals(student);
      if (!hasAny) return <span style={{ color: '#bbb' }}>—</span>;
      return (
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1f1f1f' }}>
          {obt}<span style={{ color: '#888', fontWeight: 500 }}>/{max}</span>
        </span>
      );
    },
  };

  const gradeCol = scale?.scale?.length ? {
    title: 'Grade',
    key: '_grade',
    width: 80,
    fixed: 'right',
    onHeaderCell: () => ({ style: { ...totalColCellStyle, background: '#f0f0f0' } }),
    onCell: () => ({ style: totalColCellStyle }),
    render: (_, student) => {
      const { obt, max, hasAny } = computeTotals(student);
      if (!hasAny) return <span style={{ color: '#bbb' }}>—</span>;
      const pctNum = max > 0 ? Number(((obt / max) * 100).toFixed(1)) : 0;
      const grade = getGrade(pctNum, scale);
      if (!grade?.grade) return <span style={{ color: '#bbb' }}>—</span>;
      const tone = pctNum >= 75 ? { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' }
        : pctNum >= 50 ? { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' }
        : pctNum >= 33 ? { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' }
        : { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' };
      return (
        <span
          title={grade.description || grade.grade}
          style={{
            display: 'inline-block',
            fontSize: 12, fontWeight: 700,
            padding: '2px 9px', borderRadius: 4,
            background: tone.bg, color: tone.fg,
            border: `1px solid ${tone.bd}`,
          }}
        >
          {grade.grade}
        </span>
      );
    },
  } : null;

  const studentCol = {
    title: 'Student',
    dataIndex: 'full_name',
    width: 200,
    fixed: 'left',
    render: (_, student) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.full_name}
          </div>
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.2 }}>
            {student.student_code}
          </div>
        </div>
        <Tooltip title="Generate report card">
          <Button
            size="small"
            type="text"
            icon={<FilePdfOutlined />}
            className="marks-row-action"
            onClick={() => onGenerateReport?.(student)}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      </div>
    ),
  };

  const columns = [
    studentCol,
    ...subjectColumns,
    totalCol,
    ...(gradeCol ? [gradeCol] : []),
  ];

  const dirtyCount = Object.keys(dirty).length;

  if (groupTests.length === 0 && !loading) {
    return <Empty description="No subjects added yet. Click 'Add Subject' above to start." />;
  }

  return (
    <div>
      <style>{ROW_STYLE}</style>
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
        rowClassName="marks-grid-row"
        pagination={{ pageSize: 25 }}
        scroll={{ x: 'max-content' }}
        size="small"
        bordered
      />
    </div>
  );
}
