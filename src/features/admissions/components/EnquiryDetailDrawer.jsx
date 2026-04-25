import React, { useEffect, useState, useMemo } from 'react';
import {
  Drawer, Tag, Button, Space, Typography, Divider, Skeleton, Empty, Input, Select,
  App, Popconfirm, Tooltip, Steps, Avatar, Descriptions, Timeline,
} from 'antd';
import {
  PhoneOutlined, MailOutlined, MessageOutlined, UserOutlined, EnvironmentOutlined,
  CloseCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined, CalendarOutlined,
  HomeOutlined, FileTextOutlined, CheckCircleOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  admissionsService, STATUS_META, PIPELINE_STEPS, FOLLOWUP_TYPES, SOURCES, PRIORITIES,
} from '../services/admissionsService';

dayjs.extend(relativeTime);
const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const FOLLOWUP_ICONS = {
  call: <PhoneOutlined />,
  whatsapp: <WhatsAppOutlined />,
  email: <MailOutlined />,
  visit: <EnvironmentOutlined />,
  note: <FileTextOutlined />,
};
const FOLLOWUP_COLORS = {
  call: '#3b82f6',
  whatsapp: '#10b981',
  email: '#f59e0b',
  visit: '#8b5cf6',
  note: '#6B7280',
};

function sourceLabel(v) {
  return SOURCES.find(s => s.value === v)?.label || v;
}
function priorityMeta(v) {
  return PRIORITIES.find(p => p.value === v) || PRIORITIES[1];
}

export default function EnquiryDetailDrawer({ open, enquiryId, onClose, canManage, onChanged, onEdit }) {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [enquiry, setEnquiry] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [busy, setBusy] = useState(false);

  const [showAddFollowup, setShowAddFollowup] = useState(false);
  const [followupType, setFollowupType] = useState('call');
  const [followupNote, setFollowupNote] = useState('');

  const reload = async () => {
    if (!enquiryId) return;
    try {
      setLoading(true);
      const [det, fups] = await Promise.all([
        admissionsService.getById(enquiryId),
        admissionsService.listFollowups(enquiryId),
      ]);
      setEnquiry(det);
      setFollowups(fups);
    } catch (e) {
      message.error(e.message || 'Failed to load enquiry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && enquiryId) {
      reload();
      setShowAddFollowup(false);
      setFollowupNote('');
      setFollowupType('call');
    }
  }, [open, enquiryId]);

  const setStatus = async (status) => {
    if (!enquiry) return;
    try {
      setBusy(true);
      await admissionsService.updateStatus(enquiry.id, status);
      message.success(`Marked as ${STATUS_META[status].label}`);
      await reload();
      onChanged?.();
    } catch (e) {
      message.error(e.message || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  const removeEnquiry = async () => {
    if (!enquiry) return;
    try {
      setBusy(true);
      await admissionsService.delete(enquiry.id);
      message.success('Enquiry deleted');
      onChanged?.();
      onClose();
    } catch (e) {
      message.error(e.message || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const addFollowup = async () => {
    if (!followupNote.trim()) {
      message.warning('Note cannot be empty');
      return;
    }
    try {
      setBusy(true);
      await admissionsService.addFollowup(enquiry.id, {
        type: followupType,
        note: followupNote.trim(),
      });
      setFollowupNote('');
      setShowAddFollowup(false);
      await reload();
      message.success('Follow-up logged');
    } catch (e) {
      message.error(e.message || 'Failed to add follow-up');
    } finally {
      setBusy(false);
    }
  };

  const currentStepIndex = useMemo(() => {
    if (!enquiry) return 0;
    if (enquiry.status === 'rejected') return -1;
    return PIPELINE_STEPS.indexOf(enquiry.status);
  }, [enquiry]);

  const meta = enquiry ? STATUS_META[enquiry.status] : null;
  const pri = enquiry ? priorityMeta(enquiry.priority) : null;

  return (
    <Drawer
      title={
        loading || !enquiry ? 'Enquiry' : (
          <Space size={8} wrap>
            <span style={{ fontWeight: 600 }}>{enquiry.student_name}</span>
            <Tag color={meta?.color} style={{ borderRadius: 12, padding: '2px 10px', border: 'none', color: '#fff' }}>
              {meta?.label}
            </Tag>
            <Tag color={pri?.color} style={{ borderRadius: 12, border: 'none', color: '#fff' }}>
              {pri?.label} priority
            </Tag>
          </Space>
        )
      }
      open={open}
      onClose={onClose}
      width={Math.min(720, window.innerWidth - 24)}
      destroyOnClose
      extra={
        canManage && enquiry ? (
          <Space>
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} onClick={() => onEdit?.(enquiry)} />
            </Tooltip>
            <Popconfirm title="Delete this enquiry?" okType="danger" onConfirm={removeEnquiry}>
              <Button danger icon={<DeleteOutlined />} loading={busy} />
            </Popconfirm>
          </Space>
        ) : null
      }
    >
      {loading || !enquiry ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          {/* Pipeline progress */}
          <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: 0.5 }}>
              ADMISSION PIPELINE
            </Text>
            <div style={{ marginTop: 12 }}>
              <Steps
                size="small"
                current={currentStepIndex < 0 ? 0 : currentStepIndex}
                status={enquiry.status === 'rejected' ? 'error' : (enquiry.status === 'admitted' ? 'finish' : 'process')}
                items={PIPELINE_STEPS.map((s, idx) => ({
                  title: STATUS_META[s].label,
                  onClick: canManage && enquiry.status !== s ? () => {
                    modal.confirm({
                      title: `Move to ${STATUS_META[s].label}?`,
                      okText: 'Yes, advance',
                      onOk: () => setStatus(s),
                    });
                  } : undefined,
                  style: canManage ? { cursor: 'pointer' } : undefined,
                  icon: idx <= currentStepIndex ? <CheckCircleOutlined /> : undefined,
                }))}
              />
            </div>
            {canManage && enquiry.status !== 'rejected' && enquiry.status !== 'admitted' && (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Popconfirm
                  title="Mark this enquiry as rejected?"
                  okType="danger"
                  onConfirm={() => setStatus('rejected')}
                >
                  <Button danger icon={<CloseCircleOutlined />} size="small">
                    Mark as Rejected
                  </Button>
                </Popconfirm>
              </div>
            )}
            {enquiry.status === 'rejected' && canManage && (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => setStatus('new')}>Reopen as New</Button>
              </div>
            )}
          </div>

          {/* Contact */}
          <Title level={5} style={{ margin: '0 0 8px' }}>Contact</Title>
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label={<><UserOutlined /> {enquiry.parent_relationship || 'Parent'}</>}>
              {enquiry.parent_name}
            </Descriptions.Item>
            <Descriptions.Item label={<><PhoneOutlined /> Phone</>}>
              <a href={`tel:${enquiry.parent_phone}`}>{enquiry.parent_phone}</a>
              {enquiry.parent_phone && (
                <a
                  href={`https://wa.me/${enquiry.parent_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 12 }}
                >
                  <WhatsAppOutlined style={{ color: '#25D366' }} /> WhatsApp
                </a>
              )}
            </Descriptions.Item>
            {enquiry.parent_email && (
              <Descriptions.Item label={<><MailOutlined /> Email</>}>
                <a href={`mailto:${enquiry.parent_email}`}>{enquiry.parent_email}</a>
              </Descriptions.Item>
            )}
            {enquiry.address && (
              <Descriptions.Item label={<><HomeOutlined /> Address</>}>
                {enquiry.address}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Details */}
          <Title level={5} style={{ margin: '0 0 8px' }}>Details</Title>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Class">{enquiry.class_applying_for}</Descriptions.Item>
            <Descriptions.Item label="Source">{sourceLabel(enquiry.source)}</Descriptions.Item>
            <Descriptions.Item label="Priority">{pri?.label}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">{enquiry.date_of_birth || '—'}</Descriptions.Item>
            <Descriptions.Item label="Gender">{enquiry.gender || '—'}</Descriptions.Item>
            <Descriptions.Item label="Received">
              <Tooltip title={dayjs(enquiry.created_at).format('YYYY-MM-DD HH:mm')}>
                {dayjs(enquiry.created_at).fromNow()}
              </Tooltip>
            </Descriptions.Item>
            <Descriptions.Item label="Assigned To" span={2}>
              {enquiry.assigned_to_name || 'Unassigned'}
            </Descriptions.Item>
            {enquiry.notes && (
              <Descriptions.Item label="Notes" span={2}>
                <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{enquiry.notes}</Paragraph>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Follow-ups */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Title level={5} style={{ margin: 0 }}>Follow-ups ({followups.length})</Title>
            {canManage && (
              <Button
                type={showAddFollowup ? 'default' : 'primary'}
                icon={showAddFollowup ? <CloseCircleOutlined /> : <PlusOutlined />}
                size="small"
                onClick={() => setShowAddFollowup(v => !v)}
              >
                {showAddFollowup ? 'Cancel' : 'Log Follow-up'}
              </Button>
            )}
          </div>

          {showAddFollowup && (
            <div style={{ background: '#F9FAFB', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Space wrap style={{ marginBottom: 8 }}>
                {FOLLOWUP_TYPES.map(t => (
                  <Tag.CheckableTag
                    key={t.type}
                    checked={followupType === t.type}
                    onChange={() => setFollowupType(t.type)}
                    style={{ padding: '4px 12px', borderRadius: 16, border: '1px solid #E5E7EB' }}
                  >
                    <span style={{ marginRight: 6 }}>{FOLLOWUP_ICONS[t.type]}</span>
                    {t.label}
                  </Tag.CheckableTag>
                ))}
              </Space>
              <TextArea
                value={followupNote}
                onChange={e => setFollowupNote(e.target.value)}
                rows={3}
                placeholder="What happened in this interaction?"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button type="primary" loading={busy} onClick={addFollowup} disabled={!followupNote.trim()}>
                  Save Follow-up
                </Button>
              </div>
            </div>
          )}

          {followups.length === 0 ? (
            <Empty description="No follow-ups logged yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Timeline
              items={followups.map(f => ({
                color: FOLLOWUP_COLORS[f.type] || '#6B7280',
                dot: FOLLOWUP_ICONS[f.type],
                children: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ textTransform: 'capitalize' }}>{f.type}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(f.created_at).fromNow()}
                      </Text>
                    </div>
                    <Paragraph style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{f.note}</Paragraph>
                    {f.user_name && (
                      <Text type="secondary" style={{ fontSize: 12 }}>— {f.user_name}</Text>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
