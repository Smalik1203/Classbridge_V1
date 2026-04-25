import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, Select, Radio, Upload, Button, Space, Tag, Typography, App,
} from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  announcementsService, PRIORITY_META,
} from '../services/communicationsService';
import AnnouncementImage from './AnnouncementImage';

const { TextArea } = Input;
const { Text } = Typography;

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

export default function AnnouncementFormModal({
  open, onClose, onSaved, schoolCode, classes = [], editing,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [imagePath, setImagePath] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const ids = editing.class_instance_ids?.length
        ? editing.class_instance_ids
        : (editing.class_instance_id ? [editing.class_instance_id] : []);
      form.setFieldsValue({
        title: editing.title || '',
        message: editing.message || '',
        priority: editing.priority || 'medium',
        target_type: editing.target_type || 'all',
        class_instance_ids: ids,
      });
      setImagePath(editing.image_url || null);
    } else {
      form.resetFields();
      form.setFieldsValue({ priority: 'medium', target_type: 'all', class_instance_ids: [] });
      setImagePath(null);
    }
    setImageFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const handleImagePick = async (file) => {
    setImageFile(file);
    try {
      setUploadingImage(true);
      const path = await announcementsService.uploadImage(file, schoolCode);
      setImagePath(path);
      message.success('Image uploaded');
    } catch (e) {
      message.error(e.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
    return false; // prevent AntD auto upload
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    const title = (values.title || '').trim() || (values.message || '').trim().slice(0, 60);
    const target_type = values.target_type;
    const class_instance_ids = target_type === 'class' ? (values.class_instance_ids || []) : [];

    if (target_type === 'class' && class_instance_ids.length === 0) {
      message.error('Select at least one class');
      return;
    }

    const payload = {
      title,
      message: values.message,
      priority: values.priority,
      target_type,
      class_instance_id: class_instance_ids[0] || null,
      class_instance_ids,
      image_url: imagePath || null,
      school_code: schoolCode,
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await announcementsService.update(editing.id, {
          title: payload.title,
          message: payload.message,
          priority: payload.priority,
          image_url: payload.image_url,
          target_type: payload.target_type,
          class_instance_id: payload.class_instance_id,
          class_instance_ids: payload.class_instance_ids,
        });
        message.success('Announcement updated');
      } else {
        const res = await announcementsService.create(payload);
        const notified = res?.notified;
        message.success(
          notified != null
            ? `Announcement posted • ${notified} recipient${notified === 1 ? '' : 's'} notified`
            : 'Announcement posted'
        );
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      message.error(e.message || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={submitting ? undefined : onClose}
      title={isEdit ? 'Edit Announcement' : 'Post Announcement'}
      onOk={handleSubmit}
      okText={isEdit ? 'Save changes' : 'Post'}
      confirmLoading={submitting}
      width={680}
      destroyOnClose
    >
      <Form layout="vertical" form={form} initialValues={{ priority: 'medium', target_type: 'all' }}>
        <Form.Item label="Title (optional)" name="title">
          <Input placeholder="Auto-fills from message if blank" maxLength={120} />
        </Form.Item>

        <Form.Item
          label="Message"
          name="message"
          rules={[{ required: true, whitespace: true, message: 'Message is required' }]}
        >
          <TextArea autoSize={{ minRows: 4, maxRows: 10 }} placeholder="Share an update with the school…" />
        </Form.Item>

        <Form.Item label="Priority" name="priority" rules={[{ required: true }]}>
          <Radio.Group buttonStyle="solid" optionType="button">
            {PRIORITIES.map((p) => (
              <Radio.Button key={p} value={p} style={{ textTransform: 'capitalize' }}>
                <span style={{ marginRight: 4 }}>{PRIORITY_META[p].icon}</span>{PRIORITY_META[p].label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>

        <Form.Item label="Audience" name="target_type" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="all">Everyone in school</Radio>
            <Radio value="class">Specific classes</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item shouldUpdate={(p, c) => p.target_type !== c.target_type} noStyle>
          {({ getFieldValue }) => getFieldValue('target_type') === 'class' && (
            <Form.Item
              label="Classes"
              name="class_instance_ids"
              rules={[{ required: true, message: 'Select at least one class', type: 'array', min: 1 }]}
            >
              <Select
                mode="multiple"
                placeholder="Select one or more classes"
                allowClear
                showSearch
                optionFilterProp="label"
                options={classes.map((c) => ({
                  value: c.id,
                  label: `Grade ${c.grade}-${c.section}`,
                }))}
              />
            </Form.Item>
          )}
        </Form.Item>

        <Form.Item label="Image (optional)">
          {imagePath ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <AnnouncementImage path={imagePath} height={180} />
              <Button danger icon={<DeleteOutlined />} onClick={() => { setImagePath(null); setImageFile(null); }}>
                Remove image
              </Button>
            </Space>
          ) : (
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={handleImagePick}
              fileList={imageFile ? [{ uid: '1', name: imageFile.name, status: uploadingImage ? 'uploading' : 'done' }] : []}
              onRemove={() => { setImageFile(null); setImagePath(null); return true; }}
            >
              <Button icon={<UploadOutlined />} loading={uploadingImage}>Choose image</Button>
            </Upload>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            Stored in the <Tag>Lms</Tag> bucket at <code>announcements/{schoolCode}/…</code>
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  );
}
