// claude.ai-style message rendering for COMMITTED messages only.
// The in-flight streaming bubble lives in StreamingBubble.jsx; this
// component never receives an `isStreaming: true` message.
//
// User: soft right-aligned pill. Assistant: full-width markdown content
// with a copy button that fades in on hover. Memoized so a new message
// being appended to the list doesn't re-render any prior bubble.
import React, { memo, useState } from 'react';
import { Button, Tooltip, App } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import MarkdownRenderer from './MarkdownRenderer';

function MessageBubble({ message, isDarkMode }) {
  const { message: toast } = App.useApp();
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const isUser = message.role === 'user';

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '14px 0' }}>
        <div
          style={{
            maxWidth: '80%',
            background: isDarkMode ? '#1e293b' : '#f1f5f9',
            color: isDarkMode ? '#e2e8f0' : '#0f172a',
            padding: '10px 14px',
            borderRadius: 16,
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ margin: '20px 0', position: 'relative' }}
    >
      <MarkdownRenderer text={message.content} isDarkMode={isDarkMode} />
      {message.content && (
        <div style={{ marginTop: 4, opacity: hover ? 1 : 0, transition: 'opacity 0.15s ease' }}>
          <Tooltip title={copied ? 'Copied' : 'Copy'}>
            <Button
              size="small"
              type="text"
              icon={copied ? <CheckOutlined style={{ color: '#22c55e' }} /> : <CopyOutlined />}
              onClick={onCopy}
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export default memo(MessageBubble, (prev, next) => (
  prev.message === next.message && prev.isDarkMode === next.isDarkMode
));
