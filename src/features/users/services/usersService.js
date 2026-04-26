import { supabase } from '@/config/supabaseClient';

/**
 * Users service — direct port of mobile user-management surfaces.
 * Same Supabase RPCs, same Edge Function names, same payload shapes as
 * `~/Desktop/classbridge/src/features/admin/*` and `~/Desktop/classbridge/src/hooks/useAdmins|useStudents|useInactiveUsersList|useUserActivityStats`.
 *
 * Auth-side admin operations MUST go through Edge Functions (the web client
 * uses the anon key). This file is the single contract layer for the new
 * /users hub.
 */

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL || 'https://mvvzqouqxrtyzuzqbeud.supabase.co'}/functions/v1`;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Not authenticated. Please log in.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function callFunction(name, body) {
  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let result = {};
  try { result = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    // Surface every signal the function gives us — error, details, message,
    // or the raw text body if nothing else.
    const detail = result.error || result.details || result.message || text || `HTTP ${res.status}`;
    throw new Error(`${name}: ${detail}`);
  }
  return result;
}

export const usersService = {
  // ── unified roster ─────────────────────────────────────────────────────────
  // Queries the `users` table directly, scoped to the caller's school_code,
  // then merges last-sign-in data from the activity RPCs. The anon key
  // cannot read `auth.users` directly — last_sign_in_at flows through
  // `get_user_activity_stats` (recent logins) and `get_inactive_users_list`
  // (idle + never-signed-in users).
  async listAllUsers({ schoolCode } = {}) {
    let q = supabase
      .from('users')
      .select('id, full_name, email, phone, role, school_code, school_name, is_active, created_at, class_instance_id, avatar_url')
      .order('created_at', { ascending: false });
    if (schoolCode) q = q.eq('school_code', schoolCode);
    const { data, error } = await q;
    if (error) throw error;
    const users = data ?? [];

    if (!schoolCode) return users;

    // Pull last-sign-in info in parallel. All three RPCs fail open so a
    // missing function or RLS bump still lets the table render.
    const [stats, idleAdmin, idleStudent, neverAdmin, neverStudent] = await Promise.all([
      this.getActivityStats(schoolCode).catch(() => null),
      this.listInactiveUsers({ schoolCode, userType: 'admin', activity: 'idle' }).catch(() => []),
      this.listInactiveUsers({ schoolCode, userType: 'student', activity: 'idle' }).catch(() => []),
      this.listInactiveUsers({ schoolCode, userType: 'admin', activity: 'never' }).catch(() => []),
      this.listInactiveUsers({ schoolCode, userType: 'student', activity: 'never' }).catch(() => []),
    ]);

    const lastSignIn = new Map();
    const neverSignedIn = new Set();

    for (const r of stats?.recentLogins ?? []) {
      if (r.id && r.last_sign_in) lastSignIn.set(r.id, r.last_sign_in);
    }
    for (const r of [...idleAdmin, ...idleStudent]) {
      if (r.id && r.last_sign_in_at) {
        // Don't override a more recent value from recentLogins.
        if (!lastSignIn.has(r.id)) lastSignIn.set(r.id, r.last_sign_in_at);
      }
    }
    for (const r of [...neverAdmin, ...neverStudent]) {
      if (r.id) neverSignedIn.add(r.id);
    }

    return users.map((u) => ({
      ...u,
      last_sign_in_at: lastSignIn.get(u.id) ?? null,
      never_signed_in: neverSignedIn.has(u.id),
    }));
  },

  // ── activity / dashboard ───────────────────────────────────────────────────
  async getActivityStats(schoolCode) {
    const { data, error } = await supabase.rpc('get_user_activity_stats', {
      p_school_code: schoolCode,
    });
    if (error) throw error;
    return data || {};
  },

  // user_type: 'admin' | 'student'  ·  activity: 'never' | 'idle'
  async listInactiveUsers({ schoolCode, userType, activity, classInstanceId }) {
    const args = {
      p_school_code: schoolCode,
      p_user_type: userType,
      p_activity: activity,
    };
    if (classInstanceId) args.p_class_instance_id = classInstanceId;
    const { data, error } = await supabase.rpc('get_inactive_users_list', args);
    if (error) throw error;
    // RPC returns Json — could be either an array or an object with a list.
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.users)) return data.users;
    return [];
  },

  async listSuperAdmins() {
    const { data, error } = await supabase.rpc('get_all_super_admins');
    if (error) throw error;
    return data ?? [];
  },

  // ── creation (Edge Functions — match mobile contracts exactly) ─────────────
  async createAdmin({ full_name, email, password, phone, admin_code }) {
    return callFunction('create-admin', {
      full_name, email, password, phone,
      role: 'admin',
      admin_code,
    });
  },

  async createStudent({ full_name, email, password, phone, student_code, class_instance_id }) {
    return callFunction('create-student', {
      full_name, email, password, phone,
      student_code, class_instance_id,
    });
  },

  async createSuperAdmin({ full_name, email, password, phone, super_admin_code, school_code, school_name }) {
    return callFunction('create-super-admin', {
      full_name, email, password, phone,
      role: 'superadmin',
      super_admin_code,
      school_code,
      school_name: school_name || '',
    });
  },

  // ── deletion (Edge Functions) ──────────────────────────────────────────────
  async deleteAdmin(userId) {
    return callFunction('delete-admin', { user_id: userId });
  },

  // The hub passes the auth user id (from public.users). The `delete-student`
  // Edge Function expects student.id (the student table's own PK), so we
  // resolve auth_user_id → student.id first. If the lookup fails, surface
  // a clear error rather than calling the function with the wrong id.
  async deleteStudent(idOrAuthId) {
    let studentId = idOrAuthId;
    const { data: byAuth, error: lookupErr } = await supabase
      .from('student')
      .select('id')
      .eq('auth_user_id', idOrAuthId)
      .maybeSingle();
    if (lookupErr) throw new Error(`Lookup failed: ${lookupErr.message}`);
    if (byAuth?.id) {
      studentId = byAuth.id;
    } else {
      // Maybe the caller already passed a student.id — verify.
      const { data: byId } = await supabase
        .from('student')
        .select('id')
        .eq('id', idOrAuthId)
        .maybeSingle();
      if (!byId?.id) {
        throw new Error('Student record not found in this school');
      }
    }
    return callFunction('delete-student', { student_id: studentId });
  },

  // ── direct table updates (no auth-side change) ─────────────────────────────
  async updateUserProfile(userId, { full_name, phone, avatar_url, class_instance_id }) {
    const patch = {};
    if (full_name !== undefined) patch.full_name = full_name;
    if (phone !== undefined) patch.phone = phone;
    if (avatar_url !== undefined) patch.avatar_url = avatar_url;
    if (class_instance_id !== undefined) patch.class_instance_id = class_instance_id;
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAdminRecord(userId, { full_name, phone, admin_code }) {
    const { error } = await supabase
      .from('admin')
      .update({ full_name, phone, admin_code })
      .eq('id', userId);
    if (error) throw error;
  },

  async updateStudentRecord(studentId, { full_name, phone, student_code, class_instance_id }) {
    const patch = {};
    if (full_name !== undefined) patch.full_name = full_name;
    if (phone !== undefined) patch.phone = phone;
    if (student_code !== undefined) patch.student_code = student_code;
    if (class_instance_id !== undefined) patch.class_instance_id = class_instance_id;
    const { error } = await supabase
      .from('student')
      .update(patch)
      .eq('id', studentId);
    if (error) throw error;
  },

  // ── deactivation (soft-delete via users.is_active) ─────────────────────────
  async setActive(userId, isActive) {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deactivateUser(userId) {
    return this.setActive(userId, false);
  },

  async reactivateUser(userId) {
    return this.setActive(userId, true);
  },

  // ── linked-entity fetch helpers ────────────────────────────────────────────
  // Used by the user-detail drawer to pull the role-specific record (admin /
  // student / employee link) so admins can jump to HR/Student detail.
  async getAdminRecord(userId) {
    const { data, error } = await supabase
      .from('admin')
      .select('id, full_name, email, phone, admin_code, school_code, school_name, created_at, auth_user_id')
      .eq('id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getStudentRecord(userId) {
    // The roster RPC returns `users.id` (= auth_user_id). The student table
    // has its own surrogate `id` PK, so we must look up by `auth_user_id`.
    const { data, error } = await supabase
      .from('student')
      .select(`
        id, full_name, email, phone, student_code, class_instance_id, school_code,
        class_instances ( grade, section )
      `)
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    // Normalise the join shape so callers can read `class_instances.grade`
    // regardless of whether Supabase returns it as an array or object.
    const ci = Array.isArray(data.class_instances) ? data.class_instances[0] : data.class_instances;
    return { ...data, class_instances: ci || null };
  },

  async getEmployeeByUserId(userId) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, employee_code, designation, department, status, user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // ── self-service (current user) ────────────────────────────────────────────
  async changeOwnPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async updateOwnProfile({ full_name, phone, avatar_url }) {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id;
    if (!userId) throw new Error('Not authenticated.');
    return this.updateUserProfile(userId, { full_name, phone, avatar_url });
  },

  async signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
  },

  async sendPasswordResetEmail(email) {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  // ── classes (used by invite flow) ──────────────────────────────────────────
  async listClassInstances(schoolCode) {
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        id,
        class:classes (grade, section),
        academic_years:academic_years (year_start, year_end, is_active)
      `)
      .eq('school_code', schoolCode);
    if (error) throw error;
    return data ?? [];
  },

  async listSchools() {
    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name, school_code')
      .order('school_name');
    if (error) throw error;
    return data ?? [];
  },
};

// ── role helpers ─────────────────────────────────────────────────────────────
export const ROLE_LABELS = {
  cb_admin: 'CB Admin',
  superadmin: 'Super Admin',
  admin: 'Admin',
  student: 'Student',
};

export const ROLE_COLORS = {
  cb_admin: 'magenta',
  superadmin: 'gold',
  admin: 'blue',
  student: 'green',
};

// What roles can the current user invite?
export function invitableRoles(currentRole) {
  if (currentRole === 'cb_admin') return ['superadmin', 'admin', 'student'];
  if (currentRole === 'superadmin') return ['admin', 'student'];
  if (currentRole === 'admin') return ['student'];
  return [];
}

// Capability matrix readout — what does this role unlock on web?
export const CAPABILITY_MATRIX = {
  cb_admin: [
    'Create/manage schools',
    'Create super admins for any school',
    'View platform-level metrics',
  ],
  superadmin: [
    'Manage all users in school (admins, students)',
    'School setup (academic years, classes, subjects)',
    'HR (staff, payroll, leaves, attendance)',
    'Finance (transactions, accounts, reports)',
    'Inventory, Admissions, Communications',
    'Inactive users + force-logout',
  ],
  admin: [
    'Manage students',
    'HR view + payroll',
    'Attendance, tests, tasks, fees',
    'Communications, admissions, inventory',
  ],
  student: [
    'View own dashboard, results, fees',
    'Take tests, view syllabus + resources',
    'Self-service profile + password change',
  ],
};

export default usersService;
