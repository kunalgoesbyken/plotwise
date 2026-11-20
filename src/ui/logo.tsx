export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M5 10.5 L18 4 L27 11.5 L23.5 25.5 L7.5 24.5 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M7.5 24.5 L23.5 25.5" stroke="var(--color-road)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}
