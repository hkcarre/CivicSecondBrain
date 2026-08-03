/**
 * The Strata Civic Solutions mark: a diamond over three stacked chevron
 * "strata" layers. Built as inline SVG per the official brand guidelines
 * (no vector asset exists in this codebase — only an old placeholder
 * favicon) rather than approximated with a generic icon.
 *
 * Three variants, matching the guide's own lockup examples:
 * - "brand" (default): red diamond / navy layers — for light or cream surfaces.
 * - "reversed": red diamond stays red / layers switch to white — for the
 *   navy-background lockup (navy layers would be invisible on navy).
 * - "mono": both diamond and layers in `currentColor` — for a single-color
 *   context (e.g. a favicon-style badge) where two-tone isn't available.
 */
interface StrataLogoMarkProps {
  size?: number;
  variant?: "brand" | "reversed" | "mono";
  className?: string;
}

export function StrataLogoMark({ size = 24, variant = "brand", className }: StrataLogoMarkProps) {
  const diamondColor = variant === "mono" ? "currentColor" : "#8B1E2D";
  const layerColor = variant === "brand" ? "#081A33" : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Strata Civic Solutions"
    >
      <polygon points="50,8 76,26 50,44 24,26" fill={diamondColor} />
      <polyline
        points="24,52 50,62 76,52"
        fill="none"
        stroke={layerColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16,68 50,80 84,68"
        fill="none"
        stroke={layerColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="8,84 50,98 92,84"
        fill="none"
        stroke={layerColor}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
