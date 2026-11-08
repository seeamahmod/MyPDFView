import Svg, { Circle, Path, Rect } from 'react-native-svg';

// 24px outline icons, 1.75 stroke — same geometry as the Figma "Icon/*" set.
type El =
  | { p: string; fill?: boolean; w?: number }
  | { c: [number, number, number] }
  | { dot: [number, number, number?] }
  | { r: [number, number, number, number, number] };

const file = 'M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z M14 3.5v5h5';
const star = 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z';

const ICONS = {
  search: [{ c: [11, 11, 7] }, { p: 'M20 20l-4-4' }],
  check: [{ p: 'M5 12.5l4.5 4.5L19 7.5' }],
  plus: [{ p: 'M12 5v14M5 12h14' }],
  minus: [{ p: 'M5 12h14' }],
  close: [{ p: 'M6 6l12 12M18 6L6 18' }],
  sort: [{ p: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3' }],
  grid: [{ r: [4, 4, 6.5, 6.5, 1.5] }, { r: [13.5, 4, 6.5, 6.5, 1.5] }, { r: [4, 13.5, 6.5, 6.5, 1.5] }, { r: [13.5, 13.5, 6.5, 6.5, 1.5] }],
  list: [{ p: 'M9 6h11M9 12h11M9 18h11' }, { dot: [4.5, 6] }, { dot: [4.5, 12] }, { dot: [4.5, 18] }],
  'more-vertical': [{ dot: [12, 5, 1.6] }, { dot: [12, 12, 1.6] }, { dot: [12, 19, 1.6] }],
  star: [{ p: star }],
  'star-filled': [{ p: star, fill: true }],
  folder: [{ p: 'M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z' }],
  clock: [{ c: [12, 12, 8.5] }, { p: 'M12 7.5V12l3 2' }],
  open: [{ p: 'M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4' }],
  edit: [{ p: 'M15.5 4.5l4 4L9 19H5v-4z M13.5 6.5l4 4' }],
  share: [{ c: [18, 5.5, 2.5] }, { c: [6, 12, 2.5] }, { c: [18, 18.5, 2.5] }, { p: 'M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1' }],
  rename: [{ p: 'M12 20h8M16.5 4.5l3 3L8 19H5v-3z' }],
  duplicate: [{ r: [8, 8, 12, 12, 2] }, { p: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }],
  info: [{ c: [12, 12, 8.5] }, { p: 'M12 11v5' }, { dot: [12, 8, 1.1] }],
  alert: [{ c: [12, 12, 8.5] }, { p: 'M12 7.5v5' }, { dot: [12, 16, 1.1] }],
  trash: [{ p: 'M4 7h16M9 7V4.5h6V7M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M10 11v6M14 11v6' }],
  'chevron-left': [{ p: 'M15 5l-7 7 7 7' }],
  'chevron-right': [{ p: 'M9 5l7 7-7 7' }],
  'chevron-down': [{ p: 'M5 9l7 7 7-7' }],
  'chevron-up': [{ p: 'M5 15l7-7 7 7' }],
  'arrow-left': [{ p: 'M20 12H4M10 6l-6 6 6 6' }],
  bookmark: [{ p: 'M6.5 4.5h11v16l-5.5-4-5.5 4z' }],
  'bookmark-filled': [{ p: 'M6.5 4.5h11v16l-5.5-4-5.5 4z', fill: true }],
  pages: [{ r: [4, 3.5, 6.5, 7.5, 1.2] }, { r: [13.5, 3.5, 6.5, 7.5, 1.2] }, { r: [4, 13, 6.5, 7.5, 1.2] }, { r: [13.5, 13, 6.5, 7.5, 1.2] }],
  hash: [{ p: 'M9.5 4L7.5 20M16.5 4l-2 16M4.5 9h15.5M4 15h15.5' }],
  highlighter: [{ p: 'M14.5 4.5l5 5L11 18H6v-5zM9 10.5l4.5 4.5M3.5 20.5h9' }],
  'fit-width': [{ p: 'M3 5v14M21 5v14M6.5 12h11M9 9.5L6.5 12 9 14.5M15 9.5l2.5 2.5-2.5 2.5' }],
  moon: [{ p: 'M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z' }],
  export: [{ p: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 14v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4' }],
  undo: [{ p: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }],
  redo: [{ p: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13' }],
  save: [{ p: 'M6 4h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 4v4.5h7V4M8 20v-6h8v6' }],
  text: [{ p: 'M5 7V4.5h14V7M12 4.5v15M9 19.5h6' }],
  'text-add': [{ p: 'M4 7V4.5h11V7M9.5 4.5v14M7 18.5h5M18 12.5v7M14.5 16h7' }],
  draw: [{ p: 'M3.5 17c2.5-6 5.5-10.5 7.5-10.5 2.5 0-1 10.5 2 10.5 2 0 3-5 5-5 1.5 0 1.5 3 2.5 3' }],
  shapes: [{ r: [3.5, 3.5, 9, 9, 1.5] }, { c: [15.5, 15.5, 5] }],
  eraser: [{ p: 'M8.5 20.5l-4-4a1.5 1.5 0 0 1 0-2.1l9.4-9.4a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1l-8.4 9.4zM9.5 9.5l5 5M8.5 20.5h11' }],
  'rotate-left': [{ p: 'M4 4.5v5h5M4.6 9.5A8 8 0 1 1 4 13' }],
  file: [{ p: file }],
  'file-text': [{ p: file + 'M9 13h6M9 16.5h6' }],
  image: [{ r: [3.5, 4.5, 17, 15, 2] }, { c: [9, 10, 1.75] }, { p: 'M20.5 16l-5-5-9 8.5' }],
  compress: [{ p: 'M4 14h6v6M20 10h-6V4M14 10l6-6M4 20l6-6' }],
  square: [{ r: [4.5, 4.5, 15, 15, 2] }],
  circle: [{ c: [12, 12, 8] }],
  line: [{ p: 'M5 19L19 5' }],
  'arrow-up-right': [{ p: 'M6 18L18 6M9 6h9v9' }],
  bold: [{ p: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z' }],
  italic: [{ p: 'M10 5h8M6 19h8M14 5l-4 14' }],
} satisfies Record<string, El[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  const els = ICONS[name] as El[];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {els.map((e, i) => {
        if ('p' in e)
          return (
            <Path key={i} d={e.p} stroke={color} strokeWidth={e.w ?? 1.75} strokeLinecap="round" strokeLinejoin="round" fill={e.fill ? color : 'none'} />
          );
        if ('c' in e) return <Circle key={i} cx={e.c[0]} cy={e.c[1]} r={e.c[2]} stroke={color} strokeWidth={1.75} fill="none" />;
        if ('dot' in e) return <Circle key={i} cx={e.dot[0]} cy={e.dot[1]} r={e.dot[2] ?? 1.25} fill={color} />;
        return <Rect key={i} x={e.r[0]} y={e.r[1]} width={e.r[2]} height={e.r[3]} rx={e.r[4]} stroke={color} strokeWidth={1.75} fill="none" />;
      })}
    </Svg>
  );
}
