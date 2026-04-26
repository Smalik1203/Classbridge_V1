import React, { useMemo } from 'react';
import { Card, Row, Col, Empty, Table, Tag } from 'antd';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';
import dayjs from 'dayjs';
import { fmtRupees, fmtRupeesCompact } from '../utils/money';

/**
 * Invoice-first fees analytics. Pure-JS aggregation from the invoice list
 * passed in by the page (no extra Supabase fetches).
 */

const PIE_COLORS = ['#3f8600', '#faad14', '#cf1322', '#fa541c'];

export default function FeeAnalytics({ invoices = [] }) {
  const dailyTrend = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      for (const p of inv.payments || []) {
        const d = dayjs(p.payment_date).format('YYYY-MM-DD');
        const cur = map.get(d) || 0;
        map.set(d, cur + Number(p.amount_inr || 0));
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }, [invoices]);

  const statusBreakdown = useMemo(() => {
    let paid = 0, partial = 0, pending = 0, overdue = 0;
    for (const inv of invoices) {
      const t = Number(inv.total_amount || 0);
      const p = Number(inv.paid_amount || 0);
      const balance = Math.max(0, t - p);
      if (p >= t && t > 0) paid += 1;
      else if (p > 0) partial += 1;
      else if (balance > 0 && inv.due_date && dayjs(inv.due_date).isBefore(dayjs(), 'day')) overdue += 1;
      else pending += 1;
    }
    return [
      { name: 'Paid', value: paid },
      { name: 'Partial', value: partial },
      { name: 'Pending', value: pending },
      { name: 'Overdue', value: overdue },
    ];
  }, [invoices]);

  const periodSummary = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const k = inv.billing_period || 'Unknown';
      const cur = map.get(k) || { period: k, billed: 0, collected: 0, outstanding: 0 };
      cur.billed += Number(inv.total_amount || 0);
      cur.collected += Number(inv.paid_amount || 0);
      cur.outstanding += Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => (a.period || '').localeCompare(b.period || ''));
  }, [invoices]);

  if (!invoices.length) {
    return <Empty description="No invoice data yet — generate fees to see analytics." />;
  }

  return (
    <div>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Card title="Daily collections" size="small">
            {dailyTrend.length === 0 ? (
              <Empty description="No payments recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677ff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD MMM')} />
                    <YAxis tickFormatter={(v) => fmtRupeesCompact(v)} />
                    <Tooltip formatter={(v) => fmtRupees(v)} labelFormatter={(d) => dayjs(d).format('DD MMM YYYY')} />
                    <Area type="monotone" dataKey="amount" stroke="#1677ff" fill="url(#colorAmt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Status breakdown" size="small">
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    label
                  >
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="By billing period" size="small" style={{ marginTop: 12 }}>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={periodSummary}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(v) => fmtRupeesCompact(v)} />
              <Tooltip formatter={(v) => fmtRupees(v)} />
              <Legend />
              <Bar dataKey="collected" stackId="a" fill="#3f8600" name="Collected" />
              <Bar dataKey="outstanding" stackId="a" fill="#cf1322" name="Outstanding" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Period summary" size="small" style={{ marginTop: 12 }}>
        <Table
          size="small"
          rowKey="period"
          pagination={false}
          dataSource={periodSummary}
          columns={[
            { title: 'Period', dataIndex: 'period' },
            { title: 'Billed', dataIndex: 'billed', align: 'right', render: (v) => fmtRupees(v) },
            { title: 'Collected', dataIndex: 'collected', align: 'right', render: (v) => <span style={{ color: '#3f8600' }}>{fmtRupees(v)}</span> },
            { title: 'Outstanding', dataIndex: 'outstanding', align: 'right', render: (v) => <span style={{ color: '#cf1322' }}>{fmtRupees(v)}</span> },
            {
              title: 'Collection rate', align: 'right', width: 140,
              render: (_, r) => {
                const pct = r.billed > 0 ? (r.collected / r.billed) * 100 : 0;
                return <Tag color={pct > 80 ? 'green' : pct > 50 ? 'gold' : 'red'}>{pct.toFixed(1)}%</Tag>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
