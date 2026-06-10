import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section className="cta-band" id="start" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cta-card reveal">
          <h2>Ready when you are.</h2>
          <p>
            Privacy shouldn't be a setting you hunt for. Start with it — and let the AI earn its
            place in your life, not in your data.
          </p>
          <div className="cta-actions">
            <Link to="/signup" className="btn btn-p">
              Get early access
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <a href="#how" className="btn btn-g">
              Read how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
