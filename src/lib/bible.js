import { BOOKS, slugBook } from './books.js';
const cachedBooks = new Map();
const cachedChapters = new Map();
export const chapterKey = (book, chapter) => `${book} ${chapter}`;
export function normalizeVerses(data, chapter) {
  const list = Array.isArray(data) ? data : (data?.verses || []);
  return list.filter(v=>Number(v.chapter)===Number(chapter)).map(v=>({verse:Number(v.verse),text:String(v.text||'').replace(/\s+/g,' ').trim()})).filter(v=>v.text);
}
export async function getBook(book) {
  if(cachedBooks.has(book)) return cachedBooks.get(book);
  const response = await fetch(`./bible/${slugBook(book)}.json`);
  if(!response.ok) throw new Error('Offline Bible text is not bundled in this build.');
  const data = await response.json();
  const list = Array.isArray(data) ? data : data?.verses;
  if(!Array.isArray(list)) throw new Error(`Incorrect Bible data format for ${book}`);
  cachedBooks.set(book,list);
  return list;
}
export async function loadChapter(book, chapter) {
  const key = chapterKey(book,chapter);
  if(cachedChapters.has(key)) return cachedChapters.get(key);
  const storageKey = `sf.chapter.${key}`;
  try {
    const bookData = await getBook(book);
    const verses = normalizeVerses(bookData,chapter);
    if(!verses.length) throw new Error('No verses found');
    const result = {verses,translation:'World English Bible Updated (WEBU)',offline:true};
    cachedChapters.set(key,result);
    return result;
  } catch {
    // Browser builds without a bundled corpus can retrieve and cache individual WEB chapters.
    try {
      const saved = localStorage.getItem(storageKey);
      if(saved) return JSON.parse(saved);
    } catch { /* storage may be disabled */ }
    const ref = `${book} ${chapter}`;
    const response = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=web`);
    if(!response.ok) throw new Error('Passage unavailable. Connect to the internet or install a build with the bundled offline Bible.');
    const data = await response.json();
    const verses = (data.verses||[]).map(v=>({verse:Number(v.verse),text:String(v.text).replace(/\s+/g,' ').trim()}));
    if(!verses.length) throw new Error('Passage was empty');
    const result = {verses,translation:'World English Bible (WEB)',offline:false};
    cachedChapters.set(key,result);
    try { localStorage.setItem(storageKey,JSON.stringify(result)); } catch { /* ignore quota */ }
    return result;
  }
}
export async function searchBible(term,onProgress) {
  const needle=term.trim().toLocaleLowerCase();
  if(needle.length<3) return [];
  let hits=[];
  for(let i=0;i<BOOKS.length;i++) {
    const book = BOOKS[i][0];
    let verses=[];
    try { verses=await getBook(book); } catch { continue; }
    for(const v of verses) {
      if(String(v.text).toLocaleLowerCase().includes(needle)) {
        hits.push({book,chapter:Number(v.chapter),verse:Number(v.verse),text:String(v.text)});
        if(hits.length>=150) break;
      }
    }
    onProgress?.(Math.round((i+1)/BOOKS.length*100));
    if(hits.length>=150) break;
  }
  return hits;
}
export function parseReference(text) {
  const match = String(text).trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
  if(!match) return null;
  const book = BOOKS.find(([b]) => b.toLowerCase()===match[1].toLowerCase())?.[0];
  const chapter=Number(match[2]);
  if(!book||chapter<1||chapter>BOOKS.find(([b])=>b===book)[1]) return null;
  return {book,chapter,verse:match[3]?Number(match[3]):1};
}
