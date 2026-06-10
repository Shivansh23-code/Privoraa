import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
      <div className="nav-in">
        <Link to="/" className="brand">
          <span className="mark">
            <svg aria-hidden="true">
              <use href="#i-lock" />
            </svg>
          </span>
          Privoraa
        </Link>
        <nav className={`nav-links${open ? ' open' : ''}`} id="navLinks" aria-label="Main">
          <a href="#promises" onClick={closeMenu}>Features</a>
          <a href="#how" onClick={closeMenu}>How it works</a>
          <a href="#vault" onClick={closeMenu}>Vault</a>
          <a href="#faq" onClick={closeMenu}>FAQ</a>
          <Link to="/app" className="nav-cta" onClick={closeMenu}>
            Launch app
          </Link>
        </nav>
        <button
          className={`burger${open ? ' x' : ''}`}
          id="burger"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
