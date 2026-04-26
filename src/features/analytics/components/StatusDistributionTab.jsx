import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Row, Col, Segmented, Statistic, Button } from 'antd';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { DownloadOutlined } from '@ant-design/icons';
import {
  getStudentTestAttempts, getClassTestAttempts, getSchoolTestAttempts,
  getAttendanceRows, statusDistribution, STATUS_BANDS,
} from '../services/analyticsService';
import { downloadCsv } from '../utils/exportUtils';

export default function StatusDistributionTab({ scope, schoolCode, classId, studentId, dateRange, subjectId }) {
  const [view, setView] = useState('grades');
  const [attempts, setAttempts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = dateRange || [];
        if (scope === 'student' && studentId) {
          const [a, att] = await Promise.all([
            getStudentTestAttempts(studentId, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ studentId, startDate: s, endDate: e }),
          ]);
          if (!cancelled) { setAttempts(a); setAttendance(att); }
        } else if (scope === 'class' && classId) {
          const [a, att] = await Promise.all([
            getClassTestAttempts(classId, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ classInstanceId: classId, startDate: s, endDate: e }),
          ]);
          if (!cancelled) { setAttempts(a); setAttendance(att); }
        } else {
          const [a, att] = await Promise.all([
            getSchoolTestAttempts(schoolCode, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ schoolCode, startDate: s, endDate: e }),
          ]);
          if (!cancelled) { setAttempts(a); setAttendance(att); }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, studentId, dateRange, subjectId]);

  const grade = useMemo(() => statusDistribution(attempts), [attempts]);
  const attDist = useMemo(() => {
    const total = attendance.length || 1;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const late = attendance.filter((a) => a.status === 'late').length;
    return [
      { name: 'Present', value: present, color: '#10b981', percent: Math.round((present / total) * 1000) / 10 },
      { name: 'Late', value: late, color: '#f59e0b', percent: Math.round((late / total) * 1000) / 10 },
      { name: 'Absent', value: absent, color: '#ef4444', percent: Math.round((absent / total) * 1000) / 10 },
    ];
  }, [attendance]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <>
      <Segmented
        value={view}
        onChange={setView}
        style={{ marginBottom: 12 }}
        options={[
          { label: 'Grade bands', value: 'grades' },
          { label: 'Attendance status', value: 'attendance' },
        ]}
      />

      {view === 'grades' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {grade.map((b) => (
              <Col xs={12} sm={6} md={4} key={b.key}>
                <Card><Statistic title={b.label} value={b.value} suffix={`(${b.percent}%)`} valueStyle={{ color: b.color, fontSize: 22 }} /></Card>
              </Col>
            ))}
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Distribution" bodyStyle={{ height: 360 }}>
                {attempts.length === 0 ? <Empty /> : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={grade.filter((b) => b.value > 0)} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={110} label={(e) => `${e.label} (${e.value})`}>
                        {grade.filter((b) => b.value > 0).map((b, i) => <Cell key={i} fill={b.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Bands (count)" bodyStyle={{ height: 360 }} extra={
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadCsv('grade_distribution', grade, [
                  { dataIndex: 'label', title: 'Band' },
                  { dataIndex: 'value', title: 'Count' },
                  { dataIndex: 'percent', title: 'Percent' },
                ])}>CSV</Button>
              }>
                <ResponsiveContainer>
                  <BarChart data={grade}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value">
                      {grade.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {view === 'attendance' && (
        <Row gutter={[16, 16]}>
          {attDist.map((d) => (
            <Col xs={8} key={d.name}>
              <Card><Statistic title={d.name} value={d.value} suffix={`(${d.percent}%)`} valueStyle={{ color: d.color }} /></Card>
            </Col>
          ))}
          <Col xs={24}>
            <Card title="Attendance status" bodyStyle={{ height: 380 }}>
              {attendance.length === 0 ? <Empty /> : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={attDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(e) => `${e.name} (${e.value})`}>
                      {attDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
}
