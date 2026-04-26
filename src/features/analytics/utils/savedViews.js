const KEY = 'cb.analytics.savedViews.v1';

export function listSavedViews() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveView(view) {
  const all = listSavedViews();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  all.push({ id, ...view });
  localStorage.setItem(KEY, JSON.stringify(all));
  return id;
}

export function deleteView(id) {
  const all = listSavedViews().filter((v) => v.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}
