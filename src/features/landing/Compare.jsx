export default function Compare() {
  return (
    <section id="compare" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">The honest comparison</span>
          <h2 className="t">Privoraa vs. the usual deal.</h2>
          <p className="sub">
            Cloud assistants are remarkable — and they read everything you type. Here's the trade,
            stated plainly.
          </p>
        </div>
        <div className="tbl-wrap reveal">
          <table className="cmp">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Question</span>
                </th>
                <th scope="col" className="pv">
                  Privoraa
                </th>
                <th scope="col">Typical cloud assistant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Where the model runs</th>
                <td className="pv">Your device</td>
                <td>
                  <span className="no">Their servers</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Who can read your chats</th>
                <td className="pv">Only you</td>
                <td>
                  <span className="no">Provider systems &amp; staff</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Works offline</th>
                <td className="pv">
                  <span className="yes">
                    <svg aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                    Fully
                  </span>
                </td>
                <td>
                  <span className="no">
                    <svg aria-hidden="true">
                      <use href="#i-x" />
                    </svg>
                    No
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Trained on your data</th>
                <td className="pv">
                  <span className="yes">
                    <svg aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                    Never
                  </span>
                </td>
                <td>
                  <span className="no">Often, by default</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Deleting really deletes</th>
                <td className="pv">
                  <span className="yes">
                    <svg aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                    Yes — it's your disk
                  </span>
                </td>
                <td>
                  <span className="no">Retention policies apply</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
