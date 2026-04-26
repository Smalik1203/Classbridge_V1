// Web port of mobile's useChatbot hook. Same Edge Function call, same
// streaming protocol, same persistence. CRITICAL design choice for web
// performance:
//
//   During streaming, tokens DO NOT update React state (and therefore do not
//   re-render the page). Tokens are pushed imperatively into a sibling
//   StreamingBubble component via a ref callback. Only when the stream ends
//   do we commit the final text into `messages`. This keeps the entire page
//   tree static during the stream — only a single dedicated bubble updates.
//
// Mobile uses the same Edge Function and stream events; the web-specific
// differences are purely render-loop hygiene.
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  HISTORY_LOAD_LIMIT,
  CONTEXT_WINDOW,
  loadConversationHistory,
  streamChatbotResponse,
  clearServerHistory,
} from '../services/chatbotService';

let nextId = 0;
const generateId = () => `msg_${Date.now()}_${++nextId}`;

export function useChatbot({ userId, academicYearId } = {}) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingPhase, setStreamingPhase] = useState(null);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState([]);

  const abortRef = useRef(false);
  const fetchAbortRef = useRef(null);

  // Refs so the imperative streaming loop reads current values without
  // re-creating callbacks (which would cascade into consumer effects).
  const messagesRef = useRef(messages);
  const isTypingRef = useRef(isTyping);
  const academicYearIdRef = useRef(academicYearId);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);
  useEffect(() => { academicYearIdRef.current = academicYearId; }, [academicYearId]);

  // The streaming sink. The page registers a StreamingBubble's imperative
  // handle here; tokens are pushed into it, bypassing React state entirely.
  const streamSinkRef = useRef(null);
  const setStreamSink = useCallback((handle) => {
    streamSinkRef.current = handle;
  }, []);

  // Load DB history on mount (matches mobile)
  useEffect(() => {
    if (!userId || historyLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadConversationHistory(userId);
        if (!cancelled && loaded.length) setMessages(loaded);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, historyLoaded]);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    setIsTyping(false);
    setStreamingPhase(null);
    setSlowHint(false);
  }, []);

  const sendInternal = useCallback(async (text, seedMessages) => {
    const trimmed = text.trim();
    if (!trimmed || isTypingRef.current) return;

    setError(null);
    setSuggestedActions([]);
    abortRef.current = false;
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

    const userMsg = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    const baseMessages = seedMessages ?? messagesRef.current;
    const newConversation = [...baseMessages, userMsg];

    // Reset the streaming bubble & flip to typing state. From here until the
    // stream ends, the only React state updates are: phase text and slow-hint.
    streamSinkRef.current?.reset();
    setMessages(newConversation);
    setIsTyping(true);
    setStreamingPhase(null);
    setSlowHint(false);

    // rAF batching: NDJSON tokens arrive faster than 60Hz; coalesce them so
    // we only update the streaming bubble once per frame.
    let pendingContent = '';
    let rafScheduled = false;
    const flushTokens = () => {
      rafScheduled = false;
      if (!pendingContent || abortRef.current) return;
      const chunk = pendingContent;
      pendingContent = '';
      streamSinkRef.current?.append(chunk);
    };
    const scheduleFlush = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(flushTokens);
    };

    const slowTimer = setTimeout(() => {
      if (!abortRef.current) setSlowHint(true);
    }, 5000);

    try {
      const history = newConversation
        .slice(-CONTEXT_WINDOW)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await streamChatbotResponse({
        message: trimmed,
        history,
        academicYearId: academicYearIdRef.current ?? null,
        signal: ac.signal,
        onEvent: (ev) => {
          if (abortRef.current) return;
          if (ev.type === 'phase') {
            setStreamingPhase(ev.text);
          } else if (ev.type === 'content') {
            setSlowHint(false);
            pendingContent += ev.text ?? '';
            scheduleFlush();
          }
        },
      });

      // Drain any tokens left in the buffer
      if (pendingContent && !abortRef.current) flushTokens();

      if (abortRef.current) return;

      // Commit the streamed text (or the JSON-fallback content) into the
      // messages array as a single, final assistant message.
      const finalText = streamSinkRef.current?.snapshot() || result.content || '';
      if (finalText) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: finalText,
            timestamp: Date.now(),
            isStreaming: false,
          },
        ]);
      }
      setSuggestedActions(result.suggestedActions ?? []);
    } catch (err) {
      if (abortRef.current || err?.name === 'AbortError' || err?.message === 'Aborted') return;
      console.error('[chatbot] request failed:', err?.message);
      const msg = err?.message?.includes('429')
        ? "You've reached the AI usage limit. Please try again later."
        : err?.message?.includes('403')
        ? "You don't have permission to use the chatbot."
        : `Something went wrong: ${err?.message ?? 'unknown error'}`;
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: msg,
          timestamp: Date.now(),
          isError: true,
          isStreaming: false,
        },
      ]);
    } finally {
      clearTimeout(slowTimer);
      // Reset the streaming surface so the next send starts clean
      streamSinkRef.current?.reset();
      if (!abortRef.current) {
        setIsTyping(false);
        setStreamingPhase(null);
        setSlowHint(false);
      }
      fetchAbortRef.current = null;
    }
  }, []); // stable — reads via refs

  const sendMessage = useCallback((text) => sendInternal(text, undefined), [sendInternal]);

  const clearChat = useCallback((opts = {}) => {
    abortRef.current = true;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    streamSinkRef.current?.reset();
    setMessages([]);
    setIsTyping(false);
    setStreamingPhase(null);
    setSlowHint(false);
    setError(null);
    setSuggestedActions([]);
    if (opts.alsoServer && userId) {
      clearServerHistory(userId);
    }
  }, [userId]);

  return {
    messages,
    isTyping,
    streamingPhase,
    slowHint,
    error,
    historyLoaded,
    suggestedActions,
    sendMessage,
    clearChat,
    stopGeneration,
    setStreamSink,
  };
}
