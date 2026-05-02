/**
 * Calendar — month grid + list view, built on shadcn primitives.
 *
 * Visual language: prototype design system (oklch tokens, neutral grid,
 * accent-soft "today" tile, color-coded event pills). All interactive
 * primitives (Button, Select, Tabs) come from shadcn.
 */
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/en-in';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Download, Trash2, Edit3,
} from 'lucide-react';

import { supabase } from '@/config/supabaseClient';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import { useAuth } from '@/AuthProvider';

// shadcn primitives
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// shadcn-backed shared wrappers
import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';

import CalendarEventForm from '../components/CalendarEventForm';

dayjs.locale('en-in');

const TAG_VARIANT = {
  holiday:        'info',
  exam:           'warning',
  ptm:            'accent',
  assembly:       'info',
  'sports day':   'accent',
  'cultural event': 'accent',
};

function tagVariantFor(eventType) {
  if (!eventType) return 'neutral';
  return TAG_VARIANT[eventType.toLowerCase()] || 'accent';
}

// pill background/text colors, mirroring the prototype's calendar dots
function pillStyleFor(variant) {
  if (variant === 'warning') {
    return { background: 'var(--warning-soft)', color: 'oklch(0.50 0.13 75)' };
  }
  if (variant === 'accent') {
    return { background: 'var(--accent-soft)', color: 'var(--primary)' };
  }
  if (variant === 'info') {
    return { background: 'var(--info-soft)', color: 'var(--info)' };
  }
  return { background: 'var(--bg-muted)', color: 'var(--fg-muted)' };
}

export default function Calendar() {
  const { user, userMetadata } = useAuth();

  const [me, setMe] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');

  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('month');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

  // ── init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !userMetadata) return;
    const role = getUserRole(user);
    const school_code = getSchoolCode(user);
    if (!school_code) return;
    setMe({ id: user.id, role, school_code });
    fetchAcademicYears(school_code);
    fetchClasses(school_code);
  }, [user, userMetadata]);

  useEffect(() => {
    if (me?.school_code) fetchEvents();
  }, [me, selectedAcademicYear, selectedClass, selectedMonth]);

  useEffect(() => {
    if (me?.school_code) fetchClasses(me.school_code);
  }, [me, selectedAcademicYear]);

  async function fetchAcademicYears(schoolCode) {
    const { data } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_code', schoolCode)
      .order('year_start', { ascending: false });
    setAcademicYears(data || []);
    const active = data?.find((y) => y.is_active) || data?.[0];
    if (active) setSelectedAcademicYear(active.id);
  }

  async function fetchClasses(schoolCode) {
    if (!selectedAcademicYear) { setClasses([]); return; }
    const { data } = await supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode)
      .eq('academic_year_id', selectedAcademicYear)
      .order('grade')
      .order('section');
    setClasses(data || []);
  }

  async function fetchEvents() {
    if (!me?.school_code || !selectedAcademicYear) return;
    setLoading(true);
    const startDate = selectedMonth.startOf('month').format('YYYY-MM-DD');
    const endDate = selectedMonth.endOf('month').format('YYYY-MM-DD');
    let query = supabase
      .from('school_calendar_events')
      .select('*')
      .eq('school_code', me.school_code)
      .eq('academic_year_id', selectedAcademicYear)
      .eq('is_active', true)
      .gte('start_date', startDate)
      .lte('start_date', endDate);
    if (selectedClass && selectedClass !== 'all') {
      query = query.or(`class_instance_id.eq.${selectedClass},class_instance_id.is.null`);
    }
    const { data } = await query.order('start_date');
    setEvents(data || []);
    setLoading(false);
  }

  function handleDelete(event) {
    if (!confirm(`Delete "${event.title}"?`)) return;
    supabase
      .from('school_calendar_events')
      .delete()
      .eq('id', event.id)
      .then(() => fetchEvents());
  }

  function handleEdit(event) {
    setSelectedEvent(event);
    if (event.event_type === 'holiday') setIsHolidayModalOpen(true);
    else setIsEventModalOpen(true);
  }

  function handleEventSaved() {
    setIsEventModalOpen(false);
    setIsHolidayModalOpen(false);
    setSelectedEvent(null);
    fetchEvents();
  }

  function handleQuickAdd(date) {
    setSelectedEvent({
      start_date: date.format('YYYY-MM-DD'),
      end_date: date.format('YYYY-MM-DD'),
      is_all_day: true,
    });
    setIsEventModalOpen(true);
  }

  // ── derived ─────────────────────────────────────────────────────────────
  const monthStart = selectedMonth.startOf('month');
  const monthEnd = selectedMonth.endOf('month');
  const startDow = monthStart.day();
  const daysInMonth = monthEnd.date();
  const today = dayjs();
  const todayKey = today.format('YYYY-MM-DD');

  const eventsByDay = events.reduce((acc, ev) => {
    const key = dayjs(ev.start_date).format('YYYY-MM-DD');
    (acc[key] = acc[key] || []).push(ev);
    return acc;
  }, {});

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="px-8 pt-7 pb-16 max-w-[1480px] mx-auto w-full">
      <PageHeader
        title="Calendar"
        subtitle={selectedMonth.format('MMMM YYYY')}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download size={14} />
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => { setSelectedEvent(null); setIsEventModalOpen(true); }}
            >
              <Plus size={14} />
              New event
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setSelectedMonth(selectedMonth.subtract(1, 'month'))}
        >
          <ChevronLeft size={13} />
        </Button>
        <span className="font-semibold text-[15px] text-[color:var(--fg)]">
          {selectedMonth.format('MMMM YYYY')}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setSelectedMonth(selectedMonth.add(1, 'month'))}
        >
          <ChevronRight size={13} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedMonth(dayjs())}
        >
          Today
        </Button>

        {academicYears.length > 0 && (
          <Select value={selectedAcademicYear || ''} onValueChange={setSelectedAcademicYear}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="Academic year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.year_start} – {y.year_end}{y.is_active ? ' (Active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {`Grade ${c.grade}${c.section ? `-${c.section}` : ''}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="outline"
          size="sm"
          onClick={() => { setSelectedEvent(null); setIsHolidayModalOpen(true); }}
        >
          <CalendarIcon size={13} />
          Add holiday
        </Button>
      </div>

      {/* Views */}
      <Tabs value={view} onValueChange={setView}>
        <TabsContent value="month" className="mt-0">
          <Card padded={false}>
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-[color:var(--border)]">
              {weekdayLabels.map((d, i) => (
                <div
                  key={d}
                  className={`px-3.5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] bg-[color:var(--bg-subtle)] ${
                    i < 6 ? 'border-r border-[color:var(--border)]' : ''
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div className="grid grid-cols-7">
              {Array.from({ length: startDow }).map((_, i) => (
                <div
                  key={`b${i}`}
                  className="min-h-[110px] bg-[color:var(--bg-subtle)] border-r border-b border-[color:var(--border)]"
                />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const date = monthStart.add(i, 'day');
                const dateKey = date.format('YYYY-MM-DD');
                const dayEvents = eventsByDay[dateKey] || [];
                const isToday = dateKey === todayKey;
                const colIdx = (startDow + i) % 7;

                return (
                  <div
                    key={dateKey}
                    onClick={() => handleQuickAdd(date)}
                    className={`min-h-[110px] p-2 cursor-pointer transition-colors border-b border-[color:var(--border)] ${
                      colIdx < 6 ? 'border-r border-[color:var(--border)]' : ''
                    }`}
                    style={{
                      background: isToday ? 'var(--accent-soft)' : 'var(--bg-elev)',
                    }}
                  >
                    <div
                      className="text-[12.5px] font-semibold mb-1.5"
                      style={{ color: isToday ? 'var(--primary)' : 'var(--fg)' }}
                    >
                      {d}
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const variant = tagVariantFor(ev.event_type);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); handleEdit(ev); }}
                            className="text-[11.5px] px-1.5 py-[3px] rounded truncate font-medium"
                            style={pillStyleFor(variant)}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[11px] text-[color:var(--fg-subtle)] px-1.5">
                          + {dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          <Card padded={false} title={`Events — ${selectedMonth.format('MMMM YYYY')}`}>
            {loading ? (
              <div className="p-6 text-[color:var(--fg-subtle)]">Loading…</div>
            ) : events.length === 0 ? (
              <EmptyState
                title="No events this month"
                sub="Click any day in Month view to quickly add an event."
              />
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-[11.5px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] px-4 py-2.5 bg-[color:var(--bg-subtle)] border-b border-[color:var(--border)] w-[110px] first:pl-[22px]">
                      Date
                    </th>
                    <th className="text-left font-medium text-[11.5px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] px-4 py-2.5 bg-[color:var(--bg-subtle)] border-b border-[color:var(--border)]">
                      Event
                    </th>
                    <th className="text-left font-medium text-[11.5px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] px-4 py-2.5 bg-[color:var(--bg-subtle)] border-b border-[color:var(--border)]">
                      Type
                    </th>
                    <th className="px-4 py-2.5 bg-[color:var(--bg-subtle)] border-b border-[color:var(--border)] last:pr-[22px] w-[100px]" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-[color:var(--bg-subtle)] transition-colors"
                    >
                      <td className="px-4 py-2.5 border-b border-[color:var(--border)] first:pl-[22px] align-middle h-[var(--row-h)]">
                        <span className="font-mono text-[12px] text-[color:var(--fg-subtle)]">
                          {dayjs(ev.start_date).format('DD MMM')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-[color:var(--border)] align-middle h-[var(--row-h)]">
                        <div className="font-medium text-[color:var(--fg)]">{ev.title}</div>
                        {ev.description && (
                          <div className="text-[11.5px] text-[color:var(--fg-subtle)] mt-0.5">
                            {ev.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 border-b border-[color:var(--border)] align-middle h-[var(--row-h)]">
                        <Badge variant={tagVariantFor(ev.event_type)} dot>
                          {ev.event_type || 'event'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 border-b border-[color:var(--border)] last:pr-[22px] align-middle h-[var(--row-h)] text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(ev)}
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(ev)}
                          title="Delete"
                          className="text-[color:var(--danger)]"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CalendarEventForm
        open={isEventModalOpen}
        event={selectedEvent}
        academicYearId={selectedAcademicYear}
        schoolCode={me?.school_code}
        classes={classes}
        user={user}
        onCancel={() => { setIsEventModalOpen(false); setSelectedEvent(null); }}
        onSuccess={handleEventSaved}
      />
      <CalendarEventForm
        open={isHolidayModalOpen}
        event={selectedEvent}
        academicYearId={selectedAcademicYear}
        schoolCode={me?.school_code}
        classes={classes}
        user={user}
        isHoliday
        onCancel={() => { setIsHolidayModalOpen(false); setSelectedEvent(null); }}
        onSuccess={handleEventSaved}
      />
    </div>
  );
}
