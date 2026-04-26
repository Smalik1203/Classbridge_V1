import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Breadcrumb, Space, Typography, Tag, Button } from 'antd';
import { HomeOutlined, BarChartOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import AcademicYearPicker from '../components/AcademicYearPicker';
import { useAcademicYear } from '../context/AcademicYearContext';

const { Title, Text } = Typography;

const SECTIONS = {
  '/analytics':            { title: 'Analytics', subtitle: 'Cross-domain analytics. Pick a feature to drill in.', accent: '#6366F1' },
  '/analytics/attendance': { title: 'Attendance',          subtitle: 'Daily / period / monthly attendance — students and staff.', accent: '#10b981' },
  '/analytics/fees':       { title: 'Fees',                subtitle: 'Collection rate, aging buckets, defaulters, category mix.', accent: '#f59e0b' },
  '/analytics/tasks':      { title: 'Tasks',               subtitle: 'Submission rates, on-time vs late, top engagers.', accent: '#3b82f6' },
  '/analytics/syllabus':   { title: 'Syllabus',            subtitle: 'Coverage % by class & subject, pacing, untaught topics.', accent: '#a855f7' },
  '/analytics/academic':   { title: 'Academic Performance', subtitle: 'Test trends, weak areas, topic heatmap, misconceptions.', accent: '#ef4444' },
  '/analytics/hr':         { title: 'HR',                  subtitle: 'Staff attendance trends, leave usage, payroll cost.', accent: '#14b8a6' },
};

export default function AnalyticsShell() {
  const { pathname } = useLocation();
  const { selectedYear, compareYear, formatYearLabel } = useAcademicYear();

  const meta = SECTIONS[pathname] || (pathname.startsWith('/analytics/student/')
    ? { title: 'Student Analytics', subtitle: 'Personalised analytics for one student.', accent: '#6366F1' }
    : pathname.startsWith('/analytics/class/')
      ? { title: 'Class Analytics', subtitle: 'Class-aggregate analytics with student drill-downs.', accent: '#6366F1' }
      : SECTIONS['/analytics']);

  const inHub = pathname === '/analytics';

  return (
    <div style={{
      padding: '20px 24px 32px', minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 320px)',
    }}>
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <Space direction="vertical" size={4}>
            {!inHub && (
              <Link to="/analytics">
                <Button size="small" type="text" icon={<ArrowLeftOutlined />} style={{ color: '#64748b' }}>Hub</Button>
              </Link>
            )}
            <Space size={8} wrap>
              <Text type="secondary" style={{ fontSize: 13 }}>{meta.subtitle}</Text>
              {selectedYear && <Tag color="default" style={{ borderRadius: 999, fontWeight: 500, margin: 0 }}>AY {formatYearLabel(selectedYear)}</Tag>}
              {compareYear && <Tag color="purple" style={{ borderRadius: 999, fontWeight: 500, margin: 0 }}>vs {formatYearLabel(compareYear)}</Tag>}
            </Space>
          </Space>
          <AcademicYearPicker />
        </div>
      </div>

      <Outlet />
    </div>
  );
}
