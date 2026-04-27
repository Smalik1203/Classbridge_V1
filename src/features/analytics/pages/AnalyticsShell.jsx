import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Typography, Tag } from 'antd';
import {
  ArrowLeftOutlined, BarChartOutlined, CheckCircleOutlined, DollarCircleOutlined,
  CheckSquareOutlined, BookOutlined, ExperimentOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import AcademicYearPicker from '../components/AcademicYearPicker';
import { useAcademicYear } from '../context/AcademicYearContext';

const { Title, Text } = Typography;

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
    <div style={{
      padding: '20px 24px 32px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 320px)',
    }}>
      {/* HEADER — single horizontal bar: icon + title block on the left, AY picker on the right */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        background: '#fff',
        border: '1px solid #eef2ff',
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 20,
      }}>
        {/* LEFT: icon + (back link · title · tags) + subtitle */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${meta.accent}15`,
            color: meta.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            {meta.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!inHub && (
                <Link to="/analytics" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  color: '#64748b', fontSize: 12, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 6,
                  background: '#f1f5f9',
                }}>
                  <ArrowLeftOutlined style={{ fontSize: 11 }} /> Hub
                </Link>
              )}
              <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                {meta.title}
              </Title>
              {selectedYear && (
                <Tag color="default" style={{ borderRadius: 999, fontWeight: 500, margin: 0, fontSize: 11 }}>
                  AY {formatYearLabel(selectedYear)}
                </Tag>
              )}
              {compareYear && (
                <Tag color="purple" style={{ borderRadius: 999, fontWeight: 500, margin: 0, fontSize: 11 }}>
                  vs {formatYearLabel(compareYear)}
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
              {meta.subtitle}
            </Text>
          </div>
        </div>

        {/* RIGHT: AY picker, compact */}
        <div style={{ flexShrink: 0 }}>
          <AcademicYearPicker compact />
        </div>
      </div>

      <Outlet />
    </div>
  );
}
