import type { ReactElement } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

interface BookmarkIconProps extends IconProps {
  filled?: boolean;
}

export function IconClose({ size = 20, className }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

export function IconChatBubble({ size = 18, className, filled = false }: BookmarkIconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      {filled
        ? <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        : <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />}
    </svg>
  );
}

export function IconBookmark({ size = 12, className, filled = false }: BookmarkIconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      {filled
        ? <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
        : <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />}
    </svg>
  );
}

export function IconPerson({ size = 12, className }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

export function IconSmartToy({ size = 12, className }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM7.5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S9.83 13 9 13s-1.5-.67-1.5-1.5zM16 17H8v-2h8v2zm-1-4c-.83 0-1.5-.67-1.5-1.5S14.17 10 15 10s1.5.67 1.5 1.5S15.83 13 15 13z" />
    </svg>
  );
}

export function IconLogo({ height = 24, className }: { height?: number; className?: string }): ReactElement {
  const aspectRatio = 331.02 / 45.6;
  const width = height * aspectRatio;
  return (
    <svg width={width} height={height} viewBox="0 0 331.02 45.6" fill="currentColor" className={className}>
      <path d="M0,1.2h14.94l14.04,19.8c1.08,1.8,3.24,1.8,4.32,0L47.28,1.2h14.94v37.2h-12.54v-14.16c0-2.34-2.82-3.18-4.08-1.02l-9.9,15.18h-9.18l-9.96-15.18c-1.2-2.16-4.02-1.32-4.02,1.02v14.16H0V1.2Z" />
      <path d="M67.02,32.1V14.7c0-4.08,2.28-6.3,6.36-6.3h31.38v30h-31.02c-4.26,0-6.72-2.22-6.72-6.3ZM89.16,28.32c2.7,0,4.92-2.22,4.92-4.92s-2.22-4.92-4.92-4.92h-6.54c-2.7,0-4.92,2.22-4.92,4.92s2.22,4.92,4.92,4.92h6.54Z" />
      <path d="M149.28,14.7v17.4c0,4.08-2.22,6.3-6.3,6.3h-21.24v7.2h-12.24V8.4h33.48c4.08,0,6.3,2.22,6.3,6.3ZM125.4,18.48c-2.7,0-4.92,2.22-4.92,4.92s2.22,4.92,4.92,4.92h8.04c2.7,0,4.92-2.22,4.92-4.92s-2.22-4.92-4.92-4.92h-8.04Z" />
      <path d="M154.44,1.2h13.14v10.86c0,1.56,1.2,2.76,2.76,2.76h15.18c1.56,0,2.76-1.2,2.76-2.76V1.2h13.14v37.2h-13.14v-10.8c0-1.56-1.2-2.76-2.76-2.76h-15.18c-1.56,0-2.76,1.2-2.76,2.76v10.8h-13.14V1.2Z" />
      <path d="M205.86,32.1v-1.26c0-4.08,2.4-6.3,6.66-6.3h15.42c2.1,0,3.78-1.68,3.78-3.78s-1.68-3.72-3.78-3.72h-22.08v-2.34c0-4.08,2.28-6.3,6.36-6.3h24.18c4.08,0,6.3,2.22,6.3,6.3v23.7h-30.12c-4.26,0-6.72-2.22-6.72-6.3Z" />
      <path d="M247.5,32.1V14.7c0-4.08,2.22-6.3,6.3-6.3h24.96c3.72,0,6.42,2.7,6.42,6.42v3.66h-20.34c-2.7,0-4.92,2.22-4.92,4.92s2.22,4.92,4.92,4.92h20.34v3.66c0,3.72-2.7,6.42-6.42,6.42h-24.96c-4.08,0-6.3-2.22-6.3-6.3Z" />
      <path d="M289.38,0h12.24v14.58c0,2.34,2.1,3.24,4.02,1.5l9.54-7.68h15.84l-13.68,11.64c-1.98,1.74-1.98,3.6-.06,5.4l13.74,12.96h-15.84l-9.48-8.82c-1.8-1.74-4.08-.78-4.08,1.5v7.32h-12.24V0Z" />
    </svg>
  );
}

export function IconScrollTop({ size = 18, className }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z" />
    </svg>
  );
}

export function IconScrollBottom({ size = 18, className }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z" />
    </svg>
  );
}
