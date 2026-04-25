import React, { useEffect, useState } from 'react';
import {
  Card, Button, Space, Typography, Tag, App, Result, Skeleton, Empty,
  DatePicker, Collapse, Row, Col, Statistic, Alert, Table,
} from 'antd';
import {
  ReloadOutlined, WarningOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthProvider';
import { getUserRole } from '@/shared/utils/metadata';
import { resolveSchoolCode, financeAuditService } from '../services/financeService';

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const SEVERITY_COLOR = { high: 'red', medium: 'orange', low: 'blue' };

export default function Inconsistencies() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [range, setRange] = useState([dayjs().subtract(3, 'month'), dayjs()]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resolveSchoolCode(user)
      .then(setSchoolCode)
      .catch(err => setAccessError(err.message || 'Could not determine school'));
  }, [user]);

  const refresh = async () => {
    if (!schoolCode) return;
    setLoading(true);
    try {
      const data = await financeAuditService.detectInconsistencies({
        schoolCode,
        startDate: range[0].format('YYYY-MM-DD'),
        endDate:   range[1].format('YYYY-MM-DD'),
      });
      setItems(data);
    } catch (err) {
      message.error(err.message || 'Inconsistency check failed (RPC may be unavailable)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [schoolCode]);

  if (accessError) {
    return <Result status="warning" title="Cannot load Finance" subTitle={accessError}
             extra={<Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>} />;
  }

  const totals = {
    high:   items.filter(i => i.severity === 'high'  ).reduce((s, i) => s + i.affected_count, 0),
    medium: items.filter(i => i.severity === 'medium').reduce((s, i) => s + i.affected_count, 0),
    low:    items.filter(i => i.severity === 'low'   ).reduce((s, i) => s + i.affected_count, 0),
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ margin: 0 }}><WarningOutlined /> Inconsistencies</Title>
            <Text type="secondary">Server-side data-integrity scan via <Text code>detect_finance_inconsistencies</Text>.</Text>
          </Col>
          <Col>
            <Space wrap>
              <RangePicker value={range} onChange={(v) => v && setRange(v)} format="DD MMM YYYY" allowClear={false} />
              <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={refresh}>Run scan</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card><Statistic title="High severity"   value={totals.high}   valueStyle={{ color: '#ef4444' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Medium severity" value={totals.medium} valueStyle={{ color: '#f59e0b' }} prefix={<WarningOutlined />} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Low severity"    value={totals.low}    valueStyle={{ color: '#0ea5e9' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      ) : items.length === 0 ? (
        <Card>
          <Result status="success" icon={<CheckCircleOutlined />}
            title="No inconsistencies detected"
            subTitle="Server scan returned a clean bill of health for the selected period." />
        </Card>
      ) : (
        <>
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="What does each finding mean?"
            description="The Supabase function detect_finance_inconsistencies inspects fee_payments vs finance_transactions, orphaned links, totals drift, and other invariants. Expand each row to see the affected records — fixes are usually applied via the underlying record (e.g. re-record a missing fee payment)."
          />
          <Card>
            <Collapse
              accordion
              items={items.map((it, idx) => ({
                key: String(idx),
                label: (
                  <Space>
                    <Tag color={SEVERITY_COLOR[it.severity] || 'default'}>{it.severity?.toUpperCase()}</Tag>
                    <Text strong>{it.inconsistency_type}</Text>
                    <Tag>{it.affected_count} affected</Tag>
                  </Space>
                ),
                children: (
                  <>
                    <Paragraph>{it.description}</Paragraph>
                    {Array.isArray(it.details) && it.details.length > 0 ? (
                      <Table
                        size="small"
                        dataSource={it.details.map((d, i) => ({ key: i, ...(typeof d === 'object' ? d : { value: d }) }))}
                        columns={
                          (typeof it.details[0] === 'object' ? Object.keys(it.details[0]) : ['value']).map(k => ({
                            title: k, dataIndex: k,
                            render: (v) => v == null ? '—' : (typeof v === 'object' ? <Text code>{JSON.stringify(v)}</Text> : String(v)),
                          }))
                        }
                        pagination={{ pageSize: 25 }}
                      />
                    ) : (
                      <Empty description="No row-level details exposed by the RPC" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </>
                ),
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}
