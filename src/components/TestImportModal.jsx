import React from 'react';
import { Modal, Typography, Empty } from 'antd';

const { Title, Text } = Typography;

const TestImportModal = ({ visible, onClose, onImportComplete, classInstances, subjects, schoolCode, userId }) => {
  return (
    <Modal
      title="Import Tests"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Title level={4}>Test Import</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
          Test import features are coming soon.
        </Text>
        <Empty 
          description="Test import will be available in the next update"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    </Modal>
  );
};

export default TestImportModal;