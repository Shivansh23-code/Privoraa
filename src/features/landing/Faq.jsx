export default function Faq() {
  return (
    <section id="faq" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="reveal" style={{ textAlign: 'center' }}>
          <span className="eyebrow" style={{ justifyContent: 'center' }}>
            Questions
          </span>
          <h2 className="t">Fair things to ask.</h2>
          <p className="sub" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
            Privacy claims deserve scrutiny. Here are the straight answers.
          </p>
        </div>
        <div className="faq-list reveal">
          <details className="faq">
            <summary>Does it really work offline?</summary>
            <p className="a">
              Yes. The model and your vault both live on your device, so Vedix behaves
              identically with the connection off.{' '}
              <b>An internet connection is an option, never a requirement.</b>
            </p>
          </details>
          <details className="faq">
            <summary>What happens to my conversations?</summary>
            <p className="a">
              They're processed on-device and, when worth keeping,{' '}
              <b>sealed into your local encrypted vault.</b> Nothing is uploaded, logged, or used
              for training — there is no server-side copy to protect, because there is no
              server-side copy.
            </p>
          </details>
          <details className="faq">
            <summary>Can I use it across devices?</summary>
            <p className="a">
              Optional encrypted sync is on the roadmap — end-to-end, keyed by you, so the relay{' '}
              <b>can't read what passes through it.</b> Until then, your vault can be exported and
              imported manually.
            </p>
          </details>
          <details className="faq">
            <summary>What if I lose my device or my key?</summary>
            <p className="a">
              Your recovery phrase restores the vault on a new device. Without it, the vault stays
              sealed — <b>for everyone, including us.</b> That's not a limitation; that's the point.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
