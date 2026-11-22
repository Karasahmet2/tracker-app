// =========================================================
// Themes. The colours themselves live in css/style.css
// ([data-theme="…"] blocks); this file switches between them.
// =========================================================
export const THEMES = [
  { id: 'midnight', name: 'Midnight', bg: '#0A1020', water: '#2E9FE6', extra: '#8FD3FA', bar: '#0A1020' },
  { id: 'daylight', name: 'Daylight', bg: '#F3F6FA', water: '#1E88D9', extra: '#8CCBF4', bar: '#F3F6FA' },
  { id: 'ocean', name: 'Ocean', bg: '#06181B', water: '#1BB5A5', extra: '#7EE0D4', bar: '#06181B' },
  { id: 'berry', name: 'Berry', bg: '#130C1C', water: '#A273F2', extra: '#F29BC8', bar: '#130C1C' }
];

export function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  if (t.id === 'midnight') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bar);
  try { localStorage.setItem('tracker-theme', t.id); } catch (e) {}
}
