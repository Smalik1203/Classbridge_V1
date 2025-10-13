#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import mappings: old path patterns -> new paths
const importMappings = {
  // Components
  "from '../components/AttendanceAnalyticsEnhanced'": "from '@/features/attendance/components/AttendanceAnalyticsEnhanced'",
  "from '../components/AttendanceStatusIndicator'": "from '@/features/attendance/components/AttendanceStatusIndicator'",
  "from '../components/FeeAnalytics'": "from '@/features/fees/components/FeeAnalytics'",
  "from '../components/FeeAnalyticsEnhanced'": "from '@/features/fees/components/FeeAnalyticsEnhanced'",
  "from '../components/FeeCollections'": "from '@/features/fees/components/FeeCollections'",
  "from '../components/FeeComponents'": "from '@/features/fees/components/FeeComponents'",
  "from '../components/FeeManage'": "from '@/features/fees/components/FeeManage'",
  "from '../components/RecordPayments'": "from '@/features/fees/components/RecordPayments'",
  "from '../components/CollectionsView'": "from '@/features/fees/components/CollectionsView'",
  "from '../components/StudentFees'": "from '@/features/fees/components/StudentFees'",
  "from '../components/CsvDrawer'": "from '@/features/fees/components/CsvDrawer'",
  "from '../components/MarksEditableTable'": "from '@/features/tests/components/MarksEditableTable'",
  "from '../components/OfflineTestMarksManagerCorrect'": "from '@/features/tests/components/OfflineTestMarksManagerCorrect'",
  "from '../components/ImportQuestionsModal'": "from '@/features/tests/components/ImportQuestionsModal'",
  "from '../components/PreviewQuestionsModal'": "from '@/features/tests/components/PreviewQuestionsModal'",
  "from '../components/QuestionBuilder'": "from '@/features/tests/components/QuestionBuilder'",
  "from '../components/TestImportModal'": "from '@/features/tests/components/TestImportModal'",
  "from '../components/TestReviewModal'": "from '@/features/tests/components/TestReviewModal'",
  "from '../components/Sidebar'": "from '@/shared/components/layout/Sidebar'",
  "from '../components/CsvImportExport'": "from '@/shared/components/CsvImportExport'",
  "from '../components/PrivateRoute'": "from '@/features/auth/components/PrivateRoute'",
  "from '../components/RoleBasedGuard'": "from '@/features/auth/components/RoleBasedGuard'",
  "from '../components/RoleBasedNavigation'": "from '@/features/auth/components/RoleBasedNavigation'",
  "from '../components/ErrorBoundary'": "from '@/features/auth/components/ErrorBoundary'",
  "from '../components/AddStudent'": "from '@/features/students/components/AddStudent'",
  "from '../components/SubjectFilter'": "from '@/features/students/components/SubjectFilter'",
  "from '../components/ClassDetailView'": "from '@/features/students/components/ClassDetailView'",
  "from '../components/AddAdmin'": "from '@/features/school/components/AddAdmin'",
  "from '../components/AddSuperAdmin'": "from '@/features/school/components/AddSuperAdmin'",
  "from '../components/AddSpecificClass'": "from '@/features/school/components/AddSpecificClass'",
  "from '../components/AddSubjects'": "from '@/features/school/components/AddSubjects'",
  "from '../components/SignUpUser'": "from '@/features/school/components/SignUpUser'",
  "from '../components/SuperAdminCounter'": "from '@/features/school/components/SuperAdminCounter'",
  "from '../components/Syllabus'": "from '@/features/syllabus/components/Syllabus'",
  "from '../components/TaskForm'": "from '@/features/tasks/components/TaskForm'",
  "from '../components/TaskList'": "from '@/features/tasks/components/TaskList'",
  "from '../components/TaskProgress'": "from '@/features/tasks/components/TaskProgress'",
  "from '../components/AttachmentPreview'": "from '@/features/tasks/components/AttachmentPreview'",
  "from '../components/StudentTaskView'": "from '@/features/tasks/components/StudentTaskView'",
  "from '../components/VideoPlayer'": "from '@/features/learning-resources/components/VideoPlayer'",
  
  // Double-dot navigation
  "from '../../components/": "from '@/features/",
  "from '../../services/": "from '@/features/",
  "from '../../hooks/": "from '@/features/",
  "from '../../utils/": "from '@/shared/utils/",
  "from '../../ui/": "from '@/shared/ui/",
  
  // Services
  "from '../services/": "from '@/features/",
  "from '../../config/supabaseClient'": "from '@/config/supabaseClient'",
  
  // Hooks
  "from '../hooks/": "from '@/features/",
  "from '../../hooks/useSupabaseQuery'": "from '@/shared/hooks/useSupabaseQuery'",
  "from '../../hooks/useErrorHandler'": "from '@/shared/hooks/useErrorHandler'",
  
  // Utils
  "from '../utils/": "from '@/shared/utils/",
  "from '../../utils/": "from '@/shared/utils/",
  
  // UI
  "from '../ui/": "from '@/shared/ui/",
  "from '../../ui/": "from '@/shared/ui/",
};

// Function to recursively get all JS/JSX files
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// Function to update imports in a file
function updateImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // Apply each mapping
  Object.entries(importMappings).forEach(([oldPattern, newPattern]) => {
    if (content.includes(oldPattern)) {
      content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);
      updated = true;
    }
  });

  // Additional pattern-based replacements for relative imports within features
  // These need special handling based on file location
  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

// Main execution
const srcDir = path.join(__dirname, 'src');
const allFiles = getAllFiles(srcDir);

console.log(`Found ${allFiles.length} files to process...`);
allFiles.forEach(updateImportsInFile);
console.log('Import update complete!');

