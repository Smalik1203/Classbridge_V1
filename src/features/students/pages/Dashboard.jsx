/**
 * Dashboard — admin / superadmin / student daily snapshot.
 *
 * Visual layer is rebuilt on shadcn primitives (Button, Card, KPI, Badge,
 * Tabs, etc.). All data fetching, realtime channels, role logic, and KPI
 * math is unchanged from the previous version.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ArrowUpRight, RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  CalendarCheck, Wallet, ClipboardList, GraduationCap, ChevronRight,
  Activity, Users, FileText, Clock, BookOpen,
} from 'lucide-react';

import { useAuth } from '@/AuthProvider';
import { supabase } from '@/config/supabaseClient';
import {
  getSchoolCode, getUserRole, getStudentCode, getSchoolName,
} from '@/shared/utils/metadata';
import attendanceSvc from '@/features/analytics/services/attendanceAnalyticsService';
import feesSvc from '@/features/analytics/services/feesAnalyticsService';
import tasksSvc from '@/features/analytics/services/tasksAnalyticsService';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Badge } from '@/shared/ui/Badge';

// ───────────────────────────────────────────────────────────────────────────
// Money / number formatters (kept identical to previous Dashboard)
// ───────────────────────────────────────────────────────────────────────────
function formatINRPlain(rupees) {
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(2)}L`;
  if (rupees >= 1_000)      return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${Math.round(rupees)}`;
}

// Single-arc donut for attendance ring.
function Ring({ value, size = 120, stroke = 10, color = 'var(--brand)' }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--bg-muted)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.24} fontWeight={600} fill="currentColor"
        letterSpacing="-0.02em" className="text-[color:var(--fg)]"
      >
        {Math.round(v)}%
      </text>
    </svg>
  );
}

// Inline-SVG sparkline.
function Sparkline({ values, color = 'var(--brand)', height = 36, width = 140 }) {
  if (!values || values.length < 2) {
    return <div style={{ height, width }} className="text-[color:var(--fg-faint)] text-[11px]">—</div>;
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
      <path d={area} fill={color} fillOpacity={0.10} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Dashboard
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
  const [activeAy, setActiveAy] = useState(null);

  // Class-teacher (role === 'admin') scope. Superadmin sees school-wide.
  // adminClasses = classes where this admin is class_teacher in the active AY.
  const [adminClasses, setAdminClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  const [data, setData] = useState({
    attendanceToday:    { rate: 0, present: 0, absent: 0, marked: 0, students: 0 },
    attendanceWeek:     [],
    fees:               { collectionRate: 0, outstanding: 0, billed: 0, paid: 0, dueCount: 0 },
    feesWeek:           [],
    tasks:              { completionRate: 0, overdueTasks: 0, missed: 0 },
    topAbsentees:       [],
    topDefaulters:      [],
    recentPayments:     [],
    recentEnquiries:    [],
    studentSelf:        null,
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

  // Fetch this admin's class-teacher assignments for the active AY. Superadmin
  // skips this — they always see school-wide. Sets adminClasses + default
  // selection. Re-runs when role/schoolCode/AY change.
  useEffect(() => {
    let cancelled = false;
    if (role !== 'admin' || !schoolCode || !activeAy?.id || !user?.id) {
      setAdminClasses([]);
      setSelectedClassId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('class_teacher_id', user.id)
        .eq('school_code', schoolCode)
        .eq('academic_year_id', activeAy.id)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });
      if (cancelled) return;
      const list = (data || []).map((c) => ({
        id: c.id,
        label: c.grade != null ? `Grade ${c.grade}${c.section ? ` ${c.section}` : ''}` : 'Class',
      }));
      setAdminClasses(list);
      setSelectedClassId(list[0]?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [role, schoolCode, activeAy?.id, user?.id]);

  const loadAdminAndSuperadmin = useCallback(async (ayId) => {
    const today = todayIST();
    const weekStart = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD');

    // Scope: superadmin → null (school-wide). Admin → their selected class.
    // If admin has zero assigned classes, skip RPCs entirely and return a
    // zeroed payload (avoids privilege-escalation to school-wide data and
    // avoids sending an invalid UUID sentinel to the RPCs).
    let classScope = null;
    if (role === 'admin') {
      if (adminClasses.length === 0) {
        return {
          attendanceToday: { rate: 0, present: 0, absent: 0, marked: 0, students: 0 },
          attendanceWeek:  [],
          fees:            { collectionRate: 0, outstanding: 0, billed: 0, paid: 0, dueCount: 0 },
          feesWeek:        [],
          tasks:           { completionRate: 0, overdueTasks: 0, missed: 0 },
          topAbsentees:    [],
          topDefaulters:   [],
          recentPayments:  [],
          recentEnquiries: [],
          studentSelf:     null,
        };
      }
      classScope = selectedClassId || adminClasses[0].id;
    }

    const [
      attToday, attWeek, feesKpi, feesWeek, tasksKpi,
      absentees, defaulters, payments, enquiries,
    ] = await Promise.all([
      attendanceSvc.getHeadlineKpis({ schoolCode, ayId, classInstanceId: classScope, startDate: today, endDate: today }),
      attendanceSvc.getDailyAttendanceTrend({ schoolCode, ayId, classInstanceId: classScope, startDate: weekStart, endDate: today }),
      feesSvc.getHeadlineKpis({ schoolCode, ayId, classInstanceId: classScope }),
      feesSvc.getDailyCollection({ schoolCode, ayId, classInstanceId: classScope, startDate: weekStart, endDate: today }),
      tasksSvc.getHeadlineKpis({ schoolCode, ayId, classInstanceId: classScope }),
      attendanceSvc.getTopAbsentees({ schoolCode, ayId, classInstanceId: classScope, startDate: weekStart, endDate: today, limit: 5 }),
      feesSvc.getTopDefaulters({ schoolCode, ayId, classInstanceId: classScope, limit: 5 }),
      supabase
        .from('fee_payments')
        .select('id, amount_inr, payment_date, payment_method, fee_invoices!inner(student_id, school_code, student:student_id(full_name))')
        .eq('fee_invoices.school_code', schoolCode)
        .order('payment_date', { ascending: false })
        .limit(6),
      // admission_enquiries has school_id (FK → schools.id), not school_code,
      // and uses class_applying_for instead of grade. Filter via the FK embed.
      supabase
        .from('admission_enquiries')
        .select('id, student_name, class_applying_for, created_at, status, schools!inner(school_code)')
        .eq('schools.school_code', schoolCode)
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
        amount: Number(p.amount_inr || 0),
        when: p.payment_date,
        method: p.payment_method || 'cash',
        studentName: p.fee_invoices?.student?.full_name || 'Student',
      })),
      recentEnquiries: (enquiries?.data || []).map((e) => ({
        id: e.id,
        name: e.student_name,
        grade: e.class_applying_for,
        when: e.created_at,
        status: e.status,
      })),
      studentSelf: null,
    };
  }, [role, schoolCode, user, adminClasses, selectedClassId]);

  const loadStudent = useCallback(async (ayId) => {
    const today = todayIST();
    const weekStart = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD');

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
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title={`${greeting}, ${userName.split(' ')[0]}`}
        subtitle={`${schoolName ? schoolName + ' · ' : ''}${todayLong}${activeAy ? ' · AY ' + ayLabel : ''}`}
        actions={
          <>
            {role === 'admin' && adminClasses.length > 1 && (
              <select
                value={selectedClassId || ''}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-8 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-2 text-[13px] text-[color:var(--fg)]"
                aria-label="Filter dashboard by class"
              >
                {adminClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : role === 'student' ? (
        <StudentView self={data.studentSelf} navigate={navigate} userName={userName} />
      ) : role === 'admin' && adminClasses.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-10 text-center">
          <p className="text-[color:var(--fg-muted)] text-[14px]">
            You're not assigned as class teacher for any class in this academic year. Ask your superadmin to assign you a class to see dashboard data.
          </p>
        </div>
      ) : (
        <AdminView data={data} navigate={navigate} role={role} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Admin view
// ───────────────────────────────────────────────────────────────────────────
function AdminView({ data, navigate }) {
  const {
    attendanceToday, attendanceWeek, fees, feesWeek, tasks,
    topAbsentees, topDefaulters, recentPayments, recentEnquiries,
  } = data;
  const todayCollected = feesWeek.length ? feesWeek[feesWeek.length - 1].amount : 0;
  const yesterdayCollected = feesWeek.length > 1 ? feesWeek[feesWeek.length - 2].amount : 0;
  const collectionDelta = todayCollected - yesterdayCollected;
  const weekTotal = feesWeek.reduce((s, d) => s + d.amount, 0);

  return (
    <>
      {/* ── Hero strip: ring + 4 KPIs ─────────────────────────────────── */}
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-7 items-center">
          {/* Attendance ring */}
          <div className="flex flex-col items-center gap-2">
            <Ring value={attendanceToday.rate} color="var(--brand)" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--fg-subtle)]">
              Today's attendance
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HeroStat
              label="Marked today"
              value={attendanceToday.marked.toLocaleString('en-IN')}
              hint={
                attendanceToday.students
                  ? `${attendanceToday.present} present · ${attendanceToday.absent} absent`
                  : 'No attendance marked yet'
              }
              dotColor="var(--brand)"
              onClick={() => navigate('/attendance')}
            />
            <HeroStat
              label="Collected this week"
              value={formatINRPlain(weekTotal)}
              hint={
                collectionDelta === 0 ? 'No change vs yesterday' :
                collectionDelta > 0 ? `+${formatINRPlain(collectionDelta)} vs yesterday` :
                `${formatINRPlain(collectionDelta)} vs yesterday`
              }
              hintIcon={collectionDelta >= 0 ? TrendingUp : TrendingDown}
              hintColor={collectionDelta >= 0 ? 'var(--success)' : 'var(--danger)'}
              dotColor="var(--success)"
              onClick={() => navigate('/fees')}
            />
            <HeroStat
              label="Outstanding fees"
              value={formatINRPlain(fees.outstanding / 100)}
              hint={`${fees.dueCount} invoice${fees.dueCount === 1 ? '' : 's'} unpaid`}
              dotColor="var(--warning)"
              onClick={() => navigate('/analytics/fees')}
            />
            <HeroStat
              label="Task completion"
              value={`${Math.round(tasks.completionRate)}%`}
              hint={tasks.overdueTasks > 0 ? `${tasks.overdueTasks} overdue` : 'All current'}
              dotColor="var(--info)"
              onClick={() => navigate('/analytics/tasks')}
            />
          </div>
        </div>
      </div>

      {/* ── Two-column: trends + attention ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 mb-4">
        <SectionCard
          title="This week"
          subtitle="Last 7 days · live"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
              Open analytics <ArrowUpRight size={12} />
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <TrendBlock
              title="Attendance rate"
              value={`${Math.round(attendanceWeek.length ? attendanceWeek[attendanceWeek.length - 1].rate : 0)}%`}
              series={attendanceWeek.map((d) => d.rate)}
              color="var(--success)"
            />
            <TrendBlock
              title="Fee collection"
              value={formatINRPlain(weekTotal)}
              series={feesWeek.map((d) => d.amount)}
              color="var(--brand)"
            />
          </div>
        </SectionCard>

        <SectionCard title="Needs your attention" subtitle="What needs you today">
          <AttentionList
            absentees={topAbsentees}
            defaulters={topDefaulters}
            tasks={tasks}
            navigate={navigate}
          />
        </SectionCard>
      </div>

      {/* ── Two-column: recent activity + quick actions ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
        <SectionCard title="Recent activity" subtitle="Latest payments and enquiries">
          <RecentActivity
            payments={recentPayments}
            enquiries={recentEnquiries}
            navigate={navigate}
          />
        </SectionCard>

        <SectionCard title="Continue" subtitle="Jump back into work">
          <ContextActions navigate={navigate} />
        </SectionCard>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Student view
// ───────────────────────────────────────────────────────────────────────────
function StudentView({ self, navigate }) {
  if (!self) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-10 text-center">
        <p className="text-[color:var(--fg-muted)] text-[14px]">
          Your student profile isn't linked yet. Ask your school admin to attach your account.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-7 items-center">
          <div className="flex flex-col items-center gap-2">
            <Ring value={self.attRate} color="var(--brand)" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--fg-subtle)]">
              My attendance
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <HeroStat
              label="Pending fees"
              value={formatINRPlain(self.pendingFees)}
              hint={self.pendingFees > 0 ? 'Tap to view' : 'All clear'}
              dotColor="var(--warning)"
              onClick={() => navigate('/fees')}
            />
            <HeroStat
              label="Upcoming tests"
              value={String(self.upcomingTests)}
              hint={self.upcomingTests ? 'Prepare in advance' : 'No tests scheduled'}
              dotColor="var(--info)"
              onClick={() => navigate('/take-tests')}
            />
            <HeroStat
              label="Today's classes"
              value={String(self.todayClasses)}
              hint={self.todayClasses ? 'Check timetable' : 'Free day'}
              dotColor="var(--brand)"
              onClick={() => navigate('/student/timetable')}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
        <SectionCard title="My attendance trend" subtitle="Last 7 days">
          <TrendBlock
            title="Attendance rate"
            value={`${Math.round(self.attendanceWeek.length ? self.attendanceWeek[self.attendanceWeek.length - 1].rate : 0)}%`}
            series={self.attendanceWeek.map((d) => d.rate)}
            color="var(--success)"
          />
        </SectionCard>
        <SectionCard title="Next steps" subtitle="Continue learning">
          <ContextActions navigate={navigate} forStudent />
        </SectionCard>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Building blocks
// ───────────────────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, action, children }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-5">
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--fg)] m-0">
            {title}
          </h2>
          {subtitle && (
            <div className="text-[12px] text-[color:var(--fg-subtle)] mt-0.5">{subtitle}</div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function HeroStat({ label, value, hint, hintIcon: HintIcon, hintColor, dotColor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-3 rounded-md transition-colors hover:bg-[color:var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="size-1.5 rounded-full"
          style={{ background: dotColor || 'var(--brand)' }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[color:var(--fg-subtle)]">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums leading-tight text-[color:var(--fg)]">
        {value}
      </div>
      <div
        className="mt-1 text-[11.5px] inline-flex items-center gap-1"
        style={{ color: hintColor || 'var(--fg-subtle)' }}
      >
        {HintIcon && <HintIcon size={11} />}
        {hint}
      </div>
    </button>
  );
}

function TrendBlock({ title, value, series, color }) {
  return (
    <div className="p-4 bg-[color:var(--bg-subtle)] rounded-md">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[color:var(--fg-subtle)]">
            {title}
          </div>
          <div className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[color:var(--fg)] mt-1">
            {value}
          </div>
        </div>
        <Sparkline values={series} color={color} width={220} height={52} />
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
      color: 'var(--success)',
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
      color: 'var(--warning)',
      title: `${formatINRPlain(totalOut / 100)} overdue across ${defaulters.length} famil${defaulters.length === 1 ? 'y' : 'ies'}`,
      detail: `Top: ${top.name} · ${formatINRPlain(top.outstanding / 100)} (${top.oldestDueDays}d old)`,
      onClick: () => navigate('/analytics/fees'),
    });
  }
  if (tasks?.overdueTasks > 0) {
    items.push({
      kind: 'tasks',
      color: 'var(--info)',
      title: `${tasks.overdueTasks} task${tasks.overdueTasks === 1 ? '' : 's'} past due`,
      detail: tasks.missed > 0 ? `${tasks.missed} missed submission${tasks.missed === 1 ? '' : 's'}` : 'No submissions yet',
      onClick: () => navigate('/analytics/tasks'),
    });
  }

  if (!items.length) {
    return (
      <div className="rounded-md bg-[color:var(--bg-subtle)] p-6 text-center text-[13px] text-[color:var(--fg-muted)]">
        Nothing flagged. Everything is on track.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <button
          key={i}
          onClick={it.onClick}
          className="group flex items-start gap-3 p-3 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] hover:bg-[color:var(--bg-subtle)] transition-colors text-left"
        >
          <div
            className="size-8 rounded-md grid place-items-center shrink-0"
            style={{
              background: 'color-mix(in oklab, ' + it.color + ' 14%, transparent)',
              color: it.color,
            }}
          >
            <AlertTriangle size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[color:var(--fg)] leading-snug">
              {it.title}
            </div>
            <div className="text-[12px] text-[color:var(--fg-muted)] mt-0.5 truncate">
              {it.detail}
            </div>
          </div>
          <ChevronRight size={14} className="text-[color:var(--fg-faint)] mt-1.5 shrink-0 group-hover:text-[color:var(--fg-muted)]" />
        </button>
      ))}
    </div>
  );
}

function RecentActivity({ payments, enquiries, navigate }) {
  const feed = [
    ...payments.map((p) => ({
      kind: 'payment',
      when: p.when,
      title: `${p.studentName} paid ${formatINRPlain(p.amount)}`,
      hint: p.method?.replace('_', ' '),
      color: 'var(--success)',
      icon: Wallet,
      onClick: () => navigate('/fees'),
    })),
    ...enquiries.map((e) => ({
      kind: 'enquiry',
      when: e.when,
      title: `New enquiry: ${e.name}`,
      hint: [e.grade && `Grade ${e.grade}`, e.status].filter(Boolean).join(' · '),
      color: 'var(--brand)',
      icon: GraduationCap,
      onClick: () => navigate('/manage/admissions'),
    })),
  ].sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0)).slice(0, 8);

  if (!feed.length) {
    return (
      <div className="rounded-md bg-[color:var(--bg-subtle)] p-6 text-center text-[13px] text-[color:var(--fg-muted)]">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {feed.map((it, i) => (
        <button
          key={i}
          onClick={it.onClick}
          className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-[color:var(--bg-subtle)] transition-colors text-left"
        >
          <div
            className="size-7 rounded-md grid place-items-center shrink-0"
            style={{
              background: 'color-mix(in oklab, ' + it.color + ' 14%, transparent)',
              color: it.color,
            }}
          >
            <it.icon size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-[color:var(--fg)] truncate">
              {it.title}
            </div>
            {it.hint && (
              <div className="text-[11px] text-[color:var(--fg-subtle)] mt-0.5 capitalize">
                {it.hint}
              </div>
            )}
          </div>
          <div className="text-[11px] text-[color:var(--fg-faint)] shrink-0 tabular-nums">
            {relTime(it.when)}
          </div>
        </button>
      ))}
    </div>
  );
}

function ContextActions({ navigate, forStudent = false }) {
  const adminActions = [
    { label: 'Mark attendance', desc: 'Today\'s register', path: '/attendance', color: 'var(--success)', icon: CalendarCheck },
    { label: 'Collect fees',    desc: 'Record a payment', path: '/fees',       color: 'var(--brand)',   icon: Wallet },
    { label: 'Tests',           desc: 'Create or grade',  path: '/test-management', color: 'var(--info)',   icon: ClipboardList },
    { label: 'Analytics',       desc: 'Drill into reports', path: '/analytics', color: 'var(--warning)', icon: Activity },
  ];
  const studentActions = [
    { label: 'My timetable',    desc: 'Today\'s classes',  path: '/student/timetable', color: 'var(--brand)',  icon: Clock },
    { label: 'My attendance',   desc: 'Track your days',   path: '/student/attendance', color: 'var(--success)', icon: CalendarCheck },
    { label: 'My results',      desc: 'Recent test scores', path: '/student/results',  color: 'var(--info)',   icon: FileText },
    { label: 'Resources',       desc: 'Notes & uploads',   path: '/student/resources', color: 'var(--warning)', icon: BookOpen },
  ];
  const actions = forStudent ? studentActions : adminActions;

  return (
    <div className="flex flex-col gap-2">
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => navigate(a.path)}
          className="group flex items-center gap-3 p-3 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-subtle)] transition-all text-left"
        >
          <div
            className="size-8 rounded-md grid place-items-center shrink-0"
            style={{
              background: 'color-mix(in oklab, ' + a.color + ' 14%, transparent)',
              color: a.color,
            }}
          >
            <a.icon size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[color:var(--fg)]">{a.label}</div>
            <div className="text-[11px] text-[color:var(--fg-subtle)]">{a.desc}</div>
          </div>
          <ChevronRight size={14} className="text-[color:var(--fg-faint)] group-hover:text-[color:var(--fg-muted)]" />
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

function DashboardSkeleton() {
  return (
    <>
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--bg-elev)] border border-[color:var(--border)] p-6 mb-4">
        <div className="cb-skel h-[120px] rounded-md" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 mb-4">
        <div className="cb-skel h-[160px] rounded-[var(--radius-lg)]" />
        <div className="cb-skel h-[160px] rounded-[var(--radius-lg)]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
        <div className="cb-skel h-[200px] rounded-[var(--radius-lg)]" />
        <div className="cb-skel h-[200px] rounded-[var(--radius-lg)]" />
      </div>
    </>
  );
}
