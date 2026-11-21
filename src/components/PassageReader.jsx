import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Play, Pause, Square, SkipForward, Volume2 } from 'lucide-react';

/**
 * Extends the user's original PassageReader.jsx:
 *  - keeps one-verse-at-a-time sequencing, run-id cancellation, highlighting,
 *    variable speed, voice selection and tap-to-play
 *  - uses Android's native TTS plugin on devices, Web Speech in browsers
 *  - receives the Bible text from the app's offline/online data layer
 */
const native = Capacitor.isNativePlatform();
const webSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const speechAvailable = native || webSupported;

async function stopEngine() {
  try { if(native) await TextToSpeech.stop(); else if(webSupported) window.speechSynthesis.cancel(); }
  catch { /* best effort */ }
}
function speakWeb(text, rate,voice) {
  return new Promise((resolve,reject)=>{
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate=rate;
    utterance.lang=voice?.lang || 'en-US';
    if(voice) utterance.voice=voice;
    utterance.onend=resolve;
    utterance.onerror=e=> e.error==='canceled'||e.error==='interrupted'? resolve():reject(new Error('Speech unavailable'));
    window.speechSynthesis.speak(utterance);
  });
}
export default function PassageReader({reference,verses=[],selectedVerse,onSelect,onFinished,autoPlay=false,highlights=[],fontSize=19}) {
  const [status,setStatus]=useState('idle');
  const [current,setCurrent]=useState(0);
  const [voices,setVoices]=useState([]);
  const [voiceId,setVoiceId]=useState('');
  const [rate,setRate]=useState(0.95);
  const [error,setError]=useState('');
  const runId=useRef(0);
  const stateRef=useRef({verses,rate,voices,voiceId});
  const finishedRef=useRef(onFinished);
  stateRef.current={verses,rate,voices,voiceId};
  finishedRef.current=onFinished;

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      if(native) {
        try { const result=await TextToSpeech.getSupportedVoices();
          if(alive) setVoices((result.voices||[]).map((v,i)=>({...v,id:String(i),index:i})).filter(v=>v.lang?.toLowerCase().startsWith('en')));
        } catch { if(alive) setVoices([]); }
      } else if(webSupported) {
        const en=window.speechSynthesis.getVoices().filter(v=>v.lang?.toLowerCase().startsWith('en'));
        if(alive) setVoices(en.map(v=>({...v,id:v.voiceURI})))
      }
    };
    load();
    if(webSupported&&!native) window.speechSynthesis.addEventListener('voiceschanged',load);
    return ()=>{alive=false; if(webSupported&&!native)window.speechSynthesis.removeEventListener('voiceschanged',load);};
  },[]);
  useEffect(()=>()=>{runId.current++;stopEngine();},[]);

  const playFrom=useCallback(async(index=0)=>{
    const list=stateRef.current.verses;
    if(!list.length||!speechAvailable) return;
    const id=++runId.current;
    await stopEngine();
    if(id!==runId.current)return;
    setStatus('playing'); setError('');
    for(let i=index;i<list.length;i++) {
      if(id!==runId.current)return;
      setCurrent(i);
      const {rate,voices,voiceId}=stateRef.current;
      const voice=voices.find(v=>v.id===voiceId);
      try {
        if(native) await TextToSpeech.speak({text:list[i].text,lang:voice?.lang || 'en-US',rate,pitch:1,volume:1,...(voice?{voice:voice.index}:{})});
        else await speakWeb(list[i].text,rate,voice);
      }catch(e){ if(id===runId.current){setError(e.message||'Could not play audio');setStatus('idle');}return; }
    }
    if(id===runId.current){setStatus('idle');setCurrent(0);finishedRef.current?.();}
  },[]);
  const pause=useCallback(async()=>{runId.current++;await stopEngine();setStatus('paused');},[]);
  const stop=useCallback(async()=>{runId.current++;await stopEngine();setStatus('idle');setCurrent(0);},[]);

  useEffect(()=>{
    runId.current++;
    stopEngine();
    setCurrent(0);setStatus('idle');
    if(autoPlay&&verses.length) {
      // Run on the next microtask after refs have been updated.
      Promise.resolve().then(()=>playFrom(0));
    }
  },[reference,verses,autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="reader-body">
    <div className="audio-dock" aria-label="Bible audio controls">
      <div className="audio-main">
        <button className="play-btn" onClick={()=>status==='playing'?pause():playFrom(status==='paused'?current:Math.max(0,verses.findIndex(v=>v.verse===selectedVerse)))} disabled={!verses.length||!speechAvailable}>
          {status==='playing'?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}
          {status==='playing'?'Pause':status==='paused'?'Resume':'Listen'}
        </button>
        <button className="square-icon" onClick={stop} disabled={status==='idle'} aria-label="Stop audio"><Square size={19}/></button>
        <button className="square-icon" onClick={()=>playFrom(Math.min(current+1,verses.length-1))} disabled={!verses.length} aria-label="Next verse"><SkipForward size={19}/></button>
        <div className="playback-state"><Volume2 size={15}/>{status==='playing'?`Verse ${verses[current]?.verse||1}`:'Audio Bible'}</div>
      </div>
      <div className="audio-options">
        <label>Voice <select value={voiceId} onChange={e=>setVoiceId(e.target.value)}><option value="">System default</option>{voices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Speed <span>{rate.toFixed(2)}×</span><input type="range" min="0.65" max="1.5" step="0.05" value={rate} onChange={e=>setRate(Number(e.target.value))}/></label>
      </div>
      {error&&<p className="error-text">{error}</p>}
      {!speechAvailable&&<p className="error-text">This browser does not support speech synthesis.</p>}
    </div>
    <div className="scripture-text" style={{'--reader-font':`${fontSize}px`}}>
      {verses.map((v,i)=><button type="button" key={`${reference}-${v.verse}`} className={`scripture-verse ${status!=='idle'&&i===current?'speaking':''} ${v.verse===selectedVerse?'selected':''} ${highlights.includes(v.verse)?'highlighted':''}`} onClick={()=>onSelect?.(v.verse)} onDoubleClick={()=>playFrom(i)} aria-label={`Select verse ${v.verse}`}>
        <sup>{v.verse}</sup>{v.text}
      </button>)}
    </div>
    {!!verses.length&&<p className="reader-hint">Tap a verse to study or save it. Double-tap to listen from that verse.</p>}
  </section>;
}
