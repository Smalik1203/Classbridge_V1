import { useCallback } from 'react';
import { message, notification } from 'antd';
import { handleError } from '@/shared/utils/errorHandler.js';

/**
 * React hook for handling errors with Ant Design integration
 */
export function useErrorHandler() {
  const showError = useCallback((error, options = {}) => {
    const {
      useNotification = false,
      duration = 4.5,
      showDetails = false,
      ...errorOptions
    } = options;
    
    const errorInfo = handleError(error, errorOptions);
    
    if (useNotification) {
      notification.error({
        message: errorInfo.title,
        description: (
          <div>
            <p>{errorInfo.body}</p>
            {showDetails && (
              <p style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                {errorInfo.action}
              </p>
            )}
            {errorInfo.incidentId && (
              <p style={{ marginTop: 4, fontSize: '11px', color: '#999' }}>
                Reference: {errorInfo.incidentId}
              </p>
            )}
          </div>
        ),
        duration: duration
      });
    } else {
      message.error(errorInfo.toast, duration);
    }
    
    return errorInfo;
  }, []);
  
  const showSuccess = useCallback((messageText, duration = 3) => {
    message.success(messageText, duration);
  }, []);
  
  const showWarning = useCallback((messageText, duration = 3) => {
    message.warning(messageText, duration);
  }, []);
  
  const showInfo = useCallback((messageText, duration = 3) => {
    message.info(messageText, duration);
  }, []);
  
  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    handleError
  };
}

export default useErrorHandler;
