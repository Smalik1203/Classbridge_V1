import React, { useEffect, useState } from 'react';
import { Modal, Input, Space, Typography, Tag, Button, Divider, App, Statistic, Row, Col } from 'antd';
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import { reportCommentsService } from '../services/communicationsService';

const { TextArea } = Input;
const { Text, Title } = Typography;

function wordCount(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

export default function ReportCommentEditor({
  open, onClose, comment, onApproved,
}) {
  const { message } = App.useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(comment?.editedComment || comment?.generatedComment || '');
  }, [open, comment]);

  if (!comment) return null;

  const wc = wordCount(text);
  const subjects = comment.inputData?.subjects || [];
  const att = comment.inputData?.attendance;

  const reset = () => setText(comment.generatedComment || '');

  const approve = async () => {
    if (!text.trim()) {
      message.error('Comment cannot be empty');
      return;
    }
    try {
      setBusy(true);
      await reportCommentsService.approve(comment.id, text);
      message.success('Comment approved');
      onApproved?.(text);
      onClose?.();
    } catch (e) {
      message.error(e.message || 'Failed to approve');
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onCancel={busy ? undefined : onClose}
      title={`Edit comment — ${comment.studentName}`}
      width={720}
      footer={[
        <Button key="reset" icon={<ReloadOutlined />} onClick={reset}>Reset to AI</Button>,
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="ok" type="primary" icon={<CheckOutlined />} loading={busy} onClick={approve}>
          Save & approve
        </Button>,
      ]}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={8}><Statistic title="Subjects" value={subjects.length} /></Col>
          <Col xs={12} md={8}><Statistic title="Attendance" value={att?.percentage ?? 0} suffix="%" /></Col>
          <Col xs={12} md={8}><Statistic title="Words" value={wc} suffix="/100" valueStyle={{ color: wc > 100 ? '#DC2626' : wc < 60 ? '#D97706' : '#059669' }} /></Col>
        </Row>

        {subjects.length > 0 && (
          <div>
            <Text strong>Subject averages</Text>
            <div style={{ marginTop: 6 }}>
              {subjects.map((s, i) => (
                <Tag key={i} style={{ marginBottom: 6 }}>
                  {s.subject_name}: {Math.round(s.average_percentage || 0)}%
                </Tag>
              ))}
            </div>
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />

        <div>
          <Text strong>Comment</Text>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoSize={{ minRows: 6, maxRows: 14 }}
            style={{ marginTop: 6 }}
          />
        </div>
      </Space>
    </Modal>
  );
}
