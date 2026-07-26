import type { SVGProps } from "react";

/**
 * Hand-authored inline icons. docs/PRD.md §6 bans emoji icons — every glyph
 * in the product chrome is a real vector, including this small internal set.
 */
export type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M13 13L10.3 10.3" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.36 3.64l-1.06 1.06M4.7 11.3l-1.06 1.06M12.36 12.36l-1.06-1.06M4.7 4.7 3.64 3.64" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3Z" />
    </svg>
  );
}

export function CommandIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 2.5a1.75 1.75 0 1 0 1.75 1.75V11.75a1.75 1.75 0 1 1-1.75 1.75h5a1.75 1.75 0 1 1-1.75-1.75V4.25A1.75 1.75 0 1 0 10.5 2.5" />
      <rect x="4.5" y="4.25" width="7" height="7.5" rx="0.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </svg>
  );
}
