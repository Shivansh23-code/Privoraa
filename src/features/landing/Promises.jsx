export default function Promises() {
  return (
    <section id="promises">
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">What Privoraa is for</span>
          <h2 className="t">Built on three promises.</h2>
          <p className="sub">
            Not thirty features — three things done properly. Everything in Privoraa exists to help
            you focus, remember, and feel safe.
          </p>
        </div>
        <div className="cards3">
          <div className="card reveal">
            <span className="glyph g-violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4.5" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </span>
            <div className="tagline">Promise 01</div>
            <h3>Focus</h3>
            <p>
              A quiet co-pilot for plans, drafts, and summaries.{' '}
              <b>No feeds, no streaks, no notifications fishing for attention</b> — because you're
              not the product, you're the owner.
            </p>
          </div>
          <div className="card reveal">
            <span className="glyph g-teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a7 7 0 0 1 7 7c0 2.4-1.2 4-2.5 5.4-.9 1-1.5 1.8-1.5 3.1h-6c0-1.3-.6-2.1-1.5-3.1C6.2 14 5 12.4 5 10a7 7 0 0 1 7-7z" />
                <path d="M9.5 21.5h5" />
              </svg>
            </span>
            <div className="tagline">Promise 02</div>
            <h3>Remember</h3>
            <p>
              A private, searchable memory of what you tell it — names, dates, the little things.{' '}
              <b>Stored in an encrypted vault on your device.</b> Export or erase any time; deletion
              is real.
            </p>
          </div>
          <div className="card reveal">
            <span className="glyph g-mix">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2.5 20 6v5.5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3.5z" />
                <path d="M8.8 12.2l2.2 2.2 4.4-4.6" />
              </svg>
            </span>
            <div className="tagline">Promise 03</div>
            <h3>Feel safe</h3>
            <p>
              Conversations are <b>sealed at rest with keys only you hold</b>. Offline-first by
              design: airplane mode is just another Tuesday, and "we can't read it" is an
              architecture, not a pinky-swear.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
