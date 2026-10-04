import type { SVGProps } from "react";

/**
 * Lucide has no basketball glyph, so this one is drawn to match its style:
 * 24x24 grid, 2px round strokes, currentColor.
 */
export default function BasketballIcon({ size = 24, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="M4.9 4.9c3.6 3.6 3.6 10.6 0 14.2" />
      <path d="M19.1 4.9c-3.6 3.6-3.6 10.6 0 14.2" />
    </svg>
  );
}
