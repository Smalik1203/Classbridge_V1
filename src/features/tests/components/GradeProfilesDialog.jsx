import { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Edit, ArrowLeft } from 'lucide-react';

import {
  listGradingScales, upsertGradingScale, deleteGradingScale,
} from '@/features/tests/services/gradebookService';
import { PRESETS } from '@/features/tests/utils/grading';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/shared/ui/Field';
import { Badge } from '@/shared/ui/Badge';

const EMPTY_BAND = { min: 0, max: 0, grade: '', gpa: '', description: '' };

export default function GradeProfilesDialog({ open, onClose, schoolCode, onChanged }) {
  const [view, setView] = useState('list');
  const [scales, setScales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    if (!schoolCode) return;
    setLoading(true);
    const r = await listGradingScales(schoolCode);
    setLoading(false);
    if (r.success) setScales(r.data);
  };

  useEffect(() => { if (open) { setView('list'); load(); } }, [open, schoolCode]);

  const startCreateBlank = () => {
    setEditing({
      id: null,
      name: '',
      scale: [{ ...EMPTY_BAND, max: 100 }],
      is_default: scales.length === 0,
    });
    setView('edit');
  };

  const startCreateFromPreset = (preset) => {
    setEditing({
      id: null,
      name: preset.name,
      scale: preset.scale.map((b) => ({ ...b, gpa: b.gpa ?? '' })),
      is_default: scales.length === 0,
    });
    setView('edit');
  };

  const startEdit = (s) => {
    setEditing({
      id: s.id,
      name: s.name,
      scale: (s.scale || []).map((b) => ({
        min: b.min ?? 0, max: b.max ?? 0,
        grade: b.grade ?? '', gpa: b.gpa ?? '', description: b.description ?? '',
      })),
      is_default: !!s.is_default,
    });
    setView('edit');
  };

  const remove = async (id) => {
    if (!confirm('Delete this grade profile? Exams using it will fall back to the school default.')) return;
    const r = await deleteGradingScale(id);
    if (!r.success) return;
    load();
    onChanged?.();
  };

  const setBand = (idx, key, value) => {
    setEditing((e) => ({
      ...e,
      scale: e.scale.map((b, i) => i === idx ? { ...b, [key]: value } : b),
    }));
  };

  const addBand = () => {
    setEditing((e) => ({ ...e, scale: [...e.scale, { ...EMPTY_BAND }] }));
  };

  const removeBand = (idx) => {
    setEditing((e) => ({ ...e, scale: e.scale.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!editing.name.trim()) { alert('Profile name is required'); return; }
    const cleaned = editing.scale
      .filter((b) => b.grade && (b.grade + '').trim())
      .map((b) => ({
        min: Number(b.min) || 0,
        max: Number(b.max) || 0,
        grade: (b.grade + '').trim(),
        gpa: b.gpa === '' || b.gpa == null ? null : Number(b.gpa),
        description: (b.description || '').trim(),
      }))
      .sort((a, b) => b.min - a.min);
    if (cleaned.length === 0) { alert('Add at least one band with a grade label'); return; }
    const payload = {
      id: editing.id || undefined,
      school_code: schoolCode,
      name: editing.name.trim(),
      scale: cleaned,
      is_default: editing.is_default,
    };
    const r = await upsertGradingScale(payload);
    if (!r.success) return;
    setView('list');
    setEditing(null);
    load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[760px] p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[color:var(--border)]">
          <DialogTitle className="flex items-center gap-2">
            {view === 'edit' && (
              <button
                type="button"
                onClick={() => { setView('list'); setEditing(null); }}
                className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            {view === 'list' ? 'Grade Profiles' : (editing?.id ? 'Edit Profile' : 'New Profile')}
          </DialogTitle>
        </DialogHeader>

        {view === 'list' && (
          <div className="px-6 py-4 max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="text-center py-10 text-[13px] text-[color:var(--fg-muted)]">Loading…</div>
            ) : scales.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-[13.5px] text-[color:var(--fg-muted)] mb-4">
                  No grade profiles yet. Start from a preset or create your own.
                </p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {scales.map((s) => (
                  <div key={s.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] hover:bg-[color:var(--bg-subtle)]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-[color:var(--fg)]">{s.name}</span>
                        {s.is_default && <Badge variant="success"><Star size={10} /> Default</Badge>}
                      </div>
                      <div className="text-[12px] text-[color:var(--fg-muted)] mt-0.5">
                        {(s.scale || []).length} band{(s.scale || []).length === 1 ? '' : 's'}
                        {s.scale?.[0]?.grade && ` · ${s.scale.map((b) => b.grade).slice(0, 5).join(', ')}${s.scale.length > 5 ? '…' : ''}`}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(s)}>
                      <Edit size={13} />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      className="text-[color:var(--danger)]"
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[color:var(--border)] pt-4">
              <div className="text-[12px] font-medium text-[color:var(--fg-muted)] mb-2 uppercase tracking-[0.05em]">
                Quick start from preset
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => startCreateFromPreset(p)}
                    className="px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elev)] hover:bg-[color:var(--bg-subtle)] text-left"
                  >
                    <div className="text-[13px] font-medium text-[color:var(--fg)]">{p.name}</div>
                    <div className="text-[11px] text-[color:var(--fg-muted)] mt-0.5">{p.scale.length} bands</div>
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={startCreateBlank}>
                <Plus size={13} /> Create blank profile
              </Button>
            </div>
          </div>
        )}

        {view === 'edit' && editing && (
          <div className="px-6 py-4 max-h-[70vh] overflow-auto">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Profile name" required>
                <Input
                  placeholder="e.g. CBSE 9-Point"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Default for school">
                <label className="flex items-center gap-2 cursor-pointer h-9">
                  <input
                    type="checkbox"
                    checked={editing.is_default}
                    onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                    className="rounded border-[color:var(--border)] accent-[color:var(--brand)]"
                  />
                  <span className="text-[13px] text-[color:var(--fg)]">Use as default</span>
                </label>
              </Field>
            </div>

            <div className="text-[12px] font-medium text-[color:var(--fg-muted)] mb-2 uppercase tracking-[0.05em]">
              Bands
            </div>

            <div className="rounded-md border border-[color:var(--border)] overflow-hidden mb-3">
              <div className="grid grid-cols-[60px_60px_80px_60px_1fr_36px] gap-2 px-3 py-2 bg-[color:var(--bg-subtle)] text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[color:var(--fg-muted)]">
                <span>Min %</span>
                <span>Max %</span>
                <span>Grade</span>
                <span>GPA</span>
                <span>Description</span>
                <span></span>
              </div>
              {editing.scale.map((b, idx) => (
                <div key={idx} className="grid grid-cols-[60px_60px_80px_60px_1fr_36px] gap-2 px-3 py-2 border-t border-[color:var(--border)]">
                  <Input type="number" min={0} max={100} value={b.min}
                    onChange={(e) => setBand(idx, 'min', e.target.value)}
                    className="h-8" />
                  <Input type="number" min={0} max={100} value={b.max}
                    onChange={(e) => setBand(idx, 'max', e.target.value)}
                    className="h-8" />
                  <Input value={b.grade}
                    onChange={(e) => setBand(idx, 'grade', e.target.value)}
                    placeholder="A1"
                    className="h-8" />
                  <Input type="number" step="0.1" value={b.gpa}
                    onChange={(e) => setBand(idx, 'gpa', e.target.value)}
                    placeholder="—"
                    className="h-8" />
                  <Input value={b.description}
                    onChange={(e) => setBand(idx, 'description', e.target.value)}
                    placeholder="Optional"
                    className="h-8" />
                  <Button variant="ghost" size="icon-sm"
                    className="text-[color:var(--danger)]"
                    onClick={() => removeBand(idx)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addBand} className="mb-4">
              <Plus size={13} /> Add band
            </Button>

            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border)]">
              <Button variant="outline" size="sm" onClick={() => { setView('list'); setEditing(null); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={save}>Save Profile</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
