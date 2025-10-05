import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient.js';
import { useAuth } from '../AuthProvider';

/**
 * Custom hook for Supabase queries with automatic error handling and loading states
 */
export const useSupabaseQuery = (table, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const {
    select = '*',
    filters = [],
    orderBy = null,
    limit = null,
    single = false,
    enabled = true
  } = options;

  useEffect(() => {
    if (!enabled || !user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from(table).select(select);

        // Apply filters
        filters.forEach(filter => {
          const { column, operator, value } = filter;
          query = query[operator](column, value);
        });

        // Apply ordering
        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
        }

        // Apply limit
        if (limit) {
          query = query.limit(limit);
        }

        const { data: result, error: queryError } = single 
          ? await query.single()
          : await query;

        if (queryError) {
          throw queryError;
        }

        setData(result || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [table, JSON.stringify(filters), JSON.stringify(orderBy), limit, single, enabled, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from(table).select(select);

      // Apply filters
      filters.forEach(filter => {
        if (filter.column && filter.operator && filter.value !== undefined) {
          query = query[filter.operator](filter.column, filter.value);
        }
      });

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data: result, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      setData(single ? result[0] : result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    if (enabled && user) {
      fetchData();
    }
  };

  return { data, loading, error, refetch };
};

/**
 * Custom hook for real-time Supabase subscriptions
 */
export const useSupabaseSubscription = (table, callback, filters = []) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let channel = supabase
      .channel(`${table}_changes`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: table,
          filter: filters.length > 0 ? filters.map(f => `${f.column}=eq.${f.value}`).join(',') : undefined
        }, 
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback, JSON.stringify(filters), user]);
};

/**
 * Custom hook for Supabase mutations with optimistic updates
 */
export const useSupabaseMutation = (table) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const insert = async (data) => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: insertError } = await supabase
        .from(table)
        .insert(data)
        .select();

      if (insertError) throw insertError;

      // Log activity
      await supabase.rpc('log_activity', {
        p_action: 'create',
        p_description: `Created new ${table} record`,
        p_entity_type: table,
        p_entity_id: result[0]?.id
      });

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const update = async (id, data) => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: updateError } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select();

      if (updateError) throw updateError;

      // Log activity
      await supabase.rpc('log_activity', {
        p_action: 'update',
        p_description: `Updated ${table} record`,
        p_entity_type: table,
        p_entity_id: id
      });

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Log activity
      await supabase.rpc('log_activity', {
        p_action: 'delete',
        p_description: `Deleted ${table} record`,
        p_entity_type: table,
        p_entity_id: id
      });

      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { insert, update, remove, loading, error };
};