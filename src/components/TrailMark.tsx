// The xTrails mark: a dotted trail between two waypoints, in the app's accent.
export function TrailMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="trail-mark" width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M6 21C6 12 22 16 22 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="0.1 5"
      />
      <circle cx="6" cy="21" r="3.2" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="22" cy="7" r="4" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <em>Crowd</em>Trails
    </span>
  );
}
