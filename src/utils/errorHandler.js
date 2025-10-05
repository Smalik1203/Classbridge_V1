/**
 * User-Friendly Error Handler
 * Maps database and HTTP errors to clear, actionable messages
 */

// Error message templates
const ERROR_TEMPLATES = {
  in_use: {
    title: "Can't delete this item",
    body: "This {item} is still linked to {relatedTypePlural}.",
    action: "Remove or reassign those {relatedTypePlural}, then try again.",
    toast: "Can't delete. Linked to {relatedTypePlural}."
  },
  duplicate: {
    title: "Already exists",
    body: "An item with {field} = \"{value}\" already exists.",
    action: "Use a different value or edit the existing item.",
    toast: "Value already taken: {field} = {value}."
  },
  required: {
    title: "Missing required info",
    body: "{fieldList} can't be empty.",
    action: "Fill in the missing fields and submit again.",
    toast: "{field} is required."
  },
  format: {
    title: "Invalid format",
    body: "{field} must be a valid {typeOrFormat}.",
    action: "Example: {exampleGood}.",
    toast: "{field}: invalid {typeOrFormat}."
  },
  rule: {
    title: "Value not allowed",
    body: "{field} must meet this rule: {readableRule}.",
    action: "Update the value to match the rule.",
    toast: "{field}: invalid value."
  },
  too_long: {
    title: "Too long",
    body: "{field} can be at most {maxLen} characters.",
    action: "Shorten the text and try again.",
    toast: "{field}: too long."
  },
  out_of_range: {
    title: "Number out of range",
    body: "{field} must be between {min}–{max}.",
    action: "Enter a number within that range.",
    toast: "{field}: out of range."
  },
  access: {
    title: "You don't have access",
    body: "You're not allowed to {action} this {resource}.",
    action: "Ask an admin for access or use a different account.",
    toast: "No permission to {action}."
  },
  not_found: {
    title: "Not found",
    body: "We couldn't find {resource}. It may have been moved or deleted.",
    action: "Refresh the page or check the link.",
    toast: "{resource} not found."
  },
  conflict: {
    title: "Update conflict",
    body: "{resource} changed since you opened it.",
    action: "Refresh to get the latest version, then re-apply your changes.",
    toast: "Edit conflict. Refresh and retry."
  },
  too_large: {
    title: "File is too large",
    body: "Maximum allowed size is {maxMB} MB.",
    action: "Compress or choose a smaller file.",
    toast: "File too large."
  },
  unsupported: {
    title: "File type not supported",
    body: "Allowed file types: {mimeList}.",
    action: "Convert the file and upload again.",
    toast: "File type not supported."
  },
  rate_limit: {
    title: "Too many requests",
    body: "You've hit the request limit.",
    action: "Wait {retryAfter} and try again.",
    toast: "Too many requests. Try again in {retryAfter}."
  },
  server: {
    title: "Something went wrong",
    body: "We couldn't complete your request.",
    action: "Try again in a moment. If it keeps happening, share this code: {incidentId}.",
    toast: "Server error. Try again."
  },
  network: {
    title: "Connection issue",
    body: "We couldn't reach the server.",
    action: "Check your internet connection and try again.",
    toast: "Connection failed."
  }
};

// Error code mappings
const ERROR_CODE_MAPPINGS = {
  // PostgreSQL Foreign Key Violations (23503)
  '23503': 'in_use',
  
  // PostgreSQL Unique Violations (23505)
  '23505': 'duplicate',
  
  // PostgreSQL Not Null Violations (23502)
  '23502': 'required',
  
  // PostgreSQL Check Constraint Violations (23514)
  '23514': 'rule',
  
  // PostgreSQL Invalid Input Syntax (22P02)
  '22P02': 'format',
  
  // PostgreSQL String Data Right Truncation (22001)
  '22001': 'too_long',
  
  // PostgreSQL Numeric Value Out of Range (22003)
  '22003': 'out_of_range',
  
  // PostgreSQL Insufficient Privilege (42501)
  '42501': 'access',
  
  // PostgreSQL Undefined Table (42P01)
  '42P01': 'not_found',
  
  // PostgreSQL Undefined Column (42703)
  '42703': 'not_found',
  
  // HTTP Status Codes
  '400': 'format',
  '401': 'access',
  '403': 'access',
  '404': 'not_found',
  '409': 'conflict',
  '413': 'too_large',
  '415': 'unsupported',
  '422': 'format',
  '429': 'rate_limit',
  '500': 'server',
  '502': 'server',
  '503': 'server',
  '504': 'server'
};

// Entity name mappings for better context
const ENTITY_NAMES = {
  'subjects': 'subject',
  'students': 'student',
  'teachers': 'teacher',
  'classes': 'class',
  'tests': 'test',
  'syllabi': 'syllabus',
  'syllabus_chapters': 'chapter',
  'syllabus_topics': 'topic',
  'timetable_slots': 'timetable slot',
  'attendance': 'attendance record',
  'fees': 'fee record'
};

// Field name mappings for better readability
const FIELD_NAMES = {
  'subject_id': 'subject',
  'student_id': 'student',
  'teacher_id': 'teacher',
  'class_instance_id': 'class',
  'syllabus_id': 'syllabus',
  'chapter_id': 'chapter',
  'topic_id': 'topic',
  'full_name': 'name',
  'email': 'email address',
  'phone': 'phone number',
  'student_code': 'student code',
  'subject_name': 'subject name',
  'class_name': 'class name'
};

/**
 * Parse error context from error message
 */
function parseErrorContext(error) {
  const context = {};
  
  if (error.message) {
    const message = error.message.toLowerCase();
    
    // Extract table names from foreign key violations
    const fkMatch = message.match(/table "([^"]+)" violates foreign key constraint "([^"]+)" on table "([^"]+)"/);
    if (fkMatch) {
      context.item = ENTITY_NAMES[fkMatch[1]] || fkMatch[1];
      context.relatedTypePlural = ENTITY_NAMES[fkMatch[3]] || fkMatch[3] + 's';
    }
    
    // Extract field names from unique violations
    const uniqueMatch = message.match(/duplicate key value violates unique constraint "([^"]+)"/);
    if (uniqueMatch) {
      const constraintName = uniqueMatch[1];
      // Try to extract field name from constraint name
      const fieldMatch = constraintName.match(/(\w+)_key$/);
      if (fieldMatch) {
        context.field = FIELD_NAMES[fieldMatch[1]] || fieldMatch[1];
      }
    }
    
    // Extract field names from not null violations
    const nullMatch = message.match(/null value in column "([^"]+)" violates not-null constraint/);
    if (nullMatch) {
      context.field = FIELD_NAMES[nullMatch[1]] || nullMatch[1];
    }
    
    // Extract field names from check constraint violations
    const checkMatch = message.match(/check constraint "([^"]+)" is violated/);
    if (checkMatch) {
      context.field = 'value';
      context.readableRule = 'meet the specified requirements';
    }
  }
  
  return context;
}

/**
 * Generate incident ID for tracking
 */
function generateIncidentId() {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
}

/**
 * Format error message with context
 */
function formatErrorMessage(template, context) {
  let message = template;
  
  // Replace placeholders with context values
  Object.keys(context).forEach(key => {
    const placeholder = `{${key}}`;
    const value = context[key] || '';
    message = message.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return message;
}

/**
 * Main error handler function
 */
export function handleError(error, options = {}) {
  const {
    showToast = false,
    logError = true,
    context = {}
  } = options;
  
  // Log raw error for debugging
  if (logError) {
  }
  
  // Determine error type
  let errorType = 'server'; // default
  let errorCode = null;
  
  // Check for PostgreSQL error codes
  if (error.code) {
    errorCode = error.code;
    errorType = ERROR_CODE_MAPPINGS[error.code] || 'server';
  }
  
  // Check for HTTP status codes
  if (error.status) {
    errorCode = error.status.toString();
    errorType = ERROR_CODE_MAPPINGS[errorCode] || 'server';
  }
  
  // Check for network errors
  if (!navigator.onLine) {
    errorType = 'network';
  }
  
  // Parse error context
  const errorContext = {
    ...parseErrorContext(error),
    ...context,
    incidentId: generateIncidentId()
  };
  
  // Get template
  const template = ERROR_TEMPLATES[errorType];
  if (!template) {
    return {
      title: 'Unknown Error',
      body: 'An unexpected error occurred.',
      action: 'Please try again or contact support.',
      toast: 'Unknown error occurred.'
    };
  }
  
  // Format messages
  const result = {
    title: formatErrorMessage(template.title, errorContext),
    body: formatErrorMessage(template.body, errorContext),
    action: formatErrorMessage(template.action, errorContext),
    toast: formatErrorMessage(template.toast, errorContext),
    type: errorType,
    code: errorCode,
    incidentId: errorContext.incidentId
  };
  
  return result;
}

/**
 * Show error message using Ant Design message/notification
 * Note: This function is deprecated. Use the useErrorHandler hook instead.
 */
export function showError(error, options = {}) {
  return handleError(error, options);
}

export default {
  handleError,
  showError
};
