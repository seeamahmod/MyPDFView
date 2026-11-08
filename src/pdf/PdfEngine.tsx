import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import RNWebView, { type WebViewMessageEvent } from 'react-native-webview';

import { getEngineHtml } from './html';

// The package's class typings default their generic to `undefined`, which collapses props to `never`.
const WebView = RNWebView<object>;
type WebViewRef = RNWebView<object>;

// A hidden WebView running pdf.js: page counts, thumbnails, page images, text.
type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };
type Engine = {
  load: (key: string, base64: string) => Promise<{ pages: number; width: number; height: number }>;
  renderPage: (key: string, page: number, width: number, format?: 'image/jpeg' | 'image/png', quality?: number) => Promise<string>;
  text: (key: string) => Promise<string>;
  unload: (key: string) => Promise<void>;
};

const EngineContext = createContext<Engine | null>(null);

export function PdfEngineProvider({ children }: { children: ReactNode }) {
  const ref = useRef<WebViewRef>(null);
  const pending = useRef(new Map<number, Pending>());
  const seq = useRef(1);
  const readyWaiters = useRef<(() => void)[]>([]);
  const readyRef = useRef(false);

  const waitReady = () =>
    readyRef.current ? Promise.resolve() : new Promise<void>((r) => readyWaiters.current.push(r));

  const call = useCallback(async (msg: Record<string, unknown>) => {
    await waitReady();
    const reqId = seq.current++;
    return new Promise<any>((resolve, reject) => {
      pending.current.set(reqId, { resolve, reject });
      ref.current?.postMessage(JSON.stringify({ ...msg, reqId }));
    });
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: any;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') {
      readyRef.current = true;
      readyWaiters.current.splice(0).forEach((f) => f());
    } else if (m.type === 'res') {
      const p = pending.current.get(m.reqId);
      if (!p) return;
      pending.current.delete(m.reqId);
      if (m.ok) p.resolve(m.result);
      else p.reject(new Error(String(m.result)));
    }
  };

  const engine = useMemo<Engine>(
    () => ({
      load: (key, data) => call({ cmd: 'load', key, data }),
      renderPage: (key, page, width, format = 'image/jpeg', quality = 0.82) => call({ cmd: 'renderPage', key, page, width, format, quality }),
      text: (key) => call({ cmd: 'text', key }),
      unload: (key) => call({ cmd: 'unload', key }),
    }),
    [call],
  );

  return (
    <EngineContext.Provider value={engine}>
      {children}
      <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} pointerEvents="none">
        <WebView
          ref={ref}
          source={{ html: getEngineHtml(), baseUrl: 'https://engine.mypdfview.local/' }}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          androidLayerType="software"
          onContentProcessDidTerminate={() => ref.current?.reload()}
          onRenderProcessGone={() => {
            readyRef.current = false;
            ref.current?.reload();
          }}
        />
      </View>
    </EngineContext.Provider>
  );
}

export function usePdfEngine() {
  const e = useContext(EngineContext);
  if (!e) throw new Error('usePdfEngine must be used inside PdfEngineProvider');
  return e;
}
