import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEF0123456789▚▞▙▟';
const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
function cipherOf(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.random() < 0.12 ? ' ' : glyph();
  return s;
}

const REPLIES = [
  {
    match: /remind|remember|save|note|don'?t forget/i,
    text: "Done — saved to your vault. I'll surface it when it matters. Nothing was uploaded; this lives only here.",
  },
  {
    match: /plan|focus|today|work|study|exam/i,
    text: "Here's a calm plan: 25 minutes of deep work, a 10-minute reply sweep, then a real break. No feeds, no pings — I'll hold the line.",
  },
  {
    match: /private|privacy|offline|data|cloud|secure/i,
    text: 'Everything — model, memory, vault — lives on this device. Airplane mode changes nothing. What leaves your device: 0 bytes.',
  },
  {
    match: /./,
    text: 'Happy to help with that. I run right here on your device, so think out loud freely — this conversation never touches a server.',
  },
];

const INTRO =
  "Hi — I'm Privoraa. Everything you say here stays on this device. Try asking me to remember something, or to plan your day.";

export default function LiveDemo() {
  const [messages, setMessages] = useState([{ id: 0, who: 'ai', text: INTRO, sealed: false, cipher: null }]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vaultN, setVaultN] = useState(0);
  const [value, setValue] = useState('');

  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(1);
  const timersRef = useRef(new Set());
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => {
        clearInterval(t);
        clearTimeout(t);
      });
      timers.clear();
    };
  }, []);

  // auto-scroll the message list on every content change
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const addTimeout = (fn, ms) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
    return t;
  };

  const addInterval = (fn, ms) => {
    const t = setInterval(fn, ms);
    timersRef.current.add(t);
    return t;
  };

  const clearTimer = (t) => {
    clearInterval(t);
    clearTimeout(t);
    timersRef.current.delete(t);
  };

  const updateMsg = (id, patch) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  function typeInto(id, text, done) {
    if (reducedRef.current) {
      updateMsg(id, { text });
      done();
      return;
    }
    let i = 0;
    const t = addInterval(() => {
      i += 2;
      updateMsg(id, { text: text.slice(0, i) });
      if (i >= text.length) {
        clearTimer(t);
        updateMsg(id, { text });
        done();
      }
    }, 22);
  }

  function seal(id, plain, done) {
    const finish = () => {
      updateMsg(id, { sealed: true, cipher: cipherOf(Math.min(plain.length, 64)) });
      if (done) done();
    };
    if (reducedRef.current) {
      finish();
      return;
    }
    let f = 0;
    const total = 10;
    const t = addInterval(() => {
      f++;
      const corrupt = Math.floor((f / total) * plain.length);
      let out = '';
      for (let i = 0; i < plain.length; i++) {
        out += i < corrupt && plain[i] !== ' ' ? glyph() : plain[i];
      }
      updateMsg(id, { text: out });
      if (f >= total) {
        clearTimer(t);
        finish();
      }
    }, 46);
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (busy) return;
    const val = value.trim();
    if (!val) return;
    setBusy(true);
    setValue('');

    const mineId = nextId.current++;
    setMessages((ms) => [...ms, { id: mineId, who: 'me', text: val, sealed: false, cipher: null }]);
    setTyping(true);

    let reply = '';
    for (let r = 0; r < REPLIES.length; r++) {
      if (REPLIES[r].match.test(val)) {
        reply = REPLIES[r].text;
        break;
      }
    }

    addTimeout(() => {
      setTyping(false);
      const aiId = nextId.current++;
      setMessages((ms) => [...ms, { id: aiId, who: 'ai', text: '', sealed: false, cipher: null }]);
      typeInto(aiId, reply, () => {
        addTimeout(() => {
          seal(mineId, val, null);
          seal(aiId, reply, () => {
            setVaultN((n) => n + 1);
            setBusy(false);
            if (inputRef.current) inputRef.current.focus();
          });
        }, 900);
      });
    }, 700);
  }

  return (
    <div className="demo" id="demo" aria-label="Privoraa interactive demo">
      <div className="demo-bar">
        <span className="mark">
          <svg aria-hidden="true">
            <use href="#i-lock" />
          </svg>
        </span>
        <span className="demo-name">Privoraa</span>
        <span className="demo-status">
          <span className="pulse"></span> LOCAL SESSION
        </span>
      </div>
      <div className="demo-msgs" id="demoMsgs" ref={msgsRef} aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.who}`}>
            {m.sealed ? (
              <>
                <span className="cipher-text">{m.cipher}</span>
                <br />
                <span className="sealchip">
                  <svg aria-hidden="true">
                    <use href="#i-lock" />
                  </svg>
                  SEALED · VAULT
                </span>
              </>
            ) : (
              m.text
            )}
          </div>
        ))}
        {typing && (
          <div className="msg ai">
            <span className="typing">
              <i></i>
              <i></i>
              <i></i>
            </span>
          </div>
        )}
      </div>
      <form className="demo-input" id="demoForm" onSubmit={handleSubmit}>
        <input
          id="demoIn"
          ref={inputRef}
          type="text"
          maxLength={160}
          placeholder="Ask anything — it stays here."
          autoComplete="off"
          aria-label="Message Privoraa demo"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="demo-send" id="demoSend" type="submit" aria-label="Send message" disabled={busy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
      <div className="demo-foot">
        <span>
          VAULT ENTRIES: <b id="vCount">{vaultN}</b>
        </span>
        <span>
          SENT TO CLOUD: <b>0 B</b>
        </span>
      </div>
    </div>
  );
}
