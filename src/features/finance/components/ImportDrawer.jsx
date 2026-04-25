import React, { useEffect, useState } from 'react';
import {
  Drawer, Upload, Button, Alert, Table, Tag, Space, Typography, App, Progress,
  Steps, Statistic, Row, Col, Divider, Empty,
} from 'antd';
import { InboxOutlined, UploadOutlined, FileExcelOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import { parseImportFile } from '../services/financeExportService';
import {
  financeAccountsService,
  financeCategoriesService,
  financeTransactionsService,
} from '../services/financeService';

const { Text, Paragraph } = Typography;

/**
 * CSV / XLSX import for opening balances and historical entries.
 * Workflow: pick file → parse rows → resolve account / category names to IDs
 * → preview → bulk-create through the same single-row create path.
 */
export default function ImportDrawer({ open, onClose, onSuccess, schoolCode, userId, userRole }) {
  const { message, modal } = App.useApp();
  const [step, setStep]           = useState(0);
  const [parsedRows, setParsedRows] = useState([]);
  const [resolved, setResolved]   = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [progress, setProgress]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setParsedRows([]); setResolved([]); setProgress(null); setResult(null);
    Promise.all([
      financeAccountsService.list(schoolCode, { includeInactive: true }),
      financeCategoriesService.list(schoolCode, { includeInactive: true }),
    ]).then(([acc, cat]) => {
      setAccounts(acc);
      setCategories(cat);
    });
  }, [open, schoolCode]);

  const beforeUpload = async (file) => {
    try {
      const rows = await parseImportFile(file);
      setParsedRows(rows);
      const accIdx = new Map(accounts.map(a => [a.name.trim().toLowerCase(), a]));
      const catIdx = new Map(categories.map(c => [`${c.type}:${c.name.trim().toLowerCase()}`, c]));
      const out = rows.map(r => {
        const acc = accIdx.get(r.account_name.toLowerCase());
        const cat = catIdx.get(`${r.type}:${r.category_name.toLowerCase()}`);
        const errors = [];
        if (!r.txn_date) errors.push('missing date');
        if (!['income', 'expense'].includes(r.type)) errors.push('type must be income/expense');
        if (!Number.isFinite(r.amount) || r.amount <= 0) errors.push('amount must be > 0');
        if (!cat) errors.push(`category "${r.category_name}" (${r.type}) not found`);
        if (!acc) errors.push(`account "${r.account_name}" not found`);
        return { ...r, account: acc, category: cat, errors };
      });
      setResolved(out);
      setStep(1);
    } catch (err) {
      message.error(err.message || 'Could not parse file');
    }
    return false; // prevent default upload
  };

  const validRows = resolved.filter(r => r.errors.length === 0);
  const invalidRows = resolved.filter(r => r.errors.length > 0);

  const handleImport = () => {
    if (!validRows.length) {
      message.warning('No valid rows to import');
      return;
    }
    modal.confirm({
      title: `Import ${validRows.length} transaction${validRows.length === 1 ? '' : 's'}?`,
      content: invalidRows.length
        ? `${invalidRows.length} row${invalidRows.length === 1 ? '' : 's'} will be skipped due to errors. Continue?`
        : 'These will be posted as manual transactions with full audit trail.',
      okText: 'Import',
      onOk: async () => {
        setSubmitting(true);
        setProgress({ done: 0, total: validRows.length });
        try {
          const payload = validRows.map(r => ({
            txn_date: r.txn_date,
            amount: r.amount,
            type: r.type,
            category_id: r.category.id,
            account_id: r.account.id,
            description: r.description,
            source_type: 'manual',
          }));
          const res = await financeTransactionsService.bulkCreate({
            schoolCode, rows: payload, userId, userRole,
            onProgress: (done, total) => setProgress({ done, total }),
          });
          setResult(res);
          setStep(2);
          if (res.failed === 0) {
            message.success(`Imported ${res.ok} transactions`);
          } else {
            message.warning(`Imported ${res.ok} · ${res.failed} failed`);
          }
          onSuccess?.();
        } catch (err) {
          message.error(err.message || 'Import failed');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const previewCols = [
    { title: '#', dataIndex: '_row', width: 60 },
    { title: 'Date', dataIndex: 'txn_date', width: 110 },
    { title: 'Type', dataIndex: 'type', width: 90,
      render: (v) => v === 'income' ? <Tag color="green">income</Tag> : v === 'expense' ? <Tag color="red">expense</Tag> : <Tag>{v}</Tag> },
    { title: 'Amount', dataIndex: 'amount', width: 110,
      render: (v) => Number.isFinite(v) ? `₹${Number(v).toLocaleString('en-IN')}` : <Text type="danger">{String(v)}</Text> },
    { title: 'Category', dataIndex: 'category_name',
      render: (v, r) => r.category ? <Tag color="blue">{v}</Tag> : <Text type="danger">{v || '(blank)'}</Text> },
    { title: 'Account', dataIndex: 'account_name',
      render: (v, r) => r.account ? <Tag color="cyan">{v}</Tag> : <Text type="danger">{v || '(blank)'}</Text> },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'Status', width: 220,
      render: (_, r) => r.errors.length === 0
        ? <Tag color="green">ready</Tag>
        : <Space size={4} wrap>{r.errors.map((e, i) => <Tag key={i} color="red" style={{ fontSize: 11 }}>{e}</Tag>)}</Space>
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={Math.min(1100, typeof window !== 'undefined' ? window.innerWidth - 100 : 1000)}
      title={<Space><FileExcelOutlined />Import transactions <Tag color="blue">web-native</Tag></Space>}
      destroyOnClose
      extra={
        <Space>
          {step === 1 && (
            <Button icon={<ReloadOutlined />} onClick={() => { setStep(0); setParsedRows([]); setResolved([]); }}>
              Pick another file
            </Button>
          )}
          {step === 1 && (
            <Button type="primary" icon={<ThunderboltOutlined />} loading={submitting} disabled={!validRows.length} onClick={handleImport}>
              Import {validRows.length} row{validRows.length === 1 ? '' : 's'}
            </Button>
          )}
        </Space>
      }
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 16 }}
        items={[
          { title: 'Upload file' },
          { title: 'Preview & resolve' },
          { title: 'Done' },
        ]}
      />

      {step === 0 && (
        <>
          <Alert
            type="info" showIcon
            message="Expected columns"
            description={
              <Paragraph style={{ marginBottom: 0 }}>
                <Text code>Date</Text> (YYYY-MM-DD or any parseable form),
                <Text code> Type</Text> (income/expense),
                <Text code> Amount</Text> (positive number),
                <Text code> Category</Text> (must already exist),
                <Text code> Account</Text> (must already exist),
                <Text code> Description</Text> (optional).
              </Paragraph>
            }
            style={{ marginBottom: 16 }}
          />
          <Upload.Dragger
            multiple={false}
            beforeUpload={beforeUpload}
            accept=".csv,.xlsx,.xls"
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag a .csv / .xlsx / .xls file</p>
            <p className="ant-upload-hint">Each row becomes one finance_transactions row, posted as <Tag>manual</Tag> with full audit trail.</p>
          </Upload.Dragger>
        </>
      )}

      {step === 1 && (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}><Statistic title="Rows in file" value={resolved.length} /></Col>
            <Col span={6}><Statistic title="Ready to import" value={validRows.length} valueStyle={{ color: '#10b981' }} /></Col>
            <Col span={6}><Statistic title="Need fixing" value={invalidRows.length} valueStyle={{ color: '#ef4444' }} /></Col>
            <Col span={6}>
              <Statistic title="Total amount (valid)" prefix="₹" precision={2}
                value={validRows.reduce((s, r) => s + Number(r.amount || 0), 0)} />
            </Col>
          </Row>
          {invalidRows.length > 0 && (
            <Alert
              type="warning" showIcon style={{ marginBottom: 12 }}
              message={`${invalidRows.length} row${invalidRows.length === 1 ? ' has an issue' : 's have issues'}`}
              description="Categories and accounts must already exist (create them under Accounts & Categories first). Only rows tagged 'ready' will be imported."
            />
          )}
          {progress && progress.total > 1 && (
            <Progress percent={Math.round((progress.done / progress.total) * 100)} status="active"
              style={{ marginBottom: 12 }} />
          )}
          <Table
            size="small"
            dataSource={resolved}
            columns={previewCols}
            rowKey="_row"
            scroll={{ x: 1100, y: 'calc(100vh - 420px)' }}
            pagination={{ pageSize: 50 }}
            rowClassName={(r) => r.errors.length ? 'finance-import-error-row' : ''}
          />
        </>
      )}

      {step === 2 && result && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Statistic title="Imported" value={result.ok} valueStyle={{ color: '#10b981' }} /></Col>
            <Col span={8}><Statistic title="Failed"   value={result.failed} valueStyle={{ color: '#ef4444' }} /></Col>
            <Col span={8}><Statistic title="Total"    value={result.ok + result.failed} /></Col>
          </Row>
          {result.errors.length === 0 ? (
            <Empty description="All rows imported cleanly" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <>
              <Divider orientation="left">Errors</Divider>
              <Table
                size="small"
                dataSource={result.errors}
                columns={[
                  { title: 'Row', dataIndex: 'row', width: 80 },
                  { title: 'Message', dataIndex: 'message' },
                ]}
                rowKey={(r) => `${r.row}-${r.message}`}
                pagination={false}
              />
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
