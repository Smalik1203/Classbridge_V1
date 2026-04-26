import React from 'react';
import { Card, Row, Col, Select, DatePicker, Segmented, Button, Space, Tooltip } from 'antd';
import { ReloadOutlined, DownloadOutlined, PrinterOutlined, SaveOutlined, SwapOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;

const QUICK = [
  { label: 'Last 7d', value: '7' },
  { label: 'Last 30d', value: '30' },
  { label: 'Last 90d', value: '90' },
  { label: 'Term', value: 'term' },
  { label: 'Year', value: 'year' },
];

export default function AnalyticsToolbar({
  scope, onScopeChange,
  classes = [], classId, onClassChange,
  students = [], studentId, onStudentChange,
  subjects = [], subjectId, onSubjectChange,
  dateRange, onDateRangeChange,
  onQuickRange,
  onRefresh, onExportCsv, onPrint, onSaveView, onCompare,
  loading,
  hideExtras = false,
}) {
  return (
    <Card
      style={{ marginBottom: 16, background: '#fafafa', border: '1px solid #e5e7eb', boxShadow: 'none' }}
      bodyStyle={{ padding: 14 }}
    >
      <Row gutter={[12, 12]} align="middle">
        {scope !== undefined && (
          <Col>
            <Segmented
              value={scope}
              onChange={onScopeChange}
              options={[
                { label: 'School', value: 'school' },
                { label: 'Class', value: 'class' },
                { label: 'Student', value: 'student' },
              ]}
            />
          </Col>
        )}

        {(scope === 'class' || scope === 'student') && (
          <Col flex="220px">
            <Select
              placeholder="Select class"
              style={{ width: '100%' }}
              value={classId || undefined}
              onChange={onClassChange}
              options={classes.map((c) => ({ value: c.id, label: c.label }))}
              showSearch
              optionFilterProp="label"
              allowClear={scope !== 'class'}
            />
          </Col>
        )}

        {scope === 'student' && (
          <Col flex="240px">
            <Select
              placeholder="Select student"
              style={{ width: '100%' }}
              value={studentId || undefined}
              onChange={onStudentChange}
              options={students.map((s) => ({
                value: s.id,
                label: `${s.full_name}${s.student_code ? ` (${s.student_code})` : ''}`,
              }))}
              showSearch
              optionFilterProp="label"
              disabled={!classId}
            />
          </Col>
        )}

        <Col flex="220px">
          <Select
            placeholder="All subjects"
            style={{ width: '100%' }}
            value={subjectId}
            onChange={onSubjectChange}
            allowClear
            options={[{ value: 'all', label: 'All subjects' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            showSearch
            optionFilterProp="label"
          />
        </Col>

        <Col flex="280px">
          <RangePicker
            style={{ width: '100%' }}
            value={dateRange}
            onChange={onDateRangeChange}
            allowClear={false}
          />
        </Col>

        {onQuickRange && (
          <Col>
            <Segmented
              size="small"
              options={QUICK}
              onChange={onQuickRange}
            />
          </Col>
        )}

        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Space>
            {onRefresh && (
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading} />
              </Tooltip>
            )}
            {!hideExtras && onExportCsv && (
              <Tooltip title="Export CSV">
                <Button icon={<DownloadOutlined />} onClick={onExportCsv}>Export</Button>
              </Tooltip>
            )}
            {!hideExtras && onPrint && (
              <Tooltip title="Print report">
                <Button icon={<PrinterOutlined />} onClick={onPrint}>Print</Button>
              </Tooltip>
            )}
            {!hideExtras && onCompare && (
              <Tooltip title="Compare side-by-side">
                <Button icon={<SwapOutlined />} onClick={onCompare}>Compare</Button>
              </Tooltip>
            )}
            {!hideExtras && onSaveView && (
              <Tooltip title="Save current filter combo as a named view">
                <Button icon={<SaveOutlined />} onClick={onSaveView}>Save view</Button>
              </Tooltip>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
