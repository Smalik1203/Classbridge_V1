import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  BarChartOutlined, CheckCircleOutlined, DollarCircleOutlined,
  CheckSquareOutlined, BookOutlined, ExperimentOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import AcademicYearPicker from '../components/AcademicYearPicker';
import { useAcademicYear } from '../context/AcademicYearContext';
import { Badge } from '@/shared/ui/Badge';

const SECTIONS = {
  '/analytics':            { title: 'Analytics',            subtitle: 'Cross-domain analytics. Pick a feature to drill in.',           accent: '#6366F1', icon: <BarChartOutlined /> },
  '/analytics/attendance': { title: 'Attendance',           subtitle: 'Daily / period / monthly attendance — students and staff.',     accent: '#10b981', icon: <CheckCircleOutlined /> },
  '/analytics/fees':       { title: 'Fees',                 subtitle: 'Collection rate, aging buckets, defaulters, category mix.',     accent: '#f59e0b', icon: <DollarCircleOutlined /> },
  '/analytics/tasks':      { title: 'Tasks',                subtitle: 'Submission rates, on-time vs late, top engagers.',              accent: '#3b82f6', icon: <CheckSquareOutlined /> },
  '/analytics/syllabus':   { title: 'Syllabus',             subtitle: 'Coverage % by class & subject, pacing, untaught topics.',       accent: '#a855f7', icon: <BookOutlined /> },
  '/analytics/academic':   { title: 'Academic Performance', subtitle: 'Test trends, weak areas, topic heatmap, misconceptions.',       accent: '#ef4444', icon: <ExperimentOutlined /> },
  '/analytics/hr':         { title: 'HR',                   subtitle: 'Staff attendance trends, leave usage, payroll cost.',           accent: '#14b8a6', icon: <TeamOutlined /> },
};

export default function AnalyticsShell() {
  const { pathname } = useLocation();
  const { selectedYear, compareYear, formatYearLabel } = useAcademicYear();

  const meta = SECTIONS[pathname] || (pathname.startsWith('/analytics/student/')
    ? { title: 'Student Analytics', subtitle: 'Personalised analytics for one student.', accent: '#6366F1', icon: <UserOutlined /> }
    : pathname.startsWith('/analytics/class/')
      ? { title: 'Class Analytics', subtitle: 'Class-aggregate analytics with student drill-downs.', accent: '#6366F1', icon: <TeamOutlined /> }
      : SECTIONS['/analytics']);

  const inHub = pathname === '/analytics';

  return (
    <div className="px-6 pt-5 pb-8 min-h-screen bg-[color:var(--bg)]">
      {/* HEADER — single horizontal bar: icon + title block on the left, AY picker on the right */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[color:var(--bg-elev)] border border-[color:var(--border)] rounded-[var(--radius-lg)] px-4 py-3 mb-5">
        {/* LEFT: icon + (back link · title · badges) + subtitle */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[20px] shrink-0"
            style={{ background: `${meta.accent}15`, color: meta.accent }}
          >
            {meta.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {!inHub && (
                <Link
                  to="/analytics"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[color:var(--fg-muted)] bg-[color:var(--bg-subtle)] hover:bg-[color:var(--bg-muted)] px-2 py-0.5 rounded-md transition-colors"
                >
                  <ArrowLeft size={11} /> Hub
                </Link>
              )}
              <h2 className="m-0 text-[18px] font-bold tracking-[-0.01em] text-[color:var(--fg)]">
                {meta.title}
              </h2>
              {selectedYear && (
                <Badge variant="neutral">AY {formatYearLabel(selectedYear)}</Badge>
              )}
              {compareYear && (
                <Badge variant="accent">vs {formatYearLabel(compareYear)}</Badge>
              )}
            </div>
            <p className="m-0 mt-0.5 text-[12px] leading-[1.4] text-[color:var(--fg-muted)]">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* RIGHT: AY picker, compact */}
        <div className="shrink-0">
          <AcademicYearPicker compact />
        </div>
      </div>

      <Outlet />
    </div>
  );
}
