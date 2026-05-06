import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { message } from 'antd';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  listCcaAreas,
  getCcaGradesForStudent,
  saveCcaGradesForStudent,
} from '@/features/tests/services/gradebookService';

/**
 * Per-student CCA grade entry.
 *
 * Opens for one (termReport, student) pair. Loads the school's configured
 * CCA areas and any grades the student already has, then lets the user
 * enter or update a grade per area. Saves on click; closes on success.
 *
 * Empty inputs clear the stored grade (blank cell on the report card),
 * non-empty inputs upsert. Grade is a free-text string — schools use
 * letters (A+, A, B), descriptors (Excellent, Good), or whatever scale
 * matches their report card.
 */
export default function CcaGradesDialog({
  open,
  onOpenChange,
  termReportId,
  studentId,
  studentName,
  schoolCode,
  onSaved,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState([]);
  const [grades, setGrades] = useState({}); // { [area]: 'A+' }

  useEffect(() => {
    if (!open || !termReportId || !studentId || !schoolCode) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [areasRes, gradesRes] = await Promise.all([
        listCcaAreas(schoolCode),
        getCcaGradesForStudent({ termReportId, studentId }),
      ]);
      if (cancelled) return;
      if (!areasRes.success) {
        message.error(areasRes.error || 'Failed to load CCA areas');
        setLoading(false);
        return;
      }
      setAreas(areasRes.data || []);
      setGrades(gradesRes.success ? (gradesRes.data || {}) : {});
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, termReportId, studentId, schoolCode]);

  const updateGrade = (area, value) => {
    setGrades((prev) => ({ ...prev, [area]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await saveCcaGradesForStudent({
      schoolCode, termReportId, studentId, grades,
    });
    setSaving(false);
    if (!res.success) {
      message.error(res.error || 'Failed to save CCA grades');
      return;
    }
    message.success('CCA grades saved');
    if (typeof onSaved === 'function') onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>CCA Grades</DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName} — ` : ''}
            enter a grade for each co-curricular area.
            Leave blank to clear.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Loading…
          </div>
        ) : areas.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">
            No CCA areas configured for this school yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {areas.map((a) => (
              <div key={a.id} className="grid grid-cols-[1fr_90px] gap-3 items-center">
                <label htmlFor={`cca-${a.id}`} className="text-sm">
                  {a.area}
                </label>
                <Input
                  id={`cca-${a.id}`}
                  value={grades[a.area] || ''}
                  onChange={(e) => updateGrade(a.area, e.target.value)}
                  placeholder="A+"
                  maxLength={6}
                  className="h-8 text-center"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving || areas.length === 0}
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin mr-1.5" /> Saving…</>
            ) : (
              <><Save className="size-4 mr-1.5" /> Save</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
