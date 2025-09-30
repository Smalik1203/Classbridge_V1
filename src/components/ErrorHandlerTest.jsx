import React from 'react';
import { Button, Space } from 'antd';
import { useErrorHandler } from '../hooks/useErrorHandler.jsx';

/**
 * Simple test component to verify error handler is working
 */
export default function ErrorHandlerTest() {
  const { showError, showSuccess } = useErrorHandler();

  const testForeignKeyError = () => {
    const error = {
      code: '23503',
      message: 'update or delete on table "subjects" violates foreign key constraint "tests_subject_id_fkey" on table "tests"'
    };
    
    showError(error, {
      useNotification: true,
      showDetails: true,
      context: {
        item: 'subject',
        relatedTypePlural: 'tests'
      }
    });
  };

  const testSuccess = () => {
    showSuccess('Error handler is working correctly!');
  };

  return (
    <div style={{ padding: 24 }}>
      <h3>Error Handler Test</h3>
      <Space>
        <Button onClick={testForeignKeyError} type="primary">
          Test Foreign Key Error
        </Button>
        <Button onClick={testSuccess} type="default">
          Test Success Message
        </Button>
      </Space>
    </div>
  );
}
