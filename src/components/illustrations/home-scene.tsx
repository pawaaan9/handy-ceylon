/**
 * Flat illustration: a Sri Lankan home with a clay-tile roof, a coconut palm
 * and a technician arriving with a toolbox. Flat fills only — no gradients.
 */
export function HomeScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 400" className={className} role="img" aria-label="A technician arriving at a home">
      {/* sky elements */}
      <circle cx="392" cy="78" r="34" className="fill-urgent" />
      <rect x="54" y="64" width="96" height="22" rx="11" className="fill-white/90" />
      <rect x="82" y="48" width="52" height="26" rx="13" className="fill-white/90" />
      <rect x="282" y="122" width="74" height="18" rx="9" className="fill-white/70" />

      {/* ground */}
      <rect x="0" y="318" width="480" height="82" className="fill-leaf" />
      <rect x="0" y="318" width="480" height="10" className="fill-black/10" />
      <path d="M214 400 L238 318 H272 L300 400 Z" className="fill-sand-strong" />

      {/* coconut palm */}
      <path d="M86 320 C80 260 92 200 118 150" fill="none" strokeWidth="12" strokeLinecap="round" className="stroke-sand-strong" />
      <g className="fill-primary">
        <path d="M118 150 C96 128 64 128 40 146 C70 138 94 142 118 150 Z" />
        <path d="M118 150 C112 118 92 98 64 94 C90 110 104 126 118 150 Z" />
        <path d="M118 150 C134 118 160 106 190 110 C162 120 140 132 118 150 Z" />
        <path d="M118 150 C148 140 178 148 196 170 C170 158 146 154 118 150 Z" />
        <path d="M118 150 C122 172 112 196 92 208 C106 188 112 170 118 150 Z" />
      </g>
      <circle cx="114" cy="158" r="7" className="fill-sand-strong" />
      <circle cx="126" cy="156" r="7" className="fill-sand-strong" />

      {/* house */}
      <rect x="186" y="196" width="196" height="124" className="fill-white" />
      <path d="M170 204 L284 132 L398 204 Z" className="fill-clay" />
      <path d="M170 204 L284 132 L398 204" fill="none" strokeWidth="6" strokeLinejoin="round" className="stroke-navy" />
      <rect x="186" y="204" width="196" height="116" fill="none" strokeWidth="6" className="stroke-navy" />
      <rect x="248" y="248" width="44" height="72" rx="4" className="fill-primary" />
      <circle cx="282" cy="286" r="3.5" className="fill-white" />
      <rect x="204" y="226" width="30" height="30" rx="3" className="fill-sky" />
      <rect x="320" y="226" width="44" height="30" rx="3" className="fill-sky" />
      <path d="M219 226 V256 M204 241 H234 M342 226 V256" strokeWidth="4" className="stroke-navy" />
      <rect x="204" y="226" width="30" height="30" rx="3" fill="none" strokeWidth="4" className="stroke-navy" />
      <rect x="320" y="226" width="44" height="30" rx="3" fill="none" strokeWidth="4" className="stroke-navy" />
      {/* drip from the roof gutter: the problem being fixed */}
      <path d="M372 214 C372 222 366 226 366 230 A6 6 0 0 0 378 230 C378 226 372 222 372 214 Z" className="fill-sky" />

      {/* technician */}
      <g>
        <rect x="402" y="262" width="12" height="54" rx="5" className="fill-navy" />
        <rect x="420" y="262" width="12" height="54" rx="5" className="fill-navy" />
        <rect x="396" y="312" width="22" height="8" rx="4" className="fill-navy" />
        <rect x="416" y="312" width="22" height="8" rx="4" className="fill-navy" />
        <rect x="396" y="196" width="42" height="74" rx="14" className="fill-primary" />
        <rect x="408" y="206" width="18" height="10" rx="3" className="fill-white/80" />
        <circle cx="417" cy="176" r="18" className="fill-skin" />
        <path d="M398 172 A19 19 0 0 1 436 172 Z" className="fill-urgent" />
        <rect x="394" y="168" width="48" height="7" rx="3.5" className="fill-urgent" />
        <rect x="384" y="210" width="12" height="44" rx="6" className="fill-primary" />
        {/* toolbox */}
        <rect x="360" y="252" width="46" height="30" rx="5" className="fill-urgent" />
        <path d="M372 252 V244 H394 V252" fill="none" strokeWidth="5" className="stroke-navy" />
        <rect x="360" y="262" width="46" height="5" className="fill-black/15" />
      </g>

      {/* floating wrench */}
      <g transform="translate(316 70) rotate(35)">
        <rect x="-5" y="0" width="10" height="46" rx="5" className="fill-navy" />
        <path d="M-14 -8 A14 14 0 1 0 14 -8 L6 -2 V-14 H-6 V-2 Z" className="fill-navy" />
      </g>
    </svg>
  );
}
