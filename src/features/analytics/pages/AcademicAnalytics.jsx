import React, { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Select, Space, Table, Tag, Empty, Spin, Segmented, Typography,
  Progress,
} from 'antd';
import dayjs from 'dayjs';
import {
  TrophyOutlined, RiseOutlined, FallOutlined, MinusOutlined,
  BookOutlined, FireOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { supabase } from '@/config/supabaseClient';
import { useAcademicYear } from '../context/AcademicYearContext';
import { listClasses, listStudents } from '../services/analyticsService';
import academicSvc from '../services/academicAnalyticsService';
import {
  HeroStat, RingStat, Sparkbar, StatTile, SectionCard, DailyBars,
} from '../components/primitives';

const { Text } = Typography;

const STATUS_COLOR = {
  distinction: '#10b981',
  first: '#3b82f6',
  second: '#f59e0b',
  pass: '#a855f7',
  fail: '#ef4444',
};

export default function AcademicAnalytics() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { selectedAyId, selectedYear, formatYearLabel } = useAcademicYear();

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [scope, setScope] = useState('school');
  const [classInstanceId, setClassInstanceId] = useState('all');
  const [studentId, setStudentId] = useState(null);
  const [subjectId, setSubjectId] = useState('all');
  const [granularity, setGranularity] = useState('day');
  const [showTrendLine, setShowTrendLine] = useState(true);

  const [kpis, setKpis] = useState(null);
  const [daily, setDaily] = useState([]);
  const [perClass, setPerClass] = useState([]);
  const [perSubject, setPerSubject] = useState([]);
  const [statusMix, setStatusMix] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ top: [], bottom: [] });
  const [recentTests, setRecentTests] = useState([]);
  const [matrix, setMatrix] = useState({ rows: [], subjects: [] });
  const [loading, setLoading] = useState(false);

  // Class list for the AY.
  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    let cancelled = false;
    listClasses(schoolCode, selectedAyId).then((rows) => {
      if (cancelled) return;
      setClasses(rows);
      setClassInstanceId('all');
      setStudentId(null);
    }).catch(() => { if (!cancelled) setClasses([]); });
    return () => { cancelled = true; };
  }, [schoolCode, selectedAyId]);

  // Student list — only when a specific class is picked.
  useEffect(() => {
    if (!schoolCode || classInstanceId === 'all') { setStudents([]); setStudentId(null); return; }
    listStudents(schoolCode, classInstanceId).then(setStudents).catch(() => setStudents([]));
  }, [schoolCode, classInstanceId]);

  // Subjects (school-wide).
  useEffect(() => {
    if (!schoolCode) { setSubjects([]); return; }
    let cancelled = false;
    supabase
      .from('subjects')
      .select('id, subject_name')
      .eq('school_code', schoolCode)
      .order('subject_name')
      .then(({ data }) => {
        if (cancelled) return;
        setSubjects((data || []).map((r) => ({ id: r.id, name: r.subject_name || 'Unknown' })));
      });
    return () => { cancelled = true; };
  }, [schoolCode]);

  // Scope housekeeping.
  useEffect(() => {
    if (scope === 'school') {
      setClassInstanceId('all');
      setStudentId(null);
    } else if (scope === 'class' || scope === 'student') {
      if (classInstanceId === 'all' && classes.length > 0) {
        setClassInstanceId(classes[0].id);
      }
    }
    if (scope !== 'student') setStudentId(null);
  }, [scope, classes]); // eslint-disable-line react-hooks/exhaustive-deps

  const queryParams = useMemo(() => ({
    schoolCode,
    ayId: selectedAyId,
    classInstanceId: scope === 'school' ? null : classInstanceId,
    studentId: scope === 'student' ? studentId : null,
    subjectId: subjectId === 'all' ? null : subjectId,
  }), [schoolCode, selectedAyId, scope, classInstanceId, studentId, subjectId]);

  // Calendar window for trend.
  const trendWindow = useMemo(() => {
    const today = dayjs();
    const ayEnd = selectedYear?.end_date ? dayjs(selectedYear.end_date) : null;
    const anchor = ayEnd && today.isAfter(ayEnd) ? ayEnd : today;
    if (granularity === 'day')   return { start: anchor.subtract(29, 'day').format('YYYY-MM-DD'),  end: anchor.format('YYYY-MM-DD'), anchor };
    if (granularity === 'week')  return { start: anchor.subtract(3, 'week').startOf('week').format('YYYY-MM-DD'), end: anchor.endOf('week').format('YYYY-MM-DD'), anchor };
    return { start: anchor.subtract(11, 'month').startOf('month').format('YYYY-MM-DD'), end: anchor.endOf('month').format('YYYY-MM-DD'), anchor };
  }, [granularity, selectedYear]);

  // Master fetch.
  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    if (scope === 'class' && (classInstanceId === 'all' || !classInstanceId)) return;
    if (scope === 'student' && !studentId) {
      setKpis(null); setDaily([]); setPerSubject([]); setStatusMix([]); setRecentTests([]);
      return;
    }
    setLoading(true);
    Promise.all([
      academicSvc.getHeadlineKpis(queryParams),
      academicSvc.getDailyTrend({
        ...queryParams,
        startDate: trendWindow.start,
        endDate: trendWindow.end,
      }),
      scope === 'school'
        ? academicSvc.getPerClassSummary(queryParams)
        : Promise.resolve([]),
      academicSvc.getPerSubjectSummary(queryParams),
      academicSvc.getStatusMix(queryParams),
      scope !== 'student'
        ? academicSvc.getStudentLeaderboard({ ...queryParams, limit: 8 })
        : Promise.resolve({ top: [], bottom: [] }),
      scope === 'student'
        ? academicSvc.getRecentTestsForStudent({ ...queryParams, limit: 12 })
        : Promise.resolve([]),
      scope === 'class'
        ? academicSvc.getStudentSubjectMatrix(queryParams)
        : Promise.resolve({ rows: [], subjects: [] }),
    ]).then(([k, d, pc, ps, sm, lb, rt, mat]) => {
      setKpis(k); setDaily(d); setPerClass(pc); setPerSubject(ps);
      setStatusMix(sm); setLeaderboard(lb); setRecentTests(rt); setMatrix(mat);
    }).catch((e) => console.error('academic analytics load error', e))
      .finally(() => setLoading(false));
  }, [queryParams, scope, classInstanceId, studentId, schoolCode, selectedAyId, trendWindow]);

  if (!selectedAyId) {
    return <SectionCard><Empty description="No academic year selected." /></SectionCard>;
  }

  const ayLabel = selectedYear ? formatYearLabel(selectedYear) : '';
  const noClassPicked = scope !== 'school' && classInstanceId === 'all';
  const noStudentPicked = scope === 'student' && !studentId;
  const noClassesInAy = scope !== 'school' && classes.length === 0;
  const selectedClass = classes.find((c) => c.id === classInstanceId);
  const selectedStudent = students.find((s) => s.id === studentId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const scopeLabel =
    scope === 'student' ? (selectedStudent?.full_name || 'Student') :
    scope === 'class'   ? (selectedClass?.label || 'Class') :
                          'School-wide';
  const last7 = daily.slice(-7);

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>

        <FilterBar
          scope={scope} setScope={setScope}
          classes={classes} classInstanceId={classInstanceId} setClassInstanceId={setClassInstanceId}
          students={students} studentId={studentId} setStudentId={setStudentId}
          subjects={subjects} subjectId={subjectId} setSubjectId={setSubjectId}
          ayLabel={ayLabel}
        />

        {noClassesInAy && (
          <SectionCard>
            <Empty description={
              <Space direction="vertical" size={4} align="center">
                <span>No class instances exist for AY <b>{ayLabel}</b>.</span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                  Switch the AY at the top of the page, or create class instances for this year first.
                </span>
              </Space>
            } />
          </SectionCard>
        )}

        {!noClassesInAy && noClassPicked && (
          <SectionCard><Empty description={`Pick a class to see ${scope === 'student' ? 'a student' : 'class'} performance.`} /></SectionCard>
        )}
        {!noClassesInAy && !noClassPicked && noStudentPicked && (
          <SectionCard><Empty description="Pick a student to see their academic progress." /></SectionCard>
        )}

        {!noClassesInAy && !noClassPicked && !noStudentPicked && (
        <>
        {/* HERO ROW */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <HeroStat
              gradient={
                kpis?.avgPct >= 75 ? 'emerald' :
                kpis?.avgPct >= 50 ? 'brand' : 'rose'
              }
              eyebrow={`${scopeLabel}${selectedSubject ? ` · ${selectedSubject.name}` : ''} · AY ${ayLabel}`}
              value={kpis ? Number(kpis.avgPct).toFixed(1) : '—'}
              suffix="%"
              label={
                kpis
                  ? scope === 'student'
                    ? `Across ${kpis.totalAttempts} test${kpis.totalAttempts === 1 ? '' : 's'} · ${kpis.distinctSubjects} subject${kpis.distinctSubjects === 1 ? '' : 's'}`
                    : `${fmtNum(kpis.totalAttempts)} attempts · ${fmtNum(kpis.studentsAssessed)} students · ${fmtNum(kpis.totalTests)} tests`
                  : 'No assessments yet'
              }
              delta={
                kpis?.improvementRate !== 0 && kpis?.improvementRate != null
                  ? {
                    value: `${kpis.improvementRate > 0 ? '+' : ''}${kpis.improvementRate}% vs last month`,
                    positive: kpis.improvementRate > 0,
                  }
                  : null
              }
              height={200}
              foot={
                last7.length > 0 ? (
                  <Sparkbar
                    values={last7.map((d) => ({
                      label: dayjs(d.date).format('dd')[0],
                      value: d.noData ? 0 : (d.avg ?? 0),
                      noData: d.noData,
                    }))}
                    max={100}
                    height={36}
                    accent="#fff"
                    dim="rgba(255,255,255,0.18)"
                  />
                ) : null
              }
            />
          </Col>
          <Col xs={24} lg={14}>
            <Row gutter={[12, 12]}>
              {scope === 'student' ? (
                <>
                  <Col xs={12}>
                    <StatTile
                      label="Tests taken"
                      value={fmtNum(kpis?.totalAttempts ?? 0)}
                      accent="#6366F1"
                      icon={<BookOutlined />}
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Best score"
                      value={`${kpis?.highest != null ? Math.round(kpis.highest) : 0}%`}
                      accent="#10b981"
                      icon={<TrophyOutlined />}
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Lowest"
                      value={`${kpis?.lowest != null ? Math.round(kpis.lowest) : 0}%`}
                      accent="#ef4444"
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="This month"
                      value={fmtNum(kpis?.testsThisMonth ?? 0)}
                      accent="#f59e0b"
                      icon={<FireOutlined />}
                    />
                  </Col>
                </>
              ) : (
                <>
                  <Col xs={12}>
                    <StatTile
                      label="Tests"
                      value={fmtNum(kpis?.totalTests ?? 0)}
                      accent="#6366F1"
                      icon={<BookOutlined />}
                      foot={<Foot>{kpis?.totalAttempts ?? 0} attempts</Foot>}
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Pass rate"
                      value={`${kpis?.passPct != null ? Number(kpis.passPct).toFixed(1) : '—'}%`}
                      accent="#10b981"
                      foot={<Foot>≥33%</Foot>}
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Distinction rate"
                      value={`${kpis?.distinctionPct != null ? Number(kpis.distinctionPct).toFixed(1) : '—'}%`}
                      accent="#0ea5e9"
                      icon={<TrophyOutlined />}
                      foot={<Foot>≥75%</Foot>}
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Students assessed"
                      value={fmtNum(kpis?.studentsAssessed ?? 0)}
                      accent="#a855f7"
                      icon={<ExperimentOutlined />}
                      foot={<Foot>{kpis?.distinctSubjects ?? 0} subjects</Foot>}
                    />
                  </Col>
                </>
              )}
            </Row>
          </Col>
        </Row>

        {/* IMPROVEMENT BANNER (student scope only — mirrors mobile) */}
        {scope === 'student' && kpis?.improvementRate !== 0 && kpis?.improvementRate != null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            background: kpis.improvementRate > 0 ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${kpis.improvementRate > 0 ? '#a7f3d0' : '#fecaca'}`,
          }}>
            {kpis.improvementRate > 0
              ? <RiseOutlined style={{ color: '#059669', fontSize: 16 }} />
              : <FallOutlined style={{ color: '#dc2626', fontSize: 16 }} />}
            <Text style={{
              fontSize: 13, fontWeight: 600,
              color: kpis.improvementRate > 0 ? '#059669' : '#dc2626',
            }}>
              {Math.abs(kpis.improvementRate)}% {kpis.improvementRate > 0 ? 'improvement' : 'decline'} from last month
            </Text>
          </div>
        )}

        {/* DAILY SCORE TREND */}
        {(() => {
          const withData = daily.filter((d) => !d.noData && d.avg != null);
          const avg = withData.length > 0
            ? Math.round((withData.reduce((a, b) => a + b.avg, 0) / withData.length) * 10) / 10
            : null;
          const windowLabel =
            granularity === 'day'   ? 'Last 30 days' :
            granularity === 'week'  ? 'Last 4 weeks' :
                                      'Last 12 months';
          const hint = [
            scopeLabel,
            windowLabel,
            avg != null ? `avg ${avg}%` : 'no scores in window',
          ].join(' · ');
          return (
            <SectionCard
              title="Score over time"
              hint={hint}
              accent="#6366F1"
              extra={
                <Space size={8}>
                  <Segmented
                    size="small"
                    value={showTrendLine ? 'on' : 'off'}
                    onChange={(v) => setShowTrendLine(v === 'on')}
                    options={[
                      { label: 'Trend line', value: 'on' },
                      { label: 'Bars only', value: 'off' },
                    ]}
                  />
                  <Segmented
                    size="small"
                    value={granularity}
                    onChange={setGranularity}
                    options={[
                      { label: 'Day', value: 'day' },
                      { label: 'Week', value: 'week' },
                      { label: 'Month', value: 'month' },
                    ]}
                  />
                </Space>
              }
            >
              {daily.length === 0 ? <Empty /> : (
                <DailyBars
                  data={daily.map((d) => ({ ...d, rate: d.avg }))}
                  dateKey="date"
                  valueKey="rate"
                  valueFormat={(v) => v == null ? '—' : `${v}%`}
                  domain={[0, 100]}
                  height={260}
                  groupBy={granularity}
                  windowDays={30}
                  windowWeeks={4}
                  windowMonths={12}
                  windowAnchor={trendWindow.anchor.format('YYYY-MM-DD')}
                  showTrendLine={showTrendLine}
                  trendColor="#06b6d4"
                  detailRender={(d) => d.noData
                    ? 'No tests this day'
                    : `${d.attempts} attempt${d.attempts === 1 ? '' : 's'} · avg ${d.avg}%`}
                />
              )}
            </SectionCard>
          );
        })()}

        {/* STATUS MIX + PER-CLASS or PER-SUBJECT */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={9}>
            <SectionCard title="Grade band mix" hint="Distribution of attempts" accent="#a855f7">
              {statusMix.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                  {(() => {
                    const distinction = statusMix.find((s) => s.key === 'distinction');
                    const overall = distinction?.percent ?? 0;
                    return (
                      <RingStat
                        value={overall}
                        label="Distinction"
                        subLabel={`${fmtNum(distinction?.value ?? 0)} of ${fmtNum(statusMix.reduce((a, b) => a + b.value, 0))}`}
                        tone={overall >= 30 ? 'success' : overall >= 15 ? 'brand' : 'critical'}
                        size={140} stroke={12}
                      />
                    );
                  })()}
                  <div style={{ width: '100%' }}>
                    {statusMix.map((s) => (
                      <ProgressRow
                        key={s.key}
                        label={s.label}
                        pct={s.percent}
                        color={STATUS_COLOR[s.key] || s.color}
                        detail={`${fmtNum(s.value)} attempts`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </Col>

          <Col xs={24} md={15}>
            {scope === 'school' ? (
              <SectionCard
                title="Per-class average"
                hint={`${perClass.length} classes · sorted by average`}
                accent="#10b981"
              >
                {perClass.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={Math.max(260, perClass.length * 28)}>
                    <BarChart
                      data={perClass}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#eef2ff" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                             tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={94}
                             tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                        formatter={(v, _n, p) => [`${v}%`, `${p.payload.attempts} attempts · ${p.payload.students} students`]}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                      />
                      <Bar dataKey="avgPct" radius={[0, 8, 8, 0]} barSize={16}>
                        {perClass.map((c, i) => (
                          <Cell key={i} fill={pctColor(c.avgPct)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            ) : (
              <SectionCard
                title="Per-subject average"
                hint={`${perSubject.length} subject${perSubject.length === 1 ? '' : 's'} · trend across recent tests`}
                accent="#10b981"
              >
                <SubjectList rows={perSubject} />
              </SectionCard>
            )}
          </Col>
        </Row>

        {/* SCOPE-SPECIFIC ROWS */}
        {scope === 'school' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <SectionCard title="Per-subject average" hint={`${perSubject.length} subjects`} accent="#a855f7">
                <SubjectList rows={perSubject} />
              </SectionCard>
            </Col>
            <Col xs={24} md={12}>
              <SectionCard title="Top performers" hint={`Top ${leaderboard.top.length}`} accent="#10b981">
                <PerformerTable rows={leaderboard.top} positive />
              </SectionCard>
            </Col>
          </Row>
        )}

        {scope === 'class' && (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <SectionCard title="Top performers" hint={`Top ${leaderboard.top.length}`} accent="#10b981">
                <PerformerTable rows={leaderboard.top} positive />
              </SectionCard>
            </Col>
            <Col xs={24} md={12}>
              <SectionCard title="Need support" hint={`Bottom ${leaderboard.bottom.length}`} accent="#ef4444">
                <PerformerTable rows={leaderboard.bottom} positive={false} />
              </SectionCard>
            </Col>
          </Row>
        )}

        {scope === 'class' && matrix.subjects.length > 0 && (
          <SectionCard
            title="Student × subject matrix"
            hint={`${matrix.rows.length} students × ${matrix.subjects.length} subjects`}
            accent="#6366F1"
          >
            <StudentSubjectMatrix matrix={matrix} />
          </SectionCard>
        )}

        {scope === 'student' && (
          <SectionCard
            title="Recent tests"
            hint={`${recentTests.length} most recent`}
            accent="#6366F1"
          >
            <RecentTestsList rows={recentTests} />
          </SectionCard>
        )}

        </>
        )}

      </Space>
    </Spin>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Foot({ children }) {
  return <span style={{ fontSize: 10, color: '#94a3b8' }}>{children}</span>;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function pctColor(pct) {
  if (pct >= 75) return '#10b981';
  if (pct >= 50) return '#6366F1';
  if (pct >= 33) return '#f59e0b';
  return '#ef4444';
}

function trendIcon(t) {
  if (t === 'up')   return <RiseOutlined style={{ color: '#059669' }} />;
  if (t === 'down') return <FallOutlined style={{ color: '#dc2626' }} />;
  return <MinusOutlined style={{ color: '#94a3b8' }} />;
}

function ProgressRow({ label, pct, color, detail }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0f172a', fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
          {label}
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {detail && <span style={{ color: '#94a3b8' }}>{detail} · </span>}
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

function SubjectList({ rows }) {
  if (!rows || rows.length === 0) return <Empty description="No subject data yet." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((s) => {
        const c = pctColor(s.avgPct);
        return (
          <div key={s.subjectId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c, display: 'inline-block' }} />
                {s.subjectName}
                <span style={{ marginLeft: 4, fontSize: 12 }}>{trendIcon(s.trend)}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{s.avgPct}%</span>
            </div>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{
                height: '100%', width: `${s.avgPct}%`, background: c, borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              {s.testCount} test{s.testCount === 1 ? '' : 's'} · {s.attempts} attempt{s.attempts === 1 ? '' : 's'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerformerTable({ rows, positive }) {
  if (!rows || rows.length === 0) return <Empty description="Not enough data yet." />;
  return (
    <Table
      size="small"
      dataSource={rows}
      rowKey="studentId"
      pagination={false}
      columns={[
        {
          title: 'Student',
          dataIndex: 'name',
          render: (v, r) => (
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{v}</div>
              {r.code && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.code}</div>}
            </div>
          ),
        },
        { title: 'Class', dataIndex: 'classLabel', render: (v) => <Tag style={{ borderRadius: 999, margin: 0 }}>{v}</Tag> },
        {
          title: 'Avg',
          dataIndex: 'avgPct',
          render: (v) => (
            <span style={{
              fontWeight: 700,
              color: positive ? pctColor(v) : (v < 33 ? '#dc2626' : v < 50 ? '#d97706' : '#0f172a'),
            }}>{v}%</span>
          ),
        },
        {
          title: 'Attempts',
          dataIndex: 'attempts',
          render: (v) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>,
        },
      ]}
    />
  );
}

function RecentTestsList({ rows }) {
  if (!rows || rows.length === 0) return <Empty description="No tests completed yet." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((t) => {
        const c = pctColor(t.percentage);
        return (
          <div
            key={`${t.id}-${t.date}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px',
              background: '#fff',
              border: '1px solid #eef2ff',
              borderRadius: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                {t.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                <span>{t.subjectName}</span>
                <span>·</span>
                <span>{t.date ? dayjs(t.date).format('DD MMM YYYY') : '—'}</span>
                <Tag
                  style={{
                    borderRadius: 999, margin: 0,
                    fontSize: 10,
                    background: t.mode === 'online' ? '#eef2ff' : '#ecfdf5',
                    color: t.mode === 'online' ? '#4338ca' : '#059669',
                    border: 'none',
                  }}
                >
                  {t.mode}
                </Tag>
              </div>
            </div>
            <div style={{
              textAlign: 'right',
              padding: '6px 12px',
              borderRadius: 8,
              background: `${c}10`,
              minWidth: 84,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c, lineHeight: 1.1 }}>
                {Math.round(t.percentage)}%
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {t.marksObtained}/{t.maxMarks}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentSubjectMatrix({ matrix }) {
  const { rows, subjects } = matrix;
  const cols = [
    {
      title: 'Student',
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{v}</div>
          {r.code && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.code}</div>}
        </div>
      ),
    },
    ...subjects.map((s) => ({
      title: s.name,
      dataIndex: s.id,
      width: 90,
      render: (v) => v == null ? <span style={{ color: '#cbd5e1' }}>—</span> : (
        <span style={{ fontWeight: 600, color: pctColor(v) }}>{v}%</span>
      ),
    })),
    {
      title: 'Overall',
      dataIndex: 'overall',
      fixed: 'right',
      width: 100,
      render: (v) => v == null ? <span style={{ color: '#cbd5e1' }}>—</span> : (
        <Progress percent={Math.round(v)} size="small" strokeColor={pctColor(v)} format={(p) => `${p}%`} />
      ),
    },
  ];
  return (
    <Table
      size="small"
      dataSource={rows}
      columns={cols}
      rowKey="studentId"
      scroll={{ x: 'max-content' }}
      pagination={{ pageSize: 10, simple: true }}
    />
  );
}

function FilterBar({
  scope, setScope, classes, classInstanceId, setClassInstanceId,
  students, studentId, setStudentId, subjects, subjectId, setSubjectId,
  ayLabel,
}) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #eef2ff', borderRadius: 14,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <FilterField label="View">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { label: 'School', value: 'school' },
              { label: 'Class', value: 'class' },
              { label: 'Student', value: 'student' },
            ]}
          />
        </FilterField>

        {scope !== 'school' && (
          <FilterField label="Class">
            <Select
              style={{ minWidth: 200 }}
              placeholder="Pick a class"
              value={classInstanceId === 'all' ? null : classInstanceId}
              onChange={(v) => setClassInstanceId(v || 'all')}
              allowClear
              options={classes.map((c) => ({ value: c.id, label: c.label }))}
            />
          </FilterField>
        )}

        {scope === 'student' && (
          <FilterField label="Student">
            <Select
              style={{ minWidth: 220 }}
              placeholder="Pick a student"
              value={studentId}
              onChange={(v) => setStudentId(v)}
              allowClear
              showSearch
              optionFilterProp="label"
              options={students.map((s) => ({
                value: s.id,
                label: `${s.full_name}${s.student_code ? ` · ${s.student_code}` : ''}`,
              }))}
            />
          </FilterField>
        )}

        <FilterField label="Subject">
          <Select
            style={{ minWidth: 180 }}
            placeholder="All subjects"
            value={subjectId === 'all' ? null : subjectId}
            onChange={(v) => setSubjectId(v || 'all')}
            allowClear
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
        </FilterField>

        <div style={{ marginLeft: 'auto' }}>
          <Tag style={{ borderRadius: 999, margin: 0, fontWeight: 500 }}>
            {classes.length} {classes.length === 1 ? 'class' : 'classes'} · {ayLabel}
          </Tag>
        </div>
      </div>

      <Text type="secondary" style={{ fontSize: 11 }}>
        Scores merge offline test_marks + online test_attempts, deduped per student/test. Daily trend is calendar-windowed and may cross AY boundaries.
      </Text>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
        textTransform: 'uppercase', color: '#94a3b8',
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}
