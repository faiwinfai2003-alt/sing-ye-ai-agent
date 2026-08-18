export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="廣東話 AI Voice Agent 標誌"
    >
      <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path
        d="M13 24V16C13 13.7909 14.7909 12 17 12H23C25.2091 12 27 13.7909 27 16V22C27 24.2091 25.2091 26 23 26H18L13 30V24Z"
        fill="currentColor"
      />
      <path
        d="M17.5 17.5V20.5"
        stroke="hsl(var(--background))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M20 15.5V22.5"
        stroke="hsl(var(--background))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M22.5 17V21"
        stroke="hsl(var(--background))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
