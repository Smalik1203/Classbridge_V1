import React, { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Spin, Row, Col, Table, Tag, Segmented, Progress, Button, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  getClassTestAttempts, getSchoolTestAttempts, listStudents, listClasses,
  studentSubjectMatrix, trendByDay,
} from '../services/analyticsService';
import { downloadCsv } from '../utils/exportUtils';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function ComparisonsTab({ scope, schoolCode, classId, dateRange, subjectId, onDrillStudent, onDrillClass }) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [view, setView] = useState(scope === 'class' ? 'matrix' : 'classes');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = dateRange || [];
        if (scope === 'class' && classId) {
          const [a, st] = await Promise.all([
            getClassTestAttempts(classId, { startDate: s, endDate: e, subjectId }),
            listStudents(schoolCode, classId),
          ]);
          if (!cancelled) { setAttempts(a); setStudents(st); }
        } else if (scope === 'school') {
          const [a, cls] = await Promise.all([
            getSchoolTestAttempts(schoolCode, { startDate: s, endDate: e, subjectId }),
            listClasses(schoolCode),
          ]);
          if (!cancelled) { setAttempts(a); setClasses(cls); }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scope, schoolCode, classId, dateRange, subjectId]);

  const matrix = useMemo(() => {
    if (scope !== 'class') return null;
    return studentSubjectMatrix(attempts, students);
  }, [scope, attempts, students]);

  const classRanking = useMemo(() => {
    if (scope !== 'school') return [];
    const m = new Map();
    attempts.forEach((a) => {
      const cId = a.tests?.class_instance_id;
      if (!cId) return;
      const r = m.get(cId) || { classId: cId, sum: 0, count: 0 };
      r.sum += a.percent || 0; r.count += 1;
      m.set(cId, r);
    });
    const cMap = new Map(classes.map((c) => [c.id, c]));
    return Array.from(m.values()).map((r) => ({
      classId: r.classId,
      name: cMap.get(r.classId)?.label || 'Unknown',
      avg: r.count ? Math.round((r.sum / r.count) * 10) / 10 : 0,
      count: r.count,
    })).sort((a, b) => b.avg - a.avg);
  }, [scope, attempts, classes]);

  const classTrendByDay = useMemo(() => {
    if (scope !== 'school') return null;
    const cMap = new Map(classes.map((c) => [c.id, c.label]));
    const map = new Map();
    attempts.forEach((a) => {
      if (!a.completed_at || !a.tests?.class_instance_id) return;
      const d = dayjs(a.completed_at).format('YYYY-MM-DD');
      const cName = cMap.get(a.tests.class_instance_id) || 'Unknown';
      const k = `${d}|${cName}`;
      if (!map.has(k)) map.set(k, { day: d, cls: cName, sum: 0, count: 0 });
      const m = map.get(k);
      m.sum += a.percent || 0; m.count += 1;
    });
    const days = new Set(); const clsNames = new Set();
    map.forEach((v) => { days.add(v.day); clsNames.add(v.cls); });
    const sortedDays = Array.from(days).sort();
    return {
      rows: sortedDays.map((d) => {
        const r = { date: d };
        clsNames.forEach((cn) => {
          const m = map.get(`${d}|${cn}`);
          r[cn] = m ? Math.round((m.sum / m.count) * 10) / 10 : null;
        });
        return r;
      }),
      classNames: Array.from(clsNames),
    };
  }, [scope, attempts, classes]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;

  return (
    <>
      <Segmented
        value={view}
        onChange={setView}
        style={{ marginBottom: 12 }}
        options={
          scope === 'school'
            ? [
                { label: 'Class ranking', value: 'classes' },
                { label: 'Class trend lines', value: 'trend' },
              ]
            : [
                { label: 'Student × Subject matrix', value: 'matrix' },
                { label: 'Top performers', value: 'top' },
              ]
        }
      />

      {scope === 'school' && view === 'classes' && (
        <Card>
          {classRanking.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={classRanking} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="avg" fill="#3b82f6" onClick={(e) => onDrillClass?.(e.classId)} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <Button
            icon={<DownloadOutlined />}
            style={{ marginTop: 8 }}
            onClick={() => downloadCsv('class_comparison', classRanking, [
              { dataIndex: 'name', title: 'Class' },
              { dataIndex: 'avg', title: 'Avg %' },
              { dataIndex: 'count', title: 'Attempts' },
            ])}
          >Export CSV</Button>
        </Card>
      )}

      {scope === 'school' && view === 'trend' && classTrendByDay && (
        <Card>
          {classTrendByDay.rows.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={classTrendByDay.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(v) => dayjs(v).format('DD/MM')} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {classTrendByDay.classNames.map((cn, i) => (
                  <Line
                    key={cn}
                    type="monotone"
                    dataKey={cn}
                    stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#84cc16'][i % 7]}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {scope === 'class' && view === 'matrix' && matrix && (
        <Card title="Student × Subject matrix" extra={
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv('class_matrix', matrix.rows, [
            { dataIndex: 'name', title: 'Student' },
            { dataIndex: 'code', title: 'Code' },
            ...matrix.subjects.map((s) => ({ dataIndex: s.id, title: s.name })),
            { dataIndex: 'overall', title: 'Overall' },
          ])}>Export CSV</Button>
        }>
          <Table
            size="small"
            rowKey="studentId"
            dataSource={matrix.rows}
            pagination={{ pageSize: 25 }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Student', dataIndex: 'name', fixed: 'left', width: 180, render: (n, r) => (
                <a onClick={() => onDrillStudent?.(r.studentId)}>{n}</a>
              ) },
              { title: 'Code', dataIndex: 'code', width: 100 },
              ...matrix.subjects.map((s) => ({
                title: s.name,
                dataIndex: s.id,
                width: 110,
                render: (v) => v == null ? <Text type="secondary">—</Text> : (
                  <Tag color={v >= 70 ? 'green' : v >= 40 ? 'orange' : 'red'}>{v}%</Tag>
                ),
                sorter: (a, b) => (a[s.id] ?? -1) - (b[s.id] ?? -1),
              })),
              {
                title: 'Overall',
                dataIndex: 'overall',
                width: 140,
                fixed: 'right',
                render: (v) => v == null ? <Text type="secondary">—</Text> : <Progress percent={v} size="small" />,
                sorter: (a, b) => (a.overall ?? -1) - (b.overall ?? -1),
                defaultSortOrder: 'descend',
              },
            ]}
          />
        </Card>
      )}

      {scope === 'class' && view === 'top' && matrix && (
        <Card title="Top 10 students (Radar)">
          {matrix.rows.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={matrix.subjects.map((s) => {
                const r = { subject: s.name };
                matrix.rows.slice(0, 5).forEach((row) => {
                  r[row.name] = row[s.id] ?? 0;
                });
                return r;
              })}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {matrix.rows.slice(0, 5).map((row, i) => (
                  <Radar key={row.studentId} name={row.name} dataKey={row.name}
                    stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'][i]}
                    fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'][i]}
                    fillOpacity={0.15} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}
    </>
  );
}
