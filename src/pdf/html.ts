import { PDFJS_LIB, PDFJS_WORKER } from './generated/pdfjsSource';
import { WEB_APP_JS } from './webApp';

const esc = (s: string) => JSON.stringify(s).replace(/<\/(script)/gi, '<\\/$1');

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:#F8F8FF;overscroll-behavior:none}
body{-webkit-user-select:none;user-select:none}
#pages{width:max-content;min-width:100%;padding:12px 12px 200px;transform-origin:0 0}
.page{position:relative;margin:0 auto 16px;background:#fff;box-shadow:0 1px 3px rgba(13,13,20,.14),0 0 0 1px rgba(13,13,20,.04);border-radius:2px;overflow:hidden}
.page canvas{position:absolute;inset:0;width:100%;height:100%}
.page svg.ann{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.night .page{background:#111}
.night .page canvas{filter:invert(1) hue-rotate(180deg)}
body.drawing .page{touch-action:none}
.textLayer{position:absolute;inset:0;width:100%!important;height:100%!important;overflow:hidden;line-height:1;pointer-events:none;
 --min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size))}
.textLayer span,.textLayer br{color:transparent;position:absolute;white-space:pre;transform-origin:0 0}
.textLayer > :not(.markedContent),.textLayer .markedContent span:not(.markedContent){--font-height:0;font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.textLayer .markedContent{display:contents}
.textLayer .endOfContent{display:none}
.textLayer span.hit{background:rgba(255,200,0,.45);border-radius:2px}
`;

export function buildPdfHtml(mode: 'viewer' | 'engine') {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${CSS}</style></head><body><div id="root"></div>
<script>window.__MODE=${JSON.stringify(mode)};window.__LIB=${esc(PDFJS_LIB)};window.__WORKER=${esc(PDFJS_WORKER)};</script>
<script>${WEB_APP_JS}</script></body></html>`;
}

let viewerHtml: string | null = null;
let engineHtml: string | null = null;
export const getViewerHtml = () => (viewerHtml ??= buildPdfHtml('viewer'));
export const getEngineHtml = () => (engineHtml ??= buildPdfHtml('engine'));
