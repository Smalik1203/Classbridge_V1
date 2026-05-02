import React, { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Select, Space, Table, Tag, Empty, Spin, Segmented, Typography,
  Progress,
} from 'antd';
import dayjs from 'dayjs';
import {
  BookOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { supabase } from '@/config/supabaseClient';
import { useAcademicYear } from '../context/AcademicYearContext';
import { listClasses } from '../services/analyticsService';
import syllabusSvc from '../services/syllabusAnalyticsService';
import {
  HeroStat, Sparkbar, StatTile, SectionCard, DailyBars,
} from '../components/primitives';

const { Text } = Typography;

export default function SyllabusAnalytics() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { selectedAyId, selectedYear, formatYearLabel } = useAcademicYear();

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classInstanceId, setClassInstanceId] = useState('all');
  const [subjectId, setSubjectId] = useState('all');
  const [scope, setScope] = useState('school');
  const [granularity, setGranularity] = useState('day');
  const [showTrendLine, setShowTrendLine] = useState(true);

  const [kpis, setKpis] = useState(null);
  const [daily, setDaily] = useState([]);
  const [perClass, setPerClass] = useState([]);
  const [perSubject, setPerSubject] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load classes for the AY.
  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    let cancelled = false;
    listClasses(schoolCode, selectedAyId).then((rows) => {
      if (cancelled) return;
      setClasses(rows);
      setClassInstanceId('all');
      setSubjectId('all');
    }).catch(() => { if (!cancelled) setClasses([]); });
    return () => { cancelled = true; };
  }, [schoolCode, selectedAyId]);

  // Load subjects (school-wide) — actual column is subject_name.
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

  // Reset class on scope change to school.
  useEffect(() => {
    if (scope === 'school') {
      setClassInstanceId('all');
    } else if (scope === 'class' && classInstanceId === 'all' && classes.length > 0) {
      setClassInstanceId(classes[0].id);
    }
  }, [scope, classes]); // eslint-disable-line react-hooks/exhaustive-deps

  const queryParams = useMemo(() => ({
    schoolCode,
    ayId: selectedAyId,
    classInstanceId: scope === 'school' ? null : classInstanceId,
    subjectId: subjectId === 'all' ? null : subjectId,
  }), [schoolCode, selectedAyId, scope, classInstanceId, subjectId]);

  // Calendar window for trend.
  const trendWindow = useMemo(() => {
    const today = dayjs();
    const ayEnd = selectedYear?.end_date ? dayjs(selectedYear.end_date) : null;
    const anchor = ayEnd && today.isAfter(ayEnd) ? ayEnd : today;
    if (granularity === 'day')   return { start: anchor.subtract(29, 'day').format('YYYY-MM-DD'),  end: anchor.format('YYYY-MM-DD'), anchor };
    if (granularity === 'week')  return { start: anchor.subtract(3, 'week').startOf('week').format('YYYY-MM-DD'), end: anchor.endOf('week').format('YYYY-MM-DD'), anchor };
    return { start: anchor.subtract(11, 'month').startOf('month').format('YYYY-MM-DD'), end: anchor.endOf('month').format('YYYY-MM-DD'), anchor };
  }, [granularity, selectedYear]);

  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    setLoading(true);
    Promise.all([
      syllabusSvc.getHeadlineKpis(queryParams),
      syllabusSvc.getDailyProgress({
        ...queryParams,
        startDate: trendWindow.start,
        endDate: trendWindow.end,
      }),
      scope === 'school'
        ? syllabusSvc.getPerClassSummary(queryParams)
        : Promise.resolve([]),
      syllabusSvc.getPerSubjectSummary(queryParams),
      scope === 'class' && classInstanceId !== 'all'
        ? syllabusSvc.getChapterBreakdown(queryParams)
        : Promise.resolve([]),
      syllabusSvc.getAtRiskSubjects(queryParams),
    ]).then(([k, d, pc, ps, ch, risk]) => {
      setKpis(k); setDaily(d); setPerClass(pc); setPerSubject(ps);
      setChapters(ch); setAtRisk(risk);
    }).catch((e) => console.error('syllabus analytics load error', e))
      .finally(() => setLoading(false));
  }, [queryParams, scope, classInstanceId, schoolCode, selectedAyId, trendWindow]);

  if (!selectedAyId) {
    return <SectionCard><Empty description="No academic year selected." /></SectionCard>;
  }

  const ayLabel = selectedYear ? formatYearLabel(selectedYear) : '';
  const noClassPicked = scope === 'class' && (classInstanceId === 'all' || !classInstanceId);
  const noClassesInAy = scope === 'class' && classes.length === 0;
  const selectedClass = classes.find((c) => c.id === classInstanceId);
  const scopeLabel = scope === 'class' && selectedClass ? selectedClass.label : 'School-wide';
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const last7 = daily.slice(-7);

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>

        <FilterBar
          scope={scope} setScope={setScope}
          classes={classes} classInstanceId={classInstanceId} setClassInstanceId={setClassInstanceId}
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
          <SectionCard><Empty description="Pick a class to see chapter-level progress." /></SectionCard>
        )}

        {!noClassesInAy && !noClassPicked && (
        <>
        {/* HERO */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <HeroStat
              gradient={
                kpis?.overallPct >= 75 ? 'emerald' :
                kpis?.overallPct >= 40 ? 'brand' : 'rose'
              }
              eyebrow={`${scopeLabel}${selectedSubject ? ` · ${selectedSubject.name}` : ''} · AY ${ayLabel}`}
              value={kpis ? Number(kpis.overallPct).toFixed(1) : '—'}
              suffix="%"
              label={
                kpis
                  ? `${fmtNum(kpis.completedTopics)} of ${fmtNum(kpis.totalTopics)} topics taught`
                  : 'No syllabus data yet'
              }
              delta={
                kpis?.subjectCount
                  ? { value: `${kpis.subjectCount} subject${kpis.subjectCount === 1 ? '' : 's'} · ${kpis.classCount} class${kpis.classCount === 1 ? '' : 'es'}` }
                  : null
              }
              height={200}
              foot={
                last7.length > 0 ? (
                  <Sparkbar
                    values={last7.map((d) => ({
                      label: dayjs(d.date).format('dd')[0],
                      value: d.topicCount,
                      noData: d.noData,
                    }))}
                    max={Math.max(1, ...last7.map((d) => d.topicCount))}
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
                  label="Chapters"
                  value={`${fmtNum(kpis?.completedChapters ?? 0)} / ${fmtNum(kpis?.totalChapters ?? 0)}`}
                  accent="#10b981"
                  icon={<BookOutlined />}
                  foot={<Foot>{kpis ? `${kpis.chapterPct}% completed` : '—'}</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="Topics taught"
                  value={fmtNum(kpis?.completedTopics ?? 0)}
                  accent="#6366F1"
                  icon={<CheckCircleOutlined />}
                  foot={<Foot>of {fmtNum(kpis?.totalTopics ?? 0)} total</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="On-track subjects"
                  value={fmtNum(kpis?.onTrackSubjects ?? 0)}
                  accent="#0ea5e9"
                  foot={<Foot>≥60% completion</Foot>}
                />
              </Col>
              <Col xs={12}>
                <StatTile
                  label="At-risk subjects"
                  value={fmtNum(kpis?.atRiskSubjects ?? 0)}
                  accent="#ef4444"
                  icon={<WarningOutlined />}
                  foot={<Foot>&lt;30% completion</Foot>}
                />
              </Col>
            </Row>
          </Col>
        </Row>

        {/* DAILY PROGRESS TREND */}
        {(() => {
          const totalTopics = daily.reduce((a, b) => a + b.topicCount, 0);
          const windowLabel =
            granularity === 'day'   ? 'Last 30 days' :
            granularity === 'week'  ? 'Last 4 weeks' :
                                      'Last 12 months';
          const hint = [
            scopeLabel,
            windowLabel,
            totalTopics > 0 ? `${fmtNum(totalTopics)} topics taught` : 'no activity in window',
          ].join(' · ');
          return (
            <SectionCard
              title="Day-by-day teaching"
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
                  data={daily.map((d) => ({ ...d, rate: d.topicCount }))}
                  dateKey="date"
                  valueKey="rate"
                  valueFormat={(v) => `${fmtNum(v)} topic${v === 1 ? '' : 's'}`}
                  height={260}
                  groupBy={granularity}
                  windowDays={30}
                  windowWeeks={4}
                  windowMonths={12}
                  windowAnchor={trendWindow.anchor.format('YYYY-MM-DD')}
                  showTrendLine={showTrendLine}
                  trendColor="#06b6d4"
                  detailRender={(d) => d.noData
                    ? 'No teaching marked'
                    : `${d.topicCount} topic${d.topicCount === 1 ? '' : 's'} · ${d.chapterCount} chapter${d.chapterCount === 1 ? '' : 's'}`}
                />
              )}
            </SectionCard>
          );
        })()}

        {/* PER-CLASS (school) OR CHAPTER LIST (class)  +  PER-SUBJECT */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            {scope === 'school' ? (
              <SectionCard
                title="Per-class completion"
                hint={`${perClass.length} classes · sorted by completion`}
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
                        cursor={{ fill: 'rgba(16,185,129,0.06)' }}
                        formatter={(v, _n, p) => [
                          `${v}%`,
                          `${p.payload.completedTopics} of ${p.payload.totalTopics} topics · ${p.payload.subjectCount} subjects`,
                        ]}
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                      />
                      <Bar dataKey="pct" radius={[0, 8, 8, 0]} barSize={16}>
                        {perClass.map((c, i) => (
                          <Cell key={i} fill={pctColor(c.pct)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            ) : (
              <SectionCard
                title={`Chapter breakdown · ${scopeLabel}`}
                hint={selectedSubject ? selectedSubject.name : 'All subjects'}
                accent="#6366F1"
              >
                <ChapterTable rows={chapters} />
              </SectionCard>
            )}
          </Col>

          <Col xs={24} md={10}>
            <SectionCard
              title="Per-subject completion"
              hint={`${perSubject.length} subject${perSubject.length === 1 ? '' : 's'}`}
              accent="#a855f7"
            >
              {perSubject.length === 0 ? <Empty /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {perSubject.map((s) => (
                    <ProgressRow
                      key={s.subjectId}
                      label={s.subjectName}
                      pct={s.pct}
                      detail={`${s.completedTopics} of ${s.totalTopics} topics · ${s.classCount} class${s.classCount === 1 ? '' : 'es'}`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </Col>
        </Row>

        {/* AT-RISK SUBJECTS + RECENCY SNAPSHOT */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <SectionCard
              title="Subjects needing attention"
              hint={`${atRisk.length} flagged · low completion or no recent activity`}
              accent="#ef4444"
            >
              <AtRiskTable rows={atRisk} />
            </SectionCard>
          </Col>
          <Col xs={24} md={10}>
            <SectionCard
              title="Snapshot"
              hint={`As of ${dayjs().format('DD MMM YYYY')}`}
              accent="#0ea5e9"
            >
              <Snapshot kpis={kpis} />
            </SectionCard>
          </Col>
        </Row>
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
  if (pct >= 30) return '#f59e0b';
  return '#ef4444';
}

function ProgressRow({ label, pct, detail }) {
  const color = pctColor(pct);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 999,
          transition: 'width 0.4s ease',
        }} />
      </div>
      {detail && <div style={{ fontSize: 10, color: '#94a3b8' }}>{detail}</div>}
    </div>
  );
}

function ChapterTable({ rows }) {
  if (!rows || rows.length === 0) return <Empty description="No chapters defined for this scope." />;
  return (
    <Table
      size="small"
      dataSource={rows}
      rowKey="chapterId"
      pagination={{ pageSize: 8, simple: true }}
      columns={[
        {
          title: 'Chapter',
          dataIndex: 'title',
          render: (v, r) => (
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                {r.chapterNo ? `Ch ${r.chapterNo} · ` : ''}{v}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {r.completedTopics} of {r.totalTopics} topics
              </div>
            </div>
          ),
        },
        {
          title: 'Status',
          dataIndex: 'pct',
          width: 90,
          render: (v, r) => {
            if (r.totalTopics === 0 && r.chapterTaught) {
              return <Tag color="green" style={{ borderRadius: 999, margin: 0 }}>Taught</Tag>;
            }
            if (v >= 100) return <Tag color="green" style={{ borderRadius: 999, margin: 0 }}>Done</Tag>;
            if (v >= 60) return <Tag color="blue" style={{ borderRadius: 999, margin: 0 }}>On track</Tag>;
            if (v >= 30) return <Tag color="orange" style={{ borderRadius: 999, margin: 0 }}>Behind</Tag>;
            if (v > 0)   return <Tag color="red" style={{ borderRadius: 999, margin: 0 }}>Started</Tag>;
            return <Tag style={{ borderRadius: 999, margin: 0 }}>Not started</Tag>;
          },
        },
        {
          title: 'Progress',
          dataIndex: 'pct',
          width: 200,
          sorter: (a, b) => a.pct - b.pct,
          render: (v) => (
            <Progress
              percent={v}
              size="small"
              strokeColor={pctColor(v)}
              format={(p) => `${p}%`}
            />
          ),
        },
      ]}
    />
  );
}

function AtRiskTable({ rows }) {
  if (!rows || rows.length === 0) return <Empty description="Nothing flagged — every subject is moving." />;
  return (
    <Table
      size="small"
      dataSource={rows}
      rowKey={(r) => r.syllabusId}
      pagination={{ pageSize: 8, simple: true }}
      columns={[
        {
          title: 'Subject',
          dataIndex: 'subjectName',
          render: (v, r) => (
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{v}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.classLabel}</div>
            </div>
          ),
        },
        {
          title: 'Completion',
          dataIndex: 'pct',
          sorter: (a, b) => a.pct - b.pct,
          render: (v) => (
            <span style={{ fontWeight: 700, color: pctColor(v) }}>{v}%</span>
          ),
        },
        {
          title: 'Last taught',
          dataIndex: 'daysSinceLast',
          render: (v) => {
            if (v == null) return <span style={{ color: '#94a3b8' }}>Never</span>;
            const color = v > 30 ? '#dc2626' : v > 14 ? '#d97706' : '#0f172a';
            return (
              <span style={{ color, fontWeight: 600 }}>
                {v}d ago
              </span>
            );
          },
        },
        {
          title: 'Reason',
          dataIndex: 'reason',
          render: (v) => <Tag style={{ borderRadius: 999, margin: 0, fontSize: 10 }}>{v}</Tag>,
        },
      ]}
    />
  );
}

function Snapshot({ kpis }) {
  if (!kpis) return <Empty />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <SnapRow label="Overall completion" value={`${kpis.overallPct}%`} accent={pctColor(kpis.overallPct)} />
      <SnapRow label="Chapter completion" value={`${kpis.chapterPct}%`} accent={pctColor(kpis.chapterPct)} />
      <SnapRow label="Topics taught" value={fmtNum(kpis.completedTopics)} />
      <SnapRow label="Topics planned" value={fmtNum(kpis.totalTopics)} />
      <SnapRow label="Subjects covered" value={fmtNum(kpis.subjectCount)} />
      <SnapRow label="Classes tracked" value={fmtNum(kpis.classCount)} />
      <div style={{ gridColumn: '1 / span 2', marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined />
          {kpis.lastTaughtAt
            ? `Last marked taught ${dayjs(kpis.lastTaughtAt).fromNow ? dayjs(kpis.lastTaughtAt).format('DD MMM YYYY · HH:mm') : kpis.lastTaughtAt}`
            : 'No teaching marked yet for this AY.'}
        </Text>
      </div>
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

function FilterBar({
  scope, setScope, classes, classInstanceId, setClassInstanceId,
  subjects, subjectId, setSubjectId, ayLabel,
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
        Topic and chapter completion are AY-bounded ({ayLabel}). Day-by-day teaching is calendar-windowed.
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
