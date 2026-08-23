export function ArriyiaLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <img
      src="/branding/arriyia-logo.svg"
      alt="ARRIYIA"
      className={`block object-contain ${className}`}
      width={32}
      height={32}
    />
  )
}
