#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Additional mappings for remaining imports
const additionalMappings = [
  // Root-level imports (going up from features)
  [/from ['"]\.\.\/AuthProvider['"]/g, "from '@/AuthProvider'"],
  [/from ['"]\.\.\/contexts\/ThemeContext['"]/g, "from '@/contexts/ThemeContext'"],
  [/from ['"]\.\.\/config\/supabaseClient['"]/g, "from '@/config/supabaseClient'"],
  [/from ['"]\.\.\/routeAccess['"]/g, "from '@/routeAccess'"],
  
  // Utils
  [/from ['"]\.\.\/utils\/metadata['"]/g, "from '@/shared/utils/metadata'"],
  [/from ['"]\.\.\/utils\/money['"]/g, "from '@/shared/utils/money'"],
  [/from ['"]\.\.\/utils\/time['"]/g, "from '@/shared/utils/time'"],
  [/from ['"]\.\.\/utils\/formatting['"]/g, "from '@/shared/utils/formatting'"],
  [/from ['"]\.\.\/utils\/errorHandler['"]/g, "from '@/shared/utils/errorHandler'"],
  [/from ['"]\.\.\/utils\/tenantSecurity['"]/g, "from '@/shared/utils/tenantSecurity'"],
  [/from ['"]\.\.\/utils\/feeAdapters['"]/g, "from '@/features/fees/utils/feeAdapters'"],
  [/from ['"]\.\.\/utils\/attendanceColors['"]/g, "from '@/features/attendance/utils/attendanceColors'"],
  [/from ['"]\.\.\/utils\/validateMarks['"]/g, "from '@/features/tests/utils/validateMarks'"],
  
  // UI imports
  [/from ['"]\.\.\/ui['"]/g, "from '@/shared/ui'"],
  [/from ['"]\.\.\/ui\/([^'"]+)['"]/g, "from '@/shared/ui/$1'"],
  
  // Hooks
  [/from ['"]\.\.\/hooks\/useErrorHandler\.jsx['"]/g, "from '@/shared/hooks/useErrorHandler'"],
  [/from ['"]\.\.\/hooks\/useErrorHandler['"]/g, "from '@/shared/hooks/useErrorHandler'"],
  [/from ['"]\.\.\/hooks\/useSupabaseQuery['"]/g, "from '@/shared/hooks/useSupabaseQuery'"],
  [/from ['"]\.\.\/hooks\/useSupabaseQuery\.js['"]/g, "from '@/shared/hooks/useSupabaseQuery'"],
  [/from ['"]\.\.\/hooks\/([^'"]+)['"]/g, "from '@/shared/hooks/$1'"],
  
  // Components - within same feature (adjust to use relative path from components/ or use @/)
  [/from ['"]\.\.\/components\/FeeComponents['"]/g, "from './FeeComponents'"],
  [/from ['"]\.\.\/components\/FeeManage['"]/g, "from './FeeManage'"],
  [/from ['"]\.\.\/components\/RecordPayments['"]/g, "from './RecordPayments'"],
  [/from ['"]\.\.\/components\/FeeAnalyticsEnhanced['"]/g, "from './FeeAnalyticsEnhanced'"],
  [/from ['"]\.\.\/components\/StudentFees['"]/g, "from './StudentFees'"],
  [/from ['"]\.\.\/components\/FeeCollections['"]/g, "from './FeeCollections'"],
  [/from ['"]\.\.\/components\/CollectionsView['"]/g, "from './CollectionsView'"],
  [/from ['"]\.\.\/components\/CsvDrawer['"]/g, "from './CsvDrawer'"],
  
  // Services - within same feature
  [/from ['"]\.\.\/services\/([^'"]+)['"]/g, "from '../services/$1'"],
  
  // Pages
  [/from ['"]\.\.\/pages\/([^'"]+)['"]/g, "from '@/features/$1'"],
];

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
  const original = content;

  // Apply each mapping
  additionalMappings.forEach(([pattern, replacement]) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      updated = true;
    }
  });

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

