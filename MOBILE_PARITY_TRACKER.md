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

### 6. Sage / Chatbot — 🟨 Built, awaiting user manual test
Mobile: `app/(tabs)/chatbot.tsx` + `src/features/chatbot/{ChatbotScreen,components,hooks,types}`
Web: `src/features/chatbot/{pages/Chatbot.jsx, services/chatbotService.js, hooks/{useChatbot.js, useChatSuggestions.js}, components/{MessageBubble, MarkdownRenderer, TypingIndicator, WelcomeCard, ChatInput, ConversationSidebar}.jsx}`

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Sage Chatbot | `/(tabs)/chatbot` | `/chatbot` | 🟨 built (full-screen chat with sidebar history, markdown rendering, streaming, voice input, regenerate/edit/copy/export) |

**Service layer:** `src/features/chatbot/services/chatbotService.js` — JS port of mobile
`src/features/chatbot/hooks/useChatbot.ts`. Same Supabase Edge Function (`chatbot`),
byte-identical request payload (`{ message, history, academicYearId, stream: true }`),
same headers (`Authorization: Bearer <jwt>`, `apikey: <anon>`, `Content-Type: application/json`),
same NDJSON stream protocol with `phase | content | progress | done | error` events,
same fallback chain (ReadableStream → full-text NDJSON → plain JSON `{reply, suggestedActions}`).
Same persistence: reads `chatbot_conversations` (columns `id, role, content, created_at`,
filtered by `user_id`, ordered desc, limit 20). Edge Function owns INSERTs — client never writes.
Same constants: `HISTORY_LOAD_LIMIT = 20`, `CONTEXT_WINDOW = 8`.

**Web enhancements (10 of 10 from the brief, all shipped):**
1. **Conversation history sidebar** — left rail groups past user messages by day
   (Today / Yesterday / dated). Click a row to jump-and-flash the message in the chat.
   Mobile only has a single rolling thread.
2. **Rich markdown rendering** — self-contained renderer (no new deps). Headings 1–4,
   bullet/numbered lists, dividers, **bold** / *italic* / `inline code` / `[links](url)`,
   tables with horizontal scroll + numeric right-alignment, **plus fenced code blocks
   with syntax-styling and a copy button** (mobile renders these as plain text).
3. **Copy-to-clipboard** on every assistant message and every code block.
4. **Regenerate response** button on the last assistant message — re-runs the same
   user prompt, dropping the previous reply.
5. **Edit-and-resubmit** the last user message via a modal — mirrors the ChatGPT pattern.
6. **Export conversation as Markdown** — downloads a timestamped `.md` file with
   role-tagged turns and message timestamps.
7. **Voice input** via the Web Speech API (Chrome/Edge). Falls back to a hint message
   if unavailable; transcript appends to the input as it streams.
8. **Draft autosave** — input text persisted to localStorage on every keystroke
   (debounced) so a tab reload preserves what was being typed.
9. **Server-side suggested-actions shelf** — when the Edge Function returns
   `suggestedActions`, they render as one-tap chip buttons under the last response.
   Mobile reads these but doesn't surface them in UI.
10. **Smart auto-scroll** — sticks to bottom on new messages but does NOT snap
    when the user has scrolled up (60px threshold).

**Parity-preserving choices:**
- Stop button replaces Send while a response streams; abort signals propagate
  through `AbortController` to cancel both fetch and stream-reader cleanly.
- Streaming cursor (blinking caret) on the in-progress assistant bubble.
- 5-second slow-hint ("Still working on it…") matches mobile timing.
- Three-dot pulse + phase text in the typing indicator.
- Same starter prompts verbatim per role (superadmin / admin-teacher), plus a new
  student-tailored set so students who land on the route also see useful starters.
- Errors render as an in-thread assistant bubble (not a toast) — same UX as mobile.
- 429 → "usage limit" message. 403 → "permission" message. Other → wrapped error.

**Route gating:** `/chatbot` is gated to `['superadmin', 'admin', 'student']` —
matches mobile's "any signed-in non-cb_admin user". Sidebar entry shown for the
same roles.

**Known gaps (none affecting parity):**
- Multi-conversation server-side threads: backend exposes a single rolling thread
  per user via `chatbot_conversations`; the sidebar groups by day rather than by
  conversation since no `conversation_id` column exists. If a thread/conversation
  table is added later, the sidebar can switch to per-thread without UI changes.
- File / image attachments: paperclip button is rendered disabled until the Edge
  Function gains an attachments contract. Mobile also has no attachment support.

Ready for manual test. Move to 🟩 once verified.

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

### 8. Advanced Analytics — 🟨 Built (full parity + significant web enhancements + hub consolidation), awaiting user manual test
Mobile: `app/analytics/{topic-heatmap,weak-areas,misconception-report}.tsx` + `src/features/analytics/{StudentTopicHeatmapScreen,ClassWeakAreasScreen,MisconceptionReportScreen}.tsx` + `src/hooks/analytics/{useTopicHeatmap,useWeakAreas,useMisconceptionReport}.ts`
Web: `src/features/analytics/{pages,components,services,utils}` (one feature folder, unified hub)

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Unified Analytics Hub | (split across many) | `/analytics` | 🟨 built — scope picker (School / Class / Student), 9 tabs, drill-down breadcrumbs |
| 2 | Class-scoped analytics | (per-class drilldowns) | `/analytics/class/:classInstanceId` | 🟨 built (locked-scope wrapper around the hub) |
| 3 | Student-scoped analytics | `/student/analytics`, drilldowns | `/analytics/student/:studentId` and `/student/analytics` | 🟨 built (locked-scope wrapper; student self-route resolves auth → student record) |
| 4 | Weak Areas | `/analytics/weak-areas` | `/analytics?tab=weak-areas` (legacy URL → redirect) | 🟨 built (3-threshold toggle, urgency banding, "Create practice test" deep-link) |
| 5 | Topic Heatmap | `/analytics/topic-heatmap` | `/analytics?tab=heatmap` | 🟨 built (chapter-grouped grid, click-to-drill drawer, class-avg overlay, question-level drill from cells) |
| 6 | Misconception Report | `/analytics/misconception-report` | `/analytics?tab=misconceptions` | 🟨 built (per-question collapse, option-distribution bars, dominant-wrong-option badge, "Explain" insight generator) |

**Service layer:** `src/features/analytics/services/analyticsService.js` — single unified module.
- Mobile-parity RPCs ported byte-compatibly:
  - `get_student_topic_heatmap(p_student_id, p_class_instance_id, p_subject_id)` → TopicHeatmapCell[]
  - `get_class_weak_topics(p_class_instance_id, p_subject_id, p_threshold)` → ClassWeakTopic[]
  - `get_question_misconception_report(p_test_id)` → QuestionMisconceptionData[]
- Existing web RPCs kept (same param shape):
  - `attendance_analytics`, `fees_analytics`, `exams_analytics`, `learning_analytics`
- Reference-data helpers (`listClasses`, `listStudents`, `listSubjects`, `getStudentById`,
  `getClassInstanceById`) consolidated for the toolbar.
- Test-attempt + attendance fetchers (`getStudentTestAttempts`, `getClassTestAttempts`,
  `getSchoolTestAttempts`, `getAttendanceRows`) used by tabs that don't have a dedicated RPC.
- Pure aggregators (`statusDistribution`, `trendByDay`, `trendBySubject`,
  `dailyAttendanceTrend`, `attendancePerformanceCorrelation`, `studentSubjectMatrix`,
  `dominantWrongOption`) — no Supabase calls — keep tabs cheap to render.

**Components built:**
- `AnalyticsToolbar` — scope segmented + class/student/subject pickers + range picker + quick ranges (7/30/90/Term/Year) + Refresh / Export / Print / Compare / Save view buttons
- `OverviewTab` — KPIs (tests / avg / pass rate / attendance), trend area chart, status pie, subject bars, ranking list (clickable to drill)
- `PerformanceTrendsTab` — Overall area / By-subject multi-line / By-test-type cards
- `WeakAreasTab` — 3-threshold toggle (50/60/70), urgency-coloured rank list, per-row "Create practice test" link, CSV export. In student-scope, computes weak topics from heatmap cells with the same threshold rule mobile uses.
- `TopicHeatmapTab` — chapter-grouped colour grid (≥70 green / 40–69 amber / <40 red / untested gray), summary stats, optional class-average overlay layer (student scope), drilldown drawer + question-level modal listing test_questions for a topic with the student's response highlighted, CSV export
- `MisconceptionsTab` — test picker, per-question collapsible cards, option-distribution bars (correct = green, dominant wrong = red), misconception alert when one wrong option ≥ 20%, "Explain" button that generates an insight summary from problem questions, CSV export
- `ComparisonsTab` — Class ranking bar chart (school scope), class-trend multi-line, Student × Subject matrix table (class scope) with click-to-drill student, Top-5 radar overlay
- `StatusDistributionTab` — Grade bands (Distinction / First / Second / Pass / Fail) with pie + bar, plus attendance status breakdown
- `DailyTrendsTab` — Daily / Weekly / Monthly composed chart (stacked P/A/L bars + rate area line)
- `AttendanceCorrelationTab` — Weekly attendance % vs avg score line overlay + Pearson r
- `ComparisonDrawer` — side-by-side comparison drawer (class-vs-class or student-vs-student)
- `AnalyticsKPI` — small statistic card (kept for AttendanceOverview compatibility)

**Web enhancements over mobile (10 of 11 suggested in brief):**
1. **One scope picker, one filter bar** — flip School/Class/Student and every tab reflows without page reload.
2. **Drill-down breadcrumbs** with back navigation. Click a class row → `/analytics/class/:id`. Click a student row → `/analytics/student/:id`.
3. **Side-by-side comparison drawer** — pick 2 classes or 2 students, see overlaid trend chart + KPIs.
4. **CSV export of every chart's underlying data** — every tab has a data-export action.
5. **Print-ready report layout** — iframe + window.print pattern (mirrors HrDocumentViewer / Finance Reports) with title, period, school header.
6. **Saved views** — name + persist filter+scope+tab combinations in localStorage; modal-driven Apply / Delete (no schema needed).
7. **Inline "Explain" insight generator on Misconceptions** — picks the top problem questions, identifies dominant wrong options, writes a teacher-facing recommendation paragraph (rule-based since mobile doesn't ship an LLM Edge Function for misconceptions).
8. **Topic heatmap with class-average overlay** — translucent layer behind student bars when `Class avg` switch is on.
9. **Question-level drilldown from heatmap** — click a topic cell → drawer → "View questions on this topic" → modal listing every test_question on that topic with the student's selected option highlighted vs the correct option.
10. **Attendance × Performance correlation chart** with Pearson r and Strong/Moderate/Weak interpretation.
11. **Empty-state copy on every tab** — clear "Once tests are taken / Pick a subject / No data yet" messaging instead of broken charts.

**Routing changes (App.jsx):**
- `/analytics/*` is now a single nested router (`features/analytics/pages/Analytics.jsx`) that handles:
  - `/analytics` → unified hub
  - `/analytics/student/:studentId` → student-scoped wrapper
  - `/analytics/class/:classInstanceId` → class-scoped wrapper
  - Legacy paths → `?tab=` redirects: `/analytics/daily-trends → ?tab=daily-trends`,
    `/analytics/student-performance → ?tab=performance`,
    `/analytics/class-comparison → ?tab=comparisons`,
    `/analytics/status-distribution → ?tab=status`,
    `/analytics/weak-areas → ?tab=weak-areas`,
    `/analytics/topic-heatmap → ?tab=heatmap`,
    `/analytics/misconception-report → ?tab=misconceptions`,
    `/analytics/attendance/overview → ?tab=daily-trends`,
    `/analytics/attendance/classes → ?tab=comparisons`,
    `/analytics/attendance/students → ?tab=performance`,
    `/analytics/{admin,student,superadmin}` → `/analytics`
  - 3 ComingSoon placeholders for the advanced analytics screens REMOVED.
- `/student/analytics` now routes to `StudentSelfAnalytics` which resolves the auth user
  to a student record (auth_user_id → student_code → email fallbacks) and renders a
  student-locked unified hub.
- The 4 explicit duplicate `/analytics/{daily-trends,student-performance,class-comparison,status-distribution}` routes that previously pointed back to the same `<Analytics>` element have been collapsed to the single `/analytics/*` wildcard.

**Domain rules ported byte-compatible from mobile:**
- Heatmap colour buckets: ≥70% strong (green) / 40–69% developing (amber) / <40% weak (red) / untested (gray)
- Weak-area sort: ascending by `avg_class_accuracy`
- Weak-area thresholds: 50 / 60 / 70 (default 60), urgency bands at <40 / 40–55 / ≥55
- Misconception flag: dominant wrong option ≥ 20% of responses
- Test-attempt percent fallback: `(earned_points / total_points) * 100` if `score` not set
- Status bands (web-native): Distinction ≥75 / First 60–74 / Second 45–59 / Pass 33–44 / Fail <33
- All Supabase calls preserve mobile param names (`p_student_id`, `p_class_instance_id`, `p_subject_id`, `p_threshold`, `p_test_id`)

**Role gating:**
- `/analytics`, `/analytics/student/:id`, `/analytics/class/:id` → `superadmin + admin` (matches `routeAccess.analytics`)
- `/student/analytics` → `student` only; the page resolves the auth user to its student record before mounting the unified hub, so a student cannot view another student's data.
- Admin/teacher = full hub. Student = locked-scope wrapper, can only see their own.

**Known limits / parity notes:**
- The 3 advanced RPCs (`get_student_topic_heatmap`, `get_class_weak_topics`, `get_question_misconception_report`) are documented in mobile but the actual SQL implementation is in Supabase (out of scope for web — web only calls them). If the RPCs are not yet deployed to a given Supabase project, the screens render empty-state messages instead of crashing.
- Misconception "Explain" is rule-based (top problem questions + dominant wrong options + recommended action) since mobile does not ship an Edge Function for this. If `analyze-misconceptions` (or similar) is added later, swap the local `generateExplanation` function for `supabase.functions.invoke()`.
- Question-level drilldown on the heatmap reads `test_questions` joined with the student's `test_attempts.answers` JSON to highlight selected vs correct option — same data the mobile bottom-sheet would expose, but mobile keeps it implicit.
- Old fragmented files DELETED: `Analytics.jsx` rewritten as a Routes shell; `AnalyticsHub.jsx`, `AnalyticsPreview.jsx`, `AdminAnalytics.jsx`, `SuperAdminAnalytics.jsx`, `ClassComparison.jsx`, `StudentComparison.jsx`, `DailyTrendsAnalytics.jsx`, `StudentPerformanceAnalytics.jsx`, `ClassComparisonAnalytics.jsx`, `StatusDistributionAnalytics.jsx`, `AnalyticsCard.jsx`, `AnalyticsFilterBar.jsx`, `AnalyticsChart.jsx`, `AnalyticsSection.jsx`, `useLearningAnalytics.js` — all removed. `AnalyticsKPI.jsx` retained (used by AttendanceOverview).
- Mobile cache TTLs (10min heatmap/weak-areas, 5min misconceptions) not mirrored — web refetches on filter change; the explicit Refresh button gives users the same control.

Ready for manual test. Move to 🟩 once verified.

### 8b. Analytics Rewrite — AY-scoped, feature-wise IA — 🟨 In progress
Goal: replace the surface-level Unified hub with a deep, cross-domain analytics centre. Each feature gets its own page; every report is scoped through a top-level Academic Year picker (defaults to active AY, with Compare AYs mode).

**Foundational rule (per user):** the AY scope means "show only events whose `class_instance` has `academic_year_id = selectedAyId`". Every event with a `class_instance_id` is scoped via that join, not via its own AY column. AY-direct tables (HR / leaves / staff_attendance / fee_invoices) scope by their own `academic_year_id`. Date-only tables scope by `year_start..year_end`. Master tables (student / employees / subjects / class_instances) are NOT scoped — their events are.

**Phase 0 — Foundations (DONE):**
- `src/features/analytics/context/AcademicYearContext.jsx` — loads `academic_years` for the school, picks `is_active` by default, persists user's selection in localStorage. Exposes `selectedAyId`, `compareAyId`, `formatYearLabel`, `setSelectedAyId`, `setCompareAyId`, `clearCompare`, `reload`.
- `src/features/analytics/services/ayScope.js` — central scoping helper.
  - `SCOPE_MAP`: per-table audit-driven dictionary mapping each table to one of `{class, ay, date, none}`.
  - `getClassInstanceIdsForAy(schoolCode, ayId)` — cached lookup of class_instance ids belonging to an AY.
  - `getAyDateRange(ayId)` — cached `{start, end}` from `academic_years.start_date/end_date` (or `year_start/year_end` fallback).
  - `scopeQuery(query, table, {ayId, schoolCode})` — applies the right path for the given table.
  - `ayCaption(year, {allTime})` — caption helper for chart subtitles.
- `src/features/analytics/components/AcademicYearPicker.jsx` — top-of-page picker + Compare AY toggle.
- `src/features/analytics/pages/AnalyticsShell.jsx` — wraps every analytics route with breadcrumbs + AY picker.
- `src/features/analytics/pages/Analytics.jsx` — REWRITTEN as router with AcademicYearProvider + new feature routes. Legacy `?tab=` redirects mapped onto new feature pages.
- `src/features/analytics/pages/AnalyticsHub.jsx` — landing page with feature cards (Attendance, Fees, Tasks, Syllabus, Academic, HR).

**Phase 1 — Attendance Analytics (DONE):**
Web route: `/analytics/attendance`. Two top-level tabs: Student Attendance | Staff Attendance.
- Service: `src/features/analytics/services/attendanceAnalyticsService.js`
  - `getDailyAttendanceTrend` — class-bound path: `attendance` filtered via student → `class_instance_id IN (class_instances WHERE academic_year_id = ay)`.
  - `getPerClassSummary` — same class-bound path; aggregated per class_instance.
  - `getTopAbsentees` — same class-bound path; ranked.
  - `getStatusDistribution` — same class-bound path; donut buckets.
  - `getPeriodHeatmap` — `period_attendance` direct `class_instance_id IN (…)`.
  - `getMonthlyCalendar` — same class-bound path; calendar grid.
  - `getStaffAttendanceSummary` — RPC `get_staff_attendance_summary(p_school_code, p_year, p_month)` (ay-direct path on staff_attendance).
  - `getHeadlineKpis` — KPI tile aggregates.
- Page: `src/features/analytics/pages/AttendanceAnalytics.jsx` — School / Class / Student segmented scope, optional date range inside AY, charts: KPI cards, daily trend area, status pie, per-class bars, chronic absentees, period heatmap (subject × DOW), monthly calendar grid, staff summary table.

**Per-query scoping path:**
| Query | Path | Notes |
|---|---|---|
| `getDailyAttendanceTrend` | class | via student → class_instances (AY filter on class_instances) |
| `getPerClassSummary` | class | same |
| `getTopAbsentees` | class | same |
| `getStatusDistribution` | class | same |
| `getPeriodHeatmap` | class | direct class_instance_id IN (…) |
| `getMonthlyCalendar` | class | via student → class_instances |
| `getStaffAttendanceSummary` | ay-direct | RPC takes p_school_code + p_year + p_month |
| `getHeadlineKpis` | class | via student → class_instances |

**Schema change — `attendance.academic_year_id` added 2026-04-26:**
The student `attendance` table now has a direct `academic_year_id UUID NOT NULL` column with FK to `academic_years.id`. Migration applied via Supabase MCP and mirrored at `~/Desktop/classbridge/supabase/migrations/20260426120000_attendance_academic_year_id.sql`. Backfill: 16,380 rows (SCH019 25-26: 11,109 / SCH019 26-27: 5,203 / SCH101 25-26: 68; zero NULLs). Indexes: `(school_code, academic_year_id, date)` and `(academic_year_id, student_id)`. Web `ayScope.SCOPE_MAP['attendance']` switched from `class` to `ay`; `attendanceAnalyticsService` queries simplified to one-step `.eq('school_code', x).eq('academic_year_id', ayId)`. **Mobile insert paths must populate `academic_year_id` on every new attendance row going forward** — the column is NOT NULL so inserts will fail otherwise.

**Phase 2 — Fees Analytics:** scaffolded (`/analytics/fees`), implementation next.
**Phase 3 — Tasks Analytics:** scaffolded.
**Phase 4 — Syllabus Analytics:** scaffolded.
**Phase 5 — Academic Performance:** scaffolded (consolidates the existing weak-areas / heatmap / misconceptions tabs into a single Academic page).
**Phase 6 — HR Analytics:** scaffolded.

**Migration note:** the old `UnifiedAnalytics.jsx` and its 12 tab components are still on disk; `StudentScopedAnalytics` and `ClassScopedAnalytics` still wrap UnifiedAnalytics for the detail-page drill-down routes (`/analytics/student/:id`, `/analytics/class/:id`). Cleanup of the old hub will happen after each feature page lands.

In progress.

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

### 9b. Fees — 🟨 Rewritten in place (full mobile parity + web enhancements), awaiting user manual test
Mobile: `app/finance/{fees,fees-student}.tsx` + `src/features/fees/FeesScreen.tsx` + `src/components/fees/{InvoiceList,InvoiceDetailModal,InvoiceDocumentViewer,InvoiceViewer,PaymentScreen,StudentFeesView,GenerateFeesModal,ClassSelectorModal}.tsx` + `src/services/fees.ts` (canonical contract: `invoiceService`)
Web: `src/features/fees/{pages,components,services,context,utils}` (rewritten in place — same routes `/fees`, same folder, same imports)

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Fees Hub (admin) | `/finance/fees` | `/fees` | 🟨 rewritten — KPIs + aged-receivables + invoice table + analytics tab + bulk reminders |
| 2 | Student fees view | `/finance/fees-student` | `/fees` (auto-routed by role) | 🟨 rewritten — hero + invoices + payment history |

**The bug being fixed:** Old web Fees module used `fee_student_plans` + `fee_student_plan_items` + `fee_component_types` while mobile (and Inventory's fee linkage) writes to `fee_invoices` + `fee_invoice_items` + `fee_payments`. A fee created on mobile didn't appear on web; an inventory item issued on web wrote to `fee_invoices` and was invisible to web's Fees page. **Now fixed.** Web reads/writes the same tables as mobile.

**Service layer:** `src/features/fees/services/feesService.js` — JS port of mobile `services/fees.ts` `invoiceService`. Method names match mobile exactly:
- `getByClass`, `getByStudent`, `getDetail` (joined: items + payments + student + recorded_by name)
- `createInvoice`, `generateForClass` (bulk, single due date, skips existing billing_period+academic_year)
- `recordPayment`, `recordItemPayment` — validates remaining balance, immutable `recorded_by_user_id`, recomputes `paid_amount`+`status`, auto-posts to Finance GL when collector is super admin (mirrors mobile `fees.ts:574-606`)
- `addItems`, `removeItems`, `updateItem` — recompute total + status after every mutation
- `updateInvoice` (due_date / notes), `deleteInvoice` (blocked when payments exist)
- `generateInvoiceDocument`, `sendPaymentReminder`, `sendBulkReminders`
- Reference data: `listClasses`, `listStudents`, `resolveStudentForUser` (auth_user_id → student record)
- Aggregations: `summariseInvoices`, `ageReceivables` (0–30 / 31–60 / 61–90 / 90+ buckets)

**Shared invoice helpers (extracted from inventory):** `src/features/fees/services/invoiceHelpers.js` — `getOrCreateInvoice`, `addInvoiceItems`, `recalculateInvoiceTotal`, `recalculateInvoicePaidAmount`, `calculateInvoiceStatus`, `calculateInvoiceTotal`, `billingPeriodFor`, `getActiveAcademicYear`. Inventory now imports these instead of carrying its own copy → the two modules **cannot diverge again**.

**Tables now used (1:1 with mobile):** `fee_invoices`, `fee_invoice_items`, `fee_payments`, `class_instances`, `student`, `users`, `academic_years`. Edge Functions: `generate-invoice-document`, `send-fee-notification`. Status enum: **`'DUE' / 'PARTIAL' / 'PAID'` (uppercase)** — exactly matches the DB `fee_invoices_status_check` constraint and mobile's `InvoiceStatusSchema`. Computed from amounts; never trusted from client. Amounts in **rupees** (no paise).

**Status enum gotcha:** an earlier inventory implementation tried to write lowercase `'pending' / 'partial' / 'paid'` which violates the DB CHECK constraint. The error was being silently swallowed (the auto-fees block in `inventory.issue` is wrapped in `try { ... } catch { /* ... */ }` to mirror mobile). The new shared `calculateInvoiceStatus` returns the canonical uppercase values, so any future writes from inventory or fees can never trip the constraint.

**Components built:**
- `InvoiceTable` — sortable/filterable, status pills, inline Record-Payment / View-Document / Reminder actions, multi-select for bulk reminders
- `InvoiceDetailDrawer` — descriptions block with shown math (`Total − Paid = Balance`), line item table with inline edit/delete, Add-items spreadsheet form, payment history table, Edit due/notes drawer, Delete (blocked if payments), Send-reminder, View-document
- `PaymentDrawer` — payment form with amount validation against remaining balance, 6-method radio buttons (cash/upi/card/cheque/bank_transfer/online), receipt #, remarks, "Full" quick-fill
- `GenerateInvoicesDrawer` — bulk class invoice creation with quick-add presets (Tuition / Transport / Books / Activity / Lab / Exam) and live per-student total; single due date; skips students already invoiced for the period
- `CreateInvoiceDrawer` — single-student invoice creation
- `InvoiceDocumentViewer` — iframe + window.print (mirrors HrDocumentViewer / Finance Reports); calls `generate-invoice-document` Edge Function so totals are server-computed
- `BulkRemindersDrawer` — multi-select overdue invoices → progress tracker + per-row success/failure list
- `StudentFees` — student-side hero (outstanding banner with gradient), invoices grouped by period with line items, payment history table
- `FeeAnalytics` — daily-collections area chart, status pie, billing-period stacked bar, period summary table with collection-rate tags

**Web enhancements over mobile (8 of the 8 suggested):**
1. **Spreadsheet-style bulk invoice creation** — class + line items + single click → invoices for every student, with quick-add presets and live per-student total (mobile creates one at a time)
2. **CSV/XLSX export** of filtered invoices (XLSX via `xlsx` already in deps; column set: Student / Code / Period / Due / Total / Paid / Balance / Status / Created at)
3. **Iframe + window.print receipt viewer** — same pattern as HrDocumentViewer; document HTML comes from `generate-invoice-document` Edge Function so totals are authoritative
4. **Inline "Record payment" action** on every unpaid row → opens PaymentDrawer side-panel without leaving the table
5. **Bulk reminder send** — multi-select rows, run reminders sequentially via `send-fee-notification`, per-row success/failure progress display
6. **Aged-receivables card** at the top of the hub (Not yet due / 0–30 / 31–60 / 61–90 / 90+ days)
7. **Quick "Remind all overdue" button** that auto-selects every overdue invoice and pipes them through the bulk reminder flow
8. **Status segmented filter + due-date range picker + free-text search** on the invoice table (mobile only had class selector + paid/unpaid pill)

**Inventory linkage preserved:** `inventoryService.js`'s `addInvoiceItems` helper is now a thin alias to the shared `invoiceHelpers.addInvoiceItems`; the inline `recalculateInvoiceTotal` in `returnIssue` is replaced by the shared helper. Item label format (`${item.name}${quantity > 1 ? ` (x${quantity})` : ''}`), billing period format (`${year_start}-${year_end}`), invoice get-or-create defaults (`total_amount=0, paid_amount=0, due_date=today+1month`) and the three-tier refund deletion (delete-by-id → delete-by-label-match → fallback negative line) are all unchanged. Verified byte-compatible by an Explore-agent audit.

**Outside consumers updated:**
- `src/features/students/pages/Dashboard.jsx:189` — replaced `fee_student_plans` query with `fee_invoices` so the realtime fee channel still triggers a refetch but no longer hits a deprecated table
- `src/features/analytics/services/analyticsSummaryService.js` `getFeesSummary` — switched from plans+items+`amount_paise` to `fee_invoices.total_amount/paid_amount` + `fee_payments.amount_inr` (rupees, then converted to paise at render time so the legacy `fmtINR` paise API still works)
- Realtime channel filter on `fee_payments` in Dashboard is unchanged (table name is the same on both apps)

**Files removed (dead plan-based components):**
- `components/FeeComponents.jsx`, `FeeManage.jsx`, `RecordPayments.jsx`, `FeeCollections.jsx`, `CollectionsView.jsx`, `FeeAnalyticsEnhanced.jsx`, `CsvDrawer.jsx`
- `utils/feeAdapters.js` (plan-specific UI shapers)
- `hooks/useFeesAnalytics.js` (plan-specific hook; folder removed)
- All zero references confirmed via grep

**FeesContext rewritten:** simplified to expose `schoolCode`, `userRole`, `academicYear`, `classes`, `loading`, `error`, `refresh()`. Old plan-based reducer state (`studentPlans`, `payments`, `feeComponents`) and methods (`loadStudentPlans`, `loadPayments`, `addPayment`, `updateStudentPlan`, `getStudentOutstanding`) were removed. Verified no external feature imported them; only the fees folder used the context.

**Critical safety / accounting safeguards:**
- Every write wrapped in try/catch with explicit `message.error` user feedback
- Live "Total − Paid = Balance" math shown in the InvoiceDetailDrawer descriptions block
- Payment amount is validated client-side AND re-validated server-side before insert (cannot exceed remaining balance)
- `precision={2}` on every InputNumber, IN locale for ₹ display
- Delete is blocked on invoices with payments (mirrors mobile `InvoiceHasPaymentsError`)
- Status is **always derived** from amounts in services/UI, never trusted from a stale write
- Server computes invoice document totals via Edge Function; client just renders the HTML

**Role gating:** Admin/superadmin → manage everything; student → auto-routed to `StudentFees` (read-only own invoices, payment history, and document viewer).

**Known limits / parity notes:**
- Receipt generation for individual *payments* (mobile's `generate-invoice-pdf` Edge Function) is not yet wired on web; the *invoice document* viewer (which lists payments inside) is. If a per-payment receipt becomes needed, plug `generate-invoice-pdf` into `InvoiceDocumentViewer` keyed by payment id.
- `fees.read` / `fees.write` / `fees.record_payments` capability strings are mirrored in mobile but are enforced via Supabase RLS, not a client-side `assertCapability` wrapper. Web mirrors mobile's pattern: relies on RLS + client role gating.
- Mobile uses React Query for caching; web fetches on filter change with manual Refresh button. The Hub's KPIs and aged buckets recompute purely from the in-memory invoice list, so a Refresh is a single round trip.
- **Migration consideration:** any historical data in the deprecated `fee_student_plans` / `fee_student_plan_items` / `fee_component_types` / `fee_payments` (with `amount_paise` / `plan_id` / `component_type_id`) tables is **not auto-migrated** by this change. If a school has live data on the old plan model, a one-off SQL migration is needed to project plan-driven amounts into `fee_invoices` + `fee_invoice_items` rows. This work is out of scope for the web rewrite (web never modifies schema or migrations).

Ready for manual test. Test cases:
1. Create an invoice on web → appears on mobile
2. Issue an inventory item on web → resulting line item appears in both Fees hubs
3. Record a payment on web → balance updates on mobile, super-admin sees a new income transaction in `/finance`
4. Bulk-generate for a class → notifications fire, students see invoices on mobile
5. Send a bulk reminder for overdue invoices → users receive `send-fee-notification` push/email

Move to 🟩 once verified.

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
| 2 | Inactive Users | `/manage/inactive-users` | `/users/inactive` | 🟨 folded into #13 User Management |
| 3 | Classmates | `/student/classmates` | `/student/classmates` | 🟥 |
| 4 | Settings & Profile | `/settings` | `/users/me` | 🟨 folded into #13 User Management |
| 5 | Change Password | `/change-password` | `/change-password` | 🟨 folded into #13 User Management |

### 13. User Management — 🟨 Built (full parity + web enhancements), awaiting user manual test
Mobile: `app/manage/{add-admin,add-student,inactive-users}.tsx` + `app/change-password.tsx` + `src/features/admin/*` + `src/hooks/{useAdmins,useStudents,useInactiveUsersList,useUserActivityStats}.ts`
Web: `src/features/users/{pages,components,services}` — single consolidated hub.

This consolidates the previously-scattered web pages (`AddAdmin`, `AddSuperAdmin`, `AddStudent`, `SignUpUser`, `SuperAdminCounter`) and mobile screens (Add Admin, Add Student, Inactive Users, Change Password) into one coherent /users hub.

| # | Screen | Mobile route | Web route | Status |
|---|---|---|---|---|
| 1 | Users hub (cross-role roster) | (mobile splits across `add-admin` + `add-student`) | `/users` | 🟨 built (KPI strip, scope picker, search, bulk ops, CSV export, print roster) |
| 2 | User detail drawer | (no mobile equivalent) | `/users` (drawer) | 🟨 built (identity, linked records, capabilities tab, danger zone) |
| 3 | Invite user (single + bulk CSV) | `app/manage/add-admin.tsx`, `add-student.tsx` | `/users/invite?role=…` | 🟨 built (single + bulk CSV/XLSX with validation preview + per-row reporting) |
| 4 | Inactive users | `/manage/inactive-users` | `/users/inactive` | 🟨 built (Deactivated / Never / Idle filters via mobile RPC) |
| 5 | My profile | (mobile `/settings`) | `/users/me` | 🟨 built (edit profile, change password, sign-out everywhere, capability readout) |
| 6 | Change password (self-service) | `/change-password` | `/change-password` | 🟨 built (re-verifies current password, strength meter, force re-login) |

**Service layer:** `src/features/users/services/usersService.js` — byte-compatible with mobile contracts:
- Edge Functions: `create-admin`, `create-student`, `create-super-admin`, `delete-admin`, `delete-student`
- RPCs: `get_users_for_superadmin` (unified roster), `get_user_activity_stats`, `get_inactive_users_list`, `get_all_super_admins`
- Tables: `users`, `admin`, `student`, `super_admin`, `class_instances`
- Self-service auth: `supabase.auth.updateUser({ password })`, `supabase.auth.signOut({ scope: 'global' })`, `resetPasswordForEmail`

**Components built:**
- `UserDetailDrawer` — side drawer with Identity / Linked records / Capabilities / Danger zone tabs; cross-link to HR detail when an employee record is found

**Web enhancements over mobile:**
1. Single unified roster (mobile keeps admins + students on separate screens)
2. Scope picker: All / Super Admins / Admins / Students / Inactive (with live counts in pills)
3. Bulk select → bulk deactivate / bulk reactivate / bulk export / bulk role change
4. CSV / XLSX bulk-invite with downloadable role-specific template, client-side per-row validation, preview, per-row error reporting
5. Capability matrix readout per role (so admins know what they're granting)
6. Linked-entity quick-link from a user row → opens HR detail in one click (when an employees row exists for that user_id)
7. User detail drawer with cross-role identity, linked records, audit-friendly metadata
8. Type-to-confirm hard delete (must type the email) for irreversible actions
9. Print-roster button (window.print HTML page) for school records
10. Self-service "Sign out everywhere" (revokes all sessions globally)
11. Password strength meter on change-password; re-authenticates against current password before changing

**Role gating (mirrors mobile capability rules):**
- `cb_admin` — sees all schools, can invite super_admins
- `superadmin` — manages all users in their school (admin, student); can hard-delete
- `admin` — can invite students; cannot hard-delete or invite super_admins
- `student` — only `/users/me` and `/change-password` (cannot reach `/users` hub)

**Backwards-compat redirects (in App.jsx):**
- `/add-admin` → `/users/invite?role=admin`
- `/add-super-admin` → `/users/invite?role=superadmin`
- `/add-student` → `/users/invite?role=student`
- `/super-admin-count` → `/users?scope=superadmin`
- `/signup-user` → `/users/invite`
- `/manage/inactive-users` → `/users/inactive`

**Sidebar:** scattered "Super Admin / Manage Admins / Students" entries replaced by a single **Users** entry plus an **Inactive Users** entry. The CB Admin section now has one "Users" link instead of "Super Admin".

**Files removed (logic folded into /users):**
- `src/features/school/components/AddAdmin.jsx`
- `src/features/school/components/AddSuperAdmin.jsx`
- `src/features/school/components/SignUpUser.jsx`
- `src/features/school/components/SuperAdminCounter.jsx`
- `src/features/students/components/AddStudent.jsx`
- `src/features/students/components/StudentFormModal.jsx`

**Known limits:**
- MFA section is a placeholder ("coming soon") — Supabase MFA is not yet enabled on this project
- `auth.users.last_sign_in_at` and `email_confirmed_at` are read from the live session for the *current* user only; for *other* users, last sign-in comes via the existing `get_user_activity_stats` / `get_inactive_users_list` RPCs (mobile uses the same path)
- `delete-admin` / `delete-student` Edge Functions are referenced by the existing web flows but were not visible in the mobile repo's local `supabase/functions/` directory — they exist on the live project (web has been calling them in production). If they're missing in any environment, hard-delete will return an error and the user is shown that error verbatim
- "Send invitation reminder" for pending invites is not yet implemented (mobile doesn't track invitation-pending state separately from `is_active`)

Ready for manual test. Move to 🟩 once verified.

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
| School profile | Partial overlap with `/school-setup` |

These get a sweep pass after the 12 missing modules above are done.
