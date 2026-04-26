// Composer modeled after claude.ai: rounded card, auto-grow textarea, send
// button on the right. Enter sends, Shift+Enter newline. Stop replaces Send
// while a response streams.
import React, { useEffect, useRef } from 'react';
import { Button, Tooltip } from 'antd';
import { ArrowUpOutlined, StopOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating,
  disabled,
  placeholder = 'Message Sage…',
}) {
  const { isDarkMode } = useTheme();
  const taRef = useRef(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const canSend = !disabled && value.trim().length > 0 && !isGenerating;

  const submit = () => {
    if (!canSend) return;
    onSend(value);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const bg = isDarkMode ? '#1e293b' : '#ffffff';
  const border = isDarkMode ? '#334155' : '#cbd5e1';

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: '8px 8px 8px 14px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        boxShadow: isDarkMode ? 'none' : '0 4px 14px rgba(15,23,42,0.06)',
      }}
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          minHeight: 28,
          maxHeight: 200,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: isDarkMode ? '#e2e8f0' : '#0f172a',
          fontSize: 15,
          lineHeight: 1.5,
          padding: '6px 0',
          fontFamily: 'inherit',
        }}
      />
      {isGenerating ? (
        <Tooltip title="Stop">
          <Button
            type="primary"
            danger
            shape="circle"
            icon={<StopOutlined />}
            onClick={onStop}
          />
        </Tooltip>
      ) : (
        <Tooltip title="Send (Enter)">
          <Button
            type="primary"
            shape="circle"
            icon={<ArrowUpOutlined />}
            onClick={submit}
            disabled={!canSend}
          />
        </Tooltip>
      )}
    </div>
  );
}
