import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Button, 
  Space, 
  Typography, 
  Alert, 
  Spin,
  Tooltip,
  Progress,
  Badge,
  Input,
  InputNumber,
  Select,
  Modal,
  Upload,
  Divider,
  message,
  Tag
} from 'antd';
import {
  UserOutlined,
  TrophyOutlined,
  CalendarOutlined,
  SaveOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { getSchoolCode } from '../utils/metadata';
import { 
  getTestById,
  getStudentsForClassInstance, 
  getTestMarks, 
  bulkUpsertTestMarks 
} from '../services/testService';
import MarksEditableTable from './MarksEditableTable';
import CsvDrawer from './CsvDrawer';

// Helpers
const chunk = (arr, size = 100) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const { Title, Text } = Typography;

/**
 * Props:
 * - user: { id: string, ... }
 * - testId: string
 * - onSaved?: (count: number) => void
 */
export default function OfflineMarksPanel({ user, testId, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState(null);
  const [students, setStudents] = useState([]); // [{id, name, roll_no}]
  const [marksByStudent, setMarksByStudent] = useState({}); // student_id -> { marks_obtained, max_marks, remarks, is_absent }
  const [filter, setFilter] = useState("all"); // all|missing|present|absent
  const [csvOpen, setCsvOpen] = useState(false);

  const schoolCode = useMemo(() => getSchoolCode?.(user), [user]);

  const maxMarks = useMemo(() => {
    if (!test) return 100;
    return Number(test.max_marks) || 100;
  }, [test]);

  const visibleRows = useMemo(() => {
    switch (filter) {
      case "missing":
        return students.filter(
          (s) => marksByStudent[s.id]?.marks_obtained === undefined && !marksByStudent[s.id]?.is_absent
        );
      case "present":
        return students.filter((s) => marksByStudent[s.id]?.is_absent === false);
      case "absent":
        return students.filter((s) => marksByStudent[s.id]?.is_absent === true);
      default:
        return students;
    }
  }, [students, marksByStudent, filter]);

  const stats = useMemo(() => {
    const total = students.length;
    let present = 0;
    let absent = 0;
    let entered = 0;
    students.forEach((s) => {
      const m = marksByStudent[s.id];
      if (!m) return;
      if (m.is_absent) {
        absent += 1;
      } else {
        present += 1;
        if (m.marks_obtained !== undefined && m.marks_obtained !== null && m.marks_obtained !== "") {
          entered += 1;
        }
      }
    });
    return { total, present, absent, entered };
  }, [students, marksByStudent]);

  const loadAll = useCallback(async () => {
    if (!user?.id || !testId) return;
    setLoading(true);
    try {
      // Fetch test + roster + existing marks
      const testRes = await getTestById(testId);
      if (testRes?.error) throw testRes.error;
      const theTest = testRes?.data || testRes;
      if (!theTest?.class_instance_id) throw new Error("Test missing class_instance_id.");

      const [stuRes, marksRes] = await Promise.all([
        getStudentsForClassInstance(theTest.class_instance_id, schoolCode),
        getTestMarks(testId),
      ]);

      if (stuRes?.error) throw stuRes.error;
      if (marksRes?.error) throw marksRes.error;

      const roster = (stuRes?.data || stuRes || []).map((s) => ({
        id: s.id,
        name: s.full_name || s.name || s.display_name || `Student ${s.id.slice(0, 6)}`,
        roll_no: s.roll_no || s.rollNumber || null,
      }));

      const marks = {};
      (marksRes?.data || marksRes || []).forEach((r) => {
        marks[r.student_id] = {
          marks_obtained: r.is_absent ? 0 : r.marks_obtained,
          max_marks: r.max_marks ?? theTest.max_marks ?? 100,
          remarks: r.remarks || "",
          is_absent: !!r.is_absent,
        };
      });

      setTest(theTest);
      setStudents(roster);
      setMarksByStudent((prev) => ({ ...prev, ...marks }));
    } catch (err) {
      console.error(err);
      message.error(err?.message || "Failed to load test/students/marks.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, testId, schoolCode]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setOne = (studentId, patch) => {
    setMarksByStudent((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), ...patch },
    }));
  };

  const toggleAbsent = (studentId) => {
    const curr = marksByStudent[studentId]?.is_absent ?? false;
    if (!curr) {
      // if marking absent, clear marks
      setOne(studentId, { is_absent: true, marks_obtained: 0 });
    } else {
      setOne(studentId, { is_absent: false });
    }
  };

  const save = async () => {
    if (!test) return;
    if (!schoolCode) {
      message.error("No school_code found in session.");
      return;
    }
    setSaving(true);
    try {
      const rows = students.map((s) => {
        const m = marksByStudent[s.id] || {};
        const is_absent = !!m.is_absent;
        const mo =
          m.marks_obtained === "" || m.marks_obtained === undefined || m.marks_obtained === null
            ? null
            : Number(m.marks_obtained);
        return {
          test_id: test.id,
          student_id: s.id,
          // If absent, store 0 marks and flag absent
          marks_obtained: is_absent ? 0 : mo,
          max_marks: Number(m.max_marks ?? maxMarks),
          remarks: m.remarks || "",
          is_absent,
          created_by: user.id,
          school_code: schoolCode,
          class_instance_id: test.class_instance_id,
        };
      });

      // Write in chunks, bubble up errors
      let written = 0;
      for (const part of chunk(rows, 200)) {
        const res = await bulkUpsertTestMarks(part, {
          onConflict: "test_id,student_id",
          returning: true,
        });
        console.log("bulkUpsertTestMarks result:", res);
        if (res?.error) throw res.error;
        const data = res?.data || [];
        written += Array.isArray(data) ? data.length : part.length;
      }
      message.success(`Saved ${written} records`);
      onSaved?.(written);
    } catch (err) {
      console.error(err);
      message.error(err?.message || "Failed to save marks.");
    } finally {
      setSaving(false);
    }
  };

  const beforeCsvUpload = (file) => {
    const ok =
      file.type === "text/csv" ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "application/vnd.ms-excel";
    if (!ok) {
      message.error("Please upload a .csv file.");
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleCsvFile = async (file) => {
    // Very simple CSV (comma separated) parser w/ header: student_id,marks_obtained,max_marks,remarks,is_absent
    const text = await file.text();
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (lines.length === 0) {
      message.error("CSV is empty.");
      return;
    }
    const header = lines.shift().split(",").map((h) => h.trim());
    const required = ["student_id", "marks_obtained"];
    for (const r of required) {
      if (!header.includes(r)) {
        message.error(`CSV missing required column: ${r}`);
        return;
      }
    }
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    const updates = {};
    for (const line of lines) {
      const cols = line.split(",");
      const student_id = cols[idx.student_id]?.trim();
      if (!student_id) continue;
      const marks_obtained = cols[idx.marks_obtained]?.trim();
      const max_marks_csv = idx.max_marks != null ? cols[idx.max_marks]?.trim() : "";
      const remarks = idx.remarks != null ? cols[idx.remarks]?.trim() : "";
      const is_absent_csv = idx.is_absent != null ? cols[idx.is_absent]?.trim() : "";

      const is_absent = ["1", "true", "yes", "y"].includes((is_absent_csv || "").toLowerCase());
      updates[student_id] = {
        marks_obtained: is_absent ? 0 : marks_obtained === "" ? undefined : Number(marks_obtained),
        max_marks: max_marks_csv ? Number(max_marks_csv) : maxMarks,
        remarks: remarks || "",
        is_absent,
      };
    }
    setMarksByStudent((prev) => ({ ...prev, ...updates }));
    message.success("CSV loaded into form.");
  };

  return (
    <div className="offline-marks-panel">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space align="center" wrap>
            <Title level={4} style={{ margin: 0 }}>
              {test ? test.name || `Test ${test.id}` : "Loading test…"}
            </Title>
            <Tag>{test?.class_name || `Class ${test?.class_instance_id ?? "-"}`}</Tag>
            <Tag color="blue">Max: {maxMarks}</Tag>
            <Tag color="purple">Students: {stats.total}</Tag>
            <Tag color="green">Entered: {stats.entered}</Tag>
            <Tag color="red">Absent: {stats.absent}</Tag>
          </Space>
        </Col>

        <Col span={24}>
          <Card size="small">
            <Space wrap>
              <Select
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "missing", label: "Missing" },
                  { value: "present", label: "Present only" },
                  { value: "absent", label: "Absent only" },
                ]}
                style={{ width: 160 }}
              />
              <Button icon={<ReloadOutlined />} onClick={loadAll}>
                Refresh
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                Save All
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setCsvOpen(true)}>
                Import CSV
              </Button>
              <Badge status={schoolCode ? "success" : "error"} text={`school_code: ${schoolCode || "—"}`} />
            </Space>
          </Card>
        </Col>

        <Col span={24}>
          {loading ? (
            <Spin />
          ) : students.length === 0 ? (
            <Alert type="info" message="No students found for this class." />
          ) : (
            <Card>
              <Row gutter={[12, 12]}>
                {visibleRows.map((s) => {
                  const m = marksByStudent[s.id] || {};
                  const absent = !!m.is_absent;
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={s.id}>
                      <Card size="small" title={<Space>
                        <Text strong>{s.roll_no ? `${s.roll_no}.` : null} {s.name}</Text>
                        {absent ? <Tag color="red">Absent</Tag> : null}
                      </Space>}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Space>
                            <Text>Marks</Text>
                            <InputNumber
                              min={0}
                              max={maxMarks}
                              value={absent ? 0 : m.marks_obtained}
                              disabled={absent}
                              onChange={(v) => setOne(s.id, { marks_obtained: v })}
                            />
                            <Text type="secondary">/ {m.max_marks ?? maxMarks}</Text>
                          </Space>
                          <Space>
                            <Text>Max</Text>
                            <InputNumber
                              min={1}
                              max={1000}
                              value={m.max_marks ?? maxMarks}
                              onChange={(v) => setOne(s.id, { max_marks: v })}
                            />
                          </Space>
                          <Space>
                            <Button
                              size="small"
                              type={absent ? "default" : "dashed"}
                              danger={absent}
                              onClick={() => toggleAbsent(s.id)}
                            >
                              {absent ? "Mark Present" : "Mark Absent"}
                            </Button>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="Import Marks (CSV)"
        open={csvOpen}
        onCancel={() => setCsvOpen(false)}
        onOk={() => setCsvOpen(false)}
        okText="Done"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="CSV format"
            description={
              <div>
                Required columns: <code>student_id, marks_obtained</code>. Optional:{" "}
                <code>max_marks, remarks, is_absent</code>. If <code>is_absent</code> is
                true/1/yes, marks are set to 0.
              </div>
            }
          />
          <Upload.Dragger
            maxCount={1}
            accept=".csv,text/csv"
            beforeUpload={beforeCsvUpload}
            customRequest={async ({ file, onSuccess, onError }) => {
              try {
                await handleCsvFile(file);
                onSuccess?.("ok");
              } catch (e) {
                onError?.(e);
              }
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Click or drag CSV to this area to upload</p>
          </Upload.Dragger>
          <Divider />
          <Text type="secondary">
            Tip: You can export the class roster, add a <code>marks_obtained</code> column, and re-import.
          </Text>
        </Space>
      </Modal>
    </div>
  );
}
