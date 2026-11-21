// Generates the full, offline, 66-book WEBU Bible dataset from its CC0 repository.
// Runs in GitHub Actions; fails the APK build if the offline Bible is unavailable.
import { mkdir, writeFile } from 'node:fs/promises';
import { BOOKS, slugBook } from '../src/lib/books.js';
const URL='https://raw.githubusercontent.com/ringletech/webu-open-bible/main/json/complete-bible.json';
console.log(`Downloading public-domain WEBU text from ${URL}`);
const response = await fetch(URL, {signal:AbortSignal.timeout(120000)});
if(!response.ok) throw new Error(`Bible download failed: HTTP ${response.status}`);
const raw=await response.json();
const rows=Array.isArray(raw)?raw:Array.isArray(raw.verses)?raw.verses:Array.isArray(raw.data)?raw.data:null;
const aliases={'Psalms':['Psalms','Psalm'],'Song of Solomon':['Song of Solomon','Song of Songs','Song of Songs (Song of Solomon)'],'Revelation':['Revelation','Revelation of John']};
if(!rows) throw new Error('Unexpected source format. Cannot bundle Bible.');
await mkdir('public/bible',{recursive:true});
let total=0;
for(const [book] of BOOKS){
  const candidates=aliases[book]||[book];
  const data=rows.filter(v=>candidates.includes(v.book)).map(v=>({chapter:Number(v.chapter),verse:Number(v.verse),text:String(v.text||'')}));
  if(!data.length) throw new Error(`Missing book in downloaded Bible: ${book}`);
  await writeFile(`public/bible/${slugBook(book)}.json`,JSON.stringify(data));
  total+=data.length;
}
if(total<30000) throw new Error(`Incomplete Bible: only ${total} verses`);
console.log(`Prepared ${total} verses across 66 books. Offline Bible ready.`);
