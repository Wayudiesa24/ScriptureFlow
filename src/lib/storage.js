export function readJSON(key, fallback) {
  try { const saved = localStorage.getItem(`sf.${key}`); return saved == null ? fallback : JSON.parse(saved); } catch { return fallback; }
}
export function writeJSON(key, value) { try { localStorage.setItem(`sf.${key}`,JSON.stringify(value)); } catch { /* storage failure */ } }
export function exportData() {
  const data={app:'ScriptureFlow',version:1,created:new Date().toISOString(),items:{}};
  for(let i=0;i<localStorage.length;i++) {const key=localStorage.key(i);if(key?.startsWith('sf.')&& !key.startsWith('sf.chapter.')) data.items[key]=localStorage.getItem(key);}
  return data;
}
export function importData(json) {
  if(json?.app!=='ScriptureFlow'||json.version!==1||!json.items||typeof json.items!=='object') throw new Error('Not a valid ScriptureFlow backup');
  for(const [key,value] of Object.entries(json.items)) if(key.startsWith('sf.')&&typeof value==='string') localStorage.setItem(key,value);
}
