import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Row, Col, Segmented, Tag } from 'antd';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, AreaChart, Area,
} from 'recharts';
import dayjs from 'dayjs';
import {
  getStudentTestAttempts, getClassTestAttempts, getSchoolTestAttempts,
  trendByDay, trendBySubject,
} from '../services/analyticsService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#84cc16'];

export default function PerformanceTrendsTab({ scope, schoolCode, classId, studentId, dateRange, subjectId }) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [view, setView] = useState('overall');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = dateRange || [];
        let data = [];
        if (scope === 'student' && studentId) data = await getStudentTestAttempts(studentId, { startDate: s, endDate: e, subjectId });
        else if (scope === 'class' && classId) data = await getClassTestAttempts(classId, { startDate: s, endDate: e, subjectId });
        else if (scope === 'school') data = await getSchoolTestAttempts(schoolCode, { startDate: s, endDate: e, subjectId });
        if (!cancelled) setAttempts(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, studentId, dateRange, subjectId]);

  const overall = useMemo(() => trendByDay(attempts), [attempts]);
  const bySubject = useMemo(() => {
    const subjMap = new Map();
    attempts.forEach((a) => {
      if (!a.completed_at) return;
      const sId = a.tests?.subjects?.id || a.tests?.subject_id;
      const sName = a.tests?.subjects?.name || 'Unknown';
      const day = dayjs(a.completed_at).format('YYYY-MM-DD');
      const key = `${sId}|${day}`;
      if (!subjMap.has(key)) subjMap.set(key, { subjectId: sId, subjectName: sName, day, sum: 0, count: 0 });
      const m = subjMap.get(key);
      m.sum += a.percent || 0; m.count += 1;
    });
    // Pivot: rows by day, columns by subject
    const dayKeys = new Set();
    const subjects = new Map();
    subjMap.forEach((v) => {
      dayKeys.add(v.day);
      subjects.set(v.subjectId, v.subjectName);
    });
    const days = Array.from(dayKeys).sort();
    const rows = days.map((d) => {
      const r = { date: d };
      subjects.forEach((name, id) => {
        const m = subjMap.get(`${id}|${d}`);
        r[name] = m ? Math.round((m.sum / m.count) * 10) / 10 : null;
      });
      return r;
    });
    return { rows, subjectNames: Array.from(subjects.values()) };
  }, [attempts]);

  const byType = useMemo(() => {
    const typeMap = new Map();
    attempts.forEach((a) => {
      const t = a.tests?.test_type || 'Unknown';
      const m = typeMap.get(t) || { type: t, sum: 0, count: 0 };
      m.sum += a.percent || 0; m.count += 1;
      typeMap.set(t, m);
    });
    return Array.from(typeMap.values()).map((m) => ({
      type: m.type, avg: Math.round((m.sum / m.count) * 10) / 10, count: m.count,
    }));
  }, [attempts]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
  if (!attempts.length) return <Empty description="No test attempts in this period" />;

  return (
    <>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { label: 'Overall', value: 'overall' },
          { label: 'By subject', value: 'subject' },
          { label: 'By test type', value: 'type' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {view === 'overall' && (
        <Card bodyStyle={{ height: 380 }}>
          <ResponsiveContainer>
            <AreaChart data={overall}>
              <defs>
                <linearGradient id="trnd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(v) => dayjs(v).format('DD/MM')} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="avg" stroke="#3b82f6" fill="url(#trnd)" name="Avg score %" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {view === 'subject' && (
        <Card bodyStyle={{ height: 380 }}>
          <ResponsiveContainer>
            <LineChart data={bySubject.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(v) => dayjs(v).format('DD/MM')} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {bySubject.subjectNames.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {view === 'type' && (
        <Row gutter={[16, 16]}>
          {byType.map((t, i) => (
            <Col xs={24} sm={12} md={8} key={t.type}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{t.type}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: COLORS[i % COLORS.length] }}>{t.avg}%</div>
                    <Tag>{t.count} attempts</Tag>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
