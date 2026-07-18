export default function Compare() {
  return (
    <section id="compare" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">The honest comparison</span>
          <h2 className="t">Privoraa vs. the usual deal.</h2>
          <p className="sub">
            Choose cloud convenience or supported local models. The important difference is knowing
            which mode you are using.
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
                <td className="pv">Cloud or your device</td>
                <td>
                  <span className="no">Their servers</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Local inference option</th>
                <td className="pv">Supported with Ollama</td>
                <td>
                  <span className="no">Usually unavailable</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Works offline</th>
                <td className="pv">
                  <span className="yes">
                    <svg aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                    With a downloaded local model
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
                <th scope="row">Local chat storage</th>
                <td className="pv">
                  <span className="yes">
                    <svg aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                    Available with the vault
                  </span>
                </td>
                <td>
                  <span className="no">Provider-managed history</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Provider transparency</th>
                <td className="pv">
                  <span className="yes">
                    <svg aria-hidden="true">
                      <use href="#i-check" />
                    </svg>
                    Model and route shown
                  </span>
                </td>
                <td>
                  <span className="no">Varies by product</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
