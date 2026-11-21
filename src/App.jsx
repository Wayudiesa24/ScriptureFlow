import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Headphones,BookMarked,Search,Settings,ChevronLeft,ChevronRight,NotebookPen,Sparkles,Bookmark,BookmarkCheck,Highlighter,Share2,ArrowUpRight,Copy,CheckCircle2,Circle,RotateCcw,Download,Upload,Sun,Moon,Info,LoaderCircle,ArrowRight} from 'lucide-react';
import PassageReader from './components/PassageReader.jsx';
import {BOOKS,bookCount,neighbor,READING_PLAN,CROSS_REFERENCES} from './lib/books.js';
import {loadChapter,searchBible,parseReference,chapterKey} from './lib/bible.js';
import {readJSON,writeJSON,exportData,importData} from './lib/storage.js';
import {STUDY_PROMPTS,requestStudy} from './lib/ai.js';

const TABS=[['Read',BookOpen],['Study',Sparkles],['Library',BookMarked],['Search',Search],['Settings',Settings]];
const FEATURED=[{book:'Psalms',chapter:23,label:'The Good Shepherd'},{book:'John',chapter:3,label:'God’s Love'},{book:'Romans',chapter:8,label:'Life in the Spirit'},{book:'Ezekiel',chapter:1,label:'The Divine Vision'}];
const lesson = (book,chapter,verse) => `${book} ${chapter}:${verse}`;
const makeId=(book,chapter,verse)=>`${book} ${chapter}:${verse}`;

export default function App(){
  const [tab,setTab]=useState('Read');
  const [position,setPosition]=useState(()=>readJSON('position',{book:'John',chapter:1}));
  const {book,chapter}=position;
  const [verses,setVerses]=useState([]);
  const [translation,setTranslation]=useState('World English Bible Updated (WEBU)');
  const [loaded,setLoaded]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [selectedVerse,setSelectedVerse]=useState(1);
  const [bookmarks,setBookmarks]=useState(()=>readJSON('bookmarks',{}));
  const [highlights,setHighlights]=useState(()=>readJSON('highlights',{}));
  const [notes,setNotes]=useState(()=>readJSON('notes',{}));
  const [doneDays,setDoneDays]=useState(()=>readJSON('doneDays',{}));
  const [fontSize,setFontSize]=useState(()=>readJSON('fontSize',19));
  const [dark,setDark]=useState(()=>readJSON('dark',false));
  const [autoPlay,setAutoPlay]=useState(false);
  const [continuous,setContinuous]=useState(false);
  const [noteDraft,setNoteDraft]=useState('');
  const [editNote,setEditNote]=useState(false);
  const [question,setQuestion]=useState(STUDY_PROMPTS[0].question);
  const [comparison,setComparison]=useState(null);
  const [compareTranslation,setCompareTranslation]=useState('kjv');
  const [compareLoading,setCompareLoading]=useState(false);
  const [aiKey,setAiKey]=useState(''); // Intentionally RAM-only, never persisted.
  const [answer,setAnswer]=useState('');
  const [aiLoading,setAiLoading]=useState(false);
  const [aiError,setAiError]=useState('');
  const [searchTerm,setSearchTerm]=useState('');
  const [searchResults,setSearchResults]=useState([]);
  const [searchProgress,setSearchProgress]=useState(0);
  const [searchLoading,setSearchLoading]=useState(false);
  const [toast,setToast]=useState('');
  const toastTimer=useRef();
  const uploadRef=useRef();
  const pendingVerse=useRef(1);

  const selectedId=makeId(book,chapter,selectedVerse);
  const selected=verses.find(v=>v.verse===selectedVerse) || verses[0];
  const selectedText=selected?.text||'';
  const highlightedVerses=useMemo(()=>verses.filter(v=>highlights[makeId(book,chapter,v.verse)]).map(v=>v.verse),[verses,highlights,book,chapter]);
  const bookmarksList=Object.entries(bookmarks).filter(([,v])=>v).map(([ref])=>({ref,parsed:parseReference(ref)})).filter(x=>x.parsed);
  const allNotes=Object.entries(notes).filter(([,text])=>text?.trim());
  const notify=message=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3000);};

  useEffect(()=>{let active=true;setLoaded(false);setLoadError('');setVerses([]);
    loadChapter(book,chapter).then(result=>{if(!active)return;setVerses(result.verses);setTranslation(result.translation);setLoaded(true);setSelectedVerse(pendingVerse.current);pendingVerse.current=1;}).catch(e=>{if(active){setLoadError(e.message);setLoaded(true);}});
    writeJSON('position',position);return()=>{active=false;};
  },[book,chapter]);
  useEffect(()=>{writeJSON('bookmarks',bookmarks);},[bookmarks]);
  useEffect(()=>{writeJSON('highlights',highlights);},[highlights]);
  useEffect(()=>{writeJSON('notes',notes);},[notes]);
  useEffect(()=>{writeJSON('doneDays',doneDays);},[doneDays]);
  useEffect(()=>{writeJSON('fontSize',fontSize);},[fontSize]);
  useEffect(()=>{writeJSON('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
  useEffect(()=>{setNoteDraft(notes[selectedId]||'');setEditNote(false);setAnswer('');setAiError('');setComparison(null);},[selectedId]);
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);

  const jump=(target,openTab='Read')=>{
    if(!target)return;
    pendingVerse.current=(target.book===book && target.chapter===chapter)?1:(target.verse||1);setAutoPlay(false);setPosition({book:target.book,chapter:target.chapter});setSelectedVerse(target.verse||1);setTab(openTab);
  };
  const moveChapter=step=>{setAutoPlay(false);setPosition(neighbor(book,chapter,step));};
  const onChapterEnded=()=>{
    if(!continuous)return;
    const next=neighbor(book,chapter,1);
    if(next.book!==book || next.chapter!==chapter){setAutoPlay(true);setPosition(next);}
  };
  const toggleBookmark=()=>{setBookmarks(prev=>({...prev,[selectedId]:!prev[selectedId]}));notify(bookmarks[selectedId]?'Bookmark removed':'Verse bookmarked');};
  const toggleHighlight=()=>{setHighlights(prev=>({...prev,[selectedId]:!prev[selectedId]}));notify(highlights[selectedId]?'Highlight removed':'Verse highlighted');};
  const saveNote=()=>{setNotes(prev=>({...prev,[selectedId]:noteDraft}));setEditNote(false);notify('Study note saved on this device');};
  const shareVerse=async()=>{
    const message=`${selectedId} — ${selectedText} (${translation})`;
    try {if(navigator.share) await navigator.share({text:message});else{await navigator.clipboard.writeText(message);notify('Copied verse');}}
    catch(e){if(e?.name!=='AbortError')notify('Unable to share');}
  };
  const study=async()=>{
    setAiError('');setAnswer('');setAiLoading(true);
    try{const passage=`${book} ${chapter}\n${verses.map(v=>`${v.verse}. ${v.text}`).join('\n')}`;setAnswer(await requestStudy({apiKey:aiKey,passage,question}));}
    catch(e){setAiError(e.message||'Unable to ask AI');}finally{setAiLoading(false);}
  };
  const compare=async()=>{
    setCompareLoading(true);setComparison(null);
    try{const ref=lesson(book,chapter,selectedVerse);const response=await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${compareTranslation}`);
      if(!response.ok)throw new Error('Comparison unavailable');const data=await response.json();setComparison({label:compareTranslation.toUpperCase(),text:data.verses?.map(v=>v.text).join(' ').trim()||data.text||'No verse returned'});}
    catch(e){setComparison({error:'Unable to fetch the comparison. Connect to the internet and try again.'});}
    finally{setCompareLoading(false);}
  };
  const doSearch=async e=>{
    e.preventDefault();setSearchResults([]);setSearchLoading(true);setSearchProgress(0);
    try {let results=await searchBible(searchTerm,setSearchProgress);setSearchResults(results);if(!results.length)notify('No matching verses found in bundled books');}
    catch(e){notify(e.message||'Search failed');}finally{setSearchLoading(false);}
  };
  const backup=()=>{
    const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ScriptureFlow-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const restore=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    try{importData(JSON.parse(await file.text()));notify('Backup restored. Reload the app to see all changes.');}
    catch(err){notify(err.message||'Backup could not be restored');}e.target.value='';
  };
  const notesSaveCount=allNotes.length;
  const completedCount=Object.values(doneDays).filter(Boolean).length;

  return <div className="app-shell">
    <header className="app-header">
      <div className="branding"><div className="brand-icon"><BookOpen size={25} strokeWidth={1.8}/></div><div><div className="wordmark">Scripture<span>Flow</span></div><div className="brand-caption">READ · LISTEN · REFLECT</div></div></div>
      <button className="top-icon" onClick={()=>setDark(v=>!v)} aria-label="Toggle dark mode">{dark?<Sun size={21}/>:<Moon size={21}/>}</button>
    </header>
    <main>
      <section className="welcome-band"><div className="eyebrow">A MOMENT IN THE WORD</div><h1>{tab==='Read'?'Scripture for today':tab==='Study'?'Go deeper in the Word':tab==='Library'?'Your personal library':tab==='Search'?'Find in Scripture':'Make it yours'}</h1><p>{tab==='Read'?'Read with intention. Listen with your heart.':tab==='Study'?'Context, reflection, and careful exploration.':tab==='Library'?'Everything you’ve saved in one peaceful place.':tab==='Search'?'Search the entire offline Bible text.':'A reading experience shaped around you.'}</p></section>
      <div className="content-wrap">
      <section style={{display:tab==='Read'?'block':'none'}} aria-hidden={tab!=='Read'}>
        <div className="section-heading"><div><div className="eyebrow">READING NOW</div><h2>{book} <span>{chapter}</span></h2></div><span className="translation-chip">{translation.includes('Updated')?'WEBU':'WEB'}</span></div>
        <div className="passage-picker">
          <label><span>BOOK</span><select value={book} onChange={e=>jump({book:e.target.value,chapter:1})}>{BOOKS.map(([name])=><option key={name}>{name}</option>)}</select></label>
          <label><span>CHAPTER</span><select value={chapter} onChange={e=>jump({book,chapter:Number(e.target.value)})}>{Array.from({length:bookCount(book)},(_,i)=><option value={i+1} key={i+1}>{i+1}</option>)}</select></label>
          <button className="round-move" onClick={()=>moveChapter(-1)} aria-label="Previous chapter"><ChevronLeft/></button>
          <button className="round-move" onClick={()=>moveChapter(1)} aria-label="Next chapter"><ChevronRight/></button>
        </div>
        {!loaded&&<div className="empty-state"><LoaderCircle className="spin"/><p>Opening your Bible…</p></div>}
        {loadError&&<div className="alert"><p>{loadError}</p><button className="small-button" onClick={()=>{setLoaded(false);loadChapter(book,chapter).then(r=>{setVerses(r.verses);setTranslation(r.translation);setLoadError('');}).catch(e=>setLoadError(e.message)).finally(()=>setLoaded(true));}}>Try again</button></div>}
        {!!verses.length&&<div className="reader-card"><div className="reader-heading"><span><Headphones size={18}/> LISTEN AS YOU READ</span><label className="toggle-line"><input type="checkbox" checked={continuous} onChange={e=>setContinuous(e.target.checked)}/> Continue chapters</label></div>
          <PassageReader reference={chapterKey(book,chapter)} verses={verses} selectedVerse={selectedVerse} onSelect={setSelectedVerse} onFinished={onChapterEnded} autoPlay={autoPlay} highlights={highlightedVerses} fontSize={fontSize}/>
        </div>}
        {!!selectedText&&<div className="selected-card"><div className="selected-top"><div className="eyebrow">YOUR SELECTED VERSE</div><strong>{selectedId}</strong></div><p className="selected-quote">“{selectedText}”</p><div className="action-row">
          <button className={`action-button ${bookmarks[selectedId]?'active':''}`} onClick={toggleBookmark}>{bookmarks[selectedId]?<BookmarkCheck size={17}/>:<Bookmark size={17}/>} {bookmarks[selectedId]?'Saved':'Save'}</button>
          <button className={`action-button ${highlights[selectedId]?'active':''}`} onClick={toggleHighlight}><Highlighter size={17}/> Highlight</button>
          <button className="action-button" onClick={()=>{setEditNote(true);setNoteDraft(notes[selectedId]||'')}}><NotebookPen size={17}/> Note</button>
          <button className="action-button" onClick={shareVerse}><Share2 size={17}/> Share</button>
        </div>
        {editNote&&<div className="note-editor"><textarea aria-label="Personal study note" value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="What stands out to you in this verse?"/><div className="inline-actions"><button className="small-button primary" onClick={saveNote}>Save note</button><button className="small-button" onClick={()=>setEditNote(false)}>Cancel</button></div></div>}
        {notes[selectedId]&&!editNote&&<p className="saved-note"><NotebookPen size={14}/> {notes[selectedId]}</p>}
        {!!CROSS_REFERENCES[selectedId]?.length&&<div className="crossrefs"><strong>Related passages</strong><div>{CROSS_REFERENCES[selectedId].map(ref=><button key={ref} onClick={()=>jump(parseReference(ref))}>{ref} <ArrowUpRight size={14}/></button>)}</div></div>}
        <button className="study-link" onClick={()=>setTab('Study')}>Explore this chapter in Study <ArrowRight size={16}/></button>
        </div>}
        <div className="section-heading below"><div><div className="eyebrow">EXPLORE</div><h2>Beloved passages</h2></div></div>
        <div className="featured-grid">{FEATURED.map(item=><button key={item.label} className="featured-card" onClick={()=>jump(item)}><span className="featured-icon"><BookOpen size={19}/></span><strong>{item.label}</strong><small>{item.book} {item.chapter} <ChevronRight size={13}/></small></button>)}</div>
      </section>

      {tab==='Study'&&<section className="study-area">
        <div className="panel"><div className="eyebrow">STUDYING {book.toUpperCase()} {chapter}</div><h2>Ask better questions</h2><p className="muted">Explore the whole chapter, its setting and its different interpretations. AI responses are aids to study, not authorities.</p>
          <div className="prompt-pills">{STUDY_PROMPTS.map(item=><button className={question===item.question?'chosen':''} key={item.label} onClick={()=>setQuestion(item.question)}>{item.label}</button>)}</div>
          <label className="field-label">YOUR QUESTION<textarea rows={4} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about this chapter..."/></label>
          {!aiKey&&<p className="notice"><Info size={16}/> To use AI analysis, add your own Gemini API key in Settings. It stays only in this app session.</p>}
          <button className="big-primary" disabled={!verses.length||aiLoading||!question.trim()} onClick={study}>{aiLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>} {aiLoading?'Exploring...':'Explore this passage'}</button>
          {aiError&&<p className="error-text">{aiError}</p>}
          {answer&&<div className="ai-answer"><div className="eyebrow">STUDY EXPLORATION</div><div className="answer-text">{answer}</div><button className="small-button" onClick={async()=>{try{await navigator.clipboard.writeText(answer);notify('Study response copied');}catch{notify('Clipboard unavailable');}}}><Copy size={14}/> Copy notes</button></div>}
        </div>
        <div className="panel"><div className="eyebrow">TRANSLATION COMPARISON</div><h2>Compare {selectedId}</h2><p className="muted">Your loaded Bible text is shown alongside an online translation fetched on demand.</p><p className="selected-quote compact">{translation.includes('Updated')?'WEBU':'WEB'}: “{selectedText}”</p><div className="inline-actions"><select value={compareTranslation} onChange={e=>setCompareTranslation(e.target.value)} aria-label="Compare translation"><option value="kjv">King James Version (KJV)</option><option value="asv">American Standard Version (ASV)</option><option value="web">World English Bible (WEB)</option></select><button className="small-button primary" onClick={compare} disabled={compareLoading}>{compareLoading?'Loading...':'Compare verse'}</button></div>{comparison&&<p className={comparison.error?'error-text':'selected-quote compact'}>{comparison.error||`${comparison.label}: “${comparison.text}”`}</p>}</div>
        <div className="panel"><div className="eyebrow">PERSONAL JOURNAL</div><h2>Reflect on {selectedId}</h2><p className="selected-quote compact">“{selectedText||'Choose a verse in Reader to begin.'}”</p><textarea rows={5} value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="Your insights, questions, prayers, or observations..."/><button className="small-button primary" onClick={saveNote}><NotebookPen size={16}/> Save my reflection</button></div>
        <div className="panel"><div className="eyebrow">BIBLE READING PLAN</div><h2>30 days in the Word</h2><p className="muted">The Gospel of John followed by selected Psalms.</p><div className="progress-track"><div style={{width:`${Math.round(completedCount/READING_PLAN.length*100)}%`}}/></div><p className="progress-label">{completedCount} of {READING_PLAN.length} days completed</p>
          <div className="plan-list">{READING_PLAN.map((item,i)=><div key={i} className="plan-item"><button className="check-plan" onClick={()=>setDoneDays(p=>({...p,[i]:!p[i]}))} aria-label={`Mark day ${i+1} complete`}>{doneDays[i]?<CheckCircle2 size={21} className="success"/>:<Circle size={21}/>}</button><button className="plan-jump" onClick={()=>jump(item)}><span>DAY {i+1}</span><strong>{item.book} {item.chapter}</strong><ChevronRight size={16}/></button></div>)}</div>
        </div>
      </section>}

      {tab==='Library'&&<section><div className="stats-grid"><div className="stat-card"><BookmarkCheck/><strong>{bookmarksList.length}</strong><small>Saved verses</small></div><div className="stat-card"><Highlighter/><strong>{Object.values(highlights).filter(Boolean).length}</strong><small>Highlights</small></div><div className="stat-card"><NotebookPen/><strong>{notesSaveCount}</strong><small>Study notes</small></div></div>
        <div className="panel"><div className="section-heading"><h2>Your bookmarks</h2></div>{bookmarksList.length?bookmarksList.map(item=><button className="saved-list-item" key={item.ref} onClick={()=>jump(item.parsed)}><BookmarkCheck size={18}/><span>{item.ref}</span><ArrowRight size={16}/></button>):<p className="muted">No bookmarks yet. Select a verse in Reader and tap Save.</p>}</div>
        <div className="panel"><h2>Study journal</h2>{allNotes.length?allNotes.map(([ref,note])=><button className="journal-item" key={ref} onClick={()=>jump(parseReference(ref))}><strong>{ref}</strong><p>{note}</p></button>):<p className="muted">Your personal notes will appear here.</p>}</div>
      </section>}

      {tab==='Search'&&<section><div className="panel"><h2>Search Scripture</h2><p className="muted">Search every book in the bundled public-domain Bible. Enter at least three characters.</p><form className="search-form" onSubmit={doSearch}><input type="search" aria-label="Search Bible" placeholder="e.g. be still, fear not, love" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/><button disabled={searchLoading||searchTerm.trim().length<3} aria-label="Search"><Search size={21}/></button></form>
          {searchLoading&&<p className="muted"><LoaderCircle className="spin" size={15}/> Searching… {searchProgress}%</p>}
          {!!searchResults.length&&<p className="muted">{searchResults.length>=150?'First 150':'Found '+searchResults.length} matching verses</p>}
          <div className="results-list">{searchResults.map((r,i)=><button key={i} className="result-item" onClick={()=>jump(r)}><strong>{lesson(r.book,r.chapter,r.verse)}</strong><p>{r.text}</p><ArrowUpRight size={16}/></button>)}</div>
          {!searchLoading&&!searchResults.length&&searchProgress>0&&<p className="muted">No results. Try a different phrase. Online-only preview builds cannot search unbundled chapters.</p>}
        </div></section>}

      {tab==='Settings'&&<section className="settings-area">
        <div className="panel"><div className="eyebrow">READING COMFORT</div><h2>Appearance</h2><div className="setting-row"><div><strong>Dark reading mode</strong><p>Gentler colours for evening reading</p></div><label className="switch"><input type="checkbox" checked={dark} onChange={e=>setDark(e.target.checked)}/><span/></label></div><div className="setting-row"><div><strong>Scripture text size</strong><p>{fontSize}px</p></div><input type="range" aria-label="Scripture font size" min="16" max="27" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></div></div>
        <div className="panel"><div className="eyebrow">OPTIONAL AI</div><h2>Connect your AI assistant</h2><p className="muted">Use your own Gemini API key for Bible exploration. The key is held in memory only; it is not saved or included in your backups. Requests go directly to Google's API, so only use a key intended for personal device use.</p><label className="field-label">GEMINI API KEY<input type="password" autoComplete="off" placeholder="Paste Gemini API key" value={aiKey} onChange={e=>setAiKey(e.target.value)}/></label><div className="inline-actions"><button className="small-button" onClick={()=>{setAiKey('');notify('API key cleared from this session');}}>Clear key</button>{aiKey&&<span className="success-text"><CheckCircle2 size={14}/> Ready for study</span>}</div></div>
        <div className="panel"><div className="eyebrow">YOUR DATA</div><h2>Backup & restore</h2><p className="muted">Bookmarks, reading plans and notes are stored locally on this device. Export a backup before uninstalling or changing phones.</p><div className="inline-actions"><button className="small-button primary" onClick={backup}><Download size={16}/> Export backup</button><button className="small-button" onClick={()=>uploadRef.current?.click()}><Upload size={16}/> Import backup</button><input ref={uploadRef} hidden type="file" accept="application/json,.json" onChange={restore}/></div></div>
        <div className="panel"><div className="eyebrow">ABOUT</div><h2>ScriptureFlow 1.0</h2><p className="muted">An offline-first reading and personal study companion, based on the original PassageReader.jsx. Full offline text: World English Bible Updated (WEBU), public domain, maintained by eBible.org. Browser fallback: World English Bible (WEB) from bible-api.com.</p><p className="muted">Audio uses device text-to-speech. Installed offline voices are required for speech without internet; background playback while the screen is locked varies by Android device and is not guaranteed in this release.</p><p className="muted">AI study requires internet and a key. Responses can contain errors: check interpretations against the passage and reliable sources.</p></div>
      </section>}
      </div>
    </main>
    <nav className="bottom-nav" aria-label="Primary navigation">{TABS.map(([name,Icon])=><button key={name} onClick={()=>setTab(name)} className={tab===name?'current':''} aria-current={tab===name?'page':undefined}><Icon size={21} strokeWidth={tab===name?2.5:1.8}/><span>{name}</span></button>)}</nav>
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}
