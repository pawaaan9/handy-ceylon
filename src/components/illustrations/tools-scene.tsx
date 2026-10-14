/** Flat illustration: a technician's pegboard of tools and a hard hat. */
export function ToolsScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 400" className={className} role="img" aria-label="A wall of tools and a safety helmet">
      <rect x="60" y="40" width="360" height="250" rx="18" className="fill-sand" />
      <g className="fill-sand-strong">
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => (
            <circle key={`${row}-${col}`} cx={92 + col * 37} cy={72 + row * 38} r="4" />
          )),
        )}
      </g>
      {/* hammer */}
      <rect x="112" y="92" width="14" height="128" rx="6" className="fill-clay" />
      <rect x="86" y="80" width="66" height="28" rx="6" className="fill-navy" />
      {/* screwdriver */}
      <rect x="186" y="84" width="22" height="60" rx="9" className="fill-urgent" />
      <rect x="193" y="144" width="8" height="78" rx="3" className="fill-navy" />
      {/* wrench */}
      <rect x="248" y="104" width="16" height="118" rx="8" className="fill-primary" />
      <path d="M232 92 A24 24 0 1 0 280 92 L266 102 V82 H246 V102 Z" className="fill-primary" />
      {/* paint roller */}
      <rect x="300" y="84" width="84" height="30" rx="10" className="fill-sky" />
      <rect x="300" y="84" width="84" height="30" rx="10" fill="none" strokeWidth="5" className="stroke-navy" />
      <path d="M342 114 V136 H334 V212" fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-navy" />
      <rect x="326" y="200" width="16" height="34" rx="6" className="fill-urgent" />
      {/* shelf */}
      <rect x="40" y="300" width="400" height="16" rx="8" className="fill-navy" />
      {/* hard hat */}
      <path d="M150 300 A62 56 0 0 1 274 300 Z" className="fill-urgent" />
      <rect x="132" y="290" width="160" height="14" rx="7" className="fill-urgent" />
      <rect x="206" y="246" width="12" height="40" rx="6" className="fill-white/50" />
      {/* tape measure */}
      <rect x="318" y="252" width="56" height="48" rx="12" className="fill-primary" />
      <circle cx="346" cy="276" r="12" className="fill-white" />
      <rect x="370" y="290" width="44" height="8" className="fill-urgent" />
      {/* plant for warmth */}
      <rect x="402" y="338" width="34" height="40" rx="6" className="fill-clay" />
      <path d="M419 338 C404 318 404 300 412 290 C418 306 420 320 419 338 Z M419 338 C430 316 444 308 452 308 C446 322 434 332 419 338 Z" className="fill-leaf" />
    </svg>
  );
}
