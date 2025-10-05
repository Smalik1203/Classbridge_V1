// Quick sanity tests for formatting utilities

import { formatINRCompact, formatPct } from '../formatting';
import { adaptComponentBreakdown, adaptDailyTrends, adaptClasswise } from '../feeAdapters';

// Test formatINRCompact
console.log('=== FORMATTING TESTS ===');
console.log('formatINRCompact(35200500):', formatINRCompact(35200500)); // Should be ₹3.5Cr
console.log('formatINRCompact(2126500):', formatINRCompact(2126500)); // Should be ₹21.3L  
console.log('formatINRCompact(33100):', formatINRCompact(33100)); // Should be ₹33.1k
console.log('formatINRCompact(500):', formatINRCompact(500)); // Should be ₹500
console.log('formatINRCompact(null):', formatINRCompact(null)); // Should be —

// Test formatPct
console.log('formatPct(10.5):', formatPct(10.5)); // Should be 10.5%
console.log('formatPct(null):', formatPct(null)); // Should be —

// Test adaptComponentBreakdown
const componentTest = adaptComponentBreakdown([
  { component: 'Tuition', collected: 100, outstanding: 900 }
]);
console.log('adaptComponentBreakdown result:', componentTest);
console.log('collectedPct should be 10, outstandingPct should be 90');

// Test adaptDailyTrends
const dailyTest = adaptDailyTrends([
  { date: '2025-10-01', collected: null, outstanding: 1000 }
]);
console.log('adaptDailyTrends result:', dailyTest);
console.log('collected should be 0, outstanding should be 1000, sorted by date');

// Test adaptClasswise
const classTest = adaptClasswise([
  { className: 'Class A', collected: 800, outstanding: 200 },
  { className: 'Class B', collected: 300, outstanding: 700 }
]);
console.log('adaptClasswise result:', classTest);
console.log('Class A should have higher collectionRatePct, sorted desc');

console.log('=== ALL TESTS COMPLETE ===');
