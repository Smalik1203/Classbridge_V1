// Sage Chatbot service. Mirrors the mobile contract byte-for-byte:
//   - Edge Function: `chatbot` at /functions/v1/chatbot
//   - Request body : { message, history, academicYearId, stream: true }
//   - Response     : NDJSON stream of ChatStreamEvent ({type: phase|content|progress|done|error})
//   - Persistence  : reads `chatbot_conversations` (id, role, content, created_at) by user_id;
//                    Edge Function is responsible for INSERTs.
import { supabase } from '@/config/supabaseClient';

export const HISTORY_LOAD_LIMIT = 20;
export const CONTEXT_WINDOW = 8;

/**
 * Resolve active academic year for a school. Web has no global academic-year
 * context, so query directly (matches the helper used in hrService).
 */
export async function getActiveAcademicYearId(schoolCode) {
  if (!schoolCode) return null;
  const { data, error } = await supabase
    .from('academic_years')
    .select('id')
    .eq('school_code', schoolCode)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.warn('[chatbot] academic year lookup failed:', error.message);
    return null;
  }
  if (data?.id) return data.id;
  // fallback: most recent
  const { data: any } = await supabase
    .from('academic_years')
    .select('id')
    .eq('school_code', schoolCode)
    .order('year_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  return any?.id ?? null;
}

/** Load most recent N messages for the user (mobile reads exactly these columns). */
export async function loadConversationHistory(userId, limit = HISTORY_LOAD_LIMIT) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('chatbot_conversations')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[chatbot] history load failed:', error.message);
    return [];
  }
  return (data ?? [])
    .reverse()
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
    }));
}

/**
 * Hit the `chatbot` Edge Function with the same payload mobile sends.
 * Returns:
 *   - { stream, response } if NDJSON stream is available (caller reads chunks)
 *   - { json, response }   if non-streaming JSON fallback was served
 *
 * Do NOT use supabase.functions.invoke — we need raw fetch to read NDJSON.
 */
export async function callChatbotEdgeFunction({ message, history, academicYearId, signal }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('App configuration error');

  const url = `${SUPABASE_URL}/functions/v1/chatbot`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history,
      academicYearId: academicYearId ?? null,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = errText;
    try {
      const j = JSON.parse(errText);
      if (j?.error) msg = j.error;
    } catch { /* keep raw */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }

  return res;
}

/**
 * Stream the chatbot response as NDJSON events.
 *
 *   onEvent(event) — called for every parsed { type: 'phase' | 'content' | 'progress' | 'done' | 'error' }
 *   signal         — optional AbortSignal
 *
 * Returns: { suggestedActions: string[], content: string }
 *
 * Matches mobile's two-path handling: ReadableStream when available, full-text
 * line-by-line parse otherwise.
 */
export async function streamChatbotResponse({
  message,
  history,
  academicYearId,
  signal,
  onEvent,
}) {
  const res = await callChatbotEdgeFunction({ message, history, academicYearId, signal });
  const ct = res.headers.get('content-type') ?? '';

  let content = '';
  let suggestedActions = [];

  const handleEvent = (event) => {
    if (!event || typeof event !== 'object') return;
    if (event.type === 'content') {
      content += event.text ?? '';
    } else if (event.type === 'done') {
      suggestedActions = event.suggestedActions ?? [];
    } else if (event.type === 'error') {
      throw new Error(event.message || 'Chatbot error');
    }
    onEvent?.(event);
  };

  // STREAMING PATH (NDJSON via ReadableStream)
  if ((ct.includes('ndjson') || ct.includes('x-ndjson')) && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            handleEvent(JSON.parse(t));
          } catch (parseErr) {
            const isParseErr =
              parseErr instanceof SyntaxError ||
              parseErr?.name === 'SyntaxError' ||
              /Unexpected token|Unexpected end of JSON input|JSON Parse error/i.test(parseErr?.message ?? '');
            if (!isParseErr) throw parseErr;
            // skip malformed line
          }
        }
      }
      // drain remaining buffer (no trailing \n)
      if (buffer.trim()) {
        try { handleEvent(JSON.parse(buffer.trim())); } catch { /* ignore */ }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return { content, suggestedActions };
      // If we already have content, surface what we got
      if (content) {
        console.warn('[chatbot] stream interrupted:', err?.message);
        return { content, suggestedActions };
      }
      throw err;
    }

    return { content, suggestedActions };
  }

  // NDJSON FALLBACK (no ReadableStream available)
  if (ct.includes('ndjson') || ct.includes('x-ndjson')) {
    const raw = await res.text();
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { handleEvent(JSON.parse(t)); } catch { /* skip */ }
    }
    if (!content) throw new Error('Chatbot stream returned no content.');
    return { content, suggestedActions };
  }

  // NON-STREAMING JSON FALLBACK
  let data;
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Invalid JSON response from chatbot${ct ? ` (content-type: ${ct})` : ''}: ${text.slice(0, 200)}`,
    );
  }
  content = data.reply ?? '';
  suggestedActions = data.suggestedActions ?? [];
  if (content) onEvent?.({ type: 'content', text: content });
  return { content, suggestedActions };
}

/**
 * Optional convenience: clear server-side conversation history for the user.
 * Used by "Clear chat" — best-effort delete; falls back silently if RLS blocks.
 */
export async function clearServerHistory(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('chatbot_conversations')
    .delete()
    .eq('user_id', userId);
  if (error) {
    console.warn('[chatbot] clear history failed (may be blocked by RLS):', error.message);
  }
}
