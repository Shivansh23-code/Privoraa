export default function HowItWorks() {
  return (
    <section className="how" id="how">
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">How it works</span>
          <h2 className="t">Three steps. Zero round-trips.</h2>
          <p className="sub">
            Most assistants send your words to a data center and back. Privoraa's loop starts and
            ends in your hands.
          </p>
        </div>
        <div className="steps">
          <div className="step reveal">
            <div className="no">STEP / 01</div>
            <h3>You ask</h3>
            <p>
              Type or talk, with or without a connection. Drafting at 11 km over the Atlantic works
              exactly like your desk.
            </p>
          </div>
          <div className="step reveal">
            <div className="no">STEP / 02</div>
            <h3>It thinks here</h3>
            <p>
              The model runs on your device. Your prompt never traverses the internet, so there's
              nothing out there to leak, subpoena, or train on.
            </p>
          </div>
          <div className="step reveal">
            <div className="no">STEP / 03</div>
            <h3>It seals</h3>
            <p>
              Anything worth remembering is encrypted into your local vault. You hold the key —
              Privoraa just holds the door.
            </p>
          </div>
        </div>
        <div className="flow reveal" aria-label="Data flow diagram: device to model to vault, nothing to cloud">
          <div className="flow-line">
            <span className="node">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
                <path d="M10.5 18.5h3" />
              </svg>
              your device
            </span>
            <span className="arrow">→</span>
            <span className="node">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4a4 4 0 0 1 4 4v1a3.5 3.5 0 0 1 2 6.3V16a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-.7A3.5 3.5 0 0 1 8 9V8a4 4 0 0 1 4-4z" />
              </svg>
              on-device model
            </span>
            <span className="arrow">→</span>
            <span className="node">
              <svg aria-hidden="true">
                <use href="#i-lock" />
              </svg>
              encrypted vault
            </span>
            <span className="arrow" aria-hidden="true">
              ✕
            </span>
            <span className="node cloud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18.2 9.5 4 4 0 0 1 18 18H7z" />
              </svg>
              the cloud
            </span>
          </div>
          <p className="flow-cap">
            What leaves your device: <b>nothing.</b>
          </p>
        </div>
      </div>
    </section>
  );
}
