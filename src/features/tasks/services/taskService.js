import { supabase } from '@/config/supabaseClient';
import dayjs from 'dayjs';

/**
 * Task Service - Handles task management operations
 */
export class TaskService {
  
  /**
   * Upload attachment to Supabase Storage
   * @param {File} file - File to upload
   * @param {string} schoolCode - School code
   * @param {string} classInstanceId - Class instance ID
   * @returns {Promise<Object>} - Attachment metadata {bucket, path, name, size, mime}
   */
  static async uploadAttachment(file, schoolCode, classInstanceId) {
    try {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not allowed. Only images, PDFs, DOC, DOCX, and TXT files are supported.');
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const extension = file.name.split('.').pop();
      const filename = `${timestamp}_${randomStr}.${extension}`;
      
      // Construct storage path: task-attachments/{school_code}/{class_instance_id}/{filename}
      const storagePath = `task-attachments/${schoolCode}/${classInstanceId}/${filename}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('Lms')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Return sanitized metadata
      return {
        bucket: 'Lms',
        path: data.path,
        name: file.name,
        size: file.size,
        mime: file.type
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sign download URL for an attachment
   * @param {Object} metadata - Attachment metadata {bucket, path}
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
   * @returns {Promise<string>} - Signed URL
   */
  static async signDownloadURL(metadata, ttl = 300) {
    try {
      if (!metadata.bucket || !metadata.path) {
        throw new Error('Invalid attachment metadata');
      }

      const { data, error } = await supabase.storage
        .from(metadata.bucket)
        .createSignedUrl(metadata.path, ttl);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all tasks for a school with optional filters and pagination
   * @param {string} schoolCode - School code
   * @param {Object} filters - Optional filters
   * @param {Object} pagination - Pagination options {page, pageSize}
   * @returns {Promise<Object>} - {data: Array, total: number}
   */
  static async getTasks(schoolCode, filters = {}, pagination = { page: 1, pageSize: 10 }) {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name),
          class_instances(grade, section),
          academic_years(year_start, year_end)
        `, { count: 'exact' })
        .eq('school_code', schoolCode)
        .eq('is_active', true);

      // Apply filters only if they are explicitly provided
      if (filters.academicYearId) {
        query = query.eq('academic_year_id', filters.academicYearId);
      }

      if (filters.classInstanceId) {
        query = query.eq('class_instance_id', filters.classInstanceId);
      }
      
      if (filters.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
      }
      
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      
      if (filters.startDate) {
        query = query.gte('assigned_date', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('due_date', filters.endDate);
      }
      
      if (filters.overdue) {
        query = query.lt('due_date', dayjs().format('YYYY-MM-DD'));
      }

      // Apply search filter (server-side text search)
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply pagination
      const { page = 1, pageSize = 10 } = pagination;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }
      
      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    } catch (error) {
      console.error('TaskService.getTasks error:', error);
      throw error;
    }
  }

  /**
   * Get a single task by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} - Task object
   */
  static async getTaskById(taskId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name),
          class_instances(grade, section),
          academic_years(year_start, year_end)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task data (attachments should be sanitized metadata only)
   * @returns {Promise<Object>} - Created task
   */
  static async createTask(taskData) {
    try {
      // Ensure attachments are sanitized (no AntD UploadFile objects)
      const sanitizedData = {
        ...taskData,
        attachments: taskData.attachments?.map(att => ({
          bucket: att.bucket,
          path: att.path,
          name: att.name,
          size: att.size,
          mime: att.mime
        })) || []
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([sanitizedData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing task
   * @param {string} taskId - Task ID
   * @param {Object} taskData - Updated task data (attachments should be sanitized metadata only)
   * @returns {Promise<Object>} - Updated task
   */
  static async updateTask(taskId, taskData) {
    try {
      // Ensure attachments are sanitized (no AntD UploadFile objects)
      const sanitizedData = {
        ...taskData,
        attachments: taskData.attachments?.map(att => ({
          bucket: att.bucket,
          path: att.path,
          name: att.name,
          size: att.size,
          mime: att.mime
        })) || [],
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(sanitizedData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a task (soft delete by setting is_active to false)
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteTask(taskId) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tasks for a specific class and date range
   * @param {string} schoolCode - School code
   * @param {string} classInstanceId - Class instance ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of tasks
   */
  static async getTasksForClassAndDateRange(schoolCode, classInstanceId, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name)
        `)
        .eq('school_code', schoolCode)
        .eq('class_instance_id', classInstanceId)
        .eq('is_active', true)
        .gte('assigned_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tasks assigned to a specific student
   * @param {string} studentId - Student ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of tasks
   */
  static async getTasksForStudent(studentId, filters = {}) {
    try {
      // First get the student's class instance
      const { data: student, error: studentError } = await supabase
        .from('student')
        .select('class_instance_id, school_code')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      let query = supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name),
          class_instances(grade, section)
        `)
        .eq('school_code', student.school_code)
        .eq('class_instance_id', student.class_instance_id)
        .eq('is_active', true);

      // Apply additional filters
      if (filters.overdue) {
        query = query.lt('due_date', dayjs().format('YYYY-MM-DD'));
      }
      
      if (filters.upcoming) {
        query = query.gte('due_date', dayjs().format('YYYY-MM-DD'));
      }
      

      const { data, error } = await query
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get task statistics for a school
   * @param {string} schoolCode - School code
   * @param {string} classInstanceId - Optional class instance ID
   * @returns {Promise<Object>} - Task statistics
   */
  static async getTaskStatistics(schoolCode, classInstanceId = null) {
    try {
      let query = supabase
        .from('tasks')
        .select('priority, due_date, assigned_date')
        .eq('school_code', schoolCode)
        .eq('is_active', true);

      if (classInstanceId) {
        query = query.eq('class_instance_id', classInstanceId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const today = dayjs().format('YYYY-MM-DD');
      
      const stats = {
        total: data.length,
        byPriority: {},
        overdue: 0,
        dueToday: 0,
        upcoming: 0
      };

      data.forEach(task => {
        // Count by priority
        stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
        
        // Count by due date
        if (dayjs(task.due_date).isBefore(today)) {
          stats.overdue++;
        } else if (dayjs(task.due_date).isSame(today)) {
          stats.dueToday++;
        } else {
          stats.upcoming++;
        }
      });

      return stats;
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Task Submission Service - Handles task submission operations
 */
export class TaskSubmissionService {
  
  /**
   * Mark task as complete (simple completion without detailed submission)
   * @param {string} taskId - Task ID
   * @param {string} studentId - Student ID
   * @returns {Promise<Object>} - Created/updated completion record
   */
  static async markTaskComplete(taskId, studentId) {
    try {
      // Check if already submitted
      const { data: existing } = await supabase
        .from('task_submissions')
        .select('id, status')
        .eq('task_id', taskId)
        .eq('student_id', studentId)
        .single();

      if (existing) {
        // Update existing submission to completed
        const { data, error } = await supabase
          .from('task_submissions')
          .update({
            status: 'completed',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new completion record
        const { data, error } = await supabase
          .from('task_submissions')
          .insert([{
            task_id: taskId,
            student_id: studentId,
            status: 'completed',
            submission_text: null,
            attachments: [],
            submitted_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark task as incomplete
   * @param {string} taskId - Task ID
   * @param {string} studentId - Student ID
   * @returns {Promise<boolean>} - Success status
   */
  static async markTaskIncomplete(taskId, studentId) {
    try {
      const { error } = await supabase
        .from('task_submissions')
        .delete()
        .eq('task_id', taskId)
        .eq('student_id', studentId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get student's completion status for a task
   * @param {string} taskId - Task ID
   * @param {string} studentId - Student ID
   * @returns {Promise<Object|null>} - Completion status or null
   */
  static async getTaskCompletion(taskId, studentId) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', taskId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all students' completion status for a task
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} - Array of submissions with student info
   */
  static async getTaskCompletions(taskId) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select(`
          *,
          student (
            id,
            full_name,
            student_code
          )
        `)
        .eq('task_id', taskId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Submit a task (detailed submission with text and attachments)
   * @param {Object} submissionData - Submission data
   * @returns {Promise<Object>} - Created submission
   */
  static async submitTask(submissionData) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .insert([submissionData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get submissions for a task
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} - Array of submissions
   */
  static async getTaskSubmissions(taskId) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select(`
          *,
          student(full_name, student_code)
        `)
        .eq('task_id', taskId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get student's submission for a task
   * @param {string} taskId - Task ID
   * @param {string} studentId - Student ID
   * @returns {Promise<Object|null>} - Submission or null
   */
  static async getStudentSubmission(taskId, studentId) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', taskId)
        .eq('student_id', studentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Grade a submission
   * @param {string} submissionId - Submission ID
   * @param {Object} gradeData - Grade data
   * @returns {Promise<Object>} - Updated submission
   */
  static async gradeSubmission(submissionId, gradeData) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .update({
          ...gradeData,
          graded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get submissions for a student
   * @param {string} studentId - Student ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - Array of submissions
   */
  static async getStudentSubmissions(studentId, filters = {}) {
    try {
      let query = supabase
        .from('task_submissions')
        .select(`
          *,
          tasks(title, due_date, max_marks, subjects(subject_name))
        `)
        .eq('student_id', studentId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  }
}
