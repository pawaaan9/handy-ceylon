/** Flat illustration: a sealed envelope and shield — for verification and resets. */
export function SecureScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 400" className={className} role="img" aria-label="A secure envelope and shield">
      <circle cx="240" cy="200" r="150" className="fill-white/10" />
      <rect x="110" y="132" width="220" height="150" rx="14" className="fill-white" />
      <path d="M110 146 L220 222 L330 146" fill="none" strokeWidth="8" strokeLinejoin="round" className="stroke-navy" />
      <rect x="110" y="132" width="220" height="150" rx="14" fill="none" strokeWidth="8" className="stroke-navy" />
      <path d="M300 168 L376 196 V246 C376 288 344 314 300 330 C256 314 224 288 224 246 V196 Z" className="fill-primary" />
      <path d="M300 168 L376 196 V246 C376 288 344 314 300 330 C256 314 224 288 224 246 V196 Z" fill="none" strokeWidth="8" strokeLinejoin="round" className="stroke-navy" />
      <path d="M268 248 L292 272 L334 226" fill="none" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" className="stroke-white" />
      <circle cx="132" cy="96" r="10" className="fill-urgent" />
      <circle cx="384" cy="120" r="6" className="fill-white/70" />
      <rect x="86" y="300" width="40" height="10" rx="5" className="fill-urgent" />
      <rect x="350" y="94" width="26" height="8" rx="4" className="fill-white/70" />
    </svg>
  );
}
