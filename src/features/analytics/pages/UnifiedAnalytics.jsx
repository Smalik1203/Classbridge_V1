import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tabs, Typography, Space, Breadcrumb, Empty, message, Modal, Input, List, Tag, Button } from 'antd';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BarChartOutlined, HomeOutlined, UserOutlined, TeamOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAuth } from '@/AuthProvider';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';
import {
  listClasses, listStudents, listSubjects, getStudentById, getClassInstanceById,
} from '../services/analyticsService';

import AnalyticsToolbar from '../components/AnalyticsToolbar';
import OverviewTab from '../components/OverviewTab';
import PerformanceTrendsTab from '../components/PerformanceTrendsTab';
import WeakAreasTab from '../components/WeakAreasTab';
import TopicHeatmapTab from '../components/TopicHeatmapTab';
import MisconceptionsTab from '../components/MisconceptionsTab';
import ComparisonsTab from '../components/ComparisonsTab';
import StatusDistributionTab from '../components/StatusDistributionTab';
import DailyTrendsTab from '../components/DailyTrendsTab';
import AttendanceCorrelationTab from '../components/AttendanceCorrelationTab';
import ComparisonDrawer from '../components/ComparisonDrawer';
import { printReport } from '../utils/exportUtils';
import { listSavedViews, saveView, deleteView } from '../utils/savedViews';

const { Title, Text } = Typography;

// Map legacy URL → tab key
const LEGACY_REDIRECTS = {
  '/analytics/daily-trends': 'daily-trends',
  '/analytics/student-performance': 'performance',
  '/analytics/class-comparison': 'comparisons',
  '/analytics/status-distribution': 'status',
  '/analytics/weak-areas': 'weak-areas',
  '/analytics/topic-heatmap': 'heatmap',
  '/analytics/misconception-report': 'misconceptions',
};

export default function UnifiedAnalytics({ lockedScope, lockedStudentId, lockedClassId }) {
  const { user } = useAuth();
  const role = getUserRole(user);
  const schoolCode = getSchoolCode(user);
  const navigate = useNavigate();
  const params = useParams();
  const [search, setSearch] = useSearchParams();

  // Initial scope inferred from props (locked detail page) or role
  const initialScope = lockedScope || (role === 'student' ? 'student' : 'school');

  const [scope, setScope] = useState(initialScope);
  const [classId, setClassId] = useState(lockedClassId || null);
  const [studentId, setStudentId] = useState(lockedStudentId || null);
  const [subjectId, setSubjectId] = useState('all');
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [activeTab, setActiveTab] = useState(search.get('tab') || 'overview');
  const [savedViewsModal, setSavedViewsModal] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Sync legacy path → tab redirect
  useEffect(() => {
    const path = window.location.pathname;
    if (LEGACY_REDIRECTS[path]) {
      const newTab = LEGACY_REDIRECTS[path];
      navigate(`/analytics?tab=${newTab}`, { replace: true });
    }
  }, [navigate]);

  // Sync tab to URL
  useEffect(() => {
    const next = new URLSearchParams(search);
    next.set('tab', activeTab);
    setSearch(next, { replace: true });
  }, [activeTab]);

  // Load scoped resources (student record / class record) on locked detail pages
  useEffect(() => {
    (async () => {
      if (lockedStudentId) {
        const stu = await getStudentById(lockedStudentId);
        if (stu) {
          setStudents([stu]);
          if (stu.class_instance_id && !classId) setClassId(stu.class_instance_id);
        }
      }
      if (lockedClassId && !classId) setClassId(lockedClassId);
    })();
  }, [lockedStudentId, lockedClassId]);

  // Load classes for the school
  useEffect(() => {
    if (!schoolCode) return;
    listClasses(schoolCode).then(setClasses).catch(() => setClasses([]));
  }, [schoolCode]);

  // Load students for selected class
  useEffect(() => {
    if (!classId) { if (!lockedStudentId) setStudents([]); return; }
    listStudents(schoolCode, classId).then((list) => {
      // Preserve locked student even if not in list (RLS edge)
      if (lockedStudentId && !list.find((s) => s.id === lockedStudentId)) {
        setStudents((cur) => list);
      } else {
        setStudents(list);
      }
    }).catch(() => setStudents([]));
  }, [classId, schoolCode, lockedStudentId]);

  // Load subjects (scope-aware)
  useEffect(() => {
    if (!schoolCode) return;
    listSubjects(schoolCode, scope === 'class' || scope === 'student' ? classId : null).then(setSubjects).catch(() => setSubjects([]));
  }, [scope, schoolCode, classId]);

  // Quick range
  const onQuickRange = (val) => {
    if (val === 'term') setDateRange([dayjs().subtract(120, 'day'), dayjs()]);
    else if (val === 'year') setDateRange([dayjs().subtract(365, 'day'), dayjs()]);
    else setDateRange([dayjs().subtract(parseInt(val, 10), 'day'), dayjs()]);
  };

  const onSaveView = () => {
    let name = '';
    Modal.confirm({
      title: 'Save current view',
      content: <Input placeholder="View name" onChange={(e) => { name = e.target.value; }} />,
      onOk: () => {
        if (!name.trim()) return;
        saveView({
          name: name.trim(),
          scope, classId, studentId, subjectId,
          dateRange: [dateRange[0].toISOString(), dateRange[1].toISOString()],
          tab: activeTab,
        });
        message.success(`Saved "${name.trim()}"`);
      },
    });
  };

  const applyView = (v) => {
    setScope(v.scope);
    setClassId(v.classId);
    setStudentId(v.studentId);
    setSubjectId(v.subjectId);
    if (Array.isArray(v.dateRange)) setDateRange([dayjs(v.dateRange[0]), dayjs(v.dateRange[1])]);
    if (v.tab) setActiveTab(v.tab);
    setSavedViewsModal(false);
  };

  const onPrintReport = () => {
    const periodStr = `${dayjs(dateRange[0]).format('DD MMM YYYY')} – ${dayjs(dateRange[1]).format('DD MMM YYYY')}`;
    const ctxLabel =
      scope === 'student' ? students.find((s) => s.id === studentId)?.full_name :
      scope === 'class' ? classes.find((c) => c.id === classId)?.label :
      'School';
    const title = `${ctxLabel || ''} Analytics Report`;
    const html = `
      <h2>Summary</h2>
      <p>This report covers the period ${periodStr} for ${ctxLabel}. The full charts are visible on screen at /analytics. Print uses the screen rendering — for high-fidelity export, use the per-tab CSV download then format in Excel.</p>
      <p style="color:#6b7280;font-size:9pt;">Tip: use the per-tab "Export CSV" button to capture exact numbers, and the browser's File → Save as PDF for charts.</p>
    `;
    printReport({ title, period: periodStr, html });
  };

  // ─── Available tabs (scope-aware) ───
  const tabs = useMemo(() => {
    const t = [
      { key: 'overview', label: 'Overview' },
      { key: 'performance', label: 'Performance Trends' },
      { key: 'weak-areas', label: 'Weak Areas' },
      { key: 'heatmap', label: 'Topic Heatmap' },
      { key: 'misconceptions', label: 'Misconceptions' },
      { key: 'status', label: 'Status Distribution' },
      { key: 'daily-trends', label: 'Daily Trends' },
      { key: 'attendance-corr', label: 'Attendance × Performance' },
    ];
    if (scope !== 'student') {
      t.splice(5, 0, { key: 'comparisons', label: 'Comparisons' });
    }
    return t;
  }, [scope]);

  if (!schoolCode) return <Empty description="No school code on user." />;

  const drillStudent = (sid) => {
    navigate(`/analytics/student/${sid}`);
  };
  const drillClass = (cid) => {
    navigate(`/analytics/class/${cid}`);
  };

  const ctxStudent = students.find((s) => s.id === studentId);
  const ctxClass = classes.find((c) => c.id === classId);

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space direction="vertical" size={2}>
            <Breadcrumb separator=">">
              <Breadcrumb.Item><Link to="/dashboard"><HomeOutlined /></Link></Breadcrumb.Item>
              <Breadcrumb.Item><Link to="/analytics"><BarChartOutlined /> Analytics</Link></Breadcrumb.Item>
              {lockedClassId && <Breadcrumb.Item><TeamOutlined /> {ctxClass?.label || 'Class'}</Breadcrumb.Item>}
              {lockedStudentId && <Breadcrumb.Item><UserOutlined /> {ctxStudent?.full_name || 'Student'}</Breadcrumb.Item>}
            </Breadcrumb>
            <Title level={3} style={{ margin: 0 }}>
              {lockedStudentId
                ? `${ctxStudent?.full_name || 'Student'} — Analytics`
                : lockedClassId
                ? `${ctxClass?.label || 'Class'} — Analytics`
                : 'Analytics'}
            </Title>
            <Text type="secondary">
              {lockedStudentId
                ? 'Personalised analytics for this student.'
                : lockedClassId
                ? 'Class-aggregate analytics with student drill-downs.'
                : 'Unified school-wide analytics. Switch scope to drill into a class or a student.'}
            </Text>
          </Space>
        </Space>
      </Card>

      <AnalyticsToolbar
        scope={lockedScope ? undefined : scope}
        onScopeChange={(v) => {
          setScope(v);
          if (v === 'school') { setStudentId(null); }
          if (v === 'class') { setStudentId(null); }
        }}
        classes={classes}
        classId={classId}
        onClassChange={(v) => { setClassId(v); setStudentId(null); }}
        students={students}
        studentId={studentId}
        onStudentChange={setStudentId}
        subjects={subjects}
        subjectId={subjectId}
        onSubjectChange={(v) => setSubjectId(v || 'all')}
        dateRange={dateRange}
        onDateRangeChange={(v) => v && setDateRange(v)}
        onQuickRange={onQuickRange}
        onRefresh={() => setRefreshKey((k) => k + 1)}
        onPrint={onPrintReport}
        onCompare={scope !== 'student' || classId ? () => setCompareOpen(true) : null}
        onSaveView={onSaveView}
      />

      {!lockedScope && (listSavedViews().length > 0 || (scope === 'student' && !studentId && classId) || ((scope === 'class' || scope === 'student') && !classId)) && (
        <Space wrap style={{ marginBottom: 12 }}>
          {listSavedViews().length > 0 && (
            <Button size="small" type="link" style={{ paddingLeft: 0 }} onClick={() => setSavedViewsModal(true)}>
              Saved views ({listSavedViews().length})
            </Button>
          )}
          {scope === 'student' && !studentId && classId && (
            <Tag color="orange">Pick a student</Tag>
          )}
          {(scope === 'class' || scope === 'student') && !classId && (
            <Tag color="orange">Pick a class</Tag>
          )}
        </Space>
      )}

      <Tabs
        // Left rail tabs scale to any number of tabs without overflowing
        // horizontally. The previous horizontal layout truncated tabs and
        // pushed the rest under a "..." overflow.
        tabPosition="left"
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ minHeight: 600 }}
        items={tabs.map((t) => ({
          ...t,
          children: renderTab(t.key, {
            scope, schoolCode, classId, studentId, dateRange, subjectId,
            onSubjectChange: (v) => setSubjectId(v || 'all'),
            onDrillStudent: drillStudent,
            onDrillClass: drillClass,
            refreshKey,
          }),
        }))}
      />

      <ComparisonDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        scope={scope === 'student' ? 'student' : 'class'}
        schoolCode={schoolCode}
        dateRange={dateRange}
        subjectId={subjectId}
        classId={classId}
      />

      <Modal
        open={savedViewsModal}
        onCancel={() => setSavedViewsModal(false)}
        footer={null}
        title="Saved views"
      >
        <List
          dataSource={listSavedViews()}
          locale={{ emptyText: 'No saved views yet — click "Save view" in the toolbar to create one.' }}
          renderItem={(v) => (
            <List.Item
              actions={[
                <Button key="apply" type="link" onClick={() => applyView(v)}>Apply</Button>,
                <Button
                  key="del"
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => { deleteView(v.id); setSavedViewsModal(false); setTimeout(() => setSavedViewsModal(true), 50); }}
                />,
              ]}
            >
              <List.Item.Meta
                title={v.name}
                description={`${v.scope} · ${v.tab} · ${dayjs(v.dateRange[0]).format('DD MMM')} – ${dayjs(v.dateRange[1]).format('DD MMM')}`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}

function renderTab(key, ctx) {
  const k = `${key}_${ctx.refreshKey}`;
  const props = { ...ctx };
  switch (key) {
    case 'overview':       return <OverviewTab key={k} {...props} />;
    case 'performance':    return <PerformanceTrendsTab key={k} {...props} />;
    case 'weak-areas':     return <WeakAreasTab key={k} {...props} />;
    case 'heatmap':        return <TopicHeatmapTab key={k} {...props} />;
    case 'misconceptions': return <MisconceptionsTab key={k} {...props} />;
    case 'comparisons':    return <ComparisonsTab key={k} {...props} />;
    case 'status':         return <StatusDistributionTab key={k} {...props} />;
    case 'daily-trends':   return <DailyTrendsTab key={k} {...props} />;
    case 'attendance-corr':return <AttendanceCorrelationTab key={k} {...props} />;
    default:               return <Empty />;
  }
}
