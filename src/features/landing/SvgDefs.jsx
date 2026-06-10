export default function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="i-lock" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" strokeWidth="2.2" d="M7 11V8a5 5 0 0 1 10 0v3" />
          <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 12.5 10 18.5 20 6.5"
          />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            d="M6 6l12 12M18 6 6 18"
          />
        </symbol>
      </defs>
    </svg>
  );
}
