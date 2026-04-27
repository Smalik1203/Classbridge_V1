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
import feesSvc from '../services/feesAnalyticsService';
import {
  HeroStat, Sparkbar, StatTile, SectionCard, DailyBars,
} from '../components/primitives';
import AyComparePanel from '../components/AyComparePanel';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function FeesAnalytics() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { selectedAyId, selectedYear, compareAyId, compareYear, formatYearLabel } = useAcademicYear();

  const [classes, setClasses] = useState([]);
  const [classInstanceId, setClassInstanceId] = useState('all');
  const [scope, setScope] = useState('school');
  const [dateRange, setDateRange] = useState([null, null]);
  const [granularity, setGranularity] = useState('day');
  const [showTrendLine, setShowTrendLine] = useState(true);

  const [kpis, setKpis] = useState(null);
  const [daily, setDaily] = useState([]);
  const [aging, setAging] = useState([]);
  const [perClass, setPerClass] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [dists, setDists] = useState({ status: [], method: [], label: [] });

  const [compareKpis, setCompareKpis] = useState(null);

  const [loading, setLoading] = useState(false);

  // Class list — re-fetched whenever the AY picker changes.
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
      // Auto-pick the first class on entering Class scope so the page lights up.
      setClassInstanceId(classes[0].id);
    }
  }, [scope, classes, classInstanceId]);

  const queryParams = useMemo(() => ({
    schoolCode,
    ayId: selectedAyId,
    classInstanceId: scope === 'school' ? null : classInstanceId,
  }), [schoolCode, selectedAyId, scope, classInstanceId]);

  // Trend chart is calendar-anchored — last 30d / 4w / 12m, anchored on
  // today (or the AY's end_date when looking at a past AY).
  const trendWindow = useMemo(() => {
    const today = dayjs();
    const ayEnd = selectedYear?.end_date ? dayjs(selectedYear.end_date) : null;
    const anchor = ayEnd && today.isAfter(ayEnd) ? ayEnd : today;
    if (granularity === 'day')   return { start: anchor.subtract(29, 'day').format('YYYY-MM-DD'),  end: anchor.format('YYYY-MM-DD'), anchor };
    if (granularity === 'week')  return { start: anchor.subtract(3, 'week').startOf('week').format('YYYY-MM-DD'), end: anchor.endOf('week').format('YYYY-MM-DD'), anchor };
    return { start: anchor.subtract(11, 'month').startOf('month').format('YYYY-MM-DD'), end: anchor.endOf('month').format('YYYY-MM-DD'), anchor };
  }, [granularity, selectedYear]);

  // Honor explicit date range filter if user provided one.
  const collectionWindow = useMemo(() => {
    if (dateRange?.[0] && dateRange?.[1]) {
      return { start: dateRange[0].format('YYYY-MM-DD'), end: dateRange[1].format('YYYY-MM-DD'), anchor: dateRange[1] };
    }
    return trendWindow;
  }, [dateRange, trendWindow]);

  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    setLoading(true);
    Promise.all([
      feesSvc.getHeadlineKpis(queryParams),
      feesSvc.getDailyCollection({
        ...queryParams,
        startDate: collectionWindow.start,
        endDate: collectionWindow.end,
      }),
      feesSvc.getAgingSnapshot(queryParams),
      scope === 'school'
        ? feesSvc.getPerClassSummary({ schoolCode, ayId: selectedAyId })
        : Promise.resolve([]),
      feesSvc.getTopDefaulters({ ...queryParams, limit: 20 }),
      feesSvc.getDistributions(queryParams),
    ]).then(([k, d, a, pc, def, dd]) => {
      setKpis(k); setDaily(d); setAging(a); setPerClass(pc);
      setDefaulters(def); setDists(dd);
    }).catch((e) => console.error('fees analytics load error', e))
      .finally(() => setLoading(false));
  }, [queryParams, scope, schoolCode, selectedAyId, collectionWindow]);

  // Compare-AY parallel fetch — KPIs only, school-wide (class ids are
  // AY-specific so we don't carry the class filter across AYs).
  useEffect(() => {
    if (!schoolCode || !compareAyId) { setCompareKpis(null); return; }
    let cancelled = false;
    feesSvc.getHeadlineKpis({ schoolCode, ayId: compareAyId, classInstanceId: null })
      .then((k) => { if (!cancelled) setCompareKpis(k); })
      .catch((e) => { if (!cancelled) console.warn('[fees] compare fetch failed', e); });
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
            <Empty description="Pick a class to see its fee analytics." />
          </SectionCard>
        )}

        {!noClassesInAy && !noClassPicked && (
        <>
        {/* HERO ROW */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <HeroStat
              gradient={
                kpis?.collectionRate >= 75 ? 'emerald' :
                kpis?.collectionRate >= 40 ? 'brand' : 'rose'
              }
              eyebrow={`${scopeLabel} · AY ${ayLabel}`}
              value={kpis ? Number(kpis.collectionRate).toFixed(1) : '—'}
              suffix="%"
              label={`${fmtINR(kpis?.totalPaid ?? 0)} of ${fmtINR(kpis?.totalBilled ?? 0)}`}
              delta={
                kpis?.invoiceCount
                  ? { value: `${kpis.payingStudents} of ${kpis.distinctStudents} students paid` }
                  : null
              }
              height={200}
              foot={
                last7.length > 0 ? (
                  <Sparkbar
                    values={last7.map((d) => ({
                      label: dayjs(d.date).format('dd')[0],
                      value: d.amount,
                      noData: d.noData && d.amount === 0,
                    }))}
                    max={Math.max(1, ...last7.map((d) => d.amount))}
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
                  label="Outstanding"
                  value={fmtINR(kpis?.totalOutstanding ?? 0)}
                  accent="#ef4444"
                  foot={<Foot>{kpis?.dueCount ?? 0} due · {kpis?.partialCount ?? 0} partial</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Invoices"
                  value={fmtNum(kpis?.invoiceCount ?? 0)}
                  accent="#6366f1"
                  foot={<Foot>{kpis?.paidCount ?? 0} paid in full</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Billed"
                  value={fmtINR(kpis?.totalBilled ?? 0)}
                  accent="#0ea5e9"
                  foot={<Foot>across {kpis?.distinctStudents ?? 0} students</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Collected"
                  value={fmtINR(kpis?.totalPaid ?? 0)}
                  accent="#10b981"
                  foot={<Foot>{kpis?.payingStudents ?? 0} paying students</Foot>}
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
              { key: 'collectionRate', label: 'Collection rate', unit: '%', precision: 1, betterIs: 'higher' },
              { key: 'totalBilled',     label: 'Billed (₹)',  betterIs: 'higher' },
              { key: 'totalPaid',       label: 'Collected (₹)', betterIs: 'higher' },
              { key: 'totalOutstanding',label: 'Outstanding (₹)', betterIs: 'lower' },
              { key: 'invoiceCount',    label: 'Invoices', betterIs: 'higher' },
              { key: 'payingStudents',  label: 'Paying students', betterIs: 'higher' },
            ]}
          />
        )}

        {/* DAILY COLLECTION TREND */}
        {(() => {
          const withData = daily.filter((d) => d.amount > 0);
          const total = withData.reduce((a, b) => a + b.amount, 0);
          const windowLabel =
            granularity === 'day'   ? 'Last 30 days' :
            granularity === 'week'  ? 'Last 4 weeks' :
                                      'Last 12 months';
          const hint = [
            scope === 'school' ? 'School' : `Class · ${classes.find((c) => c.id === classInstanceId)?.label || ''}`,
            (dateRange?.[0] && dateRange?.[1]) ? 'Custom range' : windowLabel,
            withData.length ? `${fmtINR(total)} collected` : 'no payments in window',
          ].join(' · ');
          return (
            <SectionCard
              title="Day-by-day collection"
              hint={hint}
              accent="#10b981"
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
                    disabled={!!(dateRange?.[0] && dateRange?.[1])}
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
                  data={daily.map((d) => ({ ...d, rate: d.amount, noData: d.amount === 0 && d.noData }))}
                  dateKey="date"
                  valueKey="rate"
                  valueFormat={(v) => fmtINR(v)}
                  height={260}
                  groupBy={granularity}
                  windowDays={30}
                  windowWeeks={4}
                  windowMonths={12}
                  windowAnchor={collectionWindow.anchor.format
                    ? collectionWindow.anchor.format('YYYY-MM-DD')
                    : dayjs(collectionWindow.end).format('YYYY-MM-DD')}
                  showTrendLine={showTrendLine}
                  trendColor="#06b6d4"
                  detailRender={(d) => d.noData
                    ? 'No payments'
                    : `${d.paymentCount} payment${d.paymentCount === 1 ? '' : 's'} · ${fmtINR(d.amount)}`}
                />
              )}
            </SectionCard>
          );
        })()}

        {/* AGING + STATUS DISTRIBUTION */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <SectionCard
              title="Aging of unpaid invoices"
              hint={`As of ${dayjs().format('DD MMM YYYY')} · ${fmtINR(aging.reduce((a, b) => a + b.outstanding, 0))} outstanding`}
              accent="#f59e0b"
            >
              {aging.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={aging} margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eef2ff" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                           tickFormatter={(v) => fmtINRShort(v)} />
                    <Tooltip
                      cursor={{ fill: 'rgba(245,158,11,0.06)' }}
                      formatter={(v, _n, p) => [fmtINR(v), `${p.payload.invoiceCount} invoice${p.payload.invoiceCount === 1 ? '' : 's'}`]}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                    />
                    <Bar dataKey="outstanding" radius={[8, 8, 0, 0]}>
                      {aging.map((b, i) => (<Cell key={i} fill={b.color} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </Col>

          <Col xs={24} md={10}>
            <SectionCard
              title="Invoice status mix"
              hint={`${fmtNum(kpis?.invoiceCount ?? 0)} invoices`}
              accent="#6366F1"
            >
              {dists.status.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dists.status.map((s) => (
                    <DistRow key={s.key} label={s.label} value={s.invoiceCount}
                             percent={s.percent} color={s.color}
                             secondary={`${fmtINR(s.paid)} of ${fmtINR(s.billed)}`} />
                  ))}
                </div>
              )}
            </SectionCard>
          </Col>
        </Row>

        {/* MAIN CHART ROW —
            School scope: per-class collection bars + fee components
            Class scope:  top defaulters (full width on left) + fee components */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            {scope === 'school' ? (
              <SectionCard
                title="Per-class collection"
                hint={`${perClass.length} classes · sorted by collection rate`}
                accent="#10b981"
              >
                {perClass.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={Math.max(260, perClass.length * 28)}>
                    <BarChart
                      data={[...perClass].sort((a, b) => b.collectionRate - a.collectionRate)}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#eef2ff" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                             tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={94}
                             tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(16,185,129,0.06)' }}
                        formatter={(v, _n, p) => [`${v}%`, `${fmtINR(p.payload.totalPaid)} of ${fmtINR(p.payload.totalBilled)}`]}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                      />
                      <Bar dataKey="collectionRate" radius={[0, 8, 8, 0]} barSize={16}>
                        {perClass.map((c, i) => (
                          <Cell key={i} fill={
                            c.collectionRate >= 75 ? '#10b981' :
                            c.collectionRate >= 40 ? '#6366F1' :
                            c.collectionRate >= 15 ? '#f59e0b' : '#ef4444'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            ) : (
              <SectionCard
                title={`Defaulters · ${scopeLabel}`}
                hint={`${defaulters.length} student${defaulters.length === 1 ? '' : 's'} with outstanding`}
                accent="#ef4444"
              >
                <DefaultersTable rows={defaulters} />
              </SectionCard>
            )}
          </Col>

          <Col xs={24} md={10}>
            <SectionCard title="Fee components" hint="Billed by line-item label" accent="#a855f7">
              {dists.label.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dists.label.map((r) => (
                    <DistRow key={r.label} label={r.label} value={r.itemCount}
                             percent={r.percent}
                             color="#a855f7"
                             secondary={`${fmtINR(r.billed)} billed`} />
                  ))}
                </div>
              )}
            </SectionCard>
          </Col>
        </Row>

        {/* SECOND ROW —
            School scope: payment methods + defaulters
            Class scope:  payment methods + a class roster summary card */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={10}>
            <SectionCard title="Payment methods" hint="Share of ₹ collected" accent="#06b6d4">
              {dists.method.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dists.method.map((r) => (
                    <DistRow key={r.key} label={r.label} value={r.paymentCount}
                             percent={r.percent} color={r.color}
                             secondary={`${fmtINR(r.amount)} · ${r.paymentCount} payment${r.paymentCount === 1 ? '' : 's'}`} />
                  ))}
                </div>
              )}
            </SectionCard>
          </Col>
          <Col xs={24} md={14}>
            {scope === 'school' ? (
              <SectionCard
                title="Top defaulters"
                hint={`${defaulters.length} students with outstanding`}
                accent="#ef4444"
              >
                <DefaultersTable rows={defaulters} />
              </SectionCard>
            ) : (
              <SectionCard
                title={`Class snapshot · ${scopeLabel}`}
                hint="At a glance"
                accent="#6366F1"
              >
                <ClassSnapshot kpis={kpis} status={dists.status} />
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

// ─── Helpers / sub-components ───────────────────────────────────────────────

function Foot({ children }) {
  return <span style={{ fontSize: 10, color: '#94a3b8' }}>{children}</span>;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function fmtINR(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtINRShort(n) {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
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
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmtNum(value)}</span> · {percent}%
        </span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', width: `${percent}%`, background: color, borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {secondary && (
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{secondary}</div>
      )}
    </div>
  );
}

function ClassSnapshot({ kpis, status }) {
  if (!kpis) return <Empty />;
  const studentsBilled = kpis.distinctStudents || 0;
  const studentsPaying = kpis.payingStudents || 0;
  const studentsNoPayment = Math.max(0, studentsBilled - studentsPaying);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <SnapRow label="Students billed" value={fmtNum(studentsBilled)} />
      <SnapRow label="Students with ≥1 payment" value={fmtNum(studentsPaying)} accent="#10b981" />
      <SnapRow label="Students yet to pay" value={fmtNum(studentsNoPayment)} accent="#ef4444" />
      <SnapRow label="Avg billed / student" value={studentsBilled ? fmtINR(Math.round(kpis.totalBilled / studentsBilled)) : '—'} />
      <SnapRow label="Avg outstanding / student" value={studentsBilled ? fmtINR(Math.round(kpis.totalOutstanding / studentsBilled)) : '—'} accent="#ef4444" />
      <SnapRow label="Collection rate" value={`${Number(kpis.collectionRate || 0).toFixed(1)}%`}
        accent={kpis.collectionRate >= 75 ? '#10b981' : kpis.collectionRate >= 40 ? '#6366f1' : '#ef4444'} />
      {status && status.length > 0 && (
        <div style={{ gridColumn: '1 / span 2', marginTop: 4 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 6 }}>
            Invoice status
          </div>
          {status.map((s) => (
            <DistRow key={s.key} label={s.label} value={s.invoiceCount}
              percent={s.percent} color={s.color}
              secondary={`${fmtINR(s.paid)} of ${fmtINR(s.billed)}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function SnapRow({ label, value, accent }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: '#f8fafc',
      border: '1px solid #eef2ff',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent || '#0f172a' }}>
        {value}
      </div>
    </div>
  );
}

function DefaultersTable({ rows }) {
  if (!rows || rows.length === 0) return <Empty description="No outstanding balances." />;
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
        { title: 'Class', dataIndex: 'classLabel', render: (v) => <Tag style={{ borderRadius: 999, margin: 0 }}>{v}</Tag> },
        {
          title: 'Outstanding',
          dataIndex: 'outstanding',
          sorter: (a, b) => a.outstanding - b.outstanding,
          render: (v) => <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmtINR(v)}</span>,
        },
        {
          title: 'Overdue',
          dataIndex: 'oldestDueDays',
          render: (v) => v > 0
            ? <span style={{ color: v > 30 ? '#dc2626' : '#d97706', fontWeight: 600 }}>{v}d</span>
            : <span style={{ color: '#94a3b8' }}>—</span>,
        },
      ]}
    />
  );
}

const RANGE_PRESETS = [
  { key: 'all',  label: 'All time', range: () => null },
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

function FilterBar({
  scope, setScope, classes, classInstanceId, setClassInstanceId,
  dateRange, setDateRange, ayLabel,
}) {
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
              { label: 'Class', value: 'class' },
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
        <FilterField label="Collection window">
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
        KPIs and aging are AY-bounded ({ayLabel}). Day-by-day collection is calendar-windowed and may include payments against past-AY invoices when the window crosses AYs.
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
