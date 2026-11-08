import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import RNWebView, { type WebViewMessageEvent } from 'react-native-webview';

import { getViewerHtml } from './html';
import type { Annotation } from './annotations';

// The package's class typings default their generic to `undefined`, which collapses props to `never`.
const WebView = RNWebView<object>;
type WebViewRef = RNWebView<object>;

export type ViewerMode = 'viewer' | 'highlight' | 'editor';
export type ToolState = {
  mode?: ViewerMode;
  tool?: 'edit' | 'text' | 'draw' | 'shapes' | 'erase' | null;
  color?: string;
  width?: number;
  hlColor?: string;
  shape?: 'rect' | 'circle' | 'line' | 'arrow';
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
};

export type PdfViewMessage =
  | { type: 'ready' }
  | { type: 'loaded'; pages: number; zoom: number }
  | { type: 'page'; page: number }
  | { type: 'zoom'; zoom: number }
  | { type: 'annotations'; annotations: Annotation[]; canUndo: boolean; canRedo: boolean; initial?: boolean }
  | { type: 'requestText'; page: number; x: number; y: number }
  | { type: 'requestEdit'; page: number; rect: { x: number; y: number; w: number; h: number }; text: string; fontSize: number }
  | { type: 'search'; total: number; pages: number; index: number; page: number }
  | { type: 'toast'; message: string }
  | { type: 'error'; message: string };

export type PdfViewHandle = {
  open: (o: { data: string; annotations?: Annotation[]; mode?: ViewerMode; page?: number; night?: boolean; bg: string; padTop?: number; padBottom?: number }) => void;
  setTool: (t: ToolState) => void;
  zoom: (dir: 1 | -1) => void;
  fitWidth: () => void;
  goTo: (page: number) => void;
  night: (on: boolean) => void;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  addText: (page: number, x: number, y: number, text: string) => void;
  applyEdit: (m: { page: number; rect: { x: number; y: number; w: number; h: number }; text: string; fontSize: number }) => void;
  search: (q: string) => void;
  searchNext: (dir: 1 | -1) => void;
  setAnnotations: (a: Annotation[]) => void;
};

export const PdfView = forwardRef<PdfViewHandle, { onMessage: (m: PdfViewMessage) => void; bg: string }>(function PdfView(
  { onMessage, bg },
  ref,
) {
  const web = useRef<WebViewRef>(null);
  const send = (m: object) => web.current?.postMessage(JSON.stringify(m));
  useImperativeHandle(ref, () => ({
    open: (o) => send({ cmd: 'open', ...o }),
    setTool: (t) => send({ cmd: 'setTool', ...t }),
    zoom: (dir) => send({ cmd: 'zoom', dir }),
    fitWidth: () => send({ cmd: 'fitWidth' }),
    goTo: (page) => send({ cmd: 'goTo', page }),
    night: (on) => send({ cmd: 'night', on }),
    undo: () => send({ cmd: 'undo' }),
    redo: () => send({ cmd: 'redo' }),
    clearAll: () => send({ cmd: 'clearAll' }),
    addText: (page, x, y, text) => send({ cmd: 'addText', page, x, y, text }),
    applyEdit: (m) => send({ cmd: 'applyEdit', ...m }),
    search: (q) => send({ cmd: 'search', q }),
    searchNext: (dir) => send({ cmd: 'searchNext', dir }),
    setAnnotations: (annotations) => send({ cmd: 'setAnnotations', annotations }),
  }));
  const handle = (e: WebViewMessageEvent) => {
    try {
      onMessage(JSON.parse(e.nativeEvent.data));
    } catch {}
  };
  return (
    <WebView
      ref={web}
      style={[StyleSheet.absoluteFill, { backgroundColor: bg }]}
      source={{ html: getViewerHtml(), baseUrl: 'https://viewer.mypdfview.local/' }}
      originWhitelist={['*']}
      onMessage={handle}
      javaScriptEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
      textZoom={100}
      androidLayerType="hardware"
      onRenderProcessGone={() => web.current?.reload()}
    />
  );
});
