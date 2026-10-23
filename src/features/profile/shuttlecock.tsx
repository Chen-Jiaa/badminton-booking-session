/**
 * A shuttlecock (cork at the bottom, feather skirt fanning up). Uses `currentColor`:
 * solid by default, or just the outline with `outline`.
 */
export function Shuttlecock({ className, outline }: { className?: string; outline?: boolean }) {
  const line = {
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
  return (
    <svg
      viewBox="0 0 24 28"
      className={className}
      fill={outline ? "none" : "currentColor"}
      {...(outline ? line : {})}
      aria-hidden
    >
      <path d="M8.2 20.5 3.2 4.2C8.5 1.8 15.5 1.8 20.8 4.2l-5 16.3Z" />
      <path d="M8.4 22h7.2a1.6 1.6 0 0 1 1.6 1.6 4.6 4.6 0 0 1-4.6 4.4h-1.2a4.6 4.6 0 0 1-4.6-4.4A1.6 1.6 0 0 1 8.4 22Z" />
      <g
        stroke={outline ? "currentColor" : "white"}
        strokeOpacity={outline ? 1 : 0.45}
        strokeWidth={outline ? 1.2 : 0.7}
        fill="none"
      >
        <path d="M9.2 3.2 10.6 20.5M14.8 3.2 13.4 20.5" />
      </g>
    </svg>
  );
}
