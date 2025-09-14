// services/testTakingService.js
// Robust, tolerant service for student test-taking flows.
// - Uses Supabase client imported from your config
// - Defensive: tolerates schema differences (started_at, in_progress)
// - All functions throw Error objects when unrecoverable; callers should catch and surface messages.

import { supabase } from '../config/supabaseClient.js';

/**
 * Helper: resolve student row by studentCode or email.
 * Returns null if not found.
 */
async function resolveStudent({ schoolCode, studentCode, userEmail }) {
  if (!schoolCode) throw new Error('schoolCode required');

  try {
    const base = supabase.from('student').select('id, class_instance_id, school_code, student_code, email');

    if (studentCode) {
      const { data, error } = await base.eq('student_code', studentCode).eq('school_code', schoolCode).maybeSingle();
      if (error) throw error;
      if (data) return data;
    }

    if (userEmail) {
      const { data, error } = await base.eq('email', userEmail).eq('school_code', schoolCode).maybeSingle();
      if (error) throw error;
      if (data) return data;
    }

    return null;
  } catch (err) {
    console.error('resolveStudent error', err);
    throw err;
  }
}

/**
 * Get tests available to a student's class.
 * Returns array of test objects with minimal fields and test_questions (if present).
 */
export async function getAvailableTests(studentId, schoolCode, userEmail, studentCode) {
  try {
    if (!schoolCode) throw new Error('schoolCode is required');

    // Resolve student if class_instance_id unknown
    let classInstanceId = null;
    if (studentId) {
      // Try quick fetch by id first
      const { data: sData, error: sErr } = await supabase
        .from('student')
        .select('id, class_instance_id, school_code')
        .eq('id', studentId)
        .eq('school_code', schoolCode)
        .maybeSingle();

      if (sErr) {
        console.warn('getAvailableTests: student lookup by id error', sErr);
      } else if (sData) {
        classInstanceId = sData.class_instance_id;
      }
    }

    if (!classInstanceId) {
      const student = await resolveStudent({ schoolCode, studentCode, userEmail });
      if (!student) {
        // Not an exceptional condition: return empty list
        return [];
      }
      classInstanceId = student.class_instance_id;
    }

    if (!classInstanceId) return [];

    // Fetch tests for class_instance
    const { data: tests, error: testsErr } = await supabase
      .from('tests')
      .select(
        `id, title, description, test_type, time_limit_seconds, class_instance_id, created_at, allow_reattempts,
         class_instances(id,grade,section),
         subjects(id,subject_name),
         syllabus_chapters(id, chapter_no, title, description),
         test_questions(id, question_text, question_type, options, correct_index, correct_text)`
      )
      .eq('class_instance_id', classInstanceId)
      .eq('school_code', schoolCode)
      .order('created_at', { ascending: false });

    if (testsErr) {
      console.error('getAvailableTests - testsErr', testsErr);
      throw testsErr;
    }

    // Optionally filter out completed tests for this student (best-effort; don't fail on errors)
    let completedIds = [];
    try {
      if (studentId) {
        const { data: completed, error: compErr } = await supabase
          .from('test_attempts')
          .select('test_id')
          .eq('student_id', studentId)
          .eq('status', 'completed');

        if (compErr) {
          console.warn('getAvailableTests: could not fetch completed tests', compErr);
        } else if (completed) {
          completedIds = completed.map(r => r.test_id);
        }
      }
    } catch (err) {
      console.warn('getAvailableTests: completed tests fallback error', err);
    }

    // Filter tests based on completion status and reattempt settings
    const available = (tests || []).filter(t => {
      const isCompleted = completedIds.includes(t.id);
      const allowsReattempts = t.allow_reattempts === true;
      
      // Show test if:
      // 1. Not completed yet, OR
      // 2. Completed but reattempts are allowed
      return !isCompleted || allowsReattempts;
    });
    
    return available;
  } catch (err) {
    console.error('getAvailableTests fatal', err);
    throw err;
  }
}

/**
 * Get test details for taking.
 * Returns { test, existingAttempt } where existingAttempt may be null.
 */
export async function getTestForTaking(testId, studentId, schoolCode, userEmail, studentCode) {
  try {
    if (!testId) throw new Error('testId required');
    if (!schoolCode) throw new Error('schoolCode required');

    // resolve actual student id if necessary
    let actualStudentId = studentId;
    if (!actualStudentId) {
      const student = await resolveStudent({ schoolCode, studentCode, userEmail });
      if (!student) throw new Error('Student not found');
      actualStudentId = student.id;
    }

    // Fetch test with questions. Avoid deep client-side expansions that rely on schema cache.
    const { data: test, error: testErr } = await supabase
      .from('tests')
      .select(
        `*,
        class_instances(id,grade,section),
        subjects(id,subject_name),
        test_questions(id, question_text, question_type, options, correct_index, correct_text)`
      )
      .eq('id', testId)
      .maybeSingle();

    if (testErr) {
      console.error('getTestForTaking - testErr', testErr);
      throw testErr;
    }
    if (!test) throw new Error('Test not found');

    // Try to fetch an existing attempt. Do not use server-side status filters that might be unsupported.
    let existingAttempt = null;
    try {
      const { data: attempts, error: attemptsErr } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('test_id', testId)
        .eq('student_id', actualStudentId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (attemptsErr) {
        console.warn('getTestForTaking: attempts lookup error (non-fatal)', attemptsErr);
      } else if (attempts && attempts.length > 0) {
        // prefer in_progress if present
        existingAttempt = attempts.find(a => a.status === 'in_progress') || attempts[0];
      }
    } catch (err) {
      console.warn('getTestForTaking: attempts lookup exception', err);
    }

    return { test, existingAttempt: existingAttempt || null };
  } catch (err) {
    console.error('getTestForTaking fatal', err);
    throw err;
  }
}

/**
 * Start or resume an attempt.
 * Tries to create in_progress + started_at; falls back to submitted if schema rejects it.
 */
export async function startTestAttempt(testId, studentId, schoolCode, userEmail, studentCode) {
  try {
    if (!testId) throw new Error('testId required');
    if (!schoolCode) throw new Error('schoolCode required');

    // resolve student ID
    let actualStudentId = studentId;
    if (!actualStudentId) {
      const student = await resolveStudent({ schoolCode, studentCode, userEmail });
      if (!student) throw new Error('Student not found');
      actualStudentId = student.id;
    }

    // Get test info to check if reattempts are allowed
    const { data: testData, error: testErr } = await supabase
      .from('tests')
      .select('allow_reattempts')
      .eq('id', testId)
      .single();

    if (testErr) {
      console.warn('startTestAttempt: test lookup warning', testErr);
    }

    const allowsReattempts = testData?.allow_reattempts === true;
    console.log('startTestAttempt: testId=', testId, 'allowsReattempts=', allowsReattempts);

    // Check existing attempts first (avoid duplicates)
    try {
      const { data: attempts, error: attemptsErr } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('test_id', testId)
        .eq('student_id', actualStudentId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (attemptsErr) {
        console.warn('startTestAttempt: existing lookup warning', attemptsErr);
      } else if (attempts && attempts.length > 0) {
        const latest = attempts[0];
        console.log('startTestAttempt: found existing attempt', latest.id, 'status=', latest.status);
        
        // Resume if not completed/abandoned, OR if reattempts are allowed and latest is completed
        if (latest.status !== 'completed' && latest.status !== 'abandoned') {
          console.log('startTestAttempt: resuming existing in-progress attempt');
          return latest;
        } else if (allowsReattempts && latest.status === 'completed') {
          console.log('startTestAttempt: resetting completed attempt for reattempt');
          // Reset the completed attempt to in_progress for reattempt
          const { data: resetAttempt, error: resetError } = await supabase
            .from('test_attempts')
            .update({
              status: 'in_progress',
              started_at: new Date().toISOString(),
              answers: {},
              score: null,
              earned_points: null,
              total_points: null,
              completed_at: null
            })
            .eq('id', latest.id)
            .select()
            .single();

          if (resetError) {
            console.warn('startTestAttempt: reset attempt warning', resetError);
            // If reset fails, create a new attempt
          } else {
            console.log('startTestAttempt: successfully reset attempt for reattempt');
            return resetAttempt;
          }
        } else {
          console.log('startTestAttempt: cannot reuse attempt, creating new one');
        }
      }
    } catch (err) {
      console.warn('startTestAttempt: existing lookup exception', err);
    }

    // Try to insert with in_progress + started_at (preferred)
    try {
      const { data, error } = await supabase
        .from('test_attempts')
        .insert([{
          test_id: testId,
          student_id: actualStudentId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          answers: {}
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      // If server rejects (schema mismatch), fall back to 'submitted' insert without started_at
      console.warn('startTestAttempt: insert with in_progress failed - falling back', err);

       const { data: fallback, error: fallbackErr } = await supabase
         .from('test_attempts')
         .insert([{
           test_id: testId,
           student_id: actualStudentId,
           status: 'in_progress',
           answers: {}
         }])
         .select()
         .single();

      if (fallbackErr) {
        console.error('startTestAttempt: fallback insert failed', fallbackErr);
        throw fallbackErr;
      }
      return fallback;
    }
  } catch (err) {
    console.error('startTestAttempt fatal', err);
    throw err;
  }
}

/**
 * Save answer for a specific attempt (partial save).
 * Updates answers JSONB; returns updated attempt row.
 */
export async function saveTestAnswer(attemptId, questionId, answer, studentId) {
  try {
    console.log('saveTestAnswer called:', { attemptId, questionId, answer, studentId });
    if (!attemptId) throw new Error('attemptId required');

    // fetch existing answers (single)
    const { data: attempt, error: getErr } = await supabase
      .from('test_attempts')
      .select('answers, student_id')
      .eq('id', attemptId)
      .maybeSingle();

    if (getErr) throw getErr;
    if (!attempt) throw new Error('Attempt not found');

    console.log('Current attempt answers:', attempt.answers);

    // optional: enforce student ownership
    if (studentId && attempt.student_id !== studentId) {
      throw new Error('Not authorized to modify this attempt');
    }

    const updated = { ...(attempt.answers || {}), [questionId]: answer };
    console.log('Updated answers object:', updated);

    const { data, error } = await supabase
      .from('test_attempts')
      .update({ answers: updated, started_at: new Date().toISOString() }) // refresh started_at to mark activity if supported
      .eq('id', attemptId)
      .select()
      .single();

    if (error) throw error;
    console.log('Answer saved to database:', data);
    return data;
  } catch (err) {
    console.error('saveTestAnswer fatal', err);
    throw err;
  }
}

/**
 * Submit attempt: auto-grade MCQs (best-effort using test_questions correct_index/correct_text)
 * and update attempt to completed with score.
 */
export async function submitTestAttempt(attemptId, answers, studentId) {
  try {
    if (!attemptId) throw new Error('attemptId required');
    console.log('submitTestAttempt: attemptId=', attemptId, 'studentId=', studentId);

    // Fetch attempt and its test questions
    const { data: attemptRow, error: attemptErr } = await supabase
      .from('test_attempts')
      .select(`id, test_id, student_id, status`)
      .eq('id', attemptId)
      .maybeSingle();

    if (attemptErr) throw attemptErr;
    if (!attemptRow) throw new Error('Attempt not found');

    console.log('submitTestAttempt: found attempt', attemptRow.id, 'status=', attemptRow.status);

    if (studentId && attemptRow.student_id !== studentId) {
      throw new Error('Not authorized to submit this attempt');
    }

    // Check if attempt is in progress
    if (attemptRow.status !== 'in_progress') {
      throw new Error(`Cannot submit test - attempt is not in progress (status: ${attemptRow.status})`);
    }

    const testId = attemptRow.test_id;
    // Get test questions
    const { data: testData, error: testErr } = await supabase
      .from('tests')
      .select('id, test_questions(id, question_type, correct_index, correct_text, options)')
      .eq('id', testId)
      .maybeSingle();

    if (testErr) throw testErr;
    if (!testData) throw new Error('Associated test not found');

    const questions = testData.test_questions || [];
    console.log('submitTestAttempt: fetched questions:', questions.length, 'questions');
    console.log('submitTestAttempt: questions data:', questions);

    // Calculate correct answers
    const totalQuestions = questions.length;
    let correctAnswers = 0;
    
    for (const q of questions) {
      const studentAns = answers ? answers[q.id] : undefined;
      let correct = false;
      
      console.log('Processing question:', {
        id: q.id,
        question_type: q.question_type,
        correct_index: q.correct_index,
        correct_text: q.correct_text,
        student_answer: studentAns,
        options: q.options
      });
      
      if (q.question_type === 'mcq' || q.question_type === 'multiple_choice') {
        if (q.correct_index !== null && q.correct_index !== undefined && q.options && q.options.length > q.correct_index) {
          // Get the correct option text from the options array
          const correctOptionText = q.options[q.correct_index];
          // Compare student answer with the correct option text
          correct = String(studentAns || '').trim().toLowerCase() === String(correctOptionText || '').trim().toLowerCase();
          console.log('MCQ with correct_index:', { 
            studentAns, 
            correct_index: q.correct_index, 
            correctOptionText,
            correct 
          });
        } else if (q.correct_text) {
          correct = String(studentAns || '').trim().toLowerCase() === String(q.correct_text).trim().toLowerCase();
          console.log('MCQ with correct_text:', { studentAns, correct_text: q.correct_text, correct });
        } else {
          console.log('MCQ with no correct answer data');
        }
      } else {
        // text based: compare with correct_text if available
        if (q.correct_text) {
          correct = String(studentAns || '').trim().toLowerCase() === String(q.correct_text).trim().toLowerCase();
          console.log('Text question:', { studentAns, correct_text: q.correct_text, correct });
        } else {
          // cannot auto-grade; skip counting as correct
          correct = false;
          console.log('Text question with no correct answer data');
        }
      }
      
      if (correct) correctAnswers++;
      console.log('Question result:', { questionId: q.id, correct, correctAnswers });
    }
    
    // Ensure values are non-negative
    const validCorrectAnswers = Math.max(0, correctAnswers);
    const validTotalQuestions = Math.max(0, totalQuestions);
    
    console.log('Score calculation:', { 
      totalQuestions,
      correctAnswers,
      validCorrectAnswers,
      validTotalQuestions,
      answers: answers,
      questions: questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        correct_index: q.correct_index,
        correct_text: q.correct_text,
        student_answer: answers[q.id]
      }))
    });

    // First check the current status of the attempt
    const { data: currentAttempt, error: checkError } = await supabase
      .from('test_attempts')
      .select('id, status, test_id, student_id, answers')
      .eq('id', attemptId)
      .single();

    if (checkError) {
      console.error('Error checking current attempt status:', checkError);
      throw checkError;
    }

    if (!currentAttempt) {
      throw new Error('Attempt not found');
    }

    console.log('Current attempt data:', currentAttempt);

    // Only update if the attempt is in progress
    if (currentAttempt.status !== 'in_progress') {
      throw new Error('Cannot submit test - attempt is not in progress');
    }

    // Update with proper scoring fields
    const updateData = {
      answers: answers,
      status: 'completed',
      score: validCorrectAnswers,
      earned_points: validCorrectAnswers,
      total_points: validTotalQuestions,
      completed_at: new Date().toISOString()
    };
    
    console.log('Attempting update with values:', {
      attemptId,
      updateData,
      correct_answers: validCorrectAnswers,
      total_questions: validTotalQuestions
    });
    
    const { data: updated, error: updateErr } = await supabase
      .from('test_attempts')
      .update(updateData)
      .eq('id', attemptId)
      .select()
      .single();

    if (updateErr) {
      console.error('Update error details:', {
        error: updateErr,
        attemptId,
        updateData,
        currentAttempt
      });
      throw updateErr;
    }

    console.log('Update successful:', updated);
    console.log('Stored score in database:', updated?.score);
    return updated;
  } catch (err) {
    console.error('submitTestAttempt fatal', err);
    throw err;
  }
}

/**
 * Allow reattempt of a test (admin/superadmin only)
 */
export async function allowTestReattempt(attemptId, studentId, schoolCode, userEmail, studentCode) {
  try {
    if (!attemptId) throw new Error('attemptId required');
    if (!schoolCode) throw new Error('schoolCode required');

    // Resolve student id if not provided
    let actualStudentId = studentId;
    if (!actualStudentId) {
      const student = await resolveStudent({ schoolCode, studentCode, userEmail });
      if (!student) throw new Error('Student not found');
      actualStudentId = student.id;
    }

    // Update the attempt status to allow reattempt
    const { data: updated, error } = await supabase
      .from('test_attempts')
      .update({
        status: 'abandoned', // Mark as abandoned to allow new attempt
        updated_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .eq('student_id', actualStudentId)
      .select()
      .single();

    if (error) throw error;
    return updated;
  } catch (err) {
    console.error('allowTestReattempt fatal', err);
    throw err;
  }
}

/**
 * Get student's completed test history
 */
export async function getTestHistory(studentId, schoolCode, userEmail, studentCode) {
  try {
    // Resolve student id if not provided
    let actualStudentId = studentId;
    if (!actualStudentId) {
      const student = await resolveStudent({ schoolCode, studentCode, userEmail });
      if (!student) return [];
      actualStudentId = student.id;
    }

    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select(`
        id,
        test_id,
        status,
        score,
        earned_points,
        total_points,
        answers,
        completed_at,
        test:tests ( 
          title, 
          test_type, 
          subjects(subject_name),
          test_questions(
            id,
            question_text,
            question_type,
            options,
            correct_text,
            correct_index
          )
        )
      `)
      .eq('student_id', actualStudentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (error) throw error;
    
    console.log('Test history data:', attempts);
    console.log('First attempt details:', attempts?.[0]);
    
    return attempts || [];
  } catch (err) {
    console.error('getTestHistory fatal', err);
    throw err;
  }
}
