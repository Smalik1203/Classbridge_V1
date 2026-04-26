import React, { useEffect, useState } from 'react';
import { Drawer, Select, Card, Row, Col, Statistic, Empty, Spin, Typography, Space } from 'antd';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import dayjs from 'dayjs';
import {
  listClasses, listStudents, getClassTestAttempts, getStudentTestAttempts, trendByDay,
} from '../services/analyticsService';

const { Text, Title } = Typography;

export default function ComparisonDrawer({ open, onClose, scope, schoolCode, dateRange, subjectId, classId }) {
  const [opts, setOpts] = useState([]); // class options or student options
  const [aId, setAId] = useState(null);
  const [bId, setBId] = useState(null);
  const [aData, setAData] = useState(null);
  const [bData, setBData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (scope === 'class' || scope === 'school') {
        const cls = await listClasses(schoolCode);
        setOpts(cls.map((c) => ({ value: c.id, label: c.label })));
      } else if (scope === 'student' && classId) {
        const st = await listStudents(schoolCode, classId);
        setOpts(st.map((s) => ({ value: s.id, label: `${s.full_name}${s.student_code ? ` (${s.student_code})` : ''}` })));
      }
    })();
  }, [open, scope, schoolCode, classId]);

  async function fetchOne(id) {
    const [s, e] = dateRange || [];
    if (scope === 'student') {
      const a = await getStudentTestAttempts(id, { startDate: s, endDate: e, subjectId });
      return { id, attempts: a };
    } else {
      const a = await getClassTestAttempts(id, { startDate: s, endDate: e, subjectId });
      return { id, attempts: a };
    }
  }

  useEffect(() => {
    if (!aId || !bId) return;
    setLoading(true);
    Promise.all([fetchOne(aId), fetchOne(bId)])
      .then(([a, b]) => { setAData(a); setBData(b); })
      .finally(() => setLoading(false));
  }, [aId, bId, dateRange, subjectId, scope]);

  const overlayData = (() => {
    if (!aData || !bData) return [];
    const aDay = trendByDay(aData.attempts);
    const bDay = trendByDay(bData.attempts);
    const days = new Set([...aDay.map((x) => x.date), ...bDay.map((x) => x.date)]);
    const aMap = new Map(aDay.map((x) => [x.date, x.avg]));
    const bMap = new Map(bDay.map((x) => [x.date, x.avg]));
    return Array.from(days).sort().map((d) => ({ date: d, A: aMap.get(d) ?? null, B: bMap.get(d) ?? null }));
  })();

  const aSummary = aData ? {
    count: aData.attempts.length,
    avg: aData.attempts.length ? Math.round((aData.attempts.reduce((s, x) => s + x.percent, 0) / aData.attempts.length) * 10) / 10 : 0,
  } : null;
  const bSummary = bData ? {
    count: bData.attempts.length,
    avg: bData.attempts.length ? Math.round((bData.attempts.reduce((s, x) => s + x.percent, 0) / bData.attempts.length) * 10) / 10 : 0,
  } : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Compare ${scope === 'student' ? 'students' : 'classes'}`}
      placement="right"
      width={700}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select style={{ width: 280 }} placeholder="A" options={opts} value={aId} onChange={setAId} showSearch optionFilterProp="label" />
        <Text type="secondary">vs</Text>
        <Select style={{ width: 280 }} placeholder="B" options={opts} value={bId} onChange={setBId} showSearch optionFilterProp="label" />
      </Space>

      {loading && <Spin />}

      {!loading && aData && bData && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Card><Statistic title={`A — ${opts.find((o) => o.value === aId)?.label}`} value={aSummary?.avg} suffix="%" /></Card>
            </Col>
            <Col span={12}>
              <Card><Statistic title={`B — ${opts.find((o) => o.value === bId)?.label}`} value={bSummary?.avg} suffix="%" /></Card>
            </Col>
          </Row>
          <Card title="Trend comparison" bodyStyle={{ height: 320 }}>
            {overlayData.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <LineChart data={overlayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => dayjs(v).format('DD/MM')} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="A" stroke="#3b82f6" dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="B" stroke="#10b981" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}
    </Drawer>
  );
}
