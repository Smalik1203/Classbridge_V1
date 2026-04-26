import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Alert, Row, Col, Statistic } from 'antd';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area,
} from 'recharts';
import {
  getStudentTestAttempts, getClassTestAttempts, getSchoolTestAttempts,
  getAttendanceRows, attendancePerformanceCorrelation,
} from '../services/analyticsService';
import dayjs from 'dayjs';

export default function AttendanceCorrelationTab({ scope, schoolCode, classId, studentId, dateRange, subjectId }) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = dateRange || [];
        let attempts = [];
        let attendance = [];
        if (scope === 'student' && studentId) {
          [attempts, attendance] = await Promise.all([
            getStudentTestAttempts(studentId, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ studentId, startDate: s, endDate: e }),
          ]);
        } else if (scope === 'class' && classId) {
          [attempts, attendance] = await Promise.all([
            getClassTestAttempts(classId, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ classInstanceId: classId, startDate: s, endDate: e }),
          ]);
        } else {
          [attempts, attendance] = await Promise.all([
            getSchoolTestAttempts(schoolCode, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ schoolCode, startDate: s, endDate: e }),
          ]);
        }
        if (!cancelled) setSeries(attendancePerformanceCorrelation(attendance, attempts));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, studentId, dateRange, subjectId]);

  const corr = useMemo(() => {
    const pts = series.filter((p) => p.attendanceRate != null && p.avgScore != null);
    if (pts.length < 2) return null;
    const ax = pts.map((p) => p.attendanceRate);
    const ay = pts.map((p) => p.avgScore);
    const mx = ax.reduce((a, b) => a + b, 0) / ax.length;
    const my = ay.reduce((a, b) => a + b, 0) / ay.length;
    const num = ax.reduce((acc, x, i) => acc + (x - mx) * (ay[i] - my), 0);
    const denX = Math.sqrt(ax.reduce((acc, x) => acc + (x - mx) ** 2, 0));
    const denY = Math.sqrt(ay.reduce((acc, y) => acc + (y - my) ** 2, 0));
    if (!denX || !denY) return null;
    const r = num / (denX * denY);
    return Math.round(r * 1000) / 1000;
  }, [series]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Weekly attendance rate vs weekly average test score"
        description="High correlation suggests attendance directly influences performance. Negative correlation may indicate other factors at play."
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card><Statistic title="Weeks tracked" value={series.length} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Pearson r" value={corr ?? '—'} valueStyle={{ color: corr == null ? undefined : corr > 0.3 ? '#10b981' : corr < -0.3 ? '#ef4444' : '#f59e0b' }} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Interpretation" valueStyle={{ fontSize: 16 }} value={
          corr == null ? 'Insufficient data' : Math.abs(corr) > 0.7 ? 'Strong' : Math.abs(corr) > 0.3 ? 'Moderate' : 'Weak'
        } /></Card></Col>
      </Row>
      <Card>
        {series.length === 0 ? <Empty description="No data points to compare" /> : (
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <ComposedChart data={series}>
                <defs>
                  <linearGradient id="att2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(v) => dayjs(v).format('DD/MM')} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="attendanceRate" stroke="#10b981" fill="url(#att2)" name="Attendance %" connectNulls />
                <Line type="monotone" dataKey="avgScore" stroke="#3b82f6" dot={{ r: 3 }} name="Avg score %" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
