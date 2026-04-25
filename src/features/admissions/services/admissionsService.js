import { supabase } from '@/config/supabaseClient';

/**
 * Admissions service — direct port of mobile `src/services/admissions.ts`.
 * Same Supabase tables (admission_enquiries, admission_followups), same query
 * shapes, same defaults. Web UI is rebuilt with AntD; this layer must stay
 * byte-compatible with mobile.
 */

// ── Constants (mirrors mobile) ───────────────────────────────────────────────

export const ENQUIRY_STATUSES = ['new', 'contacted', 'follow_up', 'admitted', 'rejected'];

export const STATUS_META = {
  new:       { label: 'New',        color: '#6366f1', bg: '#EEF2FF', text: '#4338CA' },
  contacted: { label: 'Contacted',  color: '#f59e0b', bg: '#FEF3C7', text: '#B45309' },
  follow_up: { label: 'Follow Up',  color: '#3b82f6', bg: '#DBEAFE', text: '#1D4ED8' },
  admitted:  { label: 'Admitted',   color: '#10b981', bg: '#D1FAE5', text: '#047857' },
  rejected:  { label: 'Rejected',   color: '#ef4444', bg: '#FEE2E2', text: '#B91C1C' },
};

export const PIPELINE_STEPS = ['new', 'contacted', 'follow_up', 'admitted'];

export const SOURCES = [
  { label: 'Walk-in',  value: 'walk_in' },
  { label: 'Phone',    value: 'phone' },
  { label: 'Website',  value: 'website' },
  { label: 'Referral', value: 'referral' },
  { label: 'Social',   value: 'social_media' },
  { label: 'Other',    value: 'other' },
];

export const PRIORITIES = [
  { label: 'High',   value: 'high',   color: '#dc2626', bg: '#FEE2E2' },
  { label: 'Medium', value: 'medium', color: '#d97706', bg: '#FEF3C7' },
  { label: 'Low',    value: 'low',    color: '#059669', bg: '#D1FAE5' },
];

export const FOLLOWUP_TYPES = [
  { type: 'call',     label: 'Call',     icon: 'phone' },
  { type: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
  { type: 'email',    label: 'Email',    icon: 'email' },
  { type: 'visit',    label: 'Visit',    icon: 'visit' },
  { type: 'note',     label: 'Note',     icon: 'note' },
];

export const RELATIONSHIPS = [
  { label: 'Parent',   value: 'parent' },
  { label: 'Guardian', value: 'guardian' },
  { label: 'Other',    value: 'other' },
];

export const GENDERS = [
  { label: 'Male',   value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other',  value: 'other' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSchoolId(schoolCode) {
  const { data, error } = await supabase
    .from('schools')
    .select('id')
    .eq('school_code', schoolCode)
    .single();
  if (error || !data) throw new Error('School not found');
  return data.id;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const admissionsService = {
  async list(schoolCode, filters = {}, options = {}) {
    const schoolId = await getSchoolId(schoolCode);
    const limit = Math.min(options.limit ?? 200, 500);
    const offset = options.offset ?? 0;

    let query = supabase
      .from('admission_enquiries')
      .select('*, assigned_user:assigned_to(full_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.search) {
      const s = filters.search.replace(/%/g, '');
      query = query.or(
        `student_name.ilike.%${s}%,parent_name.ilike.%${s}%,parent_phone.ilike.%${s}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const mapped = (data ?? []).map((row) => ({
      ...row,
      assigned_to_name: row.assigned_user?.full_name ?? null,
      assigned_user: undefined,
    }));

    return { data: mapped, total: count ?? 0 };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('admission_enquiries')
      .select('*, assigned_user:assigned_to(full_name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      assigned_to_name: data.assigned_user?.full_name ?? null,
      assigned_user: undefined,
    };
  },

  async create(schoolCode, input) {
    const schoolId = await getSchoolId(schoolCode);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('admission_enquiries')
      .insert({
        school_id: schoolId,
        student_name: input.student_name,
        date_of_birth: input.date_of_birth ?? null,
        gender: input.gender ?? null,
        class_applying_for: input.class_applying_for,
        parent_name: input.parent_name,
        parent_phone: input.parent_phone,
        parent_email: input.parent_email ?? null,
        parent_relationship: input.parent_relationship ?? 'parent',
        address: input.address ?? null,
        source: input.source ?? 'walk_in',
        status: 'new',
        priority: input.priority ?? 'medium',
        notes: input.notes ?? null,
        assigned_to: input.assigned_to ?? null,
        academic_year_id: input.academic_year_id ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  async updateStatus(id, status) {
    const { error } = await supabase
      .from('admission_enquiries')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  },

  async update(id, updates) {
    const { error } = await supabase
      .from('admission_enquiries')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('admission_enquiries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Follow-ups ─────────────────────────────────────────────────────────────

  async listFollowups(enquiryId) {
    const { data, error } = await supabase
      .from('admission_followups')
      .select('*, user:user_id(full_name)')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      user_name: row.user?.full_name ?? null,
      user: undefined,
    }));
  },

  async addFollowup(enquiryId, input) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('admission_followups')
      .insert({
        enquiry_id: enquiryId,
        user_id: auth.user.id,
        type: input.type,
        note: input.note,
        scheduled_at: input.scheduled_at ?? null,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  // ── Web-native: bulk operations ────────────────────────────────────────────

  async bulkUpdateStatus(ids, status) {
    if (!ids?.length) return;
    const { error } = await supabase
      .from('admission_enquiries')
      .update({ status })
      .in('id', ids);
    if (error) throw error;
  },

  async bulkDelete(ids) {
    if (!ids?.length) return;
    const { error } = await supabase
      .from('admission_enquiries')
      .delete()
      .in('id', ids);
    if (error) throw error;
  },
};
