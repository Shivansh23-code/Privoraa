import { useEffect, useRef } from 'react';
import LiveDemo from './LiveDemo';

const GLYPHS = 'ABCDEF0123456789▚▞▙▟';
const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
function cipherOf(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.random() < 0.12 ? ' ' : glyph();
  return s;
}

export default function Hero() {
  const scrambleRef = useRef(null);

  useEffect(() => {
    const el = scrambleRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduced) return undefined;
    const target = el.getAttribute('data-text');
    let frame = 0;
    const total = 26;
    el.textContent = cipherOf(target.length);
    const t = setInterval(() => {
      frame++;
      const resolved = Math.floor((frame / total) * target.length);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        out += i < resolved || target[i] === ' ' ? target[i] : glyph();
      }
      el.textContent = out;
      if (frame >= total) {
        el.textContent = target;
        clearInterval(t);
      }
    }, 42);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <span className="pill">
              <span className="pulse"></span> Offline-first · Early access open
            </span>
            <h1>
              <span className="sr-only">Your AI companion. Nobody else's.</span>
              <span aria-hidden="true" id="scramble" ref={scrambleRef} data-text="Your AI companion.">
                Your AI companion.
              </span>
              <br />
              <span className="keep" aria-hidden="true">
                Nobody else's.
              </span>
            </h1>
            <p className="lead">
              Privoraa helps you <strong>focus, remember, and feel safe</strong> — an AI that runs on{' '}
              <strong>your device</strong>, keeps memory in a vault <strong>only you can open</strong>,
              and works the same with the Wi-Fi off.
            </p>
            <div className="hero-cta">
              <a href="#demo" className="btn btn-p">
                Try the live demo
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href="#how" className="btn btn-g">
                How it stays private
              </a>
            </div>
            <div className="microproof">
              <span>
                <b>0 B</b> SENT TO CLOUD
              </span>
              <span>
                <b>100%</b> ON-DEVICE
              </span>
              <span>
                <b>AES-256</b> SEALED VAULT
              </span>
            </div>
          </div>

          <LiveDemo />
        </div>
      </div>
    </section>
  );
}
