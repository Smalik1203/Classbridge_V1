import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function clientFromReq(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
}

function json(body: unknown, status = 200, cid = crypto.randomUUID()) {
  return new Response(JSON.stringify({ ...(body as any), correlation_id: cid }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-correlation-id",
      "x-correlation-id": cid
    }
  });
}

async function meRow(sb: ReturnType<typeof createClient>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('users').select('id, role, school_code').eq('id', user.id).maybeSingle();
  return data as { id: string, role: string, school_code: string } | null;
}

// Actions
async function createQuiz(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const who = await meRow(sb);
  if (!who || !['superadmin','admin','teacher'].includes(who.role)) return json({ status: 'error', error: 'forbidden' }, 403, cid);
  const { class_instance_id, subject_id, title, description = null, time_limit_minutes = null, total_points = null } = payload ?? {};
  if (!class_instance_id || !subject_id || !title) return json({ status: 'error', error: 'bad_request', message: 'Missing fields' }, 400, cid);
  const toInsert = {
    school_code: who.school_code,
    class_instance_id: String(class_instance_id),
    subject_id: String(subject_id),
    title: String(title),
    description,
    time_limit_minutes,
    total_points,
    created_by: who.id,
    visibility: 'draft'
  };
  const { data, error } = await sb.from('quizzes').insert(toInsert).select('id').single();
  if (error) return json({ status: 'error', error: error.message }, 400, cid);
  return json({ status: 'ok', data: { id: data.id } }, 200, cid);
}

async function addQuestion(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const { quiz_id, question_text, type = 'mcq', options = [], correct_answer = null, points = 1, order_index = 0 } = payload ?? {};
  if (!quiz_id || !question_text) return json({ status: 'error', error: 'bad_request', message: 'quiz_id & question_text required' }, 400, cid);
  const row = { quiz_id, question_text, type, options, correct_answer, points, order_index };
  const { data, error } = await sb.from('quiz_questions').insert(row).select('id').single();
  if (error) return json({ status: 'error', error: error.message }, 400, cid);
  return json({ status: 'ok', data: { id: data.id } }, 200, cid);
}

async function publishQuiz(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const { id } = payload ?? {};
  if (!id) return json({ status: 'error', error: 'bad_request', message: 'id required' }, 400, cid);
  const { data: q, error } = await sb.from('quizzes').select('id, visibility').eq('id', id).single();
  if (error || !q) return json({ status: 'error', error: 'not_found' }, 404, cid);
  if (q.visibility !== 'draft') return json({ status: 'error', error: 'bad_request', message: 'only draft can be published' }, 400, cid);
  const { error: upErr } = await sb.from('quizzes').update({ visibility: 'active' }).eq('id', id);
  if (upErr) return json({ status: 'error', error: upErr.message }, 400, cid);
  return json({ status: 'ok', data: { id } }, 200, cid);
}

async function listActive(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const { class_instance_id, subject_id } = payload ?? {};
  let q = sb.from('quizzes').select('id, title, description, time_limit_minutes, total_points, class_instance_id, subject_id').eq('visibility','active');
  if (class_instance_id) q = q.eq('class_instance_id', class_instance_id);
  if (subject_id) q = q.eq('subject_id', subject_id);
  const { data, error } = await q;
  if (error) return json({ status: 'error', error: error.message }, 400, cid);
  return json({ status: 'ok', data }, 200, cid);
}

async function startAttempt(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const { quiz_id } = payload ?? {};
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ status: 'error', error: 'unauthorized' }, 401, cid);
  if (!quiz_id) return json({ status: 'error', error: 'bad_request', message: 'quiz_id required' }, 400, cid);

  const { data: existing } = await sb.from('quiz_attempts').select('id, status').eq('quiz_id', quiz_id).eq('student_id', user.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (existing && existing.status !== 'submitted') {
    const { data: qs } = await sb.from('quiz_questions').select('id, question_text, type, options, points, order_index').eq('quiz_id', quiz_id).order('order_index');
    return json({ status: 'ok', data: { attempt_id: existing.id, questions: qs || [] } }, 200, cid);
  }
  const { data: ins, error } = await sb.from('quiz_attempts').insert({ quiz_id, student_id: user.id }).select('id').single();
  if (error) return json({ status: 'error', error: error.message }, 400, cid);
  const { data: qs } = await sb.from('quiz_questions').select('id, question_text, type, options, points, order_index').eq('quiz_id', quiz_id).order('order_index');
  return json({ status: 'ok', data: { attempt_id: ins.id, questions: qs || [] } }, 200, cid);
}

async function saveAnswer(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ status: 'error', error: 'unauthorized' }, 401, cid);
  const { attempt_id, question_id, answer } = payload ?? {};
  if (!attempt_id || !question_id) return json({ status: 'error', error: 'bad_request', message: 'attempt_id & question_id required' }, 400, cid);
  const { data: existing } = await sb.from('quiz_answers').select('id').eq('attempt_id', attempt_id).eq('question_id', question_id).maybeSingle();
  if (existing) {
    const { error } = await sb.from('quiz_answers').update({ answer }).eq('id', existing.id);
    if (error) return json({ status: 'error', error: error.message }, 400, cid);
  } else {
    const { error } = await sb.from('quiz_answers').insert({ attempt_id, question_id, answer });
    if (error) return json({ status: 'error', error: error.message }, 400, cid);
  }
  return json({ status: 'ok' }, 200, cid);
}

async function submitAttempt(sb: ReturnType<typeof createClient>, payload: any, cid: string) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ status: 'error', error: 'unauthorized' }, 401, cid);
  const { attempt_id } = payload ?? {};
  if (!attempt_id) return json({ status: 'error', error: 'bad_request', message: 'attempt_id required' }, 400, cid);

  const { data: rows, error: jErr } = await sb
    .from('quiz_answers')
    .select('id, question_id, answer, attempts:attempt_id!inner(id, quiz_id), questions:question_id!inner(id, type, correct_answer, points)');
  if (jErr) return json({ status: 'error', error: jErr.message }, 400, cid);
  const answers = (rows || []).filter((r: any) => r.attempts.id === attempt_id);

  let score = 0;
  for (const a of answers) {
    const q = a.questions;
    let correct = null;
    if (q?.type === 'mcq' || q?.type === 'msq') {
      correct = JSON.stringify(a.answer) === JSON.stringify(q.correct_answer);
    }
    const pts = correct ? Number(q?.points || 0) : 0;
    score += pts;
    await sb.from('quiz_answers').update({ is_correct: correct, points_awarded: pts }).eq('id', a.id);
  }
  await sb.from('quiz_attempts').update({ status: 'submitted', submitted_at: new Date().toISOString(), score }).eq('id', attempt_id);
  return json({ status: 'ok', data: { score } }, 200, cid);
}

serve(async (req) => {
  const cid = crypto.randomUUID();
  if (req.method === 'OPTIONS') return json({ ok: true }, 200, cid);
  if (req.method !== 'POST') return json({ status: 'error', error: 'method_not_allowed' }, 405, cid);
  let body: any = {}; try { body = await req.json(); } catch {}
  const action = body?.action as string; const payload = body?.payload ?? {};
  if (!action) return json({ status: 'error', error: 'bad_request', message: "Missing 'action'" }, 400, cid);
  const sb = clientFromReq(req);
  try {
    switch (action) {
      case 'quizzes.create': return await createQuiz(sb, payload, cid);
      case 'quizzes.add_question': return await addQuestion(sb, payload, cid);
      case 'quizzes.publish': return await publishQuiz(sb, payload, cid);
      case 'quizzes.list_active': return await listActive(sb, payload, cid);
      case 'attempts.start': return await startAttempt(sb, payload, cid);
      case 'attempts.answer': return await saveAnswer(sb, payload, cid);
      case 'attempts.submit': return await submitAttempt(sb, payload, cid);
      default: return json({ status: 'error', error: 'bad_request', message: `Unknown action: ${action}` }, 400, cid);
    }
  } catch (e) {
    const msg = (e as any)?.message ?? String(e);
    return json({ status: 'error', error: 'server_error', message: msg }, 500, cid);
  }
});


