// Sage Chatbot — claude.ai-style web UX. Single centered column, no sidebar,
// composer pinned at the bottom, welcome state with prompt chips.
//
// Performance design: during streaming, tokens flow imperatively into a
// dedicated <StreamingBubble> via a ref handle. The page itself does NOT
// re-render per token — only the streaming bubble does. When the stream
// ends, the final text is committed to `messages` once.
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tooltip, App, Spin } from 'antd';
import { ClearOutlined } from '@ant-design/icons';

import { useAuth } from '@/AuthProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { getSchoolCode, getUserRole } from '@/shared/utils/metadata';

import { useChatbot } from '../hooks/useChatbot';
import { useChatSuggestions } from '../hooks/useChatSuggestions';
import { getActiveAcademicYearId } from '../services/chatbotService';

import WelcomeCard from '../components/WelcomeCard';
import MessageBubble from '../components/MessageBubble';
import StreamingBubble from '../components/StreamingBubble';
import TypingIndicator from '../components/TypingIndicator';
import ChatInput from '../components/ChatInput';

const COLUMN_MAX = 760;

export default function Chatbot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { modal } = App.useApp();

  const userId = user?.id;
  const role = (getUserRole(user) || 'admin').toLowerCase();
  const schoolCode = getSchoolCode(user);
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'there';
  const firstName = (fullName.split(' ')[0] || '').trim();

  const [academicYearId, setAcademicYearId] = useState(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!schoolCode) return;
    getActiveAcademicYearId(schoolCode).then((id) => {
      if (!cancelled) setAcademicYearId(id);
    });
    return () => { cancelled = true; };
  }, [schoolCode]);

  const chat = useChatbot({ userId, academicYearId });
  const {
    messages, isTyping, streamingPhase, slowHint, suggestedActions, historyLoaded,
    sendMessage, clearChat, stopGeneration, setStreamSink,
  } = chat;

  const capabilities = useMemo(() => ({
    canCreateAssessments: role === 'superadmin' || role === 'admin',
  }), [role]);
  const suggestions = useChatSuggestions(role, capabilities);

  // Wire the streaming bubble into the hook via callback ref. This runs
  // exactly once per mount/unmount of the bubble, NOT on every token.
  const scrollerRef = useRef(null);
  const streamRef = useCallback((node) => {
    setStreamSink(node);
  }, [setStreamSink]);

  // Auto-scroll on new committed messages or when typing flips on/off.
  // (Streaming-time auto-scroll is handled inside StreamingBubble itself.)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (dist < 200) el.scrollTop = el.scrollHeight;
  }, [messages.length, isTyping]);

  const handleSend = useCallback((text) => {
    if (!text?.trim()) return;
    setInput('');
    sendMessage(text);
  }, [sendMessage]);

  const handleSuggestion = useCallback((s) => {
    if (s.href) navigate(s.href);
    else if (s.message) handleSend(s.message);
  }, [navigate, handleSend]);

  const handleSuggestedAction = useCallback((text) => handleSend(text), [handleSend]);

  const handleClear = useCallback(() => {
    modal.confirm({
      title: 'Clear chat?',
      content: 'This permanently deletes your chat history with Sage.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => clearChat({ alsoServer: true }),
    });
  }, [modal, clearChat]);

  const isEmpty = historyLoaded && messages.length === 0 && !isTyping;
  const pageBg = isDarkMode ? '#0a0e17' : '#ffffff';
  const border = isDarkMode ? '#1f2937' : '#e2e8f0';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 48px)',
        background: pageBg,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: `1px solid ${border}`,
          background: isDarkMode ? '#0f172a' : '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 13,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#0f172a' }}>
            Sage
          </div>
          <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            School AI assistant
          </div>
        </div>
        {messages.length > 0 && (
          <Tooltip title="Clear chat">
            <Button type="text" icon={<ClearOutlined />} onClick={handleClear} />
          </Tooltip>
        )}
      </div>

      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          background: pageBg,
        }}
      >
        {!historyLoaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin />
          </div>
        ) : isEmpty ? (
          <WelcomeCard firstName={firstName} suggestions={suggestions} onSelect={handleSuggestion} />
        ) : (
          <div style={{ maxWidth: COLUMN_MAX, margin: '0 auto', padding: '24px 20px 16px' }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} isDarkMode={isDarkMode} />
            ))}
            {isTyping && (
              <>
                <StreamingBubble
                  ref={streamRef}
                  isDarkMode={isDarkMode}
                  scrollerRef={scrollerRef}
                />
                <TypingIndicator phase={streamingPhase} slowHint={slowHint} />
              </>
            )}
            {!isTyping && suggestedActions?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {suggestedActions.map((a, i) => (
                  <Button
                    key={i}
                    size="small"
                    onClick={() => handleSuggestedAction(a)}
                    style={{ borderRadius: 999 }}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '12px 20px 20px',
          borderTop: `1px solid ${border}`,
          background: pageBg,
        }}
      >
        <div style={{ maxWidth: COLUMN_MAX, margin: '0 auto' }}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={stopGeneration}
            isGenerating={isTyping}
            disabled={!historyLoaded}
          />
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
            Sage can make mistakes — double-check important answers.
          </div>
        </div>
      </div>
    </div>
  );
}
