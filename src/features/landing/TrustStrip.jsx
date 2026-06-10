export default function TrustStrip() {
  return (
    <div className="strip" role="presentation">
      <div className="strip-in">
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          OFFLINE-FIRST
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
          ZERO TRACKING
        </span>
        <span>
          <svg aria-hidden="true">
            <use href="#i-check" />
          </svg>
          END-TO-END SEALED
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
