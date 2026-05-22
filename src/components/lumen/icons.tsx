// Lumen icon set — 1.5 stroke, currentColor. Ported from the design.

import type { CSSProperties, ReactNode } from "react";

interface IconProps {
  size?: number;
  stroke?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
}

function Icon({ size = 16, stroke = 1.5, fill = "none", style, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconLibrary = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></Icon>
);
export const IconClock = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>
);
export const IconDup = (p: IconProps) => (
  <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></Icon>
);
export const IconBroom = (p: IconProps) => (
  <Icon {...p}><path d="M14 4l6 6"/><path d="M3 21l7-7"/><path d="M10 14l3-3 7 7-3 3z"/><path d="M5 21h6"/></Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></Icon>
);
export const IconSparkle = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z"/><path d="M19 16l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/></Icon>
);
export const IconMountain = (p: IconProps) => (
  <Icon {...p}><path d="M3 19l5-9 4 6 3-4 6 7z"/><circle cx="17" cy="6" r="1.4"/></Icon>
);
export const IconFolder = (p: IconProps) => (
  <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></Icon>
);
export const IconRestore = (p: IconProps) => (
  <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></Icon>
);
export const IconGrid = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>
);
export const IconMasonry = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="11" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="17" width="7" height="4" rx="1"/><rect x="14" y="13" width="7" height="8" rx="1"/></Icon>
);
export const IconList = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p} stroke={2}><path d="M5 12l5 5 9-11"/></Icon>
);
export const IconX = (p: IconProps) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>
);
export const IconChevD = (p: IconProps) => (
  <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>
);
export const IconChevL = (p: IconProps) => (
  <Icon {...p}><path d="M15 6l-6 6 6 6"/></Icon>
);
export const IconChevR = (p: IconProps) => (
  <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>
);
export const IconMenu = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16"/></Icon>
);
export const IconArrowR = (p: IconProps) => (
  <Icon {...p}><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></Icon>
);
export const IconShot = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="6.5" cy="6.5" r=".4" fill="currentColor"/><circle cx="8.5" cy="6.5" r=".4" fill="currentColor"/></Icon>
);
export const IconVideo = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3z"/></Icon>
);
export const IconWA = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M8 14l1-2.5 -1-2 2-1 1 1.5 -1 1 1.5 1.5 1-1 1.5 1-1 2-2.5 -.5z"/></Icon>
);
export const IconBlur = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" opacity="0.4"/><circle cx="12" cy="12" r="6" opacity="0.7"/><circle cx="12" cy="12" r="9" opacity="1"/></Icon>
);
export const IconBurst = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="6" width="12" height="12" rx="1.2"/><rect x="6" y="4" width="12" height="12" rx="1.2"/><rect x="9" y="2" width="12" height="12" rx="1.2"/></Icon>
);
export const IconFlash = (p: IconProps) => (
  <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></Icon>
);
export const IconFace = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".7" fill="currentColor"/><circle cx="15" cy="10" r=".7" fill="currentColor"/><path d="M9 15c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5"/></Icon>
);
export const IconStar = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l3 6 6 .8-4.5 4.2 1 6.5-5.5-3-5.5 3 1-6.5L3 9.8 9 9z"/></Icon>
);
export const IconHash = (p: IconProps) => (
  <Icon {...p}><path d="M4 9h16M4 15h16M10 3l-2 18M16 3l-2 18"/></Icon>
);
export const IconRefresh = (p: IconProps) => (
  <Icon {...p}><path d="M3 12a9 9 0 0 1 15.5-6.3"/><path d="M21 12a9 9 0 0 1-15.5 6.3"/><path d="M18 3v4h-4M6 21v-4h4"/></Icon>
);
export const IconSettings = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>
);
export const IconWand = (p: IconProps) => (
  <Icon {...p}><path d="M15 4l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z"/><path d="M3 21l9-9"/></Icon>
);
export const IconKeep = (p: IconProps) => (
  <Icon {...p} stroke={2}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></Icon>
);
export const IconFile = (p: IconProps) => (
  <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></Icon>
);
export const IconDrive = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/><circle cx="7" cy="16" r=".6" fill="currentColor"/></Icon>
);

export const LumenMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1" />
    <circle cx="11" cy="11" r="5.5" stroke="currentColor" strokeWidth="1" />
    <circle cx="11" cy="11" r="1.6" fill="currentColor" />
  </svg>
);
