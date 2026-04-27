import React, { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Select, DatePicker, Space, Table, Tag, Empty, Spin,
  Segmented, Typography,
} from 'antd';
import dayjs from 'dayjs';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { useAcademicYear } from '../context/AcademicYearContext';
import { listClasses } from '../services/analyticsService';
import tasksSvc from '../services/tasksAnalyticsService';
import {
  HeroStat, Sparkbar, StatTile, SectionCard, DailyBars,
} from '../components/primitives';
import AyComparePanel from '../components/AyComparePanel';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function TasksAnalytics() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { selectedAyId, selectedYear, compareAyId, compareYear, formatYearLabel } = useAcademicYear();

  const [classes, setClasses]               = useState([]);
  const [classInstanceId, setClassInstanceId] = useState('all');
  const [scope, setScope]                   = useState('school');
  const [dateRange, setDateRange]           = useState([null, null]);
  const [granularity, setGranularity]       = useState('day');
  const [showTrendLine, setShowTrendLine]   = useState(true);

  const [kpis, setKpis]                   = useState(null);
  const [daily, setDaily]                 = useState([]);
  const [perClass, setPerClass]           = useState([]);
  const [perSubject, setPerSubject]       = useState([]);
  const [dists, setDists]                 = useState([]);
  const [nonSubmitters, setNonSubmitters] = useState([]);
  const [compareKpis, setCompareKpis]     = useState(null);

  const [loading, setLoading] = useState(false);

  // Class list — re-fetched on AY change
  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    let cancelled = false;
    listClasses(schoolCode, selectedAyId).then((rows) => {
      if (cancelled) return;
      setClasses(rows);
      setClassInstanceId('all');
    }).catch(() => { if (!cancelled) setClasses([]); });
    return () => { cancelled = true; };
  }, [schoolCode, selectedAyId]);

  useEffect(() => {
    if (scope === 'school') {
      setClassInstanceId('all');
    } else if (scope === 'class' && classInstanceId === 'all' && classes.length > 0) {
      setClassInstanceId(classes[0].id);
    }
  }, [scope, classes, classInstanceId]);

  const queryParams = useMemo(() => ({
    schoolCode,
    ayId: selectedAyId,
    classInstanceId: scope === 'school' ? null : classInstanceId,
  }), [schoolCode, selectedAyId, scope, classInstanceId]);

  // Calendar-anchored trend window (mirrors FeesAnalytics pattern)
  const trendWindow = useMemo(() => {
    const today = dayjs();
    const ayEnd = selectedYear?.end_date ? dayjs(selectedYear.end_date) : null;
    const anchor = ayEnd && today.isAfter(ayEnd) ? ayEnd : today;
    if (granularity === 'day')
      return { start: anchor.subtract(29, 'day').format('YYYY-MM-DD'), end: anchor.format('YYYY-MM-DD'), anchor };
    if (granularity === 'week')
      return { start: anchor.subtract(3, 'week').startOf('week').format('YYYY-MM-DD'), end: anchor.endOf('week').format('YYYY-MM-DD'), anchor };
    return { start: anchor.subtract(11, 'month').startOf('month').format('YYYY-MM-DD'), end: anchor.endOf('month').format('YYYY-MM-DD'), anchor };
  }, [granularity, selectedYear]);

  const submissionWindow = useMemo(() => {
    if (dateRange?.[0] && dateRange?.[1]) {
      return { start: dateRange[0].format('YYYY-MM-DD'), end: dateRange[1].format('YYYY-MM-DD'), anchor: dateRange[1] };
    }
    return trendWindow;
  }, [dateRange, trendWindow]);

  // Main data fetch
  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    setLoading(true);
    Promise.all([
      tasksSvc.getHeadlineKpis(queryParams),
      tasksSvc.getDailySubmissions({
        ...queryParams,
        startDate: submissionWindow.start,
        endDate: submissionWindow.end,
      }),
      scope === 'school'
        ? tasksSvc.getPerClassSummary({ schoolCode, ayId: selectedAyId })
        : Promise.resolve([]),
      tasksSvc.getPerSubjectSummary(queryParams),
      tasksSvc.getDistributions(queryParams),
      tasksSvc.getTopNonSubmitters({ ...queryParams, limit: 20 }),
    ]).then(([k, d, pc, ps, dist, ns]) => {
      setKpis(k);
      setDaily(d);
      setPerClass(pc);
      setPerSubject(ps);
      setDists(dist);
      setNonSubmitters(ns);
    }).catch((e) => console.error('[tasks analytics] load error', e))
      .finally(() => setLoading(false));
  }, [queryParams, scope, schoolCode, selectedAyId, submissionWindow]);

  // Compare-AY KPIs (school-wide only — class ids are AY-specific)
  useEffect(() => {
    if (!schoolCode || !compareAyId) { setCompareKpis(null); return; }
    let cancelled = false;
    tasksSvc.getHeadlineKpis({ schoolCode, ayId: compareAyId, classInstanceId: null })
      .then((k) => { if (!cancelled) setCompareKpis(k); })
      .catch((e) => { if (!cancelled) console.warn('[tasks] compare fetch failed', e); });
    return () => { cancelled = true; };
  }, [schoolCode, compareAyId]);

  if (!selectedAyId) {
    return <SectionCard><Empty description="No academic year selected." /></SectionCard>;
  }

  const ayLabel = selectedYear ? formatYearLabel(selectedYear) : '';
  const noClassPicked = scope === 'class' && (classInstanceId === 'all' || !classInstanceId);
  const noClassesInAy = scope === 'class' && classes.length === 0;
  const selectedClass = classes.find((c) => c.id === classInstanceId);
  const scopeLabel = scope === 'class' && selectedClass ? selectedClass.label : 'School-wide';
  const last7 = daily.slice(-7);

  const completionGradient =
    (kpis?.completionRate ?? 0) >= 75 ? 'emerald' :
    (kpis?.completionRate ?? 0) >= 40 ? 'brand' : 'rose';

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>

        <FilterBar
          scope={scope} setScope={setScope}
          classes={classes} classInstanceId={classInstanceId} setClassInstanceId={setClassInstanceId}
          dateRange={dateRange} setDateRange={setDateRange}
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
          <SectionCard>
            <Empty description="Pick a class to see its task analytics." />
          </SectionCard>
        )}

        {!noClassesInAy && !noClassPicked && (
        <>

        {/* HERO ROW */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <HeroStat
              gradient={completionGradient}
              eyebrow={`${scopeLabel} · AY ${ayLabel}`}
              value={kpis ? Number(kpis.completionRate).toFixed(1) : '—'}
              suffix="%"
              label="Completion rate"
              delta={kpis?.expectedSubmissions
                ? { value: `${fmtNum(kpis.submittedCount)} of ${fmtNum(kpis.expectedSubmissions)} expected submissions` }
                : null}
              height={200}
              foot={
                last7.length > 0 ? (
                  <Sparkbar
                    values={last7.map((d) => ({
                      label: dayjs(d.date).format('dd')[0],
                      value: d.submissionCount,
                      noData: d.noData && d.submissionCount === 0,
                    }))}
                    max={Math.max(1, ...last7.map((d) => d.submissionCount))}
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
              <Col xs={12}>
                <StatTile
                  label="On-time rate"
                  value={kpis ? `${Number(kpis.onTimeRate).toFixed(1)}%` : '—'}
                  accent="#10b981"
                  foot={<Foot>{fmtNum(kpis?.lateCount ?? 0)} late · {fmtNum(kpis?.missedCount ?? 0)} missed</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Overdue queue"
                  value={fmtNum(kpis?.overdueTaskCount ?? 0)}
                  accent="#ef4444"
                  foot={<Foot>tasks with missing submissions</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Tasks assigned"
                  value={fmtNum(kpis?.totalTasks ?? 0)}
                  accent="#6366f1"
                  foot={<Foot>{fmtNum(kpis?.distinctStudents ?? 0)} students · AY {ayLabel}</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Submissions received"
                  value={fmtNum(kpis?.submittedCount ?? 0)}
                  accent="#3b82f6"
                  foot={<Foot>of {fmtNum(kpis?.expectedSubmissions ?? 0)} expected</Foot>}
                />
              </Col>
            </Row>
          </Col>
        </Row>

        {/* COMPARE PANEL */}
        {compareYear && (
          <AyComparePanel
            primary={{ label: `AY ${formatYearLabel(selectedYear)}`, kpis }}
            compare={{ label: `AY ${formatYearLabel(compareYear)}`, kpis: compareKpis }}
            metrics={[
              { key: 'completionRate',   label: 'Completion rate', unit: '%', precision: 1, betterIs: 'higher' },
              { key: 'onTimeRate',       label: 'On-time rate',    unit: '%', precision: 1, betterIs: 'higher' },
              { key: 'totalTasks',       label: 'Tasks assigned',  betterIs: 'higher' },
              { key: 'submittedCount',   label: 'Submissions',     betterIs: 'higher' },
              { key: 'missedCount',      label: 'Missed',          betterIs: 'lower' },
              { key: 'overdueTaskCount', label: 'Overdue tasks',   betterIs: 'lower' },
            ]}
          />
        )}

        {/* SUBMISSIONS TREND */}
        {(() => {
          const withData = daily.filter((d) => d.submissionCount > 0);
          const total = withData.reduce((a, b) => a + b.submissionCount, 0);
          const windowLabel =
            granularity === 'day'  ? 'Last 30 days' :
            granularity === 'week' ? 'Last 4 weeks' : 'Last 12 months';
          const hint = [
            scope === 'school' ? 'School' : `Class · ${selectedClass?.label || ''}`,
            (dateRange?.[0] && dateRange?.[1]) ? 'Custom range' : windowLabel,
            withData.length ? `${fmtNum(total)} submission${total === 1 ? '' : 's'}` : 'no submissions in window',
          ].join(' · ');
          return (
            <SectionCard
              title="Submissions over time"
              hint={hint}
              accent="#3b82f6"
              extra={
                <Space size={8}>
                  <Segmented
                    size="small"
                    value={showTrendLine ? 'on' : 'off'}
                    onChange={(v) => setShowTrendLine(v === 'on')}
                    options={[
                      { label: 'Trend line', value: 'on' },
                      { label: 'Bars only',  value: 'off' },
                    ]}
                  />
                  <Segmented
                    size="small"
                    value={granularity}
                    onChange={setGranularity}
                    disabled={!!(dateRange?.[0] && dateRange?.[1])}
                    options={[
                      { label: 'Day',   value: 'day' },
                      { label: 'Week',  value: 'week' },
                      { label: 'Month', value: 'month' },
                    ]}
                  />
                </Space>
              }
            >
              {daily.length === 0 ? <Empty /> : (
                <DailyBars
                  data={daily.map((d) => ({ ...d, rate: d.submissionCount, noData: d.noData && d.submissionCount === 0 }))}
                  dateKey="date"
                  valueKey="rate"
                  valueFormat={(v) => `${v} submission${v === 1 ? '' : 's'}`}
                  height={260}
                  groupBy={granularity}
                  windowDays={30}
                  windowWeeks={4}
                  windowMonths={12}
                  windowAnchor={submissionWindow.anchor?.format
                    ? submissionWindow.anchor.format('YYYY-MM-DD')
                    : dayjs(submissionWindow.end).format('YYYY-MM-DD')}
                  showTrendLine={showTrendLine}
                  trendColor="#06b6d4"
                  detailRender={(d) => d.noData
                    ? 'No submissions'
                    : `${d.submissionCount} submission${d.submissionCount === 1 ? '' : 's'} · ${d.onTimeCount} on time · ${d.lateCount} late`}
                />
              )}
            </SectionCard>
          );
        })()}

        {/* DIAGNOSTIC ROW 1: per-class/class-view + distribution */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            {scope === 'school' ? (
              <SectionCard
                title="Per-class completion"
                hint={`${perClass.length} class${perClass.length === 1 ? '' : 'es'} · sorted by completion rate`}
                accent="#3b82f6"
              >
                {perClass.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={Math.max(260, perClass.length * 28)}>
                    <BarChart
                      data={[...perClass].sort((a, b) => b.completionRate - a.completionRate)}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#eef2ff" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                             tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={94}
                             tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                        formatter={(v, _n, p) => [
                          `${v}%`,
                          `${fmtNum(p.payload.submittedCount)} of ${fmtNum(p.payload.expected)} · ${fmtNum(p.payload.missedCount)} missed`,
                        ]}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                      />
                      <Bar dataKey="completionRate" radius={[0, 8, 8, 0]} barSize={16}>
                        {perClass.map((c, i) => (
                          <Cell key={i} fill={
                            c.completionRate >= 75 ? '#10b981' :
                            c.completionRate >= 40 ? '#3b82f6' :
                            c.completionRate >= 15 ? '#f59e0b' : '#ef4444'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            ) : (
              <SectionCard
                title={`Non-submitters · ${scopeLabel}`}
                hint={`${nonSubmitters.length} student${nonSubmitters.length === 1 ? '' : 's'} · sorted by missed tasks`}
                accent="#ef4444"
              >
                <NonSubmittersTable rows={nonSubmitters} />
              </SectionCard>
            )}
          </Col>

          <Col xs={24} md={10}>
            <SectionCard
              title="On-time vs late vs missed"
              hint={`${fmtNum((kpis?.submittedCount ?? 0) + (kpis?.missedCount ?? 0))} student-tasks resolved`}
              accent="#f59e0b"
            >
              {dists.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dists.map((s) => (
                    <DistRow
                      key={s.segment}
                      label={s.label}
                      value={s.count}
                      percent={s.percent}
                      color={s.color}
                    />
                  ))}
                  <Text type="secondary" style={{ fontSize: 10, marginTop: 4 }}>
                    Pending (not yet due, not submitted) excluded from distribution.
                  </Text>
                </div>
              )}
            </SectionCard>
          </Col>
        </Row>

        {/* DIAGNOSTIC ROW 2: per-subject + non-submitters / class snapshot */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={10}>
            <SectionCard
              title="Per-subject completion"
              hint={`${perSubject.length} subject${perSubject.length === 1 ? '' : 's'}`}
              accent="#a855f7"
            >
              {perSubject.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {perSubject.map((s) => (
                    <DistRow
                      key={s.subjectId || s.subjectName}
                      label={s.subjectName}
                      value={s.taskCount}
                      percent={s.completionRate}
                      color="#a855f7"
                      secondary={`${fmtNum(s.submittedCount)} of ${fmtNum(s.expected)} · ${fmtNum(s.missedCount)} missed`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </Col>

          <Col xs={24} md={14}>
            {scope === 'school' ? (
              <SectionCard
                title="Top non-submitters"
                hint={`${nonSubmitters.length} student${nonSubmitters.length === 1 ? '' : 's'} · most missed tasks first`}
                accent="#ef4444"
              >
                <NonSubmittersTable rows={nonSubmitters} />
              </SectionCard>
            ) : (
              <SectionCard
                title={`Class snapshot · ${scopeLabel}`}
                hint="At a glance"
                accent="#3b82f6"
              >
                <ClassSnapshot kpis={kpis} />
              </SectionCard>
            )}
          </Col>
        </Row>

        </>
        )}

      </Space>
    </Spin>
  );
}

// ─── Helpers / sub-components ────────────────────────────────────────────────

function Foot({ children }) {
  return <span style={{ fontSize: 10, color: '#94a3b8' }}>{children}</span>;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function DistRow({ label, value, percent, color, secondary }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0f172a', fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
          {label}
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmtNum(value)}</span> · {Number(percent).toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', width: `${Math.min(percent, 100)}%`, background: color, borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {secondary && (
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{secondary}</div>
      )}
    </div>
  );
}

function NonSubmittersTable({ rows }) {
  if (!rows || rows.length === 0) return <Empty description="No missing submissions." />;
  return (
    <Table
      size="small"
      dataSource={rows}
      rowKey="studentId"
      pagination={{ pageSize: 8, simple: true }}
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
        {
          title: 'Class',
          dataIndex: 'classLabel',
          render: (v) => <Tag style={{ borderRadius: 999, margin: 0 }}>{v}</Tag>,
        },
        {
          title: 'Assigned',
          dataIndex: 'assignedCount',
          render: (v) => <span style={{ color: '#475569' }}>{v}</span>,
        },
        {
          title: 'Missed',
          dataIndex: 'missedCount',
          sorter: (a, b) => a.missedCount - b.missedCount,
          defaultSortOrder: 'descend',
          render: (v) => (
            <span style={{ fontWeight: 700, color: v > 0 ? '#dc2626' : '#94a3b8' }}>
              {v}
            </span>
          ),
        },
        {
          title: 'On-time %',
          dataIndex: 'onTimeRate',
          render: (v) => (
            <span style={{ fontWeight: 600, color: v >= 75 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444' }}>
              {Number(v).toFixed(0)}%
            </span>
          ),
        },
      ]}
    />
  );
}

function ClassSnapshot({ kpis }) {
  if (!kpis) return <Empty />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <SnapRow label="Tasks assigned"       value={fmtNum(kpis.totalTasks)} />
      <SnapRow label="Students on roster"   value={fmtNum(kpis.distinctStudents)} />
      <SnapRow label="Submissions received" value={fmtNum(kpis.submittedCount)} accent="#10b981" />
      <SnapRow label="Missed (past due)"    value={fmtNum(kpis.missedCount)} accent="#ef4444" />
      <SnapRow label="Completion rate"
        value={`${Number(kpis.completionRate || 0).toFixed(1)}%`}
        accent={kpis.completionRate >= 75 ? '#10b981' : kpis.completionRate >= 40 ? '#3b82f6' : '#ef4444'} />
      <SnapRow label="On-time rate"
        value={`${Number(kpis.onTimeRate || 0).toFixed(1)}%`}
        accent={kpis.onTimeRate >= 75 ? '#10b981' : kpis.onTimeRate >= 40 ? '#f59e0b' : '#ef4444'} />
    </div>
  );
}

function SnapRow({ label, value, accent }) {
  return (
    <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #eef2ff', borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent || '#0f172a' }}>{value}</div>
    </div>
  );
}

const RANGE_PRESETS = [
  { key: 'all',  label: 'All time',     range: () => null },
  { key: '7d',   label: 'Last 7 days',  range: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
  { key: '30d',  label: 'Last 30 days', range: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
  { key: '90d',  label: 'Last 90 days', range: () => [dayjs().subtract(89, 'day').startOf('day'), dayjs().endOf('day')] },
  { key: 'mtd',  label: 'This month',   range: () => [dayjs().startOf('month'), dayjs().endOf('day')] },
];

function rangePresetKey(dateRange) {
  if (!dateRange?.[0] || !dateRange?.[1]) return 'all';
  for (const p of RANGE_PRESETS) {
    const r = p.range();
    if (!r) continue;
    if (r[0].isSame(dateRange[0], 'day') && r[1].isSame(dateRange[1], 'day')) return p.key;
  }
  return 'custom';
}

function FilterBar({ scope, setScope, classes, classInstanceId, setClassInstanceId, dateRange, setDateRange, ayLabel }) {
  const presetKey = rangePresetKey(dateRange);
  const customActive = presetKey === 'custom';

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
              { label: 'Class',  value: 'class' },
            ]}
          />
        </FilterField>

        {scope === 'class' && (
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

        <div style={{ marginLeft: 'auto' }}>
          <Tag style={{ borderRadius: 999, margin: 0, fontWeight: 500 }}>
            {classes.length} {classes.length === 1 ? 'class' : 'classes'} · {ayLabel}
          </Tag>
        </div>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        paddingTop: 10, borderTop: '1px dashed #eef2ff',
      }}>
        <FilterField label="Submission window">
          <Segmented
            value={presetKey}
            onChange={(k) => {
              if (k === 'custom') return;
              const preset = RANGE_PRESETS.find((p) => p.key === k);
              const r = preset?.range();
              setDateRange(r || [null, null]);
            }}
            options={[
              ...RANGE_PRESETS.map((p) => ({ label: p.label, value: p.key })),
              ...(customActive ? [{ label: 'Custom', value: 'custom' }] : []),
            ]}
          />
        </FilterField>

        <FilterField label="Custom">
          <RangePicker
            value={dateRange?.[0] ? dateRange : null}
            onChange={(v) => setDateRange(v || [null, null])}
            placeholder={['Start date', 'End date']}
            allowClear
            format="DD MMM YYYY"
          />
        </FilterField>

        {dateRange?.[0] && dateRange?.[1] && (
          <Tag
            closable
            onClose={() => setDateRange([null, null])}
            style={{ borderRadius: 999, margin: 0, fontWeight: 500 }}
          >
            {dayjs(dateRange[0]).format('DD MMM')} – {dayjs(dateRange[1]).format('DD MMM YYYY')}
          </Tag>
        )}
      </div>

      <Text type="secondary" style={{ fontSize: 11 }}>
        KPIs and distributions are AY-bounded ({ayLabel}). Submission trend is calendar-windowed.
      </Text>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: '#94a3b8' }}>
        {label}
      </span>
      {children}
    </div>
  );
}
