import { useCallback, useEffect, useRef, useState } from "react";

/**
 * PassageReader — reads a Bible passage aloud using the browser's built-in
 * Web Speech API (no backend, no API key).
 *
 * Text comes from bible-api.com in the World English Bible (public domain).
 * Verses are spoken one utterance at a time, which avoids the cut-off bug on
 * long utterances in Chrome and lets us highlight the verse being read.
 *
 * Props (all optional):
 *   reference  – passage to load, default "1 Peter 1:13-25"
 *   verses     – pass your own [{ verse, text }] to skip the fetch
 */

const styles = `
.pr { --ink:#1f2a2e; --paper:#f7f5f0; --muted:#6b767a; --line:#d9d5ca; --accent:#2f5d62; --hl:#e3ecea;
  max-width:640px; margin:0 auto; padding:20px 16px 40px; color:var(--ink); background:var(--paper);
  font-family:Georgia,"Iowan Old Style","Times New Roman",serif; line-height:1.65; box-sizing:border-box; }
.pr *, .pr *::before, .pr *::after { box-sizing:inherit; }
.pr h2 { font-size:1.35rem; font-weight:600; margin:0 0 2px; }
.pr .sub { color:var(--muted); font-size:.9rem; margin:0 0 16px; font-family:system-ui,sans-serif; }
.pr .bar { position:sticky; top:0; z-index:2; background:var(--paper); padding:10px 0 12px; border-bottom:1px solid var(--line);
  display:flex; flex-wrap:wrap; gap:10px; align-items:center; font-family:system-ui,sans-serif; }
.pr button { font:inherit; font-size:.95rem; min-height:44px; padding:0 18px; border-radius:10px; border:1px solid var(--accent);
  background:var(--accent); color:#fff; cursor:pointer; }
.pr button.ghost { background:transparent; color:var(--accent); }
.pr button:disabled { opacity:.45; cursor:default; }
.pr button:focus-visible, .pr select:focus-visible, .pr input:focus-visible { outline:3px solid #8fb7bb; outline-offset:2px; }
.pr .opts { display:flex; flex-wrap:wrap; gap:12px; width:100%; font-size:.85rem; color:var(--muted); }
.pr label { display:flex; flex-direction:column; gap:2px; flex:1 1 140px; }
.pr select { min-height:40px; font:inherit; font-size:.9rem; padding:0 8px; border-radius:8px; border:1px solid var(--line); background:#fff; color:var(--ink); }
.pr input[type=range] { width:100%; min-height:40px; accent-color:var(--accent); }
.pr .text { margin-top:16px; font-size:1.08rem; }
.pr .v { display:block; width:100%; text-align:left; padding:8px 10px; margin:0 -10px; border-radius:8px; border:0;
  background:transparent; color:inherit; font:inherit; min-height:0; cursor:pointer; }
.pr .v.on { background:var(--hl); }
.pr .v sup { color:var(--accent); font-family:system-ui,sans-serif; font-size:.7em; margin-right:5px; font-weight:600; }
.pr .note { color:var(--muted); font-size:.85rem; font-family:system-ui,sans-serif; margin-top:20px; }
.pr .err { color:#8a2b1f; font-family:system-ui,sans-serif; margin-top:16px; }
`;

export default function PassageReader({
  reference = "1 Peter 1:13-25",
  verses: versesProp,
}) {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [verses, setVerses] = useState(versesProp || []);
  const [loading, setLoading] = useState(!versesProp);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | playing | paused
  const [current, setCurrent] = useState(0);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(0.95);

  const runId = useRef(0); // invalidates stale onend callbacks after cancel
  const rateRef = useRef(rate);
  const voiceRef = useRef(null);
  const versesRef = useRef(verses);
  rateRef.current = rate;
  versesRef.current = verses;

  // Load the passage (World English Bible, public domain).
  useEffect(() => {
    if (versesProp) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=web`
    )
      .then((r) => {
        if (!r.ok) throw new Error("Passage not found");
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        setVerses(
          data.verses.map((v) => ({
            verse: v.verse,
            text: v.text.replace(/\s+/g, " ").trim(),
          }))
        );
      })
      .catch(() => alive && setError("Couldn't load the passage. Check your connection and try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reference, versesProp]);

  // Load available English voices (they arrive asynchronously in most browsers).
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const en = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith("en"));
      setVoices(en);
      setVoiceURI((prev) => prev || (en[0] && en[0].voiceURI) || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  useEffect(() => {
    voiceRef.current = voices.find((v) => v.voiceURI === voiceURI) || null;
  }, [voices, voiceURI]);

  // Stop speaking when the component unmounts.
  useEffect(() => {
    return () => {
      runId.current += 1;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speakFrom = useCallback(
    (index) => {
      if (!supported) return;
      const list = versesRef.current;
      if (!list.length) return;

      window.speechSynthesis.cancel();
      const myRun = ++runId.current;

      const next = (i) => {
        if (myRun !== runId.current) return;
        if (i >= list.length) {
          setStatus("idle");
          setCurrent(0);
          return;
        }
        setCurrent(i);
        const u = new SpeechSynthesisUtterance(list[i].text);
        u.rate = rateRef.current;
        if (voiceRef.current) {
          u.voice = voiceRef.current;
          u.lang = voiceRef.current.lang;
        } else {
          u.lang = "en-US";
        }
        u.onend = () => next(i + 1);
        u.onerror = (e) => {
          // "canceled"/"interrupted" are expected when we stop or jump.
          if (e.error === "canceled" || e.error === "interrupted") return;
          if (myRun === runId.current) setStatus("idle");
        };
        window.speechSynthesis.speak(u);
      };

      setStatus("playing");
      next(index);
    },
    [supported]
  );

  // Pause = stop and remember the verse; resume restarts that verse.
  // (speechSynthesis.pause() is unreliable on Android and some desktop builds.)
  const pause = () => {
    runId.current += 1;
    window.speechSynthesis.cancel();
    setStatus("paused");
  };

  const stop = () => {
    runId.current += 1;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setCurrent(0);
  };

  const onPrimary = () => {
    if (status === "playing") pause();
    else speakFrom(status === "paused" ? current : 0);
  };

  const label =
    status === "playing" ? "Pause" : status === "paused" ? "Resume" : "Listen";

  return (
    <div className="pr">
      <style>{styles}</style>

      <h2>{reference}</h2>
      <p className="sub">World English Bible</p>

      {!supported && (
        <p className="err">
          This browser doesn't support speech synthesis. Try Chrome, Edge, or Safari.
        </p>
      )}

      <div className="bar">
        <button
          onClick={onPrimary}
          disabled={!supported || loading || !verses.length}
        >
          {label}
        </button>
        <button
          className="ghost"
          onClick={stop}
          disabled={status === "idle"}
        >
          Stop
        </button>

        <div className="opts">
          <label>
            Voice
            <select
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              disabled={!voices.length}
            >
              {voices.length === 0 && <option>Default</option>}
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label>
            Speed {rate.toFixed(2)}×
            <input
              type="range"
              min="0.6"
              max="1.4"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </div>

      {loading && <p className="note">Loading passage…</p>}
      {error && <p className="err">{error}</p>}

      <div className="text">
        {verses.map((v, i) => (
          <button
            key={v.verse}
            className={`v${status !== "idle" && i === current ? " on" : ""}`}
            onClick={() => speakFrom(i)}
            disabled={!supported}
            aria-label={`Read from verse ${v.verse}`}
          >
            <sup>{v.verse}</sup>
            {v.text}
          </button>
        ))}
      </div>

      {verses.length > 0 && (
        <p className="note">Tap any verse to start reading from there.</p>
      )}
    </div>
  );
}
