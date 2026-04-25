import React, { useEffect, useState } from 'react';
import {
  Drawer, Descriptions, Tag, Space, Button, Divider, App, Typography, Timeline,
  Empty, Alert, Skeleton, Popconfirm, Input,
} from 'antd';
import {
  EditOutlined, DeleteOutlined, RollbackOutlined, HistoryOutlined,
  LockOutlined, LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { financeTransactionsService, financeAuditService } from '../services/financeService';

const { Text, Paragraph } = Typography;

/**
 * Read-only-by-default detail drawer with Edit / Void / Restore affordances.
 * Fee-derived rows show a lock badge — they can only be reversed via the
 * underlying fee receipt to keep the books reconciled.
 */
export default function TransactionDetailDrawer({
  open, onClose, txn, schoolCode, userId, userRole, onChanged, onEdit,
}) {
  const { message, modal } = App.useApp();
  const [links, setLinks]       = useState([]);
  const [audit, setAudit]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [voiding, setVoiding]   = useState(false);
  const [restoring, setRestore] = useState(false);

  useEffect(() => {
    if (!open || !txn?.id) return;
    setLoading(true);
    Promise.all([
      financeTransactionsService.getLinks(txn.id),
      financeAuditService.listRecent({ schoolCode, resourceType: 'transaction', resourceId: txn.id, limit: 25 }),
    ]).then(([l, a]) => {
      setLinks(l);
      setAudit(a);
    }).finally(() => setLoading(false));
  }, [open, txn?.id, schoolCode]);

  if (!txn) return null;

  const isFeeDerived     = links.some(l => l.source_type === 'fee_payment');
  const isPayrollDerived = links.some(l => l.source_type === 'salary');
  const isReadOnly       = isFeeDerived || isPayrollDerived;
  const isDeleted        = !!txn.deleted_at;

  const handleVoid = (reason) => {
    setVoiding(true);
    financeTransactionsService.softDelete({ id: txn.id, schoolCode, userId, userRole, reason })
      .then(() => {
        message.success('Transaction voided');
        onChanged?.();
        onClose?.();
      })
      .catch(err => message.error(err.message || 'Void failed'))
      .finally(() => setVoiding(false));
  };

  const promptVoid = () => {
    let reason = '';
    modal.confirm({
      title: 'Void this transaction?',
      icon: <DeleteOutlined style={{ color: '#ef4444' }} />,
      content: (
        <div>
          <Paragraph>
            This will <Text strong>soft-delete</Text> the transaction. It will
            disappear from reports and totals, but remains in the audit log.
          </Paragraph>
          <Paragraph>Please give a reason (required):</Paragraph>
          <Input.TextArea rows={3} onChange={(e) => { reason = e.target.value; }} placeholder="e.g. Posted in error / duplicate of #..." />
        </div>
      ),
      okText: 'Void', okButtonProps: { danger: true },
      onOk: () => {
        if (!reason || reason.trim().length < 4) {
          message.warning('Please give a reason of at least 4 characters');
          return Promise.reject();
        }
        // Confirm twice for irreversible-feeling action.
        return new Promise((resolve, reject) => {
          modal.confirm({
            title: 'Are you sure?',
            content: 'Confirm one more time. The transaction will be voided.',
            okText: 'Yes, void it', okButtonProps: { danger: true },
            onOk: () => { handleVoid(reason); resolve(); },
            onCancel: () => reject(),
          });
        });
      },
    });
  };

  const handleRestore = () => {
    setRestore(true);
    financeTransactionsService.restore({ id: txn.id, schoolCode, userId, userRole })
      .then(() => {
        message.success('Transaction restored');
        onChanged?.();
        onClose?.();
      })
      .catch(err => message.error(err.message || 'Restore failed'))
      .finally(() => setRestore(false));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <Space>
          {txn.type === 'income' ? <Tag color="green">Income</Tag> : <Tag color="red">Expense</Tag>}
          <span>Transaction</span>
          {isFeeDerived     && <Tag color="blue"   icon={<LockOutlined />}>fee-derived</Tag>}
          {isPayrollDerived && <Tag color="purple" icon={<LockOutlined />}>payroll-derived</Tag>}
          {isDeleted        && <Tag color="orange">voided</Tag>}
        </Space>
      }
      extra={
        <Space>
          {!isReadOnly && !isDeleted && (
            <Button icon={<EditOutlined />} onClick={() => onEdit?.(txn)}>Edit</Button>
          )}
          {!isReadOnly && !isDeleted && (
            <Button danger icon={<DeleteOutlined />} loading={voiding} onClick={promptVoid}>Void</Button>
          )}
          {isDeleted && (
            <Popconfirm title="Restore this transaction?" onConfirm={handleRestore}>
              <Button type="primary" icon={<RollbackOutlined />} loading={restoring}>Restore</Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      {isReadOnly && (
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message={isFeeDerived ? 'This is a fee-derived transaction' : 'This is a payroll-derived transaction'}
          description={
            isFeeDerived
              ? 'It was posted automatically when a fee receipt was recorded. Reverse the underlying fee payment to remove this entry.'
              : 'It was posted automatically when payroll was locked. Reverse the underlying payroll run to remove this entry.'
          }
        />
      )}

      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Date">{dayjs(txn.txn_date).format('DD MMMM YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Amount">
          <Text strong style={{ fontSize: 18, color: txn.type === 'income' ? '#10b981' : '#ef4444' }}>
            {txn.type === 'income' ? '+' : '−'} ₹{Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Category">{txn.category?.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Account">
          {txn.account ? (
            <Space>{txn.account.name} <Tag color={txn.account.type === 'cash' ? 'green' : txn.account.type === 'bank' ? 'blue' : 'purple'}>{txn.account.type}</Tag></Space>
          ) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Description">{txn.description || <Text type="secondary">—</Text>}</Descriptions.Item>
        <Descriptions.Item label="Created">{dayjs(txn.created_at).format('DD MMM YYYY hh:mm A')}</Descriptions.Item>
        {txn.updated_at !== txn.created_at && (
          <Descriptions.Item label="Updated">{dayjs(txn.updated_at).format('DD MMM YYYY hh:mm A')}</Descriptions.Item>
        )}
        {isDeleted && (
          <Descriptions.Item label="Voided at">{dayjs(txn.deleted_at).format('DD MMM YYYY hh:mm A')}</Descriptions.Item>
        )}
      </Descriptions>

      {links.length > 0 && (
        <>
          <Divider orientation="left"><Space><LinkOutlined />Source links</Space></Divider>
          {links.map(l => (
            <div key={l.id} style={{ marginBottom: 6 }}>
              <Tag>{l.source_type}</Tag>
              <Text code copyable>{l.source_id}</Text>
            </div>
          ))}
        </>
      )}

      <Divider orientation="left"><Space><HistoryOutlined />Audit timeline</Space></Divider>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : audit.length === 0 ? (
        <Empty description="No audit entries (audit log RLS may hide rows)" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline
          items={audit.map(a => ({
            color: a.event_type === 'create' ? 'green' : a.event_type === 'delete' ? 'red' : 'blue',
            children: (
              <div>
                <div><Text strong style={{ textTransform: 'capitalize' }}>{a.event_type}</Text> by <Text code>{a.user_role}</Text></div>
                <div><Text type="secondary" style={{ fontSize: 12 }}>{dayjs(a.created_at).format('DD MMM YYYY hh:mm A')}</Text></div>
                {a.action_details && Object.keys(a.action_details).length > 0 && (
                  <Paragraph code style={{ marginTop: 4, fontSize: 11 }}>
                    {JSON.stringify(a.action_details, null, 2)}
                  </Paragraph>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
