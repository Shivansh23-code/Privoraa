import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEF0123456789▚▞▙▟';
const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
function cipherOf(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.random() < 0.12 ? ' ' : glyph();
  return s;
}

const ENTRIES = [
  { plain: "Gym with Arjun — Thursdays at 7, he's bringing the pads.", date: 'JUN 02' },
  { plain: 'Passport renewal — the slot window opens 12 Aug, set aside ₹3,500.', date: 'MAY 28' },
  { plain: "Mum's tea: less sugar, more ginger. She pretends not to notice. She notices.", date: 'MAY 19' },
  { plain: "Project Falcon retro — what worked: smaller PRs. What didn't: Friday deploys.", date: 'MAY 11' },
];

function VRow({ plain, date, index }) {
  const [sealed] = useState(() => cipherOf(Math.min(plain.length, 54)));
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(sealed);
  const animRef = useRef(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => clearInterval(animRef.current);
  }, []);

  function toPlain() {
    setOpen(true);
    if (reducedRef.current) {
      setText(plain);
      return;
    }
    let f = 0;
    const total = 12;
    clearInterval(animRef.current);
    animRef.current = setInterval(() => {
      f++;
      const res = Math.floor((f / total) * plain.length);
      let out = '';
      for (let i = 0; i < plain.length; i++) {
        out += i < res || plain[i] === ' ' ? plain[i] : glyph();
      }
      setText(out);
      if (f >= total) {
        setText(plain);
        clearInterval(animRef.current);
      }
    }, 28);
  }

  function toSealed() {
    setOpen(false);
    clearInterval(animRef.current);
    setText(sealed);
  }

  return (
    <button
      className={`vrow${open ? ' open' : ''}`}
      type="button"
      data-plain={plain}
      aria-label={`Unseal memory entry ${index + 1}`}
      onMouseEnter={toPlain}
      onMouseLeave={toSealed}
      onFocus={toPlain}
      onBlur={toSealed}
      onClick={() => (open ? toSealed() : toPlain())}
    >
      <span className="lockico">
        <svg aria-hidden="true">
          <use href="#i-lock" />
        </svg>
      </span>
      <span className="vtxt">{text}</span>
      <span className="vdate">{date}</span>
    </button>
  );
}

export default function Vault() {
  return (
    <section id="vault">
      <div className="wrap">
        <div className="vault-grid">
          <div className="vault-copy reveal">
            <span className="eyebrow">The vault</span>
            <h2 className="t">Your memory, under your key.</h2>
            <p>
              Everything Privoraa remembers for you lives in a vault on your device —{' '}
              <b>sealed at rest, readable only when you're the one asking.</b>
            </p>
            <p>
              No silent syncing. No "anonymized" analytics. If you delete a memory, it isn't
              soft-deleted to a server farm in another hemisphere — <b>it's gone.</b>
            </p>
            <span className="vault-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" />
              </svg>
              Hover or tap an entry to unseal it
            </span>
          </div>
          <div className="vault-box reveal">
            <div className="vault-head">
              <svg aria-hidden="true">
                <use href="#i-lock" />
              </svg>
              Memory vault
              <span className="k">KEY: LOCAL · YOU</span>
            </div>
            <div className="vault-list" id="vaultList">
              {ENTRIES.map((e, i) => (
                <VRow key={e.date} plain={e.plain} date={e.date} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
