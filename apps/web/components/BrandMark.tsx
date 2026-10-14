import { useId } from "react";

/** The NomClock mark: a smiling plate with a bite out of the rim. Decorative unless labelled. */
export function BrandMark({ size = 32, label }: { size?: number; label?: string }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <mask id={mask}>
          <rect width="200" height="200" fill="#fff" />
          <circle cx="168" cy="44" r="21" fill="#000" />
          <circle cx="185" cy="68" r="16" fill="#000" />
          <circle cx="148" cy="24" r="15" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        <circle cx="100" cy="100" r="86" fill="#FFFFFF" stroke="var(--ink)" strokeWidth="13" />
      </g>
      <ellipse cx="81" cy="92" rx="8" ry="11" fill="#1F2340" />
      <ellipse cx="119" cy="92" rx="8" ry="11" fill="#1F2340" />
      <ellipse cx="63" cy="113" rx="11" ry="7" fill="#B4245C" opacity="0.3" />
      <ellipse cx="137" cy="113" rx="11" ry="7" fill="#B4245C" opacity="0.3" />
      <path d="M84 115 Q100 133 116 115" fill="none" stroke="#1F2340" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
