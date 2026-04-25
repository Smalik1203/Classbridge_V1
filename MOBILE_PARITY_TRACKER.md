# Mobile Parity Tracker

Source of truth: `~/Desktop/classbridge` (Expo Router mobile app).
Web: this repo. Both share the same Supabase project (URL, RLS, RPCs).

## Workflow
- One module at a time, finished fully before moving on (every screen, every action).
- I read mobile source → build on web with AntD or better web-native components → user tests manually → fix → mark done.
- Web must never modify Supabase schema. Only call existing RPCs / read existing tables.

## Status legend
- 🟥 Not started — `<ComingSoon>` placeholder only
- 🟨 In progress
- 🟩 Done (user-tested)
- ⚪ N/A on web (web-only or out of scope)

---

## Modules

### 1. HRMS — 🟨 Built (full parity + web enhancements), awaiting user manual test
Mobile: `app/hr/*` + `src/features/hr/*`
Web: `src/features/hr/{pages,components,services}`
| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | HR Hub | `/hr` | `/hr` | 🟨 built + 7-day attendance grid + check-in gap alert |
| 2 | Staff Directory | `/hr/staff` | `/hr/staff` | 🟨 built (search, status pills, dept tags) |
| 3 | Staff Detail | `/hr/staff/[id]` | `/hr/staff/:id` | 🟨 built + attendance calendar grid + salary summary card + doc dropdown |
| 4 | Payroll | `/hr/payroll` | `/hr/payroll` | 🟨 built (create/process/lock/payslip viewer) |
| 5 | Leaves & Approvals | `/hr/leaves` | `/hr/leaves` | 🟨 built + summary banner + leave types CRUD modal |
| 6 | Staff Attendance | `/hr/attendance` | `/hr/attendance` | 🟨 built (P/A/L/LV/H grid, month picker) |
| 7 | My HR (self-service) | `/hr/my` | `/hr/my` | 🟨 built + balance preview + payslip hero + doc viewer |
| 8 | **Salary Components** (web-only) | n/a | `/hr/salary-components` | 🟨 web-native CRUD page |

**Components built:**
- `HrDocumentViewer` — iframe HTML render with print + Save-as-PDF + download for all 4 doc types (payslip, appointment letter, experience letter, relieving letter)
- `EmployeeFormModal`, `SalaryStructureModal` (with inline `Add Component` button), `LeaveTypesModal`, `SalaryComponentForm`

**Web enhancements over mobile:**
- HR Hub: dedicated 7-day per-day attendance grid (mobile shows flat avg)
- Staff Detail: visual color-coded month calendar grid + salary structure summary card always-visible
- MyHr: leave-balance preview before submit (insufficient warning)
- Hero gradient card for latest payslip
- Dedicated Salary Components page with type filter, search, full CRUD (mobile only exposed it inline in salary structure modal)

**Known limits:**
- Salary component _update_ goes through `createSalaryComponent` placeholder (mobile didn't expose updates either; would need a new RPC)
- Employee photo upload not yet wired (form takes `photo_url` text but no upload UI)

Ready for manual test. Move to 🟩 once verified.

### 2. Transport (TMS) — 🟥
| # | Screen | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | Transport Hub | `/transport` | `/transport` | 🟥 |
| 2 | Buses | `/transport/buses` | `/transport/buses` | 🟥 |
| 3 | Drivers | `/transport/drivers` | `/transport/drivers` | 🟥 |
| 4 | Assignments | `/transport/assignments` | `/transport/assignments` | 🟥 |
| 5 | Routes | `/transport/routes` | `/transport/routes` | 🟥 |
| 6 | Live Tracking | `/transport/live` | `/transport/live` | 🟥 |
| 7 | Simulator | `/transport/simulator` | `/transport/simulator` | 🟥 |
| 8 | School Location | `/transport/school-location` | `/transport/school-location` | 🟥 |
| 9 | My Bus (student) | `/transport/my-bus` | `/transport/my-bus` | 🟥 |
| 10 | Driver Console | `/driver` | `/driver` | 🟥 |

### 3. Admissions — 🟨 Built (full parity + web enhancements), awaiting user manual test
Mobile: `app/manage/admissions.tsx` + `src/features/admissions/{AdmissionsScreen,EnquiryDetailModal,AddEnquiryModal}.tsx` + `src/services/admissions.ts`
Web: `src/features/admissions/{pages,components,services}` (one feature folder)

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Admissions Pipeline | `/manage/admissions` | `/manage/admissions` | 🟨 built (table + kanban + funnel views, full CRUD, follow-ups, bulk ops, CSV export) |

**Service layer:** `src/features/admissions/services/admissionsService.js` — byte-compatible
port of mobile `admissions.ts`. Same tables (`admission_enquiries`, `admission_followups`),
same join shapes (`assigned_user:assigned_to(full_name)`, `user:user_id(full_name)`),
same defaults (status='new', source='walk_in', priority='medium', parent_relationship='parent').
All 8 mobile methods ported (`list`, `getById`, `create`, `updateStatus`, `update`,
`delete`, `listFollowups`, `addFollowup`) plus 2 web-native bulk methods
(`bulkUpdateStatus`, `bulkDelete`).

**Components built:**
- `EnquiryFormModal` — create + edit (mobile only had create); required fields
  validate, source/priority radio groups, DOB/gender, parent relationship picker
- `EnquiryDetailDrawer` — side drawer (web-native vs mobile's full-screen modal):
  AntD Steps pipeline with tap-to-jump, contact descriptions with tel:/mailto:/WhatsApp
  links, details grid, reject/reopen, follow-up form (5 types) + AntD Timeline
- `KanbanBoard` — drag-and-drop board across all 5 stages, card-style with priority
  dot + left-border colour, HTML5 native drag (no extra deps)

**Web enhancements over mobile:**
1. Three view modes (Segmented control): Table / Kanban / Funnel
2. Drag-and-drop kanban board (mobile is list-only)
3. Conversion funnel chart with stage drop-off % and rejected/last-7-days stats
4. KPI cards: Total / New / In Progress / **Conversion %** (mobile only had 3 simple counts)
5. Bulk select rows → bulk move stage / bulk delete (with confirmation)
6. CSV export of filtered list (14 columns)
7. Source filter + Priority filter (mobile only had stage filter)
8. Full edit of any field (mobile only supports create + status change)
9. Reopen-from-rejected button in detail drawer
10. WhatsApp deep-link next to phone number (mobile only had tel:)

**Role gating:** superadmin → manage (CRUD + status changes), admin → read-only.
Matches mobile capability mapping (`admissions.manage` → superadmin only,
`admissions.read` → both).

**Known limits / parity notes:**
- Long-press-to-delete on mobile → web uses row-action dropdown menu (desktop pattern).
- FAB on mobile → web uses header "+ New Enquiry" button (desktop pattern).
- Pull-to-refresh on mobile → web uses Refresh button (desktop pattern).
- Mobile screen has no `assigned_to` UI (field exists but no picker); web also keeps
  it read-only for now — would need a staff picker; flagged for future enhancement.
- No public-facing application form exists in mobile; web matches (internal-only).
- No convert-to-student RPC on mobile (`converted_student_id` is a placeholder
  column); web doesn't add one — would require a new RPC.

Ready for manual test. Move to 🟩 once verified.

### 4. Inventory — 🟨 Built (full parity + web enhancements), awaiting user manual test
Mobile: `app/manage/inventory.tsx` + `src/features/inventory/InventoryItemMasterScreen.tsx` + `src/components/inventory/{InventoryItemForm,IssueInventoryModal,ReturnInventoryModal,IssueDetailsModal}.tsx` + `src/services/inventory.ts`
Web: `src/features/inventory/{pages,components,services}` (one feature folder)

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Inventory & Fee Linkage | `/manage/inventory` | `/manage/inventory` | 🟨 built (table + cards view, items + issued tabs, full CRUD, issuance, returns, stock adjustments, batch issue, CSV export) |

**Service layer:** `src/features/inventory/services/inventoryService.js` — byte-compatible
port of mobile `inventory.ts`. Same tables (`inventory_items`, `inventory_issues`,
`fee_invoices`, `fee_invoice_items`, `academic_years`, `student`, `users`,
`class_instances`), same select shape, same defaults (is_active=true, status='issued').
All mobile methods ported (`list`, `getById`, `create`, `update`, `softDelete`,
`setStock`, `issue`, `listIssues`, `returnIssue`) plus 2 web-native bulk methods
(`bulkSoftDelete`, `batchIssue`).

**Fee linkage byte-compatibility verified vs mobile:**
- `addInvoiceItems` — mirrors mobile `invoiceService.addItems` (insert → recalc total → update status)
- Item label format: `${item.name}${quantity > 1 ? ` (x${quantity})` : ''}` (identical)
- billing_period format: `${year_start}-${year_end}` (identical)
- Invoice upsert: lookup by student+billing_period+academic_year, else insert with
  due_date=today+1month, total_amount=0, paid_amount=0 (identical)
- Return deposit → negative refund line `Refund: ${name}... - Returned` (identical)
- Return one-time → delete invoice item by ID, fallback by label, fallback to
  negative line, then recalc invoice total (identical three-tier logic)

**Components built:**
- `InventoryItemFormDrawer` — single-form drawer (web vs mobile's 5-step wizard);
  every mobile field present (name/category/description/track_quantity/current_quantity/
  low_stock_threshold/track_serially/can_be_issued/issue_to/must_be_returned/
  return_duration_days/is_chargeable/charge_type/charge_amount/auto_add_to_fees/
  fee_category/unit_cost/allow_price_override/internal_notes); same conditional
  validation; example fee impact + warning when one-time + returnable
- `IssueInventoryModal` — student class+student picker, staff picker, qty (locked
  for serial-tracked), serial input, charge override (gated by allow_price_override),
  expected return date, total charge banner, batch-issue-to-class toggle (web only)
- `ReturnInventoryModal` — full issue summary, return notes (required if mark-as-lost),
  mark-as-lost toggle, "what will be reversed" preview
- `IssueDetailsDrawer` — KPI summary (units out / overdue / charged) + sortable table
  with per-row Return action (web pattern vs mobile's read-only list)
- `StockAdjustmentDrawer` — web-native add/subtract/set-to with reason picker
  (restock / damage / loss / correction / opening); appends timestamped audit
  line to internal_notes for the item

**Web enhancements over mobile:**
1. **Item edit** — mobile only had create; web supports full edit of any field
2. **Stock adjustment drawer** with reason picker + audit trail in internal_notes
3. **Batch issuance to a class** — multi-select students from a class and issue
   in one action (each call goes through the same `issue` path so fee linkage is
   identical to single-issue); per-recipient success/error report shown inline
4. **Sortable + filterable table view** (sort by stock, charge, etc.; filter by
   category column or by category dropdown)
5. **Card-grid alternate view** (Segmented switcher) for visual scanning
6. **CSV export** of items (19 columns) and issues (11 columns) — context-aware
   based on active tab
7. **Low-stock alert banner** at top with per-item tags that open Adjust Stock
   on click (one-click reorder affordance)
8. **Stock value KPI** — sum(qty × unit_cost or charge_amount) — not on mobile
9. **Bulk archive** with selection toolbar
10. **Per-row dropdown menu** (Edit / Adjust Stock / Archive) instead of mobile's
    long-press
11. **Search across name+category+description** (mobile only searched name+category)

**Role gating:** superadmin → manage (CRUD + issue + return + stock adjust),
admin → read-only + create. Matches mobile capability mapping (`inventory.read`,
`inventory.create` → both; `inventory.manage` → superadmin only).

**Known limits / parity notes:**
- FAB on mobile → web uses header "+ New Item" button (desktop pattern).
- Pull-to-refresh on mobile → web uses Reload button (desktop pattern).
- Long-press to delete on mobile → web uses row-action dropdown (desktop pattern).
- Mobile has an offline-draft-via-AsyncStorage flow for the create form; web
  skips this since web is online-by-default. Form state still persists across
  the open drawer session via AntD Form.
- Server-side capability assertion mirrors mobile pattern — relies on Supabase RLS
  and client-side role gating; no extra `assertCapability` call wrapper needed
  (mobile's `assertCurrentUserCapability` is a UX guard, not a security boundary).
- Mobile capability uses `inventory.create` for both superadmin and admin (admin
  can create but not delete/issue); web mirrors this exactly.

Ready for manual test. Move to 🟩 once verified.

### 5. School GL Finance — 🟨 Built (full parity + significant web enhancements), awaiting user manual test
Mobile: `app/finance/index.tsx` + `src/features/finance/FinanceScreen.tsx` + `src/services/finance.ts` + `src/services/financeExport.ts`
Web: `src/features/finance/{pages,components,services}` (one feature folder, 5 pages)

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Finance Hub                | `/finance` | `/finance` | 🟨 built (KPIs, daily area+bar chart, quick actions, recent activity, FY quick-ranges) |
| 2 | **Transactions ledger** (web) | n/a       | `/finance/transactions` | 🟨 web-native — sortable/filterable table with source-link badges, voided toggle, void+restore, in-line drilldown drawer |
| 3 | **Accounts & Categories** (web) | n/a     | `/finance/accounts`     | 🟨 web-native — chart of accounts + categories with closing balances per account, type filters, KPIs (cash/bank/virtual liquidity) |
| 4 | **Reports** (web)            | n/a       | `/finance/reports`      | 🟨 web-native — P&L (with category pie + compare prev period/year), Monthly breakdown (composed chart + table), Trial Balance (with click-through to ledger), Account Ledger (running balance), Category Ledger |
| 5 | **Inconsistencies** (web)    | n/a       | `/finance/inconsistencies` | 🟨 web-native — runs `detect_finance_inconsistencies` RPC, severity KPIs, expandable per-finding row tables |

**Service layer:** `src/features/finance/services/financeService.js` — byte-compatible
port of mobile `finance.ts`. Same tables (`finance_accounts`, `finance_categories`,
`finance_transactions`, `finance_transaction_links`, `finance_audit_log`), same RPCs
(`log_finance_operation`, `detect_finance_inconsistencies`), same `super_admin`
school-code resolution fallback. Same get-or-create defaults for accounts named
**Cash / Bank Account / UPI** and category named **Fees** so the existing mobile
fees→finance auto-posting (`fees.ts:582-590`) continues to write through unchanged.
Same idempotency-by-`source_type+source_id` and same rollback-if-link-fails recovery
as mobile.

`financeExportService.js` — CSV (header order Date/Type/Amount/Category/Account/
Description/Created At, identical to mobile `transactionsToCSV`), XLSX (web bonus),
print-to-PDF via hidden iframe + `window.print()` (mobile uses `expo-print`; same
HTML shell, same totals, same period header). Audit `log_finance_operation`
event_type='export' fired identically.

**Components built:**
- `TransactionFormModal` — single-row create/edit; type radio, date, ₹ amount with
  IN locale, type-filtered category select, account select with type tag, description.
  Live "will increase/decrease X by ₹Y" preview banner for transparency before submit.
- `MultiLineEntryDrawer` (web-native) — spreadsheet-style multi-row entry. Each row
  posts via the same single-create path so validation, idempotency and audit are
  preserved. Live totals row (debit / credit / net). Keyboard shortcuts: ⌘⇧N add
  row, ⌘S post all, Esc close. Bulk-progress tracker + per-row error list on partial
  failure.
- `TransactionDetailDrawer` — read-only descriptions block, source-link tags
  (manual / fee_payment / salary), audit timeline via `finance_audit_log` (RLS-safe
  empty fallback), Edit + Void (twice-confirmed with required reason ≥ 4 chars) +
  Restore for soft-deleted rows. Fee/payroll-derived rows show lock badge and the
  edit/void buttons are hidden — only the underlying receipt can change them.
- `AccountFormModal`, `CategoryFormModal` — create + edit, with deactivate switch
  (mobile only had implicit creation through `ensureDefaultAccounts`).
- `ImportDrawer` (web-native) — CSV/XLSX upload → name-resolve to ID + type-match
  preview → bulk post via the same single-create path. Stepped Steps UI, per-row
  error tags ("category 'Foo' (income) not found"), partial-import progress.

**Web enhancements over mobile (8 of the 10 suggested in the brief):**
1. **Spreadsheet-style multi-line entry** with keyboard shortcuts and live debit/
   credit/net totals (mobile only had a single-row Add Expense modal).
2. **Account-ledger drilldown** with opening, per-line debit/credit, and running
   balance. Click any account name in Trial Balance to jump to its ledger.
3. **Multi-tab Reports viewer** (P&L, Monthly, Trial Balance, Account Ledger,
   Category Ledger) sharing one date-range picker; switching tabs reuses the same
   period.
4. **Print-ready report layouts** for P&L, Trial Balance, and Account Ledger
   using the iframe + `window.print()` pattern (mirrors `HrDocumentViewer`). Each
   PDF carries school header, period, signature lines, generated-at timestamp.
5. **CSV + XLSX bulk import** for opening balances and historical entries via
   xlsx parsing; same single-create path for safety + audit.
6. **Inconsistency dashboard** with severity KPIs, on-demand RPC re-run, expand
   to view per-finding row table.
7. **Restore voided transactions** (mobile has no restore UI; soft-delete is
   the only state).
8. **Compare prev period / prev year** columns in P&L (`Δ` per category).
9. **Daily activity chart** (Area or Bar toggle) on the Hub for in-period trend
   visualisation (mobile shows none).
10. **Source-link badges** in the ledger (`manual` / `fee_payment` 🔒 /
    `salary` 🔒) with full audit-log timeline in the detail drawer.

**Role gating:** `/finance` and sub-routes `superadmin + admin` (admin is
read-only — write controls auto-disable). `/finance/inconsistencies` is
`superadmin` only since the detect RPC asserts the same in mobile.

**Critical accounting safeguards:**
- Every write wrapped in try/catch with explicit `message.error` user feedback.
- Live debit/credit math shown in TransactionFormModal banner before submit.
- No silent rounding — `precision={2}` everywhere, IN locale for ₹ display.
- Voids require typed reason ≥ 4 chars, plus a second confirmation.
- Fee-derived and payroll-derived rows are locked from edit/void — they must be
  reversed at the source receipt to keep books reconciled.
- Bulk import goes through the same single-row validation path as manual entry,
  so a malformed import row can't bypass type-matching, account-school checks,
  or audit logging.

**Known limits / parity notes:**
- FAB on mobile → web uses header "+ New transaction" button (desktop pattern).
- Pull-to-refresh on mobile → web uses Refresh icon (desktop pattern).
- Date range default: web uses current month with FY/quarter/YTD quick-picks.
  Mobile defaults to active academic year via `useActiveAcademicYear` context;
  that context isn't ported on web, but "This FY (Apr–Mar)" is one click away.
- Grouped-by-date transaction rendering on mobile → web uses a sortable table
  with default `txn_date desc` sort (the table-with-sort idiom is the web norm
  for ledgers; date column groups visually via the sort).
- Mobile has no Income create modal (only Expense — income comes via fees
  auto-posting). Web allows manual Income too via the type radio so super
  admins can correct or backfill.
- `finance_audit_log` reads may be RLS-restricted; the detail drawer falls back
  to an Empty state without breaking the page.

Ready for manual test. Move to 🟩 once verified.

### 6. Sage / Chatbot — 🟥
| # | Screen | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | Sage Chatbot | `/(tabs)/chatbot` | `/chatbot` | 🟥 |

### 7. AI Test Generator — 🟨 Built (integrated into Test Management), awaiting user manual test
Mobile: `app/ai-test-generator/index.tsx` + `src/features/ai-test-generator/AITestGeneratorScreen.tsx` + `src/services/aiTestGeneratorFetch.ts`
Web: integrated as a 4-step wizard component inside the existing `/test-management` hub
(no separate page on web — the architectural rule is that all test-related flows
live under `/test-management`).

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | AI Test Generator | `/ai-test-generator` | `/test-management?mode=ai` (and the sidebar's `/ai-test-generator` redirects here) | 🟨 built (Source → Configure → Generating → Review wizard inside Test Management) |

**Service layer:** `src/features/tests/services/aiTestGeneratorService.js` — JS port of mobile
`src/services/aiTestGeneratorFetch.ts`. Same Supabase Edge Function (`process-ai-job`),
same `ai_jobs` table (columns: `user_id, school_code, status, source_kind, job_label,
pdf_name, image_paths, input_path, text_content, question_count, context, syllabus_scope,
blooms_levels, return_tagged, result, error`), same Storage bucket (`ai-test-materials`)
with paths `{userId}/ai-job-images/...` and `{userId}/pdf-uploads/...`. Same payload
shape passed to the Edge Function (`{ job_id }` POST body). Same job lifecycle:
INSERT `ai_jobs` row → `kickProcessAiJob` → poll `ai_jobs.status` until `done` or
`failed` → read `ai_jobs.result.questions` → save via `create_test_with_questions`
RPC (with insert-test + insert-questions fallback if the RPC isn't available).
Difference from mobile: web uses browser FileReader + base64 instead of
`expo-file-system`; no AsyncStorage cache (online-by-default).

**Components built:**
- `AITestGeneratorWizard.jsx` — self-contained wizard with 4 steps:
  1. **Source** — Segmented picker: paste text (TextArea), upload PDF (Dragger),
     upload up to 5 images (multi Dragger). Same 3MB/image, 20-char-min-text limits.
  2. **Configure** — class/subject pickers (driven by `class_instances` /
     `subjects`), question count (1–50), Bloom's Taxonomy multi-select (6 levels),
     optional syllabus chapter scope (calls `get_syllabus_tree` RPC with table
     fallback to `syllabus_chapters`), optional additional context.
  3. **Generating** — full-screen Spin with the same status messages mobile shows,
     polls `ai_jobs` every 2.5s, shows progress text, supports cancel
     (writes `status='failed', error='Cancelled by user'`).
  4. **Review & Save** — list of generated questions with per-card edit /
     regenerate-this-question / remove. Edit modal lets the user rewrite the
     question, edit options, change correct answer, add/remove options. Save
     persists test + questions and returns to the hub.

**Web-native enhancements over mobile:**
1. **Inline edit-and-regenerate** — per-question Edit modal lets you tweak text or
   options before saving (mobile only had global regenerate-all).
2. **Regenerate this question** — single-question regenerate that replaces just
   the targeted question, reusing the same source material (mobile only allowed
   regenerating the entire batch).
3. **Single-page integration** — the wizard opens as a modal *inside*
   `/test-management` instead of being a separate page, so the user keeps the
   list view and filters context (matches the locked architectural rule that
   ALL tests live under `/test-management`).
4. **Sidebar deep link still works** — the existing `/ai-test-generator` route
   in `App.jsx` is now a `<Navigate to="/test-management?mode=ai" replace />`,
   which auto-opens the wizard inside the unified hub.

**Save path:**
- Test row written to `tests` with `test_mode='online'`, `test_type='Quiz'`,
  `status='active'`, `created_by=user.id`, `time_limit_seconds=timeLimit*60`.
- Questions written to `test_questions` with full mobile column set:
  `question_text, question_type='mcq', options, correct_index, points=1,
  order_index, bloom_level, cognitive_verbs`.
- Atomic via `create_test_with_questions` RPC; if the RPC errors (e.g. not
  deployed on this Supabase project), falls back to one INSERT to `tests`
  followed by per-question INSERTs to `test_questions`.

**Routing changes (App.jsx):**
- `/ai-test-generator` placeholder removed — now redirects to `/test-management?mode=ai`.
- `/test/create`, `/test/:testId/questions`, `/test/:testId/results`,
  `/test/:testId/marks` placeholders removed — now redirect to `/test-management`
  so deep links from mobile/email still resolve cleanly.

**Known limits / parity notes:**
- Mobile streams progress text from the Edge Function via the `onProgress`
  callback in `generateQuestionsFromInput`; web mirrors the exact strings.
- Mobile has a 24-hour AsyncStorage cache for repeat generations; web skips it
  (online-by-default).
- The Edge Function `process-ai-job` is shared — no schema changes were made.
- Source-material sharing with students (`tests.source_material` JSONB and
  `test-materials` bucket upload) is not yet ported to the web wizard. Mobile
  uploads via `uploadSourceMaterial` in `testMaterialsUpload.ts`; that's a
  later enhancement when a teacher wants to share the original PDF/images
  with students during the test. Not blocking for AI test creation itself.

Ready for manual test. Move to 🟩 once verified.

### 8. Advanced Analytics — 🟥
| # | Screen | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | Weak Areas | `/analytics/weak-areas` | `/analytics/weak-areas` | 🟥 |
| 2 | Topic Heatmap | `/analytics/topic-heatmap` | `/analytics/topic-heatmap` | 🟥 |
| 3 | Misconception Report | `/analytics/misconception-report` | `/analytics/misconception-report` | 🟥 |

### 9. Communications — 🟨 Built (full parity + web enhancements), awaiting user manual test
Mobile: `app/academics/{announcements,communication-hub,report-comments}.tsx` + `src/features/{announcements,feedback,report-comments}/*`
Web: `src/features/communications/{pages,components,services}` (single feature folder spanning all 3 mobile features)

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Announcements | `/academics/announcements` | `/academics/announcements` | 🟨 built (feed, create/edit/delete, pin, reminder, image upload, search, priority+audience filters) |
| 2 | Communication Hub | `/academics/communication-hub` | `/academics/communication-hub` | 🟨 built (3 role views: superadmin dashboard table, admin/teacher inbox, student send/receive tabs) |
| 3 | Report Comments | `/academics/report-comments` | `/academics/report-comments` | 🟨 built (class picker, AI generate-all, per-student edit/regenerate/approve, approve-all bulk) |

**Service layer:** `src/features/communications/services/communicationsService.js` exports
`announcementsService`, `feedbackService`, `reportCommentsService`. Same Edge Functions
(`post-announcement`, `resend-announcement-notification`, `generate-report-comment`),
same RPC (`approve_report_comment`), same tables (`announcements`, `feedback`,
`feedback_for_admin` view, `class_instances`, `subjects`, `student`, `users`),
same Storage bucket (`Lms`) at path `announcements/{school_code}/{ts}_{rand}.{ext}`.

**Components built:**
- `AnnouncementFormModal` — title/message/priority radio tiles, all-vs-class audience picker, multi-class select, image upload+preview+remove
- `AnnouncementImage` — resolves bucket path → public URL with signed-URL fallback, AntD `Image` viewer
- `ManagementNoteModal` — recipient picker, category radios, requires-ack checkbox
- `StudentFeedbackModal` — class filter→student picker, category radios, content
- `FeedbackDetailModal` — full record view with Acknowledge + Archive footer actions
- `ReportCommentEditor` — word-count meter, reset-to-AI, save & approve

**Web enhancements over mobile:**
1. Announcements summary banner (Total / Pinned / Urgent / Last 7 days) + audience-type secondary filter
2. Inline action row on each announcement card (no need to open menu) for edit/pin/reminder/delete
3. SuperAdmin feedback dashboard rebuilt as filterable table (vs mobile card list) with sentiment + acknowledgement filters
4. CSV export of filtered feedback dashboard (web-native; mobile has none)
5. Report Comments: bulk "Approve all drafts" with confirmation dialog
6. Report Comments: status filter Segmented (All / Drafts / Approved) + search by name/code
7. Report Comments: CSV export of comments with words/positivity/attendance for offline review
8. Report Comments: settings exposed in side `Drawer` instead of inline panel; settings tags always visible at top
9. Per-comment Regenerate button (mobile only had reset-to-AI inside edit modal)

**Known limits / parity notes:**
- `likes_count` / `views_count`: present in schema but never incremented or surfaced — mobile doesn't track these either, so no gap.
- Realtime: web uses pull-to-refresh + manual reload. Mobile has no realtime subscription on these screens either; not a regression.
- Push notifications: handled server-side by `post-announcement` Edge Function; web does not need to mirror.
- Banned-phrase / positivity-score enforcement is server-side in `generate-report-comment`; UI displays the resulting score.

Ready for manual test. Move to 🟩 once verified.

### 10. Test detail screens — 🟥
| # | Screen | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | Create Test | `/test/create` | `/test/create` | 🟥 |
| 2 | Test Questions | `/test/[testId]/questions` | `/test/:testId/questions` | 🟥 |
| 3 | Test Results | `/test/[testId]/results` | `/test/:testId/results` | 🟥 |
| 4 | Edit Marks | `/test/[testId]/marks` | `/test/:testId/marks` | 🟥 |

### 11. Academics extras — 🟥
| # | Screen | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | Grade Book | `/academics/gradebook` | `/academics/gradebook` | 🟥 |
| 2 | Student Progress | `/academics/progress` | `/academics/progress` | 🟥 |
| 3 | My Syllabus (student) | `/academics/syllabus-student` | `/academics/syllabus-student` | 🟥 |
| 4 | Class Comparison | `/academics/class-comparison` | `/academics/class-comparison` | 🟥 |

### 12. Misc — 🟥
| # | Screen | Mobile | Web | Status |
|---|---|---|---|---|
| 1 | My Class | `/manage/my-class` | `/manage/my-class` | 🟥 |
| 2 | Inactive Users | `/manage/inactive-users` | `/manage/inactive-users` | 🟥 |
| 3 | Classmates | `/student/classmates` | `/student/classmates` | 🟥 |
| 4 | Settings & Profile | `/settings` | `/settings` | 🟥 |
| 5 | Change Password | `/change-password` | `/change-password` | 🟥 |

---

## Partial / divergent screens (already exist on web, need parity work later)
From earlier audit — these are NOT placeholders, they have real impls but differ from mobile:

| Screen | Issue |
|---|---|
| Dashboard | KPI parity unverified vs mobile |
| Timetable | `mark_syllabus_taught` parity unverified |
| Syllabus | Student path differs |
| Attendance | Bulk vs class-scoped capability not mirrored |
| Assessments | Hardcoded sample data — broken |
| Test management | Different RPC surface than mobile |
| Take test (student) | Offline + submission RPC parity unverified |
| Tasks | Feature-by-feature comparison needed |
| Student/class progress | Split differently across pages |
| Analytics hub | Legacy subroutes inside one file |
| Fees | Different data model (fee_student_plans vs fee_invoices) |
| School profile | Partial overlap with `/school-setup` |

These get a sweep pass after the 12 missing modules above are done.
