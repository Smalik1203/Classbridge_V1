import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ArrowUpRight, RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  CalendarCheck, Wallet, ClipboardList, GraduationCap, ChevronRight, Activity,
} from 'lucide-react';
import { useAuth } from '@/AuthProvider';
import { supabase } from '@/config/supabaseClient';
import { getSchoolCode, getUserRole, getStudentCode, getSchoolName } from '@/shared/utils/metadata';
import attendanceSvc from '@/features/analytics/services/attendanceAnalyticsService';
import feesSvc from '@/features/analytics/services/feesAnalyticsService';
import tasksSvc from '@/features/analytics/services/tasksAnalyticsService';

// ───────────────────────────────────────────────────────────────────────────
// Visual language: matches AnalyticsShell — gradient page bg fading to white,
// soft 1px indigo-tinted borders, no shadows. Accent palette is shared with
// the analytics SECTIONS map so the two surfaces feel like one product.
// ───────────────────────────────────────────────────────────────────────────
const ACCENT = {
  attendance: '#10b981',
  fees:       '#f59e0b',
  tasks:      '#3b82f6',
  academic:   '#ef4444',
  primary:    '#6366F1',
};

const PANEL = {
  background: '#ffffff',
  border: '1px solid #eef2ff',
  borderRadius: 14,
};

const formatINR = (paise) => {
  const rupees = Number(paise || 0) / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(2)}L`;
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
};

const formatINRPlain = (rupees) => {
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(2)}L`;
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${Math.round(rupees)}`;
};

// Donut ring used in the Today hero — single-arc SVG so we don't pull
// recharts onto the dashboard for one shape.
const Ring = ({ value, size = 132, stroke = 12, color = ACCENT.attendance }) => {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2ff" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.26} fontWeight={700} fill="#0f172a" letterSpacing="-0.02em"
      >{Math.round(v)}%</text>
    </svg>
  );
};

// Tiny inline-SVG sparkline. Keeps the dashboard light and avoids the
// generic Statistic-card-with-trend-arrow look.
const Sparkline = ({ values, color = ACCENT.primary, height = 36, width = 140, fill = true }) => {
  if (!values || values.length < 2) {
    return <div style={{ height, width, color: '#cbd5e1', fontSize: 11 }}>—</div>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const path = `M ${pts.join(' L ')}`;
  const area = `${path} L ${width.toFixed(1)},${(height - 2).toFixed(1)} L 0,${(height - 2).toFixed(1)} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} fillOpacity={0.12} />}
      <path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const SectionTitle = ({ children, subtitle, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
    <div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{children}</h2>
      {subtitle && <div style={{ marginTop: 2, fontSize: 12, color: '#94a3b8' }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

// ───────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const channelRef = useRef(null);
  const debounceRef = useRef(null);

  const userName  = user?.user_metadata?.full_name || 'there';
  const role      = getUserRole(user) || 'user';
  const schoolCode = getSchoolCode(user);
  const studentCode = getStudentCode(user);
  const fallbackSchoolName = getSchoolName(user) || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolName, setSchoolName] = useState(fallbackSchoolName);
  const [activeAy, setActiveAy]     = useState(null); // { id, year_start, year_end }

  // Aggregate dashboard state — every key is wired to a real query.
  const [data, setData] = useState({
    attendanceToday:    { rate: 0, present: 0, absent: 0, marked: 0, students: 0 },
    attendanceWeek:     [], // [{date, rate}] for sparkline
    fees:               { collectionRate: 0, outstanding: 0, billed: 0, paid: 0, dueCount: 0 },
    feesWeek:           [], // [{date, amount}]
    tasks:              { completionRate: 0, overdueTasks: 0, missed: 0 },
    topAbsentees:       [],
    topDefaulters:      [],
    recentPayments:     [],
    recentEnquiries:    [],
    studentSelf:        null, // populated only for role=student
  });

  // Load active AY once school code is known.
  useEffect(() => {
    let cancelled = false;
    if (!schoolCode) return;
    (async () => {
      const { data: rows } = await supabase
        .from('academic_years')
        .select('id, year_start, year_end, start_date, end_date, is_active')
        .eq('school_code', schoolCode)
        .order('year_start', { ascending: false });
      if (cancelled) return;
      const list = rows || [];
      setActiveAy(list.find((y) => y.is_active) || list[0] || null);

      const { data: schoolRow } = await supabase
        .from('schools').select('school_name').eq('school_code', schoolCode).maybeSingle();
      if (!cancelled && schoolRow?.school_name) setSchoolName(schoolRow.school_name);
    })();
    return () => { cancelled = true; };
  }, [schoolCode]);

  const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const loadAdminAndSuperadmin = useCallback(async (ayId) => {
    const today = todayIST();
    const weekStart = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD');

    // For class-teacher admins, scope the attention lists to their classes.
    let classScope = null;
    if (role === 'admin') {
      const { data: classes } = await supabase
        .from('class_instances')
        .select('id')
        .eq('class_teacher_id', user.id)
        .eq('school_code', schoolCode)
        .eq('academic_year_id', ayId);
      const ids = (classes || []).map((c) => c.id);
      classScope = ids.length === 1 ? ids[0] : (ids.length > 1 ? null : '__none__');
    }

    const [
      attToday,
      attWeek,
      feesKpi,
      feesWeek,
      tasksKpi,
      absentees,
      defaulters,
      payments,
      enquiries,
    ] = await Promise.all([
      attendanceSvc.getHeadlineKpis({
        schoolCode, ayId, classInstanceId: classScope,
        startDate: today, endDate: today,
      }),
      attendanceSvc.getDailyAttendanceTrend({
        schoolCode, ayId, classInstanceId: classScope,
        startDate: weekStart, endDate: today,
      }),
      feesSvc.getHeadlineKpis({ schoolCode, ayId, classInstanceId: classScope }),
      feesSvc.getDailyCollection({
        schoolCode, ayId, classInstanceId: classScope,
        startDate: weekStart, endDate: today,
      }),
      tasksSvc.getHeadlineKpis({ schoolCode, ayId, classInstanceId: classScope }),
      attendanceSvc.getTopAbsentees({
        schoolCode, ayId, classInstanceId: classScope,
        startDate: weekStart, endDate: today, limit: 5,
      }),
      feesSvc.getTopDefaulters({ schoolCode, ayId, classInstanceId: classScope, limit: 5 }),
      // Recent fee payments — last ~10, joined to invoice → student.
      supabase
        .from('fee_payments')
        .select('id, amount_inr, payment_date, payment_method, fee_invoices!inner(student_id, school_code, student:student_id(full_name))')
        .eq('fee_invoices.school_code', schoolCode)
        .order('payment_date', { ascending: false })
        .limit(6),
      // Recent admission enquiries — fresh leads.
      supabase
        .from('admission_enquiries')
        .select('id, student_name, grade, created_at, status')
        .eq('school_code', schoolCode)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    return {
      attendanceToday: {
        rate: Number(attToday?.rate || 0),
        present: Number(attToday?.presentDays || 0),
        absent: Number(attToday?.absentDays || 0),
        marked: Number(attToday?.totalMarked || 0),
        students: Number(attToday?.distinctStudents || 0),
      },
      attendanceWeek: (attWeek || []).map((d) => ({ date: d.date, rate: Number(d.rate || 0) })),
      fees: {
        collectionRate: Number(feesKpi?.collectionRate || 0),
        outstanding:    Number(feesKpi?.totalOutstanding || 0),
        billed:         Number(feesKpi?.totalBilled || 0),
        paid:           Number(feesKpi?.totalPaid || 0),
        dueCount:       Number(feesKpi?.dueCount || 0) + Number(feesKpi?.partialCount || 0),
      },
      feesWeek: (feesWeek || []).map((d) => ({ date: d.date, amount: Number(d.amount || 0) })),
      tasks: {
        completionRate: Number(tasksKpi?.completionRate || 0),
        overdueTasks:   Number(tasksKpi?.overdueTaskCount || 0),
        missed:         Number(tasksKpi?.missedCount || 0),
      },
      topAbsentees: absentees || [],
      topDefaulters: defaulters || [],
      recentPayments: (payments?.data || []).map((p) => ({
        id: p.id,
        amount: Number(p.amount_inr || 0), // already in rupees per feesService usage
        when: p.payment_date,
        method: p.payment_method || 'cash',
        studentName: p.fee_invoices?.student?.full_name || 'Student',
      })),
      recentEnquiries: (enquiries?.data || []).map((e) => ({
        id: e.id,
        name: e.student_name,
        grade: e.grade,
        when: e.created_at,
        status: e.status,
      })),
      studentSelf: null,
    };
  }, [role, schoolCode, user]);

  const loadStudent = useCallback(async (ayId) => {
    const today = todayIST();
    const weekStart = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD');

    // Resolve the student row.
    let { data: stu } = await supabase
      .from('student')
      .select('id, class_instance_id, full_name')
      .eq('auth_user_id', user.id)
      .eq('school_code', schoolCode)
      .maybeSingle();
    if (!stu && studentCode) {
      const r = await supabase.from('student')
        .select('id, class_instance_id, full_name')
        .eq('student_code', studentCode).eq('school_code', schoolCode).maybeSingle();
      stu = r.data;
    }
    if (!stu && user?.email) {
      const r = await supabase.from('student')
        .select('id, class_instance_id, full_name')
        .eq('email', user.email).eq('school_code', schoolCode).maybeSingle();
      stu = r.data;
    }
    if (!stu) return null;

    const [attKpi, attTrend, feesSummary, upcomingTests, todayClasses] = await Promise.all([
      attendanceSvc.getHeadlineKpis({ schoolCode, ayId, studentId: stu.id }),
      attendanceSvc.getDailyAttendanceTrend({ schoolCode, ayId, studentId: stu.id, startDate: weekStart, endDate: today }),
      supabase.rpc('fees_student_summary', { p_school_code: schoolCode, p_student_id: stu.id }),
      supabase.from('tests').select('id', { count: 'exact', head: true })
        .eq('class_instance_id', stu.class_instance_id).gte('test_date', today),
      supabase.from('timetable_slots').select('id', { count: 'exact', head: true })
        .eq('class_instance_id', stu.class_instance_id).eq('date', today),
    ]);
    const planned = feesSummary?.data?.[0]?.total_planned ?? 0;
    const paid    = feesSummary?.data?.[0]?.total_paid ?? 0;
    return {
      student: stu,
      attRate: Number(attKpi?.rate || 0),
      attendanceWeek: (attTrend || []).map((d) => ({ date: d.date, rate: Number(d.rate || 0) })),
      pendingFees: Math.max(0, (planned - paid) / 100),
      upcomingTests: upcomingTests.count || 0,
      todayClasses: todayClasses.count || 0,
    };
  }, [schoolCode, studentCode, user]);

  const refresh = useCallback(async () => {
    if (!schoolCode || !activeAy?.id) { setLoading(false); return; }
    setRefreshing(true);
    try {
      if (role === 'student') {
        const self = await loadStudent(activeAy.id);
        setData((d) => ({ ...d, studentSelf: self }));
      } else {
        const next = await loadAdminAndSuperadmin(activeAy.id);
        setData((d) => ({ ...d, ...next }));
      }
    } catch {
      /* keep last good state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolCode, activeAy, role, loadAdminAndSuperadmin, loadStudent]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: debounce reloads on writes to the tables this dashboard reads.
  useEffect(() => {
    if (!schoolCode) return;
    const ch = supabase.channel(`dash:${schoolCode}`);
    const bump = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refresh, 1500);
    };
    ['attendance', 'fee_payments', 'fee_invoices', 'admission_enquiries'].forEach((t) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `school_code=eq.${schoolCode}` }, bump);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [schoolCode, refresh]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const ayLabel = activeAy ? `${activeAy.year_start}-${String(activeAy.year_end).slice(-2)}` : '—';
  const todayLong = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'short',
  });

  // ─── render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: '20px 24px 32px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 320px)',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Page header (matches AnalyticsShell) ───────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
          background: '#fff', border: '1px solid #eef2ff', borderRadius: 14,
          padding: '12px 16px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${ACCENT.primary}15`, color: ACCENT.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Activity size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {greeting}, {userName.split(' ')[0]}
                </h1>
                {activeAy && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: ACCENT.primary,
                    background: `${ACCENT.primary}15`, padding: '2px 8px', borderRadius: 999,
                  }}>AY {ayLabel}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {schoolName ? `${schoolName} · ${todayLong}` : todayLong}
              </div>
            </div>
          </div>
          <button onClick={refresh} disabled={refreshing} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', height: 32, borderRadius: 8,
            border: '1px solid #e2e8f0', background: '#fff',
            color: '#475569', fontSize: 12, fontWeight: 500,
            cursor: refreshing ? 'wait' : 'pointer',
          }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {loading ? (
          <SkeletonBody />
        ) : role === 'student' ? (
          <StudentView self={data.studentSelf} navigate={navigate} userName={userName} />
        ) : (
          <AdminView data={data} navigate={navigate} role={role} />
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Admin / superadmin view
// ───────────────────────────────────────────────────────────────────────────
function AdminView({ data, navigate, role }) {
  const { attendanceToday, attendanceWeek, fees, feesWeek, tasks, topAbsentees, topDefaulters, recentPayments, recentEnquiries } = data;
  const todayCollected = feesWeek.length ? feesWeek[feesWeek.length - 1].amount : 0;
  const yesterdayCollected = feesWeek.length > 1 ? feesWeek[feesWeek.length - 2].amount : 0;
  const collectionDelta = todayCollected - yesterdayCollected;

  return (
    <>
      {/* ── HERO: Today strip ──────────────────────────────────────────── */}
      <div style={{
        ...PANEL,
        padding: 24, marginBottom: 16,
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Ring value={attendanceToday.rate} color={ACCENT.attendance} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Today's attendance
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <HeroStat
              label="Marked today"
              value={attendanceToday.marked.toLocaleString('en-IN')}
              hint={attendanceToday.students ? `${attendanceToday.present} present · ${attendanceToday.absent} absent` : 'No attendance marked yet'}
              color={ACCENT.attendance}
              onClick={() => navigate('/attendance')}
            />
            <HeroStat
              label="Collected this week"
              value={formatINRPlain(feesWeek.reduce((s, d) => s + d.amount, 0))}
              hint={collectionDelta === 0 ? 'No change vs yesterday' :
                collectionDelta > 0 ? `+${formatINRPlain(collectionDelta)} vs yesterday` :
                `${formatINRPlain(collectionDelta)} vs yesterday`}
              hintIcon={collectionDelta >= 0 ? TrendingUp : TrendingDown}
              hintColor={collectionDelta >= 0 ? ACCENT.attendance : ACCENT.academic}
              color={ACCENT.fees}
              onClick={() => navigate('/fees')}
            />
            <HeroStat
              label="Outstanding fees"
              value={formatINRPlain(fees.outstanding / 100)}
              hint={`${fees.dueCount} invoice${fees.dueCount === 1 ? '' : 's'} unpaid`}
              color={ACCENT.academic}
              onClick={() => navigate('/analytics/fees')}
            />
            <HeroStat
              label="Task completion"
              value={`${Math.round(tasks.completionRate)}%`}
              hint={tasks.overdueTasks > 0 ? `${tasks.overdueTasks} overdue` : 'All current'}
              color={ACCENT.tasks}
              onClick={() => navigate('/analytics/tasks')}
            />
          </div>
        </div>
      </div>

      {/* ── Two-column: trends + attention ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>

        <div style={{ ...PANEL, padding: 20 }}>
          <SectionTitle subtitle="Last 7 days · live"
            action={<button onClick={() => navigate('/analytics')} style={linkBtn}>Open analytics <ArrowUpRight size={12} /></button>}
          >
            This week
          </SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TrendBlock
              title="Attendance rate"
              value={`${Math.round(attendanceWeek.length ? attendanceWeek[attendanceWeek.length - 1].rate : 0)}%`}
              series={attendanceWeek.map((d) => d.rate)}
              color={ACCENT.attendance}
            />
            <TrendBlock
              title="Fee collection"
              value={formatINRPlain(feesWeek.reduce((s, d) => s + d.amount, 0))}
              series={feesWeek.map((d) => d.amount)}
              color={ACCENT.fees}
            />
          </div>
        </div>

        <div style={{ ...PANEL, padding: 20 }}>
          <SectionTitle subtitle="What needs you today">
            Needs your attention
          </SectionTitle>
          <AttentionList absentees={topAbsentees} defaulters={topDefaulters} navigate={navigate} tasks={tasks} />
        </div>
      </div>

      {/* ── Two-column: recent activity + quick actions ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
        <div style={{ ...PANEL, padding: 20 }}>
          <SectionTitle subtitle="Latest payments and enquiries">Recent activity</SectionTitle>
          <RecentActivity payments={recentPayments} enquiries={recentEnquiries} navigate={navigate} />
        </div>
        <div style={{ ...PANEL, padding: 20 }}>
          <SectionTitle subtitle="Jump back into work">Continue</SectionTitle>
          <ContextActions role={role} navigate={navigate} />
        </div>
      </div>
    </>
  );
}

const linkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#fff', color: '#475569', fontSize: 11, fontWeight: 500, cursor: 'pointer',
};

function HeroStat({ label, value, hint, hintIcon: HintIcon, hintColor, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      cursor: 'pointer', padding: '12px 14px', borderRadius: 10,
      transition: 'background 0.15s ease',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: hintColor || '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {HintIcon && <HintIcon size={11} />}
        {hint}
      </div>
    </div>
  );
}

function TrendBlock({ title, value, series, color }) {
  return (
    <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{value}</div>
        <Sparkline values={series} color={color} width={120} height={36} />
      </div>
    </div>
  );
}

function AttentionList({ absentees, defaulters, tasks, navigate }) {
  const items = [];

  if (absentees && absentees.length) {
    const top = absentees[0];
    items.push({
      kind: 'attendance',
      color: ACCENT.attendance,
      title: `${absentees.length} student${absentees.length === 1 ? '' : 's'} with frequent absences`,
      detail: `Top: ${top.name} · ${top.absences} absence${top.absences === 1 ? '' : 's'} this week`,
      onClick: () => navigate('/analytics/attendance'),
    });
  }
  if (defaulters && defaulters.length) {
    const top = defaulters[0];
    const totalOut = defaulters.reduce((s, d) => s + (d.outstanding || 0), 0);
    items.push({
      kind: 'fees',
      color: ACCENT.fees,
      title: `${formatINRPlain(totalOut / 100)} overdue across ${defaulters.length} famil${defaulters.length === 1 ? 'y' : 'ies'}`,
      detail: `Top: ${top.name} · ${formatINRPlain(top.outstanding / 100)} (${top.oldestDueDays}d old)`,
      onClick: () => navigate('/analytics/fees'),
    });
  }
  if (tasks?.overdueTasks > 0) {
    items.push({
      kind: 'tasks',
      color: ACCENT.tasks,
      title: `${tasks.overdueTasks} task${tasks.overdueTasks === 1 ? '' : 's'} past due`,
      detail: tasks.missed > 0 ? `${tasks.missed} missed submission${tasks.missed === 1 ? '' : 's'}` : 'No submissions yet',
      onClick: () => navigate('/analytics/tasks'),
    });
  }

  if (!items.length) {
    return (
      <div style={{
        padding: '24px 16px', textAlign: 'center', color: '#94a3b8',
        background: '#f8fafc', borderRadius: 10, fontSize: 13,
      }}>
        Nothing flagged. Everything is on track.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <button key={i} onClick={it.onClick} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '10px 12px', borderRadius: 10, border: '1px solid #f1f5f9',
          background: '#fff', cursor: 'pointer', textAlign: 'left',
          transition: 'border-color 0.15s, background 0.15s',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = it.color + '55'; e.currentTarget.style.background = it.color + '08'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.background = '#fff'; }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: it.color + '18', color: it.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>{it.title}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.detail}</div>
          </div>
          <ChevronRight size={14} color="#cbd5e1" style={{ marginTop: 8, flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}

function RecentActivity({ payments, enquiries, navigate }) {
  // Merge payments + enquiries into a single descending feed.
  const feed = [
    ...payments.map((p) => ({
      kind: 'payment',
      when: p.when,
      title: `${p.studentName} paid ${formatINRPlain(p.amount)}`,
      hint: p.method?.replace('_', ' '),
      color: ACCENT.fees,
      icon: Wallet,
      onClick: () => navigate('/fees'),
    })),
    ...enquiries.map((e) => ({
      kind: 'enquiry',
      when: e.when,
      title: `New enquiry: ${e.name}`,
      hint: [e.grade && `Grade ${e.grade}`, e.status].filter(Boolean).join(' · '),
      color: ACCENT.primary,
      icon: GraduationCap,
      onClick: () => navigate('/admissions'),
    })),
  ].sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0)).slice(0, 8);

  if (!feed.length) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10, fontSize: 13 }}>
        No recent activity yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {feed.map((it, i) => (
        <button key={i} onClick={it.onClick} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent',
          cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.12s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: it.color + '15', color: it.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <it.icon size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
            {it.hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, textTransform: 'capitalize' }}>{it.hint}</div>}
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0 }}>{relTime(it.when)}</div>
        </button>
      ))}
    </div>
  );
}

function relTime(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  const now = dayjs();
  const mins = now.diff(d, 'minute');
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = now.diff(d, 'hour');
  if (hrs < 24) return `${hrs}h`;
  const days = now.diff(d, 'day');
  if (days < 7) return `${days}d`;
  return d.format('DD MMM');
}

function ContextActions({ role, navigate }) {
  const actions = role === 'cb_admin' ? [
    { label: 'Schools', desc: 'Manage tenant schools', path: '/cb-admin-dashboard', color: ACCENT.primary, icon: GraduationCap },
    { label: 'Add school', desc: 'Onboard a new school', path: '/add-schools', color: ACCENT.tasks, icon: GraduationCap },
  ] : role === 'admin' ? [
    { label: 'Mark attendance', desc: 'Today’s register', path: '/attendance', color: ACCENT.attendance, icon: CalendarCheck },
    { label: 'Collect fees', desc: 'Record payment', path: '/fees', color: ACCENT.fees, icon: Wallet },
    { label: 'Tests', desc: 'Create or grade', path: '/tests', color: ACCENT.tasks, icon: ClipboardList },
    { label: 'Analytics', desc: 'Drill into reports', path: '/analytics', color: ACCENT.primary, icon: Activity },
  ] : [
    { label: 'Attendance', desc: 'School-wide register', path: '/attendance', color: ACCENT.attendance, icon: CalendarCheck },
    { label: 'Fees', desc: 'Invoices & payments', path: '/fees', color: ACCENT.fees, icon: Wallet },
    { label: 'Admissions', desc: 'Enquiries & intake', path: '/admissions', color: ACCENT.primary, icon: GraduationCap },
    { label: 'Analytics', desc: 'Cross-domain insights', path: '/analytics', color: ACCENT.tasks, icon: Activity },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {actions.map((a, i) => (
        <button key={i} onClick={() => navigate(a.path)} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 10, border: '1px solid #f1f5f9',
          background: '#fff', cursor: 'pointer', textAlign: 'left',
          transition: 'all 0.15s',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.color + '55'; e.currentTarget.style.transform = 'translateX(2px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: a.color + '15', color: a.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <a.icon size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.label}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.desc}</div>
          </div>
          <ChevronRight size={14} color="#cbd5e1" />
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Student view — personal version with same visual language.
// ───────────────────────────────────────────────────────────────────────────
function StudentView({ self, navigate, userName }) {
  if (!self) {
    return (
      <div style={{ ...PANEL, padding: 32, textAlign: 'center', color: '#64748b' }}>
        Your student profile isn't linked yet. Ask your school admin to attach your account.
      </div>
    );
  }
  return (
    <>
      <div style={{ ...PANEL, padding: 24, marginBottom: 16,
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Ring value={self.attRate} color={ACCENT.attendance} />
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              My attendance
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <HeroStat
              label="Pending fees"
              value={formatINRPlain(self.pendingFees)}
              hint={self.pendingFees > 0 ? 'Tap to view' : 'All clear'}
              color={ACCENT.fees}
              onClick={() => navigate('/fees')}
            />
            <HeroStat
              label="Upcoming tests"
              value={String(self.upcomingTests)}
              hint={self.upcomingTests ? 'Prepare in advance' : 'No tests scheduled'}
              color={ACCENT.tasks}
              onClick={() => navigate('/take-tests')}
            />
            <HeroStat
              label="Today's classes"
              value={String(self.todayClasses)}
              hint={self.todayClasses ? 'Check timetable' : 'Free day'}
              color={ACCENT.primary}
              onClick={() => navigate('/timetable')}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
        <div style={{ ...PANEL, padding: 20 }}>
          <SectionTitle subtitle="Last 7 days">My attendance trend</SectionTitle>
          <TrendBlock
            title="Attendance rate"
            value={`${Math.round(self.attendanceWeek.length ? self.attendanceWeek[self.attendanceWeek.length - 1].rate : 0)}%`}
            series={self.attendanceWeek.map((d) => d.rate)}
            color={ACCENT.attendance}
          />
        </div>
        <div style={{ ...PANEL, padding: 20 }}>
          <SectionTitle subtitle="Continue learning">Next steps</SectionTitle>
          <ContextActions role="student" navigate={navigate} />
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
function SkeletonBody() {
  const block = { ...PANEL, height: 140, marginBottom: 16, background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%)', backgroundSize: '200% 100%', animation: 'sh 1.4s linear infinite' };
  return (
    <>
      <div style={{ ...block, height: 200 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={block} />
        <div style={block} />
      </div>
      <style>{`@keyframes sh { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </>
  );
}
