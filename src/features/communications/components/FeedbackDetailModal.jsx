import React, { useState } from 'react';
import { Modal, Descriptions, Tag, Space, Typography, Button, App } from 'antd';
import { CheckOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { feedbackService, SENTIMENT_META, CATEGORY_LABELS } from '../services/communicationsService';

const { Paragraph, Text } = Typography;

const TYPE_LABEL = {
  student_to_admin: 'From student',
  admin_to_student: 'To student',
  management_note: 'Management note',
  superadmin_to_admin: 'Super-admin → admin',
};

export default function FeedbackDetailModal({ open, onClose, item, currentUserId, onChanged }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const sentimentMeta = item.sentiment ? SENTIMENT_META[item.sentiment] : null;
  const fromUser = item.from_user;
  const toUser = item.to_user;
  const subj = item.subject;
  const cls = item.class;

  const archive = async () => {
    try {
      setBusy(true);
      await feedbackService.archive(item.id, currentUserId);
      message.success('Archived');
      onChanged?.();
      onClose?.();
    } catch (e) { message.error(e.message || 'Failed to archive'); }
    finally { setBusy(false); }
  };

  const acknowledge = async () => {
    try {
      setBusy(true);
      await feedbackService.acknowledge(item.id);
      message.success('Acknowledged');
      onChanged?.();
      onClose?.();
    } catch (e) { message.error(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onCancel={busy ? undefined : onClose}
      title="Feedback details"
      width={640}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        item.requires_acknowledgement && !item.acknowledged_at && (
          <Button key="ack" type="primary" icon={<CheckOutlined />} loading={busy} onClick={acknowledge}>
            Acknowledge
          </Button>
        ),
        <Button key="arc" danger icon={<InboxOutlined />} loading={busy} onClick={archive}>
          Archive
        </Button>,
      ].filter(Boolean)}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color="blue">{TYPE_LABEL[item.feedback_type] || item.feedback_type}</Tag>
          <Tag>{CATEGORY_LABELS[item.category] || item.category}</Tag>
          {sentimentMeta && (
            <Tag color={sentimentMeta.color === '#059669' ? 'green' : sentimentMeta.color === '#D97706' ? 'orange' : 'default'}>
              {sentimentMeta.label}
            </Tag>
          )}
          {item.acknowledged_at
            ? <Tag color="green">Acknowledged</Tag>
            : item.requires_acknowledgement && <Tag color="orange">Pending acknowledgement</Tag>}
        </Space>

        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="From">
            {fromUser ? `${fromUser.full_name} (${fromUser.role})` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="To">
            {toUser ? `${toUser.full_name} (${toUser.role})` : '—'}
          </Descriptions.Item>
          {subj && <Descriptions.Item label="Subject">{subj.subject_name}</Descriptions.Item>}
          {cls && <Descriptions.Item label="Class">Grade {cls.grade}-{cls.section}</Descriptions.Item>}
          <Descriptions.Item label="Date">{dayjs(item.created_at).format('DD MMM YYYY · HH:mm')}</Descriptions.Item>
        </Descriptions>

        <div>
          <Text strong>Content</Text>
          <Paragraph style={{ background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 6, marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {item.content}
          </Paragraph>
        </div>
      </Space>
    </Modal>
  );
}
