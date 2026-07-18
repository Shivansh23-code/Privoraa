export default function TrustStrip() {
  return (
    <div className="strip" role="presentation">
      <div className="strip-in">
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          OFFLINE MODEL SUPPORT
        </span>
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          ON-DEVICE MEMORY
        </span>
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          EXPLICIT MODEL ROUTING
        </span>
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          ENCRYPTED LOCAL VAULT
        </span>
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          YOU HOLD THE KEY
        </span>
      </div>
    </div>
  );
}
