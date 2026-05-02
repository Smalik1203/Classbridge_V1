import React from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Typography, Space, Tag } from 'antd';
import {
  CheckCircleOutlined, MoneyCollectOutlined, FileDoneOutlined, BookOutlined,
  ExperimentOutlined, TeamOutlined, ArrowRightOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const FEATURES = [
  {
    key: 'attendance',
    to: '/analytics/attendance',
    icon: <CheckCircleOutlined />,
    title: 'Attendance',
    desc: 'Daily / monthly trends, period heatmap, chronic absentees, staff attendance.',
    accent: '#10b981',
    accentSoft: '#ecfdf5',
  },
  {
    key: 'fees',
    to: '/analytics/fees',
    icon: <MoneyCollectOutlined />,
    title: 'Fees',
    desc: 'Collection rate over time, aging buckets, top defaulters, category mix.',
    accent: '#f59e0b',
    accentSoft: '#fffbeb',
  },
  {
    key: 'tasks',
    to: '/analytics/tasks',
    icon: <FileDoneOutlined />,
    title: 'Tasks',
    desc: 'Submission rate, on-time vs late, by class & subject, top engagers.',
    accent: '#3b82f6',
    accentSoft: '#eff6ff',
  },
  {
    key: 'syllabus',
    to: '/analytics/syllabus',
    icon: <BookOutlined />,
    title: 'Syllabus',
    desc: 'Topics taught vs total, pacing vs plan, untaught topics by class & subject.',
    accent: '#a855f7',
    accentSoft: '#faf5ff',
  },
  {
    key: 'academic',
    to: '/analytics/academic',
    icon: <ExperimentOutlined />,
    title: 'Academic Performance',
    desc: 'Test trends, status distribution, weak areas, topic heatmap, misconceptions.',
    accent: '#ef4444',
    accentSoft: '#fef2f2',
  },
  {
    key: 'hr',
    to: '/analytics/hr',
    icon: <TeamOutlined />,
    title: 'HR',
    desc: 'Staff attendance trend, leave usage by type, payroll cost over time.',
    accent: '#14b8a6',
    accentSoft: '#f0fdfa',
  },
];

export default function AnalyticsHub() {
  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      {/* Features */}
      <div>
        <Text style={{
          fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6,
          fontWeight: 600, marginBottom: 12, display: 'block',
        }}>
          Reports
        </Text>
        <Row gutter={[16, 16]}>
          {FEATURES.map((f) => <FeatureCard key={f.key} feature={f} />)}
        </Row>
      </div>
    </Space>
  );
}

function FeatureCard({ feature }) {
  const f = feature;
  return (
    <Col xs={24} sm={12} lg={8}>
      <Link to={f.to} style={{ textDecoration: 'none' }}>
        <div className="ay-feature-card" style={{
          background: '#fff',
          border: '1px solid #eef2ff',
          borderRadius: 14,
          padding: 20,
          cursor: 'pointer',
          height: '100%',
          minHeight: 168,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = f.accent;
          e.currentTarget.style.boxShadow = `0 12px 24px -10px ${f.accent}33`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = '#eef2ff';
          e.currentTarget.style.boxShadow = 'none';
        }}>
          {/* Soft accent in corner */}
          <div aria-hidden style={{
            position: 'absolute', right: -30, top: -30, width: 110, height: 110,
            background: f.accentSoft, borderRadius: '50%',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: f.accent, color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, marginBottom: 14,
              boxShadow: `0 6px 14px -4px ${f.accent}66`,
            }}>
              {f.icon}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 4, letterSpacing: -0.3 }}>
              {f.title}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              {f.desc}
            </div>
          </div>
          <div style={{
            position: 'relative', zIndex: 1, marginTop: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Tag color="default" style={{ borderRadius: 999, fontSize: 11, margin: 0 }}>AY-scoped</Tag>
            <span style={{ color: f.accent, fontWeight: 600, fontSize: 13 }}>
              Open <ArrowRightOutlined />
            </span>
          </div>
        </div>
      </Link>
    </Col>
  );
}
