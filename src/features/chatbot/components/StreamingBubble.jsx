// Dedicated component for the in-flight assistant response. Subscribes to a
// streaming text source via an imperative handle so that token arrivals do
// NOT propagate up the component tree — only this component re-renders.
//
// Why: when the streaming bubble is part of the parent's `messages` array,
// every token forces a re-render of the parent (the page) and its memo'd
// children diff against new prop identities. By isolating the live bubble,
// the rest of the page sees zero state changes during streaming.
import React, {
  forwardRef, useImperativeHandle, useState, useEffect, useRef,
} from 'react';

const StreamingBubble = forwardRef(function StreamingBubble({ isDarkMode, scrollerRef }, ref) {
  const [text, setText] = useState('');
  const textRef = useRef('');

  useImperativeHandle(ref, () => ({
    append(chunk) {
      textRef.current += chunk;
      setText(textRef.current);
    },
    reset() {
      textRef.current = '';
      setText('');
    },
    snapshot() {
      return textRef.current;
    },
  }), []);

  // Auto-scroll only when this component's text grows. The parent scroller
  // ref is read here so we don't trigger a parent re-render to do it.
  useEffect(() => {
    const el = scrollerRef?.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    // only stick if we're already near the bottom (don't fight the user)
    if (dist < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text, scrollerRef]);

  // Until the first token arrives, render nothing — the parent's
  // <TypingIndicator /> covers the empty period. Hides the cursor too.
  if (!text) return null;

  return (
    <div style={{ margin: '20px 0' }}>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: isDarkMode ? '#e2e8f0' : '#0f172a',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 14,
            background: '#6366F1',
            marginLeft: 2,
            verticalAlign: 'middle',
            borderRadius: 1,
            animation: 'sage-cursor 1s steps(2) infinite',
          }}
        />
      </div>
      <style>{`@keyframes sage-cursor { 50% { opacity: 0; } }`}</style>
    </div>
  );
});

export default StreamingBubble;
