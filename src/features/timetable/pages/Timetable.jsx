/**
 * Timetable — weekly schedule grid + daily list, built on shadcn primitives.
 *
 * Visual language: prototype design system (oklch tokens). Subject pills are
 * colored using a deterministic hash → hue, mirroring `screens-academic.jsx`.
 * Days run Mon–Fri across columns; periods stack vertically.
 *
 * Data layer is unchanged — same `timetable_slots` table, same lookups.
 */
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import {
  ChevronLeft, ChevronRight, Download, Edit, Plus, Coffee, Trash2,
} from 'lucide-react';

import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { useAcademicYear } from '@/features/analytics/context/AcademicYearContext';

// shadcn primitives
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// shadcn-backed shared wrappers
import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';

dayjs.extend(isoWeek);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Deterministic hue palette per subject — mirrors prototype's subject colors.
function pillForSubject(name) {
  if (!name) return null;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    background: `oklch(0.96 0.04 ${hue})`,
    color: `oklch(0.45 0.13 ${hue})`,
  };
}

function fmtTime(t) {
  return t ? t.slice(0, 5) : '';
}

export default function Timetable() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const { selectedAyId } = useAcademicYear();

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [classId, setClassId] = useState('');

  const [view, setView] = useState('week');
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek'));
  const [day, setDay] = useState(() => dayjs());

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── load lookups ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolCode || !selectedAyId) return;
    (async () => {
      const [c, s, a] = await Promise.all([
        supabase.from('class_instances').select('id, grade, section').eq('school_code', schoolCode).eq('academic_year_id', selectedAyId).order('grade').order('section'),
        supabase.from('subjects').select('id, subject_name').eq('school_code', schoolCode).order('subject_name'),
        supabase.from('admin').select('id, full_name').eq('school_code', schoolCode).order('full_name'),
      ]);
      setClasses(c.data || []);
      setSubjects(s.data || []);
      setAdmins(a.data || []);
      setClassId((cur) => (cur && c.data?.some((x) => x.id === cur)) ? cur : (c.data?.[0]?.id || ''));
    })();
  }, [schoolCode, selectedAyId]);

  // ── load slots (week or day) ───────────────────────────────────────────
  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    let startStr, endStr;
    if (view === 'week') {
      startStr = weekStart.format('YYYY-MM-DD');
      endStr = weekStart.add(5, 'day').format('YYYY-MM-DD');
    } else {
      startStr = day.format('YYYY-MM-DD');
      endStr = startStr;
    }
    supabase
      .from('timetable_slots')
      .select('id, class_date, period_number, slot_type, name, start_time, end_time, subject_id, teacher_id')
      .eq('class_instance_id', classId)
      .gte('class_date', startStr)
      .lte('class_date', endStr)
      .order('class_date')
      .order('start_time')
      .then(({ data }) => {
        setSlots(data || []);
        setLoading(false);
      });
  }, [classId, view, weekStart, day]);

  const subjectName = (id) => subjects.find((s) => s.id === id)?.subject_name || '—';
  const teacherName = (id) => admins.find((a) => a.id === id)?.full_name || '—';

  // Build a list of unique time slots across the week so rows are aligned even
  // when days have different period counts.
  const grid = useMemo(() => {
    const timeKeys = Array.from(
      new Set(
        slots
          .filter((s) => s.start_time)
          .map((s) => `${s.start_time}-${s.end_time}`)
      )
    ).sort();

    const byDayTime = {};
    for (const s of slots) {
      const dayIdx = dayjs(s.class_date).diff(weekStart, 'day');
      if (dayIdx < 0 || dayIdx > 5) continue;
      const key = `${s.start_time}-${s.end_time}`;
      byDayTime[`${dayIdx}|${key}`] = s;
    }
    return { timeKeys, byDayTime };
  }, [slots, weekStart]);

  const weekLabel = `${weekStart.format('MMM D')} – ${weekStart.add(5, 'day').format('MMM D, YYYY')}`;
  const weekNumber = weekStart.isoWeek();

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Timetable"
        subtitle={view === 'week' ? `Weekly schedule · ${weekLabel}` : day.format('dddd, MMMM D, YYYY')}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download size={14} />
              PDF
            </Button>
            <Button size="sm">
              <Edit size={14} />
              Edit schedule
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={classId || ''} onValueChange={setClassId}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue placeholder="Pick a class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {`Grade ${c.grade}${c.section ? `-${c.section}` : ''}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="day">Day</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        {view === 'week' ? (
          <>
            <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(weekStart.subtract(1, 'week'))}>
              <ChevronLeft size={13} />
            </Button>
            <span className="text-[13px] font-medium text-[color:var(--fg)]">Week {weekNumber}</span>
            <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(weekStart.add(1, 'week'))}>
              <ChevronRight size={13} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(dayjs().startOf('isoWeek'))}>
              This week
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="icon-sm" onClick={() => setDay(day.subtract(1, 'day'))}>
              <ChevronLeft size={13} />
            </Button>
            <span className="text-[13px] font-medium text-[color:var(--fg)] tabular-nums min-w-[110px] text-center">
              {day.format('ddd, MMM D')}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => setDay(day.add(1, 'day'))}>
              <ChevronRight size={13} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDay(dayjs())}>
              Today
            </Button>
          </>
        )}
      </div>

      {/* Week view */}
      {view === 'week' && (
        <Card padded={false} className="overflow-hidden">
          {/* Day header row */}
          <div
            className="grid border-b border-[color:var(--border)]"
            style={{ gridTemplateColumns: '70px repeat(6, minmax(0, 1fr))' }}
          >
            <div className="px-2.5 py-3 bg-[color:var(--bg-subtle)] border-r border-[color:var(--border)]" />
            {DAYS.map((d, i) => {
              const dayDate = weekStart.add(i, 'day');
              const isToday = dayDate.isSame(dayjs(), 'day');
              return (
                <div
                  key={d}
                  className={`px-3.5 py-3 bg-[color:var(--bg-subtle)] ${i < 5 ? 'border-r border-[color:var(--border)]' : ''}`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--fg-subtle)]">
                    {d}
                  </div>
                  <div
                    className="text-sm font-medium tabular-nums mt-0.5"
                    style={{ color: isToday ? 'var(--brand)' : 'var(--fg)' }}
                  >
                    {dayDate.format('MMM D')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body */}
          {loading ? (
            <div className="p-10 text-center text-[color:var(--fg-subtle)]">Loading…</div>
          ) : grid.timeKeys.length === 0 ? (
            <EmptyState
              title="No timetable for this week"
              sub="Pick a class with a published schedule, or switch to the Day view to add periods."
            />
          ) : (
            grid.timeKeys.map((key, rowIdx) => {
              const [startTime] = key.split('-');
              return (
                <div
                  key={key}
                  className={`grid ${rowIdx === grid.timeKeys.length - 1 ? '' : 'border-b border-[color:var(--border)]'}`}
                  style={{
                    gridTemplateColumns: '70px repeat(6, minmax(0, 1fr))',
                    minHeight: 76,
                  }}
                >
                  <div className="px-2.5 py-2.5 border-r border-[color:var(--border)] text-[11.5px] text-[color:var(--fg-subtle)] font-mono">
                    {fmtTime(startTime)}
                  </div>
                  {DAYS.map((_, dayIdx) => {
                    const slot = grid.byDayTime[`${dayIdx}|${key}`];
                    const isLast = dayIdx === 5;
                    if (!slot) {
                      return (
                        <div
                          key={dayIdx}
                          className={`p-1.5 ${!isLast ? 'border-r border-[color:var(--border)]' : ''}`}
                        />
                      );
                    }
                    if (slot.slot_type === 'break') {
                      return (
                        <div
                          key={dayIdx}
                          className={`p-1.5 ${!isLast ? 'border-r border-[color:var(--border)]' : ''}`}
                        >
                          <div className="h-full grid place-items-center text-[11.5px] italic text-[color:var(--fg-faint)]">
                            {slot.name || 'Break'}
                          </div>
                        </div>
                      );
                    }
                    const subj = subjectName(slot.subject_id);
                    const tch = teacherName(slot.teacher_id);
                    const pill = pillForSubject(subj) || { background: 'var(--bg-muted)', color: 'var(--fg-muted)' };
                    return (
                      <div
                        key={dayIdx}
                        className={`p-1.5 ${!isLast ? 'border-r border-[color:var(--border)]' : ''}`}
                      >
                        <div
                          className="rounded-[7px] px-2.5 py-2 h-full flex flex-col justify-between"
                          style={pill}
                        >
                          <div>
                            <div className="font-semibold text-[12.5px] truncate">{subj}</div>
                            {slot.period_number ? (
                              <div className="text-[11px] opacity-80">Period {slot.period_number}</div>
                            ) : null}
                          </div>
                          <div className="text-[11px] opacity-70 truncate">{tch}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </Card>
      )}

      {/* Day view */}
      {view === 'day' && (
        <DayView
          loading={loading}
          slots={slots}
          subjectName={subjectName}
          teacherName={teacherName}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Day view — clean prototype-style list of periods + breaks for the chosen day.
// ───────────────────────────────────────────────────────────────────────────
function DayView({ loading, slots, subjectName, teacherName }) {
  const sorted = useMemo(
    () =>
      [...slots].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [slots]
  );

  if (loading) {
    return (
      <Card>
        <div className="p-10 text-center text-[color:var(--fg-subtle)]">Loading…</div>
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No schedule for this day"
          sub="Switch to another day, or add periods using the editor."
          action={
            <Button size="sm" className="mt-2">
              <Plus size={14} />
              Add period
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="divide-y divide-[color:var(--border)]">
        {sorted.map((slot) => {
          if (slot.slot_type === 'break') {
            return (
              <div
                key={slot.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ background: 'var(--warning-soft)' }}
              >
                <Coffee size={14} className="text-[oklch(0.50_0.13_75)]" />
                <span className="text-[13px] font-medium text-[oklch(0.50_0.13_75)]">
                  {slot.name || 'Break'}
                </span>
                <span className="text-[12px] text-[oklch(0.50_0.13_75)] opacity-80 font-mono">
                  {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                </span>
              </div>
            );
          }
          const subj = subjectName(slot.subject_id);
          const tch = teacherName(slot.teacher_id);
          const pill = pillForSubject(subj) || { background: 'var(--bg-muted)', color: 'var(--fg-muted)' };
          return (
            <div
              key={slot.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-[color:var(--bg-subtle)] transition-colors"
            >
              <div className="font-mono text-[12.5px] text-[color:var(--fg-muted)] min-w-[110px]">
                {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
              </div>
              <div
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                style={pill}
              >
                Period {slot.period_number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[color:var(--fg)] truncate">
                  {subj}
                </div>
                <div className="text-[12.5px] text-[color:var(--fg-muted)] truncate">{tch}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" title="Edit">
                  <Edit size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Delete"
                  className="text-[color:var(--danger)] hover:text-[color:var(--danger)]"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
