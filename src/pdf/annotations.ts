import { PDFDocument, StandardFonts, rgb, LineCapStyle, type PDFFont, type PDFPage } from 'pdf-lib';

// Coordinates are PDF page units with a top-left origin (pdf.js viewport at scale 1).
type Base = { id: string; page: number };
export type Annotation =
  | (Base & { type: 'ink'; points: [number, number][]; color: string; width: number })
  | (Base & { type: 'highlight'; x: number; y: number; w: number; h: number; color: string })
  | (Base & { type: 'whiteout'; x: number; y: number; w: number; h: number })
  | (Base & { type: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; color: string; width: number })
  | (Base & { type: 'line' | 'arrow'; x: number; y: number; x2: number; y2: number; color: string; width: number })
  | (Base & { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number; bold?: boolean; italic?: boolean });

const toRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// Standard 14 fonts only cover WinAnsi; replace anything else so saving never throws.
const winAnsi = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');

function inkPath(pts: [number, number][]) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0]} ${pts[i][1]}`;
  return d;
}

/** Burns annotations into the PDF and returns the new bytes. */
export async function flattenAnnotations(
  bytes: Uint8Array,
  annotations: Annotation[],
  opts: { pageNumbers?: number[]; objectStreams?: boolean } = {},
): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const fonts: Record<string, PDFFont> = {};
  const font = async (bold?: boolean, italic?: boolean) => {
    const key = (bold ? 'B' : '') + (italic ? 'I' : '');
    const name = {
      '': StandardFonts.Helvetica,
      B: StandardFonts.HelveticaBold,
      I: StandardFonts.HelveticaOblique,
      BI: StandardFonts.HelveticaBoldOblique,
    }[key]!;
    return (fonts[key] ??= await src.embedFont(name));
  };

  for (const a of annotations) {
    if (a.page < 1 || a.page > src.getPageCount()) continue;
    const page: PDFPage = src.getPage(a.page - 1);
    const cb = page.getCropBox();
    const X = (x: number) => cb.x + x;
    const Y = (y: number) => cb.y + cb.height - y;
    switch (a.type) {
      case 'ink':
        page.drawSvgPath(inkPath(a.points), {
          x: cb.x,
          y: cb.y + cb.height,
          borderColor: toRgb(a.color),
          borderWidth: a.width,
          borderLineCap: LineCapStyle.Round,
        });
        break;
      case 'highlight':
        page.drawRectangle({ x: X(a.x), y: Y(a.y + a.h), width: a.w, height: a.h, color: toRgb(a.color), opacity: 0.4 });
        break;
      case 'whiteout':
        page.drawRectangle({ x: X(a.x), y: Y(a.y + a.h), width: a.w, height: a.h, color: rgb(1, 1, 1) });
        break;
      case 'rect':
        page.drawRectangle({ x: X(a.x), y: Y(a.y + a.h), width: a.w, height: a.h, borderColor: toRgb(a.color), borderWidth: a.width });
        break;
      case 'ellipse':
        page.drawEllipse({ x: X(a.x + a.w / 2), y: Y(a.y + a.h / 2), xScale: a.w / 2, yScale: a.h / 2, borderColor: toRgb(a.color), borderWidth: a.width });
        break;
      case 'line':
      case 'arrow': {
        const color = toRgb(a.color);
        const line = (x1: number, y1: number, x2: number, y2: number) =>
          page.drawLine({ start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: a.width, color, lineCap: LineCapStyle.Round });
        line(a.x, a.y, a.x2, a.y2);
        if (a.type === 'arrow') {
          const ang = Math.atan2(a.y2 - a.y, a.x2 - a.x);
          const L = Math.max(8, a.width * 4);
          for (const t of [ang + 2.6, ang - 2.6]) line(a.x2, a.y2, a.x2 + Math.cos(t) * L, a.y2 + Math.sin(t) * L);
        }
        break;
      }
      case 'text': {
        const f = await font(a.bold, a.italic);
        winAnsi(a.text)
          .split('\n')
          .forEach((ln, i) => {
            // y is the baseline, matching the SVG preview in the editor
            page.drawText(ln, { x: X(a.x), y: Y(a.y + a.fontSize + i * a.fontSize * 1.2), size: a.fontSize, font: f, color: toRgb(a.color) });
          });
        break;
      }
    }
  }

  let out = src;
  if (opts.pageNumbers && opts.pageNumbers.length && opts.pageNumbers.length !== src.getPageCount()) {
    out = await PDFDocument.create();
    const copied = await out.copyPages(src, opts.pageNumbers.map((n) => n - 1));
    copied.forEach((p) => out.addPage(p));
  }
  return out.save({ useObjectStreams: opts.objectStreams ?? true });
}
