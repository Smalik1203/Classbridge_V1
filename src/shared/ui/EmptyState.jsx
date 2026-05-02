/**
 * EmptyState — supports both new prototype-style API and the legacy AntD-era
 * API (so existing callers across the app keep working).
 *
 *  New API:    <EmptyState icon={Inbox} title="..." sub="..." action={<Button…/>} />
 *  Legacy API: <EmptyState type="students" title="..." description="..." actionText="..." onAction={…} />
 */
import { isValidElement } from 'react';
import { Inbox, Users, AppWindow, BarChart2, IndianRupee, Book, Clock, FileText, AlertTriangle } from 'lucide-react';

const TYPE_PRESETS = {
  students:  { icon: Users,        title: 'No students yet',          description: 'Get started by adding your first student to the system.' },
  classes:   { icon: AppWindow,    title: 'No classes found',         description: 'Create your first class to start organizing students and marking attendance.' },
  analytics: { icon: BarChart2,    title: 'Analytics will appear here', description: "Once tests are taken and attendance is recorded, you'll see trends here." },
  fees:      { icon: IndianRupee,   title: 'No fee components yet',    description: 'Create fee components to start managing student fees and collections.' },
  subjects:  { icon: Book,         title: 'No subjects yet',          description: 'Add subjects to organize your curriculum and create structured learning paths.' },
  timetable: { icon: Clock,        title: 'No timetable created yet', description: 'Create a timetable to organize classes, subjects, and schedules.' },
  syllabus:  { icon: Book,         title: 'No syllabus found',        description: 'Create a syllabus for this subject and class to organize learning content.' },
  tests:     { icon: FileText,     title: 'No tests found',           description: 'Create your first test to start assessing student progress and performance.' },
  error:     { icon: AlertTriangle,title: 'Something went wrong',     description: 'We encountered an error while loading your data. Please try again.' },
  default:   { icon: Inbox },
};

export function EmptyState({
  // new API
  icon: IconProp,
  title,
  sub,
  action,
  // legacy API
  type,
  description,
  actionText,
  onAction,
  showAction,
}) {
  const preset = TYPE_PRESETS[type] || TYPE_PRESETS.default;
  // Callers sometimes pass an emoji string instead of a lucide component;
  // fall back to the preset/Inbox component in that case so React doesn't
  // try to render <📚 /> as an HTML tag.
  const isStringIcon = typeof IconProp === 'string';
  const isElementIcon = isValidElement(IconProp);
  const Icon = (!isStringIcon && !isElementIcon && IconProp) || preset.icon || Inbox;
  const finalTitle = title || preset.title;
  const finalSub = sub || description || preset.description;

  let finalAction = action;
  if (!finalAction && onAction && actionText) {
    finalAction = (
      <button className="btn btn-accent" onClick={onAction} style={{ marginTop: 8 }}>
        {actionText}
      </button>
    );
  } else if (!finalAction && showAction && onAction) {
    finalAction = (
      <button className="btn btn-accent" onClick={onAction} style={{ marginTop: 8 }}>
        Get started
      </button>
    );
  }

  return (
    <div className="cb-empty">
      <div className="e-ico">
        {isStringIcon ? <span>{IconProp}</span> : isElementIcon ? IconProp : <Icon size={20} />}
      </div>
      {finalTitle && <div className="e-title">{finalTitle}</div>}
      {finalSub && <div className="e-sub">{finalSub}</div>}
      {finalAction}
    </div>
  );
}

export default EmptyState;
