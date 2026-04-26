import React, { useState } from 'react';
import { Drawer, Button, Space, Alert, Progress, List, Tag, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { sendPaymentReminder } from '../services/feesService';

export default function BulkRemindersDrawer({ open, onClose, invoices = [] }) {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);

  const handleSend = async () => {
    if (!invoices.length) {
      message.info('Pick at least one invoice');
      return;
    }
    setRunning(true);
    setResults([]);
    setProgress(0);

    const out = [];
    for (let i = 0; i < invoices.length; i += 1) {
      const inv = invoices[i];
      try {
        await sendPaymentReminder(inv.id);
        out.push({ id: inv.id, label: inv.student?.full_name || inv.id, ok: true });
      } catch (err) {
        out.push({ id: inv.id, label: inv.student?.full_name || inv.id, ok: false, error: err?.message || 'failed' });
      }
      setProgress(Math.round(((i + 1) / invoices.length) * 100));
      setResults([...out]);
    }
    const sent = out.filter((r) => r.ok).length;
    message.success(`Sent ${sent}/${invoices.length} reminders`);
    setRunning(false);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Send bulk reminders"
      width={520}
      destroyOnClose
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose} disabled={running}>Close</Button>
          <Button
            type="primary"
            icon={<MailOutlined />}
            loading={running}
            disabled={!invoices.length}
            onClick={handleSend}
          >
            Send {invoices.length} reminder{invoices.length === 1 ? '' : 's'}
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        message="Reminders are sent via the existing send-fee-notification Edge Function — same channel mobile uses."
      />
      {running && (
        <Progress percent={progress} status="active" style={{ marginTop: 16 }} />
      )}
      {results.length > 0 && (
        <List
          style={{ marginTop: 16 }}
          size="small"
          bordered
          dataSource={results}
          renderItem={(r) => (
            <List.Item>
              <Space>
                <Tag color={r.ok ? 'green' : 'red'}>{r.ok ? 'sent' : 'failed'}</Tag>
                <span>{r.label}</span>
                {!r.ok && <span style={{ color: '#cf1322' }}>· {r.error}</span>}
              </Space>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}
