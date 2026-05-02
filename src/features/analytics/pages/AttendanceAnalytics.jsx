import React, { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Select, DatePicker, Space, Table, Tag, Empty, Spin,
  Segmented, Typography, Tabs,
} from 'antd';
import dayjs from 'dayjs';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { useAcademicYear } from '../context/AcademicYearContext';
import { listClasses, listStudents } from '../services/analyticsService';
import attendanceSvc from '../services/attendanceAnalyticsService';
import {
  HeroStat, RingStat, Sparkbar, StatTile, SectionCard, DailyBars,
} from '../components/primitives';
import AyComparePanel from '../components/AyComparePanel';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS = {
  present: '#10b981',
  absent: '#ef4444',
  late: '#f59e0b',
  holiday: '#a855f7',
  leave: '#3b82f6',
  other: '#94a3b8',
};

const STATUS_ICON = {
  present: <CheckCircleOutlined />,
  absent: <CloseCircleOutlined />,
  late: <ClockCircleOutlined />,
};

export default function AttendanceAnalytics() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { selectedAyId, selectedYear, compareAyId, compareYear, formatYearLabel } = useAcademicYear();

  // Filters
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classInstanceId, setClassInstanceId] = useState('all');
  const [studentId, setStudentId] = useState(null);
  const [dateRange, setDateRange] = useState([null, null]);
  const [scope, setScope] = useState('school');

  // Data
  const [kpis, setKpis] = useState(null);
  const [daily, setDaily] = useState([]);
  const [perClass, setPerClass] = useState([]);
  const [absentees, setAbsentees] = useState([]);
  const [statusMix, setStatusMix] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [periodHeat, setPeriodHeat] = useState({ rows: [], subjects: [], days: [] });
  const [staffSummary, setStaffSummary] = useState([]);

  // Compare-AY parallel data (only fetched when compareAyId is set).
  const [compareKpis, setCompareKpis] = useState(null);
  const [compareDaily, setCompareDaily] = useState([]);

  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [activeView, setActiveView] = useState('students');
  const [granularity, setGranularity] = useState('day');
  const [showTrendLine, setShowTrendLine] = useState(true);

  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    let cancelled = false;
    listClasses(schoolCode, selectedAyId).then((rows) => {
      if (cancelled) return;
      setClasses(rows);
      // Reset downstream selections — a class from AY-A doesn't carry into AY-B.
      setClassInstanceId('all');
      setStudentId(null);
    }).catch(() => { if (!cancelled) setClasses([]); });
    return () => { cancelled = true; };
  }, [schoolCode, selectedAyId]);

  useEffect(() => {
    if (!schoolCode || classInstanceId === 'all') { setStudents([]); setStudentId(null); return; }
    listStudents(schoolCode, classInstanceId).then(setStudents).catch(() => setStudents([]));
  }, [schoolCode, classInstanceId]);

  useEffect(() => {
    if (scope !== 'student') setStudentId(null);
    if (scope === 'school') setClassInstanceId('all');
  }, [scope]);

  const queryParams = useMemo(() => ({
    schoolCode,
    ayId: selectedAyId,
    classInstanceId: scope === 'school' ? null : classInstanceId,
    studentId: scope === 'student' ? studentId : null,
    startDate: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : null,
    endDate: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : null,
  }), [schoolCode, selectedAyId, scope, classInstanceId, studentId, dateRange]);

  // The trend chart's window is calendar-anchored (last 30d / 4w / 12m),
  // not AY-anchored. We compute the window here and pass start/end straight
  // to the service so the RPC fetches across AY boundaries when needed.
  const buildWindow = (year) => {
    const today = dayjs();
    const ayEnd = year?.end_date ? dayjs(year.end_date) : null;
    const anchor = ayEnd && today.isAfter(ayEnd) ? ayEnd : today;
    if (granularity === 'day')   return { start: anchor.subtract(29, 'day').format('YYYY-MM-DD'),  end: anchor.format('YYYY-MM-DD'), anchor };
    if (granularity === 'week')  return { start: anchor.subtract(3, 'week').startOf('week').format('YYYY-MM-DD'), end: anchor.endOf('week').format('YYYY-MM-DD'), anchor };
    return { start: anchor.subtract(11, 'month').startOf('month').format('YYYY-MM-DD'), end: anchor.endOf('month').format('YYYY-MM-DD'), anchor };
  };
  const trendWindow        = useMemo(() => buildWindow(selectedYear), [granularity, selectedYear]);
  const compareTrendWindow = useMemo(() => compareYear ? buildWindow(compareYear) : null, [granularity, compareYear]);

  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    if (scope === 'student' && !studentId) {
      setKpis(null); setDaily([]); setStatusMix([]); setCalendar([]); setAbsentees([]); setPeriodHeat({ rows: [], subjects: [], days: [] });
      return;
    }
    setLoading(true);
    Promise.all([
      attendanceSvc.getHeadlineKpis(queryParams),
      // Trend uses calendar window, not AY filter — fetches across AYs.
      attendanceSvc.getDailyAttendanceTrend({
        schoolCode,
        classInstanceId: scope === 'school' ? null : classInstanceId,
        studentId: scope === 'student' ? studentId : null,
        startDate: trendWindow.start,
        endDate: trendWindow.end,
      }),
      attendanceSvc.getStatusDistribution(queryParams),
      attendanceSvc.getMonthlyCalendar(queryParams),
      scope === 'school' ? attendanceSvc.getPerClassSummary(queryParams) : Promise.resolve([]),
      scope !== 'student' ? attendanceSvc.getTopAbsentees({ ...queryParams, limit: 20 }) : Promise.resolve([]),
      scope !== 'school' ? attendanceSvc.getPeriodHeatmap(queryParams) : Promise.resolve({ rows: [], subjects: [], days: [] }),
    ]).then(([k, d, s, c, pc, abs, ph]) => {
      setKpis(k); setDaily(d); setStatusMix(s);
      setCalendar(c); setPerClass(pc); setAbsentees(abs); setPeriodHeat(ph);
    }).catch((e) => console.error('attendance load error', e))
      .finally(() => setLoading(false));
  }, [queryParams, scope, schoolCode, selectedAyId, classInstanceId, studentId, trendWindow]);

  // Compare-AY parallel fetch — only when compareAyId is set. Uses the
  // SAME scope (class/student) as primary; if a class isn't in the compare
  // AY, the RPC just returns no data which the chart will show as "no
  // marking in window".
  useEffect(() => {
    if (!schoolCode || !compareAyId || !compareTrendWindow) {
      setCompareKpis(null); setCompareDaily([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      attendanceSvc.getHeadlineKpis({
        schoolCode,
        ayId: compareAyId,
        // Match scope ONLY at the school level for compare — class/student
        // ids are AY-specific and won't translate. AY-vs-AY at school scope
        // is the meaningful comparison.
        classInstanceId: null,
        studentId: null,
      }),
      attendanceSvc.getDailyAttendanceTrend({
        schoolCode,
        classInstanceId: null,
        studentId: null,
        startDate: compareTrendWindow.start,
        endDate: compareTrendWindow.end,
      }),
    ]).then(([k, d]) => {
      if (cancelled) return;
      setCompareKpis(k);
      setCompareDaily(d);
    }).catch((e) => {
      if (!cancelled) console.warn('[attendance] compare fetch failed', e);
    });
    return () => { cancelled = true; };
  }, [schoolCode, compareAyId, compareTrendWindow]);

  useEffect(() => {
    if (activeView !== 'staff' || !schoolCode || !selectedAyId) return;
    setStaffLoading(true);
    attendanceSvc.getStaffAttendanceSummary({
      schoolCode,
      ayId: selectedAyId,
      // Honour the optional date range filter from the toolbar.
      startDate: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : null,
      endDate:   dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : null,
    }).then(setStaffSummary).catch(() => setStaffSummary([])).finally(() => setStaffLoading(false));
  }, [activeView, schoolCode, selectedAyId, dateRange]);

  if (!selectedAyId) {
    return (
      <SectionCard><Empty description="No academic year selected." /></SectionCard>
    );
  }

  return (
    <Tabs
      activeKey={activeView}
      onChange={setActiveView}
      tabBarStyle={{ marginBottom: 20 }}
      items={[
        { key: 'students', label: <span><UserOutlined /> Student Attendance</span>, children: renderStudentSection() },
        { key: 'staff',    label: <span><TeamOutlined /> Staff Attendance</span>, children: renderStaffSection() },
      ]}
    />
  );

  function renderStudentSection() {
    const ayLabel = selectedYear ? formatYearLabel(selectedYear) : '';
    const noClassPicked = scope !== 'school' && classInstanceId === 'all';
    const noStudentPicked = scope === 'student' && !studentId;
    const ayHasNoClasses = classes.length === 0;
    const last7 = daily.slice(-7);

    // Hero values
    const heroRate = kpis?.rate ?? null;
    const heroSubLabel =
      scope === 'student' ? `${kpis?.distinctDays ?? 0} school days marked` :
      scope === 'class' ? `${kpis?.distinctStudents ?? 0} students · ${kpis?.distinctDays ?? 0} days` :
      `${kpis?.distinctStudents ?? 0} students · ${kpis?.distinctDays ?? 0} days`;

    return (
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <FilterBar
          scope={scope} setScope={setScope}
          classes={classes} classInstanceId={classInstanceId} setClassInstanceId={setClassInstanceId}
          students={students} studentId={studentId} setStudentId={setStudentId}
          dateRange={dateRange} setDateRange={setDateRange}
          ayHasNoClasses={ayHasNoClasses} ayLabel={ayLabel}
        />

        {ayHasNoClasses && (
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

        {!ayHasNoClasses && noClassPicked && (
          <SectionCard><Empty description={`Pick a class to see ${scope === 'student' ? 'a student' : 'class'} attendance.`} /></SectionCard>
        )}
        {!ayHasNoClasses && noStudentPicked && classInstanceId !== 'all' && (
          <SectionCard><Empty description="Pick a student to see personalised attendance." /></SectionCard>
        )}

        {!ayHasNoClasses && !noClassPicked && !noStudentPicked && (
          <Spin spinning={loading}>
            {/* HERO ROW */}
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={10}>
                <HeroStat
                  gradient={heroRate >= 85 ? 'emerald' : heroRate >= 70 ? 'brand' : 'rose'}
                  eyebrow={`Attendance · AY ${ayLabel}`}
                  value={heroRate != null ? heroRate.toFixed(1) : '—'}
                  suffix="%"
                  label={heroSubLabel}
                  delta={heroRate != null && last7.length > 0 ? (() => {
                    const withData = last7.filter((d) => !d.noData && d.rate != null);
                    if (withData.length === 0) return { value: 'No marking in last 7 days' };
                    const above = withData.filter((d) => d.rate >= 80).length;
                    return { value: `${above} of ${withData.length} marked days ≥80%` };
                  })() : null}
                  height={200}
                  foot={
                    last7.length > 0 ? (
                      <Sparkbar
                        values={last7.map((d) => ({
                          label: dayjs(d.date).format('dd')[0],
                          value: d.noData ? 0 : (d.rate ?? 0),
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
                  <Col xs={12}>
                    <StatTile
                      label="Days marked"
                      value={fmt(kpis?.distinctDays ?? 0)}
                      accent="#10b981"
                      icon={STATUS_ICON.present}
                      foot={
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          out of {dateRangeDayCount(dateRange, selectedYear)} calendar days
                        </span>
                      }
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Students tracked"
                      value={fmt(kpis?.distinctStudents ?? 0)}
                      accent="#6366F1"
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Absent (student-days)"
                      value={fmt(kpis?.absentDays ?? 0)}
                      accent="#ef4444"
                      icon={STATUS_ICON.absent}
                      foot={
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          out of {fmt(kpis?.totalMarked ?? 0)} marked
                        </span>
                      }
                    />
                  </Col>
                  <Col xs={12}>
                    <StatTile
                      label="Present (student-days)"
                      value={fmt(kpis?.presentDays ?? 0)}
                      accent="#3B82F6"
                    />
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* COMPARE PANEL — only when a second AY is picked */}
            {compareYear && (
              <div style={{ marginTop: 16 }}>
                <AyComparePanel
                  primary={{
                    label: `AY ${formatYearLabel(selectedYear)}`,
                    kpis: kpis,
                  }}
                  compare={{
                    label: `AY ${formatYearLabel(compareYear)}`,
                    kpis: compareKpis,
                  }}
                  metrics={[
                    { key: 'rate',             label: 'Attendance rate', unit: '%', precision: 1, betterIs: 'higher' },
                    { key: 'distinctDays',     label: 'Days marked', betterIs: 'higher', hint: 'Calendar days where attendance was marked.' },
                    { key: 'distinctStudents', label: 'Students tracked', betterIs: 'higher' },
                    { key: 'presentDays',      label: 'Present (student-days)', betterIs: 'higher' },
                    { key: 'absentDays',       label: 'Absent (student-days)', betterIs: 'lower' },
                  ]}
                />
              </div>
            )}

            {/* DAILY TREND */}
            {(() => {
              const withData = daily.filter((d) => !d.noData && d.rate != null);
              const avg = avgOf(withData, 'rate');
              const scopeLabel =
                scope === 'student' ? 'Student' :
                scope === 'class'   ? 'Class' :
                'School';
              const windowLabel =
                granularity === 'day'   ? 'Last 30 days' :
                granularity === 'week'  ? 'Last 4 weeks' :
                                          'Last 12 months';
              const hint = [
                `${scopeLabel} · ${windowLabel}`,
                avg != null ? `avg ${avg}%` : 'no data in window',
              ].join(' · ');
              return (
                <SectionCard
                  title="Day-by-day attendance"
                  hint={hint}
                  accent="#10b981"
                  style={{ marginTop: 16 }}
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
                    <>
                      <DailyBars
                        data={daily}
                        dateKey="date"
                        valueKey="rate"
                        valueFormat={(v) => `${v}%`}
                        domain={[0, 100]}
                        height={260}
                        groupBy={granularity}
                        windowDays={30}
                        windowWeeks={4}
                        windowMonths={12}
                        windowAnchor={trendWindow.anchor.format('YYYY-MM-DD')}
                        showTrendLine={showTrendLine}
                        trendColor="#06b6d4"
                        detailRender={(d) => d.noData ? 'No data'
                          : `${d.present + d.late} present · ${d.absent} absent${d.holiday ? ` · ${d.holiday} holiday` : ''}`}
                      />
                      <Legend />
                    </>
                  )}
                </SectionCard>
              );
            })()}

            {/* STATUS RING + EITHER PER-CLASS BARS OR ABSENTEES */}
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={9}>
                <SectionCard title="Status mix" hint="Share of student-days" accent="#6366F1">
                  {statusMix.length === 0 ? <Empty /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                      {(() => {
                        const presentEntry = statusMix.find((s) => s.key === 'present');
                        const overall = presentEntry?.percent ?? 0;
                        return (
                          <RingStat
                            value={overall}
                            label="Present share"
                            subLabel={`${fmt(presentEntry?.value || 0)} of ${fmt(statusMix.reduce((a, b) => a + b.value, 0))}`}
                            tone={overall >= 85 ? 'success' : overall >= 70 ? 'brand' : 'critical'}
                            size={140} stroke={12}
                          />
                        );
                      })()}
                      <div style={{ width: '100%' }}>
                        {statusMix.map((s) => (
                          <StatusBar key={s.key} label={s.label} value={s.value} percent={s.percent} color={STATUS_COLORS[s.key] || s.color || '#94a3b8'} />
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </Col>

              <Col xs={24} md={15}>
                {scope === 'school' ? (
                  <SectionCard
                    title="Per-class attendance"
                    hint={`${perClass.length} classes · sorted by rate`}
                    accent="#10b981"
                  >
                    {perClass.length === 0 ? <Empty /> : (
                      <ResponsiveContainer width="100%" height={Math.max(260, perClass.length * 28)}>
                        <BarChart data={perClass} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                          <CartesianGrid horizontal={false} stroke="#eef2ff" />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                                 tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis type="category" dataKey="label" width={94}
                                 tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                          <Tooltip
                            cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                            formatter={(v) => `${v}%`}
                            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                          />
                          <Bar dataKey="rate" radius={[0, 8, 8, 0]} barSize={16}>
                            {perClass.map((c, i) => (
                              <Cell key={i} fill={c.rate >= 85 ? '#10b981' : c.rate >= 70 ? '#6366F1' : c.rate >= 55 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </SectionCard>
                ) : (
                  <SectionCard
                    title="Chronic absentees"
                    hint={`${absentees.length} students with ≥1 absence`}
                    accent="#ef4444"
                  >
                    {absentees.length === 0 ? <Empty /> : (
                      <Table
                        size="small"
                        dataSource={absentees}
                        rowKey="studentId"
                        pagination={{ pageSize: 8, simple: true }}
                        columns={[
                          { title: 'Student', dataIndex: 'name', render: (v, r) => (
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{v}</div>
                              {r.code && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.code}</div>}
                            </div>
                          )},
                          { title: 'Class', dataIndex: 'classLabel', render: (v) => <Tag style={{ borderRadius: 999, margin: 0 }}>{v}</Tag> },
                          { title: 'Absent', dataIndex: 'absences', sorter: (a, b) => a.absences - b.absences,
                            render: (v) => (
                              <span style={{ fontWeight: 700, color: v > 10 ? '#dc2626' : v > 5 ? '#d97706' : '#0f172a' }}>{v}</span>
                            ) },
                          { title: 'Rate', dataIndex: 'rate', render: (v) => (
                            <span style={{ color: v >= 85 ? '#059669' : v >= 70 ? '#0f172a' : '#dc2626', fontWeight: 600 }}>{v}%</span>
                          )},
                        ]}
                      />
                    )}
                  </SectionCard>
                )}
              </Col>
            </Row>

            {/* PERIOD HEATMAP */}
            {scope !== 'school' && (
              <SectionCard
                title="Period attendance"
                hint="Subject × day of week"
                accent="#a855f7"
                style={{ marginTop: 16 }}
              >
                {periodHeat.unavailable ? (
                  <Empty description="Period attendance data not available for this deployment." />
                ) : periodHeat.rows.length === 0 ? <Empty description="No period-level attendance recorded for the scope." /> : (
                  renderPeriodHeatmap(periodHeat)
                )}
              </SectionCard>
            )}

            {/* STUDENT CALENDAR */}
            {scope === 'student' && calendar.length > 0 && (
              <SectionCard
                title="Calendar"
                hint="Color = attendance rate per day"
                accent="#6366F1"
                style={{ marginTop: 16 }}
              >
                {renderCalendar(calendar)}
              </SectionCard>
            )}
          </Spin>
        )}
      </Space>
    );
  }

  function renderStaffSection() {
    return (
      <Spin spinning={staffLoading}>
        <SectionCard
          title={`Staff attendance · ${dayjs().format('MMMM YYYY')}`}
          hint="Path: ay-direct (staff_attendance.academic_year_id)"
          accent="#14b8a6"
        >
          {staffSummary.length === 0 ? <Empty description="No staff attendance data for this period." /> : (
            <Table
              size="small"
              dataSource={staffSummary}
              rowKey={(r) => r.employee_id || r.id}
              pagination={{ pageSize: 12 }}
              columns={[
                { title: 'Employee', dataIndex: 'full_name', render: (v, r) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{v || r.name || r.employee_id}</div>
                    {r.department && <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.department}</div>}
                  </div>
                )},
                { title: 'Present', dataIndex: 'present_days', sorter: (a, b) => (a.present_days || 0) - (b.present_days || 0) },
                { title: 'Absent', dataIndex: 'absent_days' },
                { title: 'Half-day', dataIndex: 'half_day_count' },
                { title: 'Rate', dataIndex: 'attendance_pct', render: (v) => v != null ? (
                  <span style={{ color: v >= 90 ? '#059669' : v >= 75 ? '#0f172a' : '#dc2626', fontWeight: 600 }}>{v}%</span>
                ) : '—' },
              ]}
            />
          )}
        </SectionCard>
      </Spin>
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const RANGE_PRESETS = [
  { key: 'all',  label: 'All time', range: () => null },
  { key: '7d',   label: 'Last 7 days',   range: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
  { key: '30d',  label: 'Last 30 days',  range: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
  { key: '90d',  label: 'Last 90 days',  range: () => [dayjs().subtract(89, 'day').startOf('day'), dayjs().endOf('day')] },
  { key: 'mtd',  label: 'This month',    range: () => [dayjs().startOf('month'), dayjs().endOf('day')] },
  { key: 'ytd',  label: 'This year',     range: () => [dayjs().startOf('year'),  dayjs().endOf('day')] },
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

function FilterBar({
  scope, setScope,
  classes, classInstanceId, setClassInstanceId,
  students, studentId, setStudentId,
  dateRange, setDateRange,
  ayHasNoClasses, ayLabel,
}) {
  const presetKey = rangePresetKey(dateRange);
  const customActive = presetKey === 'custom';

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #eef2ff',
      borderRadius: 14,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Row 1 — Scope + scoped pickers */}
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
              placeholder={classInstanceId === 'all' ? 'Pick a class first' : 'Pick a student'}
              value={studentId}
              onChange={setStudentId}
              disabled={classInstanceId === 'all'}
              allowClear showSearch optionFilterProp="label"
              options={students.map((s) => ({
                value: s.id,
                label: `${s.full_name}${s.student_code ? ` (${s.student_code})` : ''}`,
              }))}
            />
          </FilterField>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <Tag
            style={{ borderRadius: 999, margin: 0, fontWeight: 500 }}
            color={ayHasNoClasses ? 'red' : 'default'}
          >
            {classes.length} {classes.length === 1 ? 'class' : 'classes'} · {ayLabel}
          </Tag>
        </div>
      </div>

      {/* Row 2 — Date range with quick presets */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        paddingTop: 10, borderTop: '1px dashed #eef2ff',
      }}>
        <FilterField label="Date range">
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

function Legend() {
  const items = [
    { color: '#10b981', label: '≥90%' },
    { color: '#84cc16', label: '75–89' },
    { color: '#f59e0b', label: '60–74' },
    { color: '#ef4444', label: '<60' },
    { color: 'repeating-linear-gradient(45deg, #f1f5f9 0 4px, transparent 4px 8px)', label: 'No data', dashed: true },
  ];
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
          <span style={{
            width: 14, height: 10, borderRadius: 2,
            background: it.color,
            border: it.dashed ? '1px dashed #cbd5e1' : 'none',
          }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

// Number of calendar days in the active scope: explicit date range if set,
// else the AY's start_date → end_date span, else 0.
function dateRangeDayCount(dateRange, selectedYear) {
  if (dateRange?.[0] && dateRange?.[1]) {
    return dayjs(dateRange[1]).diff(dayjs(dateRange[0]), 'day') + 1;
  }
  if (selectedYear?.start_date && selectedYear?.end_date) {
    return dayjs(selectedYear.end_date).diff(dayjs(selectedYear.start_date), 'day') + 1;
  }
  return 0;
}

function avgOf(arr, key) {
  const vals = arr.map((r) => r[key]).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function StatusBar({ label, value, percent, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0f172a', fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
          {label}
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmt(value)}</span> · {percent}%
        </span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${percent}%`, background: color, borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

function renderPeriodHeatmap({ rows, subjects, days }) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const grid = new Map(rows.map((r) => [`${r.subjectId}|${r.day}`, r]));
  const colorFor = (rate) => {
    if (rate == null) return { bg: '#f8fafc', fg: '#94a3b8' };
    if (rate >= 90) return { bg: '#10b981', fg: '#fff' };
    if (rate >= 75) return { bg: '#84cc16', fg: '#0f172a' };
    if (rate >= 60) return { bg: '#f59e0b', fg: '#fff' };
    return { bg: '#ef4444', fg: '#fff' };
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 6, minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ padding: 6, textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 600 }}>SUBJECT</th>
            {days.map((d) => (
              <th key={d} style={{ padding: 6, textAlign: 'center', minWidth: 64, fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                {dayLabels[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{s.name}</td>
              {days.map((d) => {
                const cell = grid.get(`${s.id}|${d}`);
                const c = colorFor(cell?.rate);
                return (
                  <td key={d} style={{ padding: 0 }}>
                    <div title={cell ? `${cell.present}/${cell.total} (${cell.rate}%)` : 'no data'}
                         style={{
                           background: c.bg, color: c.fg,
                           padding: '10px 6px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: 600,
                           minWidth: 56,
                         }}>
                      {cell ? `${Math.round(cell.rate)}%` : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCalendar(days) {
  const byMonth = new Map();
  days.forEach((d) => {
    const k = `${d.year}-${String(d.month).padStart(2, '0')}`;
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(d);
  });
  const months = Array.from(byMonth.entries()).sort();
  const colorFor = (rate) => {
    if (rate == null) return { bg: 'transparent', fg: '#cbd5e1' };
    if (rate >= 90) return { bg: '#10b981', fg: '#fff' };
    if (rate >= 75) return { bg: '#84cc16', fg: '#0f172a' };
    if (rate >= 50) return { bg: '#f59e0b', fg: '#fff' };
    return { bg: '#ef4444', fg: '#fff' };
  };
  return (
    <Row gutter={[16, 16]}>
      {months.map(([key, ds]) => {
        const monthName = dayjs(`${key}-01`).format('MMMM YYYY');
        const firstDow = dayjs(`${key}-01`).day();
        const cells = Array(firstDow).fill(null).concat(ds.sort((a, b) => a.day - b.day));
        return (
          <Col key={key} xs={24} md={12} lg={8}>
            <div style={{ border: '1px solid #eef2ff', borderRadius: 12, padding: 14, background: '#fff' }}>
              <div style={{ fontWeight: 600, marginBottom: 10, color: '#0f172a' }}>{monthName}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 11 }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => (
                  <div key={i} style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600, padding: '4px 0' }}>{l}</div>
                ))}
                {cells.map((c, i) => {
                  const col = c ? colorFor(c.rate) : { bg: 'transparent', fg: '#cbd5e1' };
                  return (
                    <div key={i} title={c ? `${c.date}: ${c.rate ?? '—'}%` : ''} style={{
                      height: 28, borderRadius: 6, textAlign: 'center', lineHeight: '28px', fontSize: 11, fontWeight: 600,
                      background: col.bg, color: col.fg,
                      border: c ? 'none' : '1px dashed #f1f5f9',
                    }}>
                      {c ? c.day : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          </Col>
        );
      })}
    </Row>
  );
}
