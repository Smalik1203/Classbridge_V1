import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Statistic, Spin, Tag, Progress, List, Typography } from 'antd';
import EmptyState from '@/shared/ui/EmptyState';
import {
  TrophyOutlined, FieldTimeOutlined, RiseOutlined, FallOutlined,
  TeamOutlined, BookOutlined, LineChartOutlined, AlertOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import {
  getStudentTestAttempts, getClassTestAttempts, getSchoolTestAttempts,
  getAttendanceRows, listStudents, listClasses, statusDistribution, trendByDay, trendBySubject,
} from '../services/analyticsService';
import dayjs from 'dayjs';
import { kpiTone } from '@/shared/components/kpiTone';

const { Text, Title } = Typography;

export default function OverviewTab({ scope, schoolCode, classId, studentId, dateRange, subjectId, onDrillClass, onDrillStudent }) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = dateRange || [];
        if (scope === 'student' && studentId) {
          const a = await getStudentTestAttempts(studentId, { startDate: s, endDate: e, subjectId });
          const att = await getAttendanceRows({ studentId, startDate: s, endDate: e });
          if (!cancelled) { setAttempts(a); setAttendance(att); }
        } else if (scope === 'class' && classId) {
          const [a, att, st] = await Promise.all([
            getClassTestAttempts(classId, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ classInstanceId: classId, startDate: s, endDate: e }),
            listStudents(schoolCode, classId),
          ]);
          if (!cancelled) { setAttempts(a); setAttendance(att); setStudents(st); }
        } else {
          const [a, att, cls] = await Promise.all([
            getSchoolTestAttempts(schoolCode, { startDate: s, endDate: e, subjectId }),
            getAttendanceRows({ schoolCode, startDate: s, endDate: e }),
            listClasses(schoolCode),
          ]);
          if (!cancelled) { setAttempts(a); setAttendance(att); setClasses(cls); }
        }
      } catch (err) {
        console.error('OverviewTab load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, studentId, dateRange, subjectId]);

  const stats = useMemo(() => {
    const tot = attempts.length;
    const avg = tot ? Math.round((attempts.reduce((s, a) => s + (a.percent || 0), 0) / tot) * 10) / 10 : 0;
    const pass = attempts.filter((a) => (a.percent || 0) >= 33).length;
    const passRate = tot ? Math.round((pass / tot) * 100) : 0;
    const attTot = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const attRate = attTot ? Math.round((present / attTot) * 100) : 0;
    return { tot, avg, passRate, attRate };
  }, [attempts, attendance]);

  const trend = useMemo(() => trendByDay(attempts), [attempts]);
  const dist = useMemo(() => statusDistribution(attempts), [attempts]);
  const subj = useMemo(() => trendBySubject(attempts), [attempts]);

  // Top performers / classes (class & school scopes)
  const ranked = useMemo(() => {
    if (scope === 'class') {
      const byStu = new Map();
      attempts.forEach((a) => {
        const m = byStu.get(a.student_id) || { studentId: a.student_id, sum: 0, count: 0 };
        m.sum += a.percent || 0; m.count += 1;
        byStu.set(a.student_id, m);
      });
      const sMap = new Map(students.map((s) => [s.id, s]));
      return Array.from(byStu.values()).map((m) => ({
        studentId: m.studentId,
        name: sMap.get(m.studentId)?.full_name || 'Unknown',
        avg: m.count ? Math.round((m.sum / m.count) * 10) / 10 : 0,
        count: m.count,
      })).sort((a, b) => b.avg - a.avg);
    }
    if (scope === 'school') {
      const byCls = new Map();
      attempts.forEach((a) => {
        const cId = a.tests?.class_instance_id;
        if (!cId) return;
        const m = byCls.get(cId) || { classId: cId, sum: 0, count: 0 };
        m.sum += a.percent || 0; m.count += 1;
        byCls.set(cId, m);
      });
      const cMap = new Map(classes.map((c) => [c.id, c]));
      return Array.from(byCls.values()).map((m) => ({
        classId: m.classId,
        name: cMap.get(m.classId)?.label || 'Unknown',
        avg: m.count ? Math.round((m.sum / m.count) * 10) / 10 : 0,
        count: m.count,
      })).sort((a, b) => b.avg - a.avg);
    }
    return [];
  }, [scope, attempts, students, classes]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Tests taken" value={stats.tot} prefix={<BookOutlined />}
              valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Avg score" value={stats.avg} suffix="%" prefix={<TrophyOutlined />}
              valueStyle={{
                fontSize: 24,
                color: kpiTone(stats.avg, (v) => v >= 60 ? 'positive' : v >= 40 ? 'attention' : 'critical'),
              }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Pass rate" value={stats.passRate} suffix="%" prefix={<RiseOutlined />}
              valueStyle={{
                fontSize: 24,
                color: kpiTone(stats.passRate, (v) => v >= 70 ? 'positive' : 'attention'),
              }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Attendance" value={stats.attRate} suffix="%" prefix={<FieldTimeOutlined />}
              valueStyle={{
                fontSize: 24,
                color: kpiTone(stats.attRate, (v) => v >= 80 ? 'positive' : v >= 50 ? 'attention' : 'critical'),
              }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={<><LineChartOutlined /> Performance trend</>} bodyStyle={{ height: 320 }}>
            {trend.length === 0 ? (
              <EmptyState
                title="No tests in this period"
                description="Try widening the date range, or have students take a test to see the trend."
                type="analytics"
              />
            ) : (
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="ovG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => dayjs(v).format('DD/MM')} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="avg" stroke="#3b82f6" fill="url(#ovG)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Status distribution" bodyStyle={{ height: 320 }}>
            {dist.every((d) => d.value === 0) ? (
              <EmptyState
                title="No graded tests yet"
                description="Status breakdown shows how attempts split across passed, failed, and incomplete."
                type="analytics"
              />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={(e) => e.value > 0 ? `${e.label} (${e.value})` : ''}>
                    {dist.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Subject averages" bodyStyle={{ height: 280 }}>
            {subj.length === 0 ? (
              <EmptyState
                title="No subject data"
                description="Subject averages appear once tests are taken in at least one subject."
                type="analytics"
              />
            ) : (
              <ResponsiveContainer>
                <BarChart data={subj} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="subjectName" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          {scope !== 'student' && (
            <Card title={scope === 'school' ? 'Class ranking' : 'Top students'} extra={<Tag color="blue">{ranked.length}</Tag>}>
              {ranked.length === 0 ? (
                <EmptyState
                  title={scope === 'school' ? 'No ranked classes yet' : 'No ranked students yet'}
                  description={scope === 'school'
                    ? 'Class ranking populates as test attempts come in.'
                    : 'Student leaderboard fills in once attempts are scored.'}
                  type="analytics"
                />
              ) : (
                <List
                  size="small"
                  dataSource={ranked.slice(0, 8)}
                  renderItem={(r, i) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (scope === 'school' && r.classId && onDrillClass) onDrillClass(r.classId);
                        if (scope === 'class' && r.studentId && onDrillStudent) onDrillStudent(r.studentId);
                      }}
                    >
                      <span style={{ width: 28, color: i < 3 ? '#f59e0b' : '#6b7280', fontWeight: 600 }}>#{i + 1}</span>
                      <span style={{ flex: 1 }}>{r.name}</span>
                      <Progress percent={r.avg} size="small" style={{ width: 100 }} />
                      <Tag style={{ marginLeft: 8 }}>{r.avg}%</Tag>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          )}
          {scope === 'student' && (
            <Card title="At-a-glance" bodyStyle={{ minHeight: 280 }}>
              <Title level={5} style={{ marginTop: 0 }}>Recent tests</Title>
              <List
                size="small"
                dataSource={attempts.slice(-5).reverse()}
                locale={{ emptyText: 'No tests in period' }}
                renderItem={(a) => (
                  <List.Item>
                    <div style={{ flex: 1 }}>
                      <Text>{a.tests?.title || 'Test'}</Text>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{dayjs(a.completed_at).format('DD MMM')}</Text></div>
                    </div>
                    <Tag color={a.percent >= 60 ? 'green' : a.percent >= 40 ? 'orange' : 'red'}>{a.percent}%</Tag>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
