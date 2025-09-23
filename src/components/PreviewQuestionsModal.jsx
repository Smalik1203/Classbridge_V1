import React from 'react';
import { Modal, Typography, Empty } from 'antd';

const { Title, Text } = Typography;

const PreviewQuestionsModal = ({ visible, onClose, test }) => {
  return (
    <Modal
      title="Preview Questions"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Title level={4}>Question Preview</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
          Question preview features are coming soon.
        </Text>
        <Empty 
          description="Question preview will be available in the next update"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    </Modal>
  );
};

export default PreviewQuestionsModal;