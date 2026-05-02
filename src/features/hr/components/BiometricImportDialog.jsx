import React, { useMemo, useState } from 'react';
import { App as AntApp } from 'antd';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { hrService } from '../services/hrService';

// Common device CSV layouts. All converge to a normalized row:
//   { employee_code, date (YYYY-MM-DD), in_time (HH:mm), out_time (HH:mm) }
const DEVICE_PROFILES = [
  {
    key: 'generic',
    label: 'Generic CSV',
    hint: 'Headers: employee_code, date, in_time, out_time. Date in YYYY-MM-DD.',
    map: { code: 'employee_code', date: 'date', in: 'in_time', out: 'out_time' },
    dateFmt: 'YYYY-MM-DD',
  },
  {
    key: 'essl',
    label: 'eSSL eTimeTrackLite',
    hint: 'Headers: EmpCode, AttDate, InTime, OutTime. Date in DD-MM-YYYY.',
    map: { code: 'EmpCode', date: 'AttDate', in: 'InTime', out: 'OutTime' },
    dateFmt: 'DD-MM-YYYY',
  },
  {
    key: 'zkteco',
    label: 'ZKTeco / ZKTime',
    hint: 'Headers: ID No., Date, Clock In, Clock Out. Date in YYYY/MM/DD.',
    map: { code: 'ID No.', date: 'Date', in: 'Clock In', out: 'Clock Out' },
    dateFmt: 'YYYY/MM/DD',
  },
  {
    key: 'realtime',
    label: 'Realtime Biometrics',
    hint: 'Headers: EMP_ID, DATE, IN_PUNCH, OUT_PUNCH. Date in DD/MM/YYYY.',
    map: { code: 'EMP_ID', date: 'DATE', in: 'IN_PUNCH', out: 'OUT_PUNCH' },
    dateFmt: 'DD/MM/YYYY',
  },
  {
    key: 'matrix',
    label: 'Matrix COSEC',
    hint: 'Headers: User ID, Date, First In, Last Out. Date in DD-MMM-YYYY.',
    map: { code: 'User ID', date: 'Date', in: 'First In', out: 'Last Out' },
    dateFmt: 'DD-MMM-YYYY',
  },
];

// Minimal CSV parser that handles quoted fields with embedded commas.
function parseCSV(text) {
  const out = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur); cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.length > 1 || row[0] !== '') out.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); out.push(row); }
  return out;
}

const computeLateMinutes = (inTime, scheduledStartMin = 9 * 60) => {
  if (!inTime) return 0;
  const m = /^(\d{1,2}):(\d{2})/.exec(inTime);
  if (!m) return 0;
  const t = Number(m[1]) * 60 + Number(m[2]);
  return Math.max(0, t - scheduledStartMin);
};

export default function BiometricImportDialog({ open, onOpenChange, schoolCode, userId, onImported }) {
  const { message } = AntApp.useApp();

  const [profileKey, setProfileKey] = useState('generic');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState('');
  const [normalized, setNormalized] = useState([]); // [{ employee_code, full_name?, employee_id?, date, in_time, out_time, late_minutes, status, _issue }]
  const [unmatched, setUnmatched] = useState([]); // codes that didn't resolve

  const profile = useMemo(() => DEVICE_PROFILES.find((p) => p.key === profileKey), [profileKey]);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setNormalized([]);
    setUnmatched([]);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) { setParseError('CSV looks empty.'); return; }
      const header = rows[0].map((h) => (h || '').trim());
      const idx = {
        code: header.findIndex((h) => h.toLowerCase() === profile.map.code.toLowerCase()),
        date: header.findIndex((h) => h.toLowerCase() === profile.map.date.toLowerCase()),
        in:   header.findIndex((h) => h.toLowerCase() === profile.map.in.toLowerCase()),
        out:  header.findIndex((h) => h.toLowerCase() === profile.map.out.toLowerCase()),
      };
      if (idx.code < 0 || idx.date < 0 || idx.in < 0) {
        setParseError(`This file doesn't match the "${profile.label}" layout. Expected columns: ${Object.values(profile.map).filter(Boolean).join(', ')}. Try a different device profile or check the file.`);
        return;
      }
      const codeMap = await hrService.getEmployeeCodeMap(schoolCode);

      const cleaned = [];
      const missing = new Set();
      for (let r = 1; r < rows.length; r += 1) {
        const row = rows[r];
        if (!row || row.every((c) => !c || !String(c).trim())) continue;
        const code = (row[idx.code] || '').trim();
        const rawDate = (row[idx.date] || '').trim();
        const inTime = (row[idx.in] || '').trim();
        const outTime = idx.out >= 0 ? (row[idx.out] || '').trim() : '';
        const date = dayjs(rawDate, profile.dateFmt, true);
        const matched = codeMap.get(code.toLowerCase());
        const issue = !matched
          ? 'Employee code not found'
          : !date.isValid()
          ? `Bad date "${rawDate}"`
          : !inTime
          ? 'Missing in-time'
          : null;
        if (!matched && code) missing.add(code);
        const lateMin = inTime ? computeLateMinutes(inTime) : 0;
        cleaned.push({
          employee_code: code,
          full_name: matched?.full_name || '—',
          employee_id: matched?.id || null,
          date: date.isValid() ? date.format('YYYY-MM-DD') : rawDate,
          in_time: normalizeTime(inTime),
          out_time: normalizeTime(outTime),
          late_minutes: lateMin,
          status: lateMin > 0 ? 'late' : (matched && date.isValid() && inTime ? 'present' : 'absent'),
          _issue: issue,
        });
      }
      setNormalized(cleaned);
      setUnmatched(Array.from(missing));
    } catch (e) {
      setParseError(e.message || 'Failed to parse CSV');
    }
  };

  const validRows = normalized.filter((r) => !r._issue);

  const commit = async () => {
    if (validRows.length === 0) { message.error('No valid rows to import.'); return; }
    try {
      setBusy(true);
      // Group by date so each upsert covers one day.
      const byDate = new Map();
      validRows.forEach((r) => {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date).push({
          employee_id: r.employee_id,
          status: r.status,
          in_time: r.in_time || null,
          out_time: r.out_time || null,
          late_minutes: r.late_minutes || 0,
        });
      });
      let total = 0;
      for (const [date, marks] of byDate.entries()) {
        // de-dupe within the same day (last in wins)
        const dedup = new Map();
        marks.forEach((m) => dedup.set(m.employee_id, m));
        const saved = await hrService.upsertStaffAttendance({
          schoolCode,
          date,
          marks: Array.from(dedup.values()),
          markedBy: userId,
          source: 'biometric_import',
        });
        total += saved.length;
      }
      message.success(`Imported ${total} attendance ${total === 1 ? 'entry' : 'entries'} across ${byDate.size} ${byDate.size === 1 ? 'day' : 'days'}.`);
      onImported?.();
      onOpenChange(false);
      // reset
      setFileName(''); setNormalized([]); setUnmatched([]); setParseError('');
    } catch (e) {
      message.error(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFileName(''); setNormalized([]); setUnmatched([]); setParseError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import attendance from biometric / RFID device</DialogTitle>
          <DialogDescription>
            Pick your device, upload the CSV it exports, preview, then commit. Existing entries for the same employee + date are overwritten.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: device profile */}
        <div className="space-y-2">
          <Label>Device profile</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEVICE_PROFILES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { setProfileKey(p.key); reset(); }}
                className={cn(
                  'text-left p-3 rounded-lg border transition-all',
                  profileKey === p.key
                    ? 'border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <div className="text-sm font-bold text-slate-900">{p.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{p.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: file picker */}
        <div className="mt-4">
          <Label>Upload CSV</Label>
          <div className="mt-1 flex items-center gap-3">
            <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
              <Upload size={16} className="text-slate-500" />
              <span className="text-sm text-slate-700 font-medium">
                {fileName || 'Choose CSV file…'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {fileName && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RefreshCw size={14} />
                Reset
              </Button>
            )}
          </div>
          {parseError && (
            <div className="mt-2 px-3 py-2 rounded bg-rose-50 ring-1 ring-rose-100 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Step 3: preview */}
        {normalized.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat tone="emerald" label="Valid rows" value={validRows.length} icon={<CheckCircle2 size={14} />} />
              <Stat tone="amber" label="With issues" value={normalized.length - validRows.length} icon={<AlertTriangle size={14} />} />
              <Stat tone="slate" label="Unmatched codes" value={unmatched.length} icon={<FileSpreadsheet size={14} />} />
            </div>

            {unmatched.length > 0 && (
              <div className="mt-3 px-3 py-2 rounded bg-amber-50 ring-1 ring-amber-100 text-xs text-amber-900">
                <span className="font-semibold">Unmatched employee codes:</span>{' '}
                <span className="font-mono">{unmatched.slice(0, 12).join(', ')}{unmatched.length > 12 ? `, +${unmatched.length - 12} more` : ''}</span>
                <div className="mt-1 text-[11px] text-amber-700">These rows will be skipped. Make sure each device "User ID" matches the school's <code>employee_code</code>.</div>
              </div>
            )}

            <div className="mt-3 max-h-[280px] overflow-y-auto border border-slate-200 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                    <TableHead className="text-[11px] uppercase">Code</TableHead>
                    <TableHead className="text-[11px] uppercase">Name</TableHead>
                    <TableHead className="text-[11px] uppercase">Date</TableHead>
                    <TableHead className="text-[11px] uppercase">In → Out</TableHead>
                    <TableHead className="text-[11px] uppercase">Status</TableHead>
                    <TableHead className="text-[11px] uppercase">Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normalized.slice(0, 200).map((r, i) => (
                    <TableRow key={i} className={r._issue ? 'bg-rose-50/40' : ''}>
                      <TableCell className="font-mono text-xs">{r.employee_code}</TableCell>
                      <TableCell className="text-xs">{r.full_name}</TableCell>
                      <TableCell className="text-xs font-mono">{r.date}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.in_time || '—'} {r.out_time ? <span className="text-slate-400">→ {r.out_time}</span> : null}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                          r.status === 'present' ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'late' ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700',
                        )}>{r.status}</span>
                        {r.late_minutes > 0 && <span className="ml-1 text-[10px] text-amber-700">+{r.late_minutes}m</span>}
                      </TableCell>
                      <TableCell className="text-xs text-rose-700">{r._issue || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {normalized.length > 200 && (
                <div className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 text-center">
                  Showing first 200 rows · {normalized.length} total will be processed.
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={commit} disabled={busy || validRows.length === 0}>
            {busy ? <RefreshCw className="animate-spin" /> : <Upload />}
            Import {validRows.length || ''} {validRows.length === 1 ? 'entry' : 'entries'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalizeTime(s) {
  if (!s) return '';
  // Accept "9:05", "09:05", "09:05:30", "9:05 AM" → return HH:mm
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(s.trim());
  if (!m) return '';
  let h = Number(m[1]);
  const mi = m[2];
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mi}`;
}

function Stat({ tone, label, value, icon }) {
  const toneCls = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-800 ring-amber-100',
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  }[tone] || 'bg-slate-50 text-slate-700 ring-slate-200';
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg ring-1', toneCls)}>
      {icon}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold opacity-70">{label}</div>
        <div className="text-base font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
