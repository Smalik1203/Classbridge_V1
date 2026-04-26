import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Space, Button, Empty, Alert, Spin, Typography, Divider,
} from 'antd';
import { FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/AuthProvider';
import { getSchoolCode } from '@/shared/utils/metadata';
import { getByStudent, resolveStudentForUser } from '../services/feesService';
import { fmtRupees } from '../utils/money';
import InvoiceDocumentViewer from './InvoiceDocumentViewer';

const { Title, Text } = Typography;

const STATUS_COLORS = { paid: 'green', partial: 'gold', pending: 'red', overdue: 'volcano' };

function deriveStatus(inv) {
  const t = Number(inv.total_amount || 0);
  const p = Number(inv.paid_amount || 0);
  if (p >= t && t > 0) return 'paid';
  if (p > 0) return 'partial';
  if (inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day')) return 'overdue';
  return 'pending';
}

export default function StudentFees() {
  const { user } = useAuth();
  const schoolCode = getSchoolCode(user);
  const [student, setStudent] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docInvoiceId, setDocInvoiceId] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const s = await resolveStudentForUser(user.id);
      if (!s) {
        setError('No student record linked to your account.');
        return;
      }
      setStudent(s);
      const rows = await getByStudent(s.id, schoolCode || s.school_code);
      setInvoices(rows || []);
    } catch (err) {
      setError(err?.message || 'Failed to load your fees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, schoolCode]);

  const totals = useMemo(() => {
    let total = 0, paid = 0;
    for (const inv of invoices) {
      total += Number(inv.total_amount || 0);
      paid += Number(inv.paid_amount || 0);
    }
    return { total, paid, outstanding: Math.max(0, total - paid) };
  }, [invoices]);

  const allPayments = useMemo(() => {
    const flat = [];
    for (const inv of invoices) {
      for (const p of inv.payments || []) {
        flat.push({ ...p, billing_period: inv.billing_period, invoice_id: inv.id });
      }
    }
    return flat.sort((a, b) =>
      new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
    );
  }, [invoices]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" tip="Loading your fees..." />
      </div>
    );
  }

  if (error) {
    return <div style={{ padding: 24 }}><Alert type="error" showIcon message={error} /></div>;
  }

  if (!student) {
    return <div style={{ padding: 24 }}><Empty description="No student record" /></div>;
  }

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: totals.outstanding > 0
            ? 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)'
            : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          border: 'none',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ color: 'white', margin: 0 }}>
              {totals.outstanding > 0 ? 'Outstanding fees' : 'All fees paid'}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              {student.full_name}{student.student_code ? ` · ${student.student_code}` : ''}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtRupees(totals.outstanding)}</div>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              of {fmtRupees(totals.total)} billed · paid {fmtRupees(totals.paid)}
            </Text>
          </div>
        </div>
      </Card>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Total billed" value={fmtRupees(totals.total)} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Paid" value={fmtRupees(totals.paid)} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col xs={24} md={8}><Card size="small"><Statistic title="Outstanding" value={fmtRupees(totals.outstanding)} valueStyle={{ color: '#cf1322' }} /></Card></Col>
      </Row>

      <Card title="My invoices" extra={<Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>}>
        {invoices.length === 0 ? (
          <Empty description="No invoices issued yet" />
        ) : (
          invoices.map((inv) => {
            const status = deriveStatus(inv);
            const balance = Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));
            return (
              <Card
                key={inv.id}
                size="small"
                style={{ marginBottom: 12 }}
                title={
                  <Space>
                    <span>Period: {inv.billing_period}</span>
                    <Tag color={STATUS_COLORS[status]}>{status.toUpperCase()}</Tag>
                    {inv.due_date && (
                      <Text type="secondary">Due {dayjs(inv.due_date).format('DD MMM YYYY')}</Text>
                    )}
                  </Space>
                }
                extra={
                  <Button size="small" icon={<FilePdfOutlined />} onClick={() => setDocInvoiceId(inv.id)}>
                    View document
                  </Button>
                }
              >
                <Row gutter={12}>
                  <Col xs={8}><Statistic title="Total" value={fmtRupees(inv.total_amount)} valueStyle={{ fontSize: 16 }} /></Col>
                  <Col xs={8}><Statistic title="Paid" value={fmtRupees(inv.paid_amount)} valueStyle={{ color: '#3f8600', fontSize: 16 }} /></Col>
                  <Col xs={8}><Statistic title="Balance" value={fmtRupees(balance)} valueStyle={{ color: balance > 0 ? '#cf1322' : '#3f8600', fontSize: 16 }} /></Col>
                </Row>

                {inv.items?.length > 0 && (
                  <>
                    <Divider style={{ margin: '12px 0 8px' }} />
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="id"
                      dataSource={inv.items}
                      columns={[
                        { title: 'Description', dataIndex: 'label' },
                        {
                          title: 'Amount', dataIndex: 'amount', align: 'right', width: 140,
                          render: (v) => <span style={{ color: Number(v) < 0 ? '#cf1322' : undefined }}>{fmtRupees(v)}</span>,
                        },
                      ]}
                    />
                  </>
                )}
              </Card>
            );
          })
        )}
      </Card>

      {allPayments.length > 0 && (
        <Card title="Payment history" style={{ marginTop: 16 }}>
          <Table
            size="small"
            rowKey="id"
            dataSource={allPayments}
            columns={[
              { title: 'Date', dataIndex: 'payment_date', width: 120, render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
              { title: 'Period', dataIndex: 'billing_period', width: 120 },
              { title: 'Amount', dataIndex: 'amount_inr', align: 'right', width: 140, render: (v) => fmtRupees(v) },
              { title: 'Method', dataIndex: 'payment_method', width: 130, render: (v) => <Tag>{v?.replace('_', ' ')}</Tag> },
              { title: 'Receipt #', dataIndex: 'receipt_number', render: (v) => v || '—' },
              { title: 'Remarks', dataIndex: 'remarks', render: (v) => v || '' },
            ]}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      <InvoiceDocumentViewer
        open={!!docInvoiceId}
        invoiceId={docInvoiceId}
        onClose={() => setDocInvoiceId(null)}
      />
    </div>
  );
}
