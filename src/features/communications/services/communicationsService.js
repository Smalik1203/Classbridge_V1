import { supabase } from '@/config/supabaseClient';

/**
 * Communications service — direct port of mobile services for
 * announcements, feedback and report comments. Same Supabase
 * tables, same RPC names, same Edge Function names. Web UI is
 * rebuilt with AntD; this layer must stay byte-compatible with mobile.
 */

const PAGE_SIZE = 20;

// ── Announcements ────────────────────────────────────────────────────────────
export const announcementsService = {
  async listFeed(schoolCode, page = 0) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        id, title, message, priority, target_type,
        class_instance_id, class_instance_ids, target_role,
        school_code, created_by, created_at, updated_at,
        pinned, likes_count, views_count, image_url,
        creator:users!announcements_created_by_fkey(full_name, role),
        class:class_instances!announcements_class_instance_id_fkey(grade, section)
      `)
      .eq('school_code', schoolCode)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data ?? [];
  },

  // Fallback fetch without join hints — used if FK aliases don't resolve.
  async listFeedSimple(schoolCode, page = 0) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_code', schoolCode)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return data ?? [];
  },

  async create(announcement) {
    const { data, error } = await supabase.functions.invoke('post-announcement', {
      body: { announcement },
    });
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
  },

  async togglePin(id, pinned) {
    const { data, error } = await supabase
      .from('announcements')
      .update({ pinned })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async sendReminder(announcementId) {
    const { data, error } = await supabase.functions.invoke(
      'resend-announcement-notification',
      { body: { announcement_id: announcementId } }
    );
    if (error) throw error;
    return data;
  },

  async listClasses(schoolCode, academicYearId) {
    let q = supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    const { data, error } = await q.order('grade').order('section');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Upload announcement image to Supabase Storage `Lms` bucket.
   * Path format: announcements/{school_code}/{timestamp}_{random}.{ext}
   * Returns the storage path (NOT a public URL) — mobile stores the path.
   */
  async uploadImage(file, schoolCode) {
    if (!file) return null;
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 10);
    const path = `announcements/${schoolCode}/${ts}_${rnd}.${ext}`;
    const { error } = await supabase.storage
      .from('Lms')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },

  /**
   * Resolve a stored path to a viewable URL. Tries public URL; falls back to
   * signed URL if the bucket is private.
   */
  async resolveImageUrl(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const { data: pub } = supabase.storage.from('Lms').getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    const { data: signed } = await supabase.storage
      .from('Lms')
      .createSignedUrl(path, 60 * 60);
    return signed?.signedUrl ?? null;
  },
};

// ── Feedback ─────────────────────────────────────────────────────────────────
export const feedbackService = {
  /** Feedback received by an admin/teacher (uses RLS-safe view) */
  async listReceivedByAdmin(authUserId) {
    const { data, error } = await supabase
      .from('feedback_for_admin')
      .select('*')
      .eq('to_user_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },

  /** Full school feedback (super admin) */
  async listAllSchool(schoolCode) {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        *,
        from_user:users!feedback_from_user_id_fkey(id, full_name, role),
        to_user:users!feedback_to_user_id_fkey(id, full_name, role),
        subject:subjects(id, subject_name),
        class:class_instances(id, grade, section)
      `)
      .eq('school_code', schoolCode)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },

  /** Feedback addressed to a particular student (admin → student) */
  async listForStudent(studentAuthId) {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        *,
        from_user:users!feedback_from_user_id_fkey(id, full_name, role)
      `)
      .eq('to_user_id', studentAuthId)
      .eq('feedback_type', 'admin_to_student')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },

  async submitStudentFeedback(input) {
    const payload = {
      feedback_type: 'student_to_admin',
      from_user_id: input.from_user_id,
      to_user_id: input.to_user_id,
      subject_id: input.subject_id || null,
      class_instance_id: input.class_instance_id || null,
      sentiment: input.sentiment,
      category: input.category,
      content: input.content,
      school_code: input.school_code,
    };
    const { data, error } = await supabase
      .from('feedback')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addManagementNote(input) {
    const payload = {
      feedback_type: 'management_note',
      from_user_id: input.from_user_id,
      to_user_id: input.to_user_id,
      category: input.category,
      content: input.content,
      requires_acknowledgement: !!input.requires_acknowledgement,
      school_code: input.school_code,
    };
    const { data, error } = await supabase
      .from('feedback')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async sendStudentFeedback(input) {
    const payload = {
      feedback_type: 'admin_to_student',
      from_user_id: input.from_user_id,
      to_user_id: input.to_user_id,
      class_instance_id: input.class_instance_id || null,
      category: input.category,
      content: input.content,
      school_code: input.school_code,
    };
    const { data, error } = await supabase
      .from('feedback')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async acknowledge(feedbackId) {
    const { data, error } = await supabase
      .from('feedback')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', feedbackId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async archive(feedbackId, userId) {
    const { data, error } = await supabase
      .from('feedback')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
      })
      .eq('id', feedbackId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listRecipients(schoolCode) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, school_code')
      .in('role', ['admin', 'teacher', 'superadmin', 'super_admin'])
      .or(`school_code.eq.${schoolCode},school_code.is.null`)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listStudents(schoolCode) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, class_instance_id')
      .eq('school_code', schoolCode)
      .eq('role', 'student')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listClasses(schoolCode, academicYearId) {
    let q = supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    const { data, error } = await q.order('grade').order('section');
    if (error) throw error;
    return data ?? [];
  },

  async listSubjects(schoolCode) {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, subject_name, school_code')
      .eq('school_code', schoolCode)
      .order('subject_name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};

// ── Report Comments ──────────────────────────────────────────────────────────
export const reportCommentsService = {
  async listClasses(schoolCode, academicYearId) {
    let q = supabase
      .from('class_instances')
      .select('id, grade, section')
      .eq('school_code', schoolCode);
    if (academicYearId) q = q.eq('academic_year_id', academicYearId);
    const { data, error } = await q.order('grade').order('section');
    if (error) throw error;
    return data ?? [];
  },

  async listStudentsInClass(classInstanceId) {
    const { data, error } = await supabase
      .from('student')
      .select('id, full_name, student_code, auth_user_id, class_instance_id')
      .eq('class_instance_id', classInstanceId)
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Edge Function: generate-report-comment
   * Returns: { comment: { id, generatedComment, inputData, wordCount, positivityScore } }
   */
  async generateForStudent(input) {
    const { data, error } = await supabase.functions.invoke('generate-report-comment', {
      body: input,
    });
    if (error) throw error;
    return data?.comment ?? null;
  },

  async approve(commentId, editedComment) {
    const { error } = await supabase.rpc('approve_report_comment', {
      p_comment_id: commentId,
      p_edited_comment: editedComment || null,
    });
    if (error) throw error;
  },
};

// ── Display constants (mirrors mobile) ───────────────────────────────────────
export const PRIORITY_META = {
  urgent: { color: '#DC2626', label: 'Urgent', icon: '🚨' },
  high: { color: '#D97706', label: 'High', icon: '⚠️' },
  medium: { color: '#2563EB', label: 'Medium', icon: '📢' },
  low: { color: '#6B7280', label: 'Low', icon: 'ℹ️' },
};

export const SENTIMENT_META = {
  positive: { color: '#059669', label: 'Positive' },
  neutral: { color: '#6B7280', label: 'Neutral' },
  needs_improvement: { color: '#D97706', label: 'Needs Improvement' },
};

export const CATEGORY_LABELS = {
  teaching_clarity: 'Teaching Clarity',
  pace: 'Pace',
  behaviour: 'Behaviour',
  doubt_resolution: 'Doubt Resolution',
  general: 'General',
  observation: 'Observation',
  improvement_required: 'Improvement Required',
  appreciation: 'Appreciation',
};

export const STUDENT_FEEDBACK_CATEGORIES = [
  'teaching_clarity', 'pace', 'behaviour', 'doubt_resolution', 'general',
];
export const MANAGEMENT_NOTE_CATEGORIES = [
  'observation', 'improvement_required', 'appreciation',
];
export const STUDENT_REMARK_CATEGORIES = [
  'observation', 'behaviour', 'improvement_required', 'appreciation', 'general',
];
