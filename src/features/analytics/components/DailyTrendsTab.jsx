import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Row, Col, Statistic, Segmented, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { getAttendanceRows, dailyAttendanceTrend } from '../services/analyticsService';
import { downloadCsv } from '../utils/exportUtils';
import dayjs from 'dayjs';

export default function DailyTrendsTab({ scope, schoolCode, classId, studentId, dateRange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grain, setGrain] = useState('day');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = dateRange || [];
        const data = await getAttendanceRows({
          schoolCode: scope === 'school' ? schoolCode : undefined,
          classInstanceId: scope === 'class' ? classId : undefined,
          studentId: scope === 'student' ? studentId : undefined,
          startDate: s,
          endDate: e,
        });
        if (!cancelled) setRows(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, studentId, dateRange]);

  const daily = useMemo(() => dailyAttendanceTrend(rows, dateRange?.[0], dateRange?.[1]), [rows, dateRange]);

  const aggregated = useMemo(() => {
    if (grain === 'day') return daily;
    const map = new Map();
    daily.forEach((d) => {
      const k = grain === 'week' ? dayjs(d.date).startOf('week').format('YYYY-MM-DD') : dayjs(d.date).format('YYYY-MM');
      const m = map.get(k) || { date: k, present: 0, absent: 0, late: 0, total: 0 };
      m.present += d.present; m.absent += d.absent; m.late += d.late; m.total += d.total;
      map.set(k, m);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({
      ...m, rate: m.total ? Math.round((m.present / m.total) * 1000) / 10 : 0,
    }));
  }, [daily, grain]);

  const stats = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.status === 'present').length;
    const rate = total ? Math.round((present / total) * 100) : 0;
    const best = daily.reduce((b, d) => (b == null || d.rate > b.rate ? d : b), null);
    const worst = daily.filter((d) => d.total > 0).reduce((w, d) => (w == null || d.rate < w.rate ? d : w), null);
    return { rate, total, best, worst, days: daily.filter((d) => d.total > 0).length };
  }, [rows, daily]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={6}><Card><Statistic title="Avg attendance" value={stats.rate} suffix="%" valueStyle={{ color: stats.rate >= 80 ? '#10b981' : '#f59e0b' }} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Records" value={stats.total} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Best day" value={stats.best ? `${stats.best.rate}%` : '—'} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Worst day" value={stats.worst ? `${stats.worst.rate}%` : '—'} /></Card></Col>
      </Row>

      <Card title="Daily attendance trend" extra={
        <span>
          <Segmented
            value={grain}
            onChange={setGrain}
            options={[{ label: 'Day', value: 'day' }, { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }]}
            style={{ marginRight: 8 }}
          />
          <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadCsv('daily_attendance', aggregated, [
            { dataIndex: 'date', title: 'Date' },
            { dataIndex: 'present', title: 'Present' },
            { dataIndex: 'absent', title: 'Absent' },
            { dataIndex: 'late', title: 'Late' },
            { dataIndex: 'total', title: 'Total' },
            { dataIndex: 'rate', title: 'Rate %' },
          ])}>CSV</Button>
        </span>
      }>
        {aggregated.length === 0 ? <Empty description="No attendance in this period" /> : (
          <div style={{ height: 400 }}>
            <ResponsiveContainer>
              <ComposedChart data={aggregated}>
                <defs>
                  <linearGradient id="att" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => grain === 'month' ? dayjs(v + '-01').format('MMM YY') : dayjs(v).format('DD/MM')} />
                <YAxis yAxisId="rate" domain={[0, 100]} orientation="right" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="cnt" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="cnt" dataKey="present" stackId="a" fill="#10b981" name="Present" />
                <Bar yAxisId="cnt" dataKey="late" stackId="a" fill="#f59e0b" name="Late" />
                <Bar yAxisId="cnt" dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
                <Area yAxisId="rate" type="monotone" dataKey="rate" stroke="#3b82f6" fill="url(#att)" name="Rate %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
