// src/features/tests/services/aiTestGeneratorService.js
//
// Web port of mobile src/services/aiTestGeneratorFetch.ts.
// Same Supabase Edge Function (`process-ai-job`), same `ai_jobs` table,
// same Storage buckets (`ai-test-materials`, `test-materials`),
// same payload + response shapes.
//
// Differences from mobile:
//   - No AsyncStorage cache (web is online-by-default).
//   - File→base64 uses FileReader on the browser (no expo-file-system needed).

import { supabase } from '@/config/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/* ───────────────── Helpers ───────────────── */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function uploadImageToBucket(userId, base64, mimeType, index) {
  const buffer = base64ToArrayBuffer(base64);
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/ai-job-images/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${index}.${ext}`;
  const { error } = await supabase.storage
    .from('ai-test-materials')
    .upload(path, buffer, { contentType: mimeType });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return path;
}

async function uploadPdfToBucket(userId, base64, fileName) {
  const buffer = base64ToArrayBuffer(base64);
  const safe = (fileName || 'document.pdf').replace(/[^a-z0-9._-]/gi, '_');
  const path = `${userId}/pdf-uploads/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safe}`;
  const { error } = await supabase.storage
    .from('ai-test-materials')
    .upload(path, buffer, { contentType: 'application/pdf' });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  return path;
}

/* ───────────────── Edge Function kick ───────────────── */

export async function kickProcessAiJob(accessToken, jobId) {
  if (!SUPABASE_URL) throw new Error('Supabase URL is not configured.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/process-ai-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (res.status === 401) throw new Error('Session expired. Please sign in again.');
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    if (data.code === 'QUEUE_FULL') return 'queue_full';
    let msg = data.error || 'Rate limit reached. Please try again later.';
    if (data.usage?.dailyRemaining === 0) msg = 'Daily limit reached. Try again tomorrow.';
    else if (data.usage?.monthlyRemaining === 0) msg = 'Monthly limit reached. Contact admin for more quota.';
    throw new Error(msg);
  }
  if (res.status === 404) {
    throw new Error('AI worker missing: deploy the process-ai-job Edge Function to this Supabase project.');
  }
  if (res.status === 200 || res.status === 202) return 'ok';
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Job request failed with status ${res.status}`);
  }
  return 'ok';
}

/* ───────────────── Job lifecycle ───────────────── */

export async function listAiJobs(limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('id, status, source_kind, job_label, pdf_name, question_count, error, created_at, updated_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchAiJobResult(jobId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in.');
  const { data: row, error } = await supabase
    .from('ai_jobs')
    .select('status, result, error')
    .eq('id', jobId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error('Job not found.');
  if (row.status !== 'done') {
    throw new Error(row.status === 'failed' ? (row.error || 'Generation failed') : 'Job is not finished yet.');
  }
  const payload = row.result || {};
  if (!payload?.questions?.length) throw new Error('No questions in job result.');
  return {
    questions: payload.questions,
    totalGenerated: payload.totalGenerated ?? payload.questions.length,
    requestedCount: payload.requestedCount,
    usage: payload.usage,
  };
}

export async function pollAiJobStatus(jobId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in.');
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('id, status, error, result, source_kind')
    .eq('id', jobId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelAiJob(jobId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('ai_jobs')
    .update({ status: 'failed', error: 'Cancelled by user', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('user_id', session.user.id)
    .in('status', ['pending', 'processing']);
}

export async function retryAiJob(jobId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in.');
  const { data: updated, error: updErr } = await supabase
    .from('ai_jobs')
    .update({ status: 'pending', error: null, result: null, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('user_id', session.user.id)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle();
  if (updErr) throw new Error(updErr.message);
  if (!updated) throw new Error('Job not found or not in failed state.');
  await kickProcessAiJob(session.access_token, jobId);
}

/* ───────────────── Generate from input (web entry point) ─────────────────
 *
 * Input forms:
 *   { mode: 'images', files: File[] }
 *   { mode: 'pdf', file: File }
 *   { mode: 'text', content: string }
 *
 * Always returns { jobQueued: true, jobId } once the row is inserted and
 * the Edge Function has been kicked.
 */
export async function generateQuestionsFromInput({
  input,
  questionCount = 10,
  context,
  syllabusScope,
  bloomsLevels,
  schoolCode,
  onProgress,
}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new Error('Please sign in to use AI features.');

  const code = (schoolCode || '').trim();
  if (!code) throw new Error('School profile is missing. Try signing in again or contact support.');

  const baseRow = {
    user_id: session.user.id,
    school_code: code,
    status: 'pending',
    question_count: questionCount,
    context: context?.trim() ? context.trim() : null,
    syllabus_scope: syllabusScope || null,
    blooms_levels: bloomsLevels && bloomsLevels.length ? bloomsLevels : null,
    return_tagged: !!syllabusScope,
  };

  const kick = async (jobId) => {
    onProgress?.('Starting Sage on our servers…');
    try {
      const r = await kickProcessAiJob(session.access_token, jobId);
      if (r === 'queue_full') {
        onProgress?.('Server busy — we will retry when you return to this screen.');
      }
    } catch (e) {
      throw e;
    }
  };

  if (input.mode === 'images') {
    if (!input.files?.length) throw new Error('No images selected.');
    onProgress?.('Uploading images…');
    const files = input.files.slice(0, 5);
    const paths = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const b64 = await fileToBase64(f);
      if ((b64.length * 3) / 4 > 4 * 1024 * 1024) {
        throw new Error('One or more images are too large. Max 3MB per image.');
      }
      const mime = f.type || (f.name?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      const p = await uploadImageToBucket(session.user.id, b64, mime, i);
      paths.push(p);
    }
    onProgress?.('Queuing Sage job…');
    const { data, error } = await supabase
      .from('ai_jobs')
      .insert({
        ...baseRow,
        source_kind: 'images',
        image_paths: paths,
        job_label: `${paths.length} image(s)`,
      })
      .select('id')
      .single();
    if (error || !data?.id) throw new Error(error?.message || 'Could not create generation job.');
    await kick(data.id);
    return { jobQueued: true, jobId: data.id };
  }

  if (input.mode === 'pdf') {
    if (!input.file) throw new Error('No PDF selected.');
    onProgress?.('Uploading PDF…');
    const b64 = await fileToBase64(input.file);
    const path = await uploadPdfToBucket(session.user.id, b64, input.file.name);
    onProgress?.('Queuing Sage job…');
    const { data, error } = await supabase
      .from('ai_jobs')
      .insert({
        ...baseRow,
        source_kind: 'pdf',
        input_path: path,
        pdf_name: input.file.name,
        job_label: input.file.name,
      })
      .select('id')
      .single();
    if (error || !data?.id) throw new Error(error?.message || 'Could not create generation job.');
    await kick(data.id);
    return { jobQueued: true, jobId: data.id };
  }

  if (input.mode === 'text') {
    const trimmed = (input.content || '').trim();
    if (trimmed.length < 20) throw new Error('Please enter more content for question generation.');
    onProgress?.('Queuing Sage job…');
    const { data, error } = await supabase
      .from('ai_jobs')
      .insert({
        ...baseRow,
        source_kind: 'text',
        text_content: trimmed,
        job_label: `Text (${trimmed.length} chars)`,
      })
      .select('id')
      .single();
    if (error || !data?.id) throw new Error(error?.message || 'Could not create generation job.');
    await kick(data.id);
    return { jobQueued: true, jobId: data.id };
  }

  throw new Error('Unsupported input mode.');
}

/* ───────────────── Syllabus tree (for topic picker) ───────────────── */

export async function getSyllabusTree(schoolCode, classInstanceId, subjectId) {
  // Mobile uses get_syllabus_tree RPC — try that first; if it doesn't exist,
  // fall back to direct table reads.
  try {
    const { data, error } = await supabase.rpc('get_syllabus_tree', {
      p_school_code: schoolCode,
      p_class_instance_id: classInstanceId || null,
      p_subject_id: subjectId || null,
    });
    if (!error && data) return data;
  } catch { /* fall through */ }

  // Fallback: read syllabus_chapters directly.
  let q = supabase
    .from('syllabus_chapters')
    .select('id, chapter_no, title, description, class_instance_id, subject_id')
    .eq('school_code', schoolCode);
  if (classInstanceId) q = q.eq('class_instance_id', classInstanceId);
  if (subjectId) q = q.eq('subject_id', subjectId);
  q = q.order('chapter_no', { ascending: true });
  const { data, error } = await q;
  if (error) return [];
  return (data || []).map(c => ({
    chapter_id: c.id,
    chapter_no: c.chapter_no,
    chapter_title: c.title,
    description: c.description,
    topics: [],
  }));
}
