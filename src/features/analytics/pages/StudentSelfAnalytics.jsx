import React, { useEffect, useState } from 'react';
import { useAuth } from '@/AuthProvider';
import { getStudentCode } from '@/shared/utils/metadata';
import { supabase } from '@/config/supabaseClient';
import { Spin, Empty, Card } from 'antd';
import UnifiedAnalytics from './UnifiedAnalytics';

export default function StudentSelfAnalytics() {
  const { user } = useAuth();
  const code = getStudentCode(user);
  const [studentId, setStudentId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let q = supabase.from('student').select('id').limit(1);
        if (user?.id) q = q.or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`);
        if (code) q = q.eq('student_code', code);
        if (user?.email) q = q.eq('email', user.email);
        // The query above is overly restrictive when chained; do simple lookups in order
        let row = null;
        if (user?.id) {
          const r = await supabase.from('student').select('id').eq('auth_user_id', user.id).limit(1).maybeSingle();
          row = r.data;
        }
        if (!row && code) {
          const r = await supabase.from('student').select('id').eq('student_code', code).limit(1).maybeSingle();
          row = r.data;
        }
        if (!row && user?.email) {
          const r = await supabase.from('student').select('id').eq('email', user.email).limit(1).maybeSingle();
          row = r.data;
        }
        if (!cancelled) {
          setStudentId(row?.id || null);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, code]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  if (!studentId) return (
    <Card style={{ margin: 24 }}>
      <Empty description="Couldn't find your student record. Please ask an admin to link your account." />
    </Card>
  );
  return <UnifiedAnalytics lockedScope="student" lockedStudentId={studentId} />;
}
