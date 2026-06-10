import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <a href="#top" className="brand">
              <span className="mark">
                <svg aria-hidden="true">
                  <use href="#i-lock" />
                </svg>
              </span>
              Privoraa
            </a>
            <p>
              Your private AI companion — built to help you focus, remember, and feel safe. Even
              offline.
            </p>
            <div className="foot-soc">
              <a href="#" aria-label="Privoraa on X">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.7 3H21l-7.3 8.3L22.2 21h-6.7l-5.3-6.4L4.2 21H1l7.8-8.9L1.8 3h6.9l4.8 5.8L17.7 3zm-1.2 16h1.9L7.2 4.9H5.2L16.5 19z" />
                </svg>
              </a>
              <a href="#" aria-label="Privoraa on LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.3 18.3V10H5.7v8.3h2.6zM7 8.8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11.3 9.5v-4.6c0-2.4-1.3-3.6-3-3.6a2.6 2.6 0 0 0-2.4 1.3v-1.1h-2.6v8.3h2.6v-4.4c0-1.2.2-2.3 1.7-2.3s1.5 1.3 1.5 2.4v4.3h2.6z" />
                </svg>
              </a>
              <a
                href="https://github.com/Shivansh23-code/Privoraa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Privoraa on GitHub"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.8v2.6c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            <a href="#promises">Features</a>
            <a href="#how">How it works</a>
            <a href="#vault">The vault</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            <a href="#">About</a>
            <Link to="/app">Launch app</Link>
            <a href="#">Contact</a>
          </div>
          <div className="foot-col">
            <h4>Legal</h4>
            <a href="#">Privacy policy</a>
            <a href="#">Terms of service</a>
          </div>
        </div>
        <div className="foot-base">
          <span>
            © <span id="yr">{new Date().getFullYear()}</span> Privoraa. Sealed with care.
          </span>
          <span>WHAT LEAVES YOUR DEVICE: NOTHING</span>
        </div>
      </div>
    </footer>
  );
}
