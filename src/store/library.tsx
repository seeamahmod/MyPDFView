import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Legacy from 'expo-file-system/legacy';
import { fromByteArray } from 'base64-js';
import {
  deleteDeviceFile,
  devicePdfsAvailable,
  hasDeviceAccess,
  overwriteDeviceFile,
  renameDeviceFile,
  requestDeviceAccess,
  scanDevicePdfs,
} from '../../modules/device-pdfs';
import type { Annotation } from '../pdf/annotations';
import { usePdfEngine } from '../pdf/PdfEngine';

export type Source = 'Documents' | 'Downloads' | 'WhatsApp' | 'Email';
export const SOURCES: Source[] = ['Documents', 'Downloads', 'WhatsApp', 'Email'];

export type PdfDoc = {
  id: string;
  name: string; // without .pdf
  size: number;
  pages: number; // 0 = not analyzed yet
  source: Source;
  starred: boolean;
  addedAt: number;
  modifiedAt: number;
  openedAt?: number;
  lastPage?: number;
  bookmarks: number[];
  highlights: Annotation[];
  thumb?: string;
  /** Set for PDFs that live on the phone (found by the device scan) instead of in app storage. */
  external?: { uri: string; path: string; mediaId: string };
};

const pdfDir = new Directory(Paths.document, 'pdfs');
const thumbDir = new Directory(Paths.document, 'thumbs');
const dbFile = new File(Paths.document, 'library.json');

export const fileFor = (id: string) => new File(pdfDir, `${id}.pdf`);
const pathUri = (path: string) => 'file://' + path.split('/').map(encodeURIComponent).join('/');
/** The file holding a document's bytes — app storage, or the original file on the phone. */
export function srcFile(d: PdfDoc): File {
  if (!d.external) return fileFor(d.id);
  try {
    const f = new File(d.external.uri);
    if (f.exists) return f;
  } catch {}
  return new File(pathUri(d.external.path));
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const bytesToBase64 = (b: Uint8Array) => fromByteArray(b);
export const stripPdf = (n: string) => n.replace(/\.pdf$/i, '').trim() || 'Untitled';

export function detectSource(uri: string, name: string): Source {
  const s = (uri + ' ' + name).toLowerCase();
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (/(gmail|android\.gm|mail|outlook|attachment)/.test(s)) return 'Email';
  if (s.includes('download')) return 'Downloads';
  return 'Documents';
}

/** Reads the saved library synchronously so the first render already has it. */
function loadLibrary(): PdfDoc[] {
  pdfDir.create({ idempotent: true, intermediates: true });
  thumbDir.create({ idempotent: true, intermediates: true });
  try {
    if (!dbFile.exists) return [];
    const list = JSON.parse(dbFile.textSync()) as PdfDoc[];
    return list.filter((d) => d.external || fileFor(d.id).exists);
  } catch {
    return []; // corrupted db → start fresh; files remain on disk
  }
}

type Library = {
  docs: PdfDoc[];
  loaded: boolean;
  /** True when the app can see all PDFs on the phone. */
  deviceAccess: boolean;
  deviceSupported: boolean;
  scanning: boolean;
  requestDeviceAccess: () => Promise<void>;
  syncDevice: () => Promise<void>;
  importPdf: (uri: string, nameHint?: string, opts?: { source?: Source }) => Promise<PdfDoc>;
  rename: (id: string, name: string) => Promise<void>;
  duplicate: (id: string) => Promise<PdfDoc>;
  remove: (id: string) => Promise<void>;
  update: (id: string, patch: Partial<PdfDoc>) => void;
  replaceContent: (id: string, bytes: Uint8Array) => Promise<void>;
  addFromBytes: (bytes: Uint8Array, name: string, source: Source) => Promise<PdfDoc>;
  base64Of: (id: string) => Promise<string>;
  bytesOf: (id: string) => Promise<Uint8Array>;
  /** A local file URI that can be handed to the Android share sheet. */
  shareUri: (id: string) => string;
  get: (id: string) => PdfDoc | undefined;
};

const Ctx = createContext<Library | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const engine = usePdfEngine();
  const [docs, setDocs] = useState<PdfDoc[]>(loadLibrary);
  const [deviceAccess, setDeviceAccess] = useState<boolean>(hasDeviceAccess);
  const [scanning, setScanning] = useState(false);
  const loaded = true;
  const docsRef = useRef<PdfDoc[]>(docs);
  const queueBusy = useRef(false);
  const failed = useRef(new Set<string>());

  const commit = useCallback((next: PdfDoc[]) => {
    docsRef.current = next;
    setDocs(next);
    try {
      dbFile.writeSync(JSON.stringify(next));
    } catch {}
  }, []);

  const patch = useCallback(
    (id: string, p: Partial<PdfDoc>) => commit(docsRef.current.map((d) => (d.id === id ? { ...d, ...p } : d))),
    [commit],
  );

  /** Reads page count and renders a page-1 thumbnail. */
  const analyze = useCallback(
    async (d: PdfDoc) => {
      const key = `analyze-${d.id}`;
      const info = await engine.load(key, await srcFile(d).base64());
      let thumb: string | undefined;
      try {
        const url = await engine.renderPage(key, 1, 360, 'image/jpeg', 0.8);
        const t = new File(thumbDir, `${d.id}-${Date.now()}.jpg`);
        t.writeSync(url.split(',')[1], { encoding: 'base64' });
        thumb = t.uri;
      } catch {}
      engine.unload(key).catch(() => {});
      return { pages: info.pages, thumb };
    },
    [engine],
  );

  const dropThumb = (d?: PdfDoc) => {
    if (!d?.thumb) return;
    try {
      new File(d.thumb).delete();
    } catch {}
  };

  // Background queue: fill in page counts + thumbnails for device PDFs, one at a time.
  const pump = useCallback(async () => {
    if (queueBusy.current) return;
    queueBusy.current = true;
    try {
      for (;;) {
        const next = docsRef.current.find((d) => (!d.pages || !d.thumb) && !failed.current.has(d.id));
        if (!next) break;
        try {
          const { pages, thumb } = await analyze(next);
          if (docsRef.current.some((d) => d.id === next.id)) patch(next.id, { pages, thumb });
        } catch {
          failed.current.add(next.id); // unreadable or password-protected; leave the placeholder
        }
      }
    } finally {
      queueBusy.current = false;
    }
  }, [analyze, patch]);

  const syncDevice = useCallback(async () => {
    const access = hasDeviceAccess();
    setDeviceAccess(access);
    if (!access) return;
    setScanning(true);
    try {
      const found = await scanDevicePdfs();
      const current = docsRef.current;
      const byMedia = new Map(current.filter((d) => d.external).map((d) => [d.external!.mediaId, d]));
      const byPath = new Map(current.filter((d) => d.external).map((d) => [d.external!.path, d]));
      const seen = new Set<string>();
      const next: PdfDoc[] = [];
      for (const f of found) {
        const prev = byMedia.get(f.id) ?? byPath.get(f.path);
        const ext = { uri: f.uri, path: f.path, mediaId: f.id };
        if (prev) {
          seen.add(prev.id);
          const changed = prev.size !== f.size || Math.abs(prev.modifiedAt - f.modified) > 1000;
          if (changed) dropThumb(prev);
          next.push({ ...prev, name: stripPdf(f.name), size: f.size, modifiedAt: f.modified, external: ext, ...(changed ? { pages: 0, thumb: undefined } : null) });
        } else {
          next.push({
            id: `d${f.id}`,
            name: stripPdf(f.name),
            size: f.size,
            pages: 0,
            source: detectSource(f.path, f.name),
            starred: false,
            addedAt: f.modified,
            modifiedAt: f.modified,
            bookmarks: [],
            highlights: [],
            external: ext,
          });
        }
      }
      // Keep imported (app-storage) PDFs; drop device PDFs that no longer exist on the phone.
      const locals = current.filter((d) => !d.external);
      for (const d of current) if (d.external && !seen.has(d.id)) dropThumb(d);
      commit([...locals, ...next]);
    } finally {
      setScanning(false);
    }
    pump();
  }, [commit, pump]);

  // Sync on launch and whenever the app comes back to the foreground (e.g. from Settings).
  useEffect(() => {
    const t = setTimeout(() => {
      syncDevice();
      pump();
    }, 0);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncDevice();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [syncDevice, pump]);

  const requestAccess = useCallback(async () => {
    const granted = await requestDeviceAccess();
    if (granted) await syncDevice();
  }, [syncDevice]);

  const addFromBytes = useCallback(
    async (bytes: Uint8Array, name: string, source: Source) => {
      const id = newId();
      const f = fileFor(id);
      f.writeSync(bytes);
      const now = Date.now();
      const base: PdfDoc = { id, name: stripPdf(name), size: f.size, pages: 0, source, starred: false, addedAt: now, modifiedAt: now, bookmarks: [], highlights: [] };
      const { pages, thumb } = await analyze(base);
      const doc = { ...base, pages, thumb };
      commit([doc, ...docsRef.current]);
      return doc;
    },
    [analyze, commit],
  );

  const importPdf = useCallback(
    async (uri: string, nameHint?: string, opts?: { source?: Source }) => {
      // For content:// URIs (Open with / Share), Android's display name and size come
      // from the ContentResolver; the URI's last segment is often just an ID.
      let name = nameHint && /\.pdf$/i.test(nameHint) ? nameHint : '';
      let srcSize = 0;
      try {
        const src = new File(uri);
        if (!name) name = src.name || '';
        srcSize = src.size ?? 0;
      } catch {}
      if (!name) name = nameHint || 'Document.pdf';

      // Opening a file that's already in the library (imported or on the phone) reuses it.
      const existing = docsRef.current.find(
        (d) => d.name.toLowerCase() === stripPdf(name).toLowerCase() && srcSize > 0 && d.size === srcSize,
      );
      if (existing) return existing;

      const id = newId();
      const dest = fileFor(id);
      try {
        new File(uri).copySync(dest);
      } catch {
        await Legacy.copyAsync({ from: uri, to: dest.uri });
      }
      const now = Date.now();
      const base: PdfDoc = {
        id,
        name: stripPdf(name),
        size: dest.size,
        pages: 0,
        source: opts?.source ?? detectSource(uri, name),
        starred: false,
        addedAt: now,
        modifiedAt: now,
        bookmarks: [],
        highlights: [],
      };
      let info: { pages: number; thumb?: string };
      try {
        info = await analyze(base);
      } catch {
        dest.delete();
        throw new Error('This file could not be opened as a PDF.');
      }
      const doc = { ...base, ...info };
      commit([doc, ...docsRef.current]);
      return doc;
    },
    [analyze, commit],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const src = docsRef.current.find((d) => d.id === id)!;
      const nid = newId();
      srcFile(src).copySync(fileFor(nid)); // copies always live in app storage
      let thumb: string | undefined;
      if (src.thumb) {
        const t = new File(thumbDir, `${nid}-${Date.now()}.jpg`);
        try {
          new File(src.thumb).copySync(t);
          thumb = t.uri;
        } catch {}
      }
      const now = Date.now();
      const doc: PdfDoc = { ...src, id: nid, name: `${src.name} copy`, addedAt: now, modifiedAt: now, openedAt: undefined, starred: false, thumb, external: undefined };
      const idx = docsRef.current.findIndex((d) => d.id === id);
      const next = [...docsRef.current];
      next.splice(idx + 1, 0, doc);
      commit(next);
      return doc;
    },
    [commit],
  );

  const remove = useCallback(
    async (id: string) => {
      const d = docsRef.current.find((x) => x.id === id);
      if (!d) return;
      if (d.external) {
        await deleteDeviceFile(d.external.path); // throws if the phone refuses
      } else {
        try {
          fileFor(id).delete();
        } catch {}
      }
      dropThumb(d);
      commit(docsRef.current.filter((x) => x.id !== id));
    },
    [commit],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const d = docsRef.current.find((x) => x.id === id);
      if (!d) return;
      const clean = stripPdf(name);
      if (d.external) {
        const newPath = await renameDeviceFile(d.external.path, `${clean}.pdf`);
        patch(id, { name: clean, external: { ...d.external, path: newPath, uri: pathUri(newPath) } });
        syncDevice();
      } else {
        patch(id, { name: clean, modifiedAt: Date.now() });
      }
    },
    [patch, syncDevice],
  );

  const replaceContent = useCallback(
    async (id: string, bytes: Uint8Array) => {
      const old = docsRef.current.find((d) => d.id === id)!;
      let size: number;
      if (old.external) {
        const tmp = new File(Paths.cache, `save-${id}.pdf`);
        tmp.writeSync(bytes);
        size = await overwriteDeviceFile(old.external.path, tmp.uri);
        tmp.delete();
      } else {
        const f = fileFor(id);
        f.writeSync(bytes);
        size = f.size;
      }
      const { pages, thumb } = await analyze(old);
      dropThumb(old);
      patch(id, { size, pages, thumb, modifiedAt: Date.now() });
    },
    [analyze, patch],
  );

  const shareUri = useCallback((id: string) => {
    const d = docsRef.current.find((x) => x.id === id)!;
    if (!d.external) return fileFor(id).uri;
    const dir = new Directory(Paths.cache, 'share');
    dir.create({ idempotent: true, intermediates: true });
    const out = new File(dir, `${d.name.replace(/[\\/:*?"<>|]/g, '_')}.pdf`);
    if (out.exists) out.delete();
    srcFile(d).copySync(out);
    return out.uri;
  }, []);

  const value = useMemo<Library>(
    () => ({
      docs,
      loaded,
      deviceAccess,
      deviceSupported: devicePdfsAvailable,
      scanning,
      requestDeviceAccess: requestAccess,
      syncDevice,
      importPdf,
      addFromBytes,
      duplicate,
      remove,
      rename,
      replaceContent,
      shareUri,
      update: patch,
      base64Of: (id) => srcFile(docsRef.current.find((d) => d.id === id)!).base64(),
      bytesOf: (id) => srcFile(docsRef.current.find((d) => d.id === id)!).bytes(),
      get: (id) => docsRef.current.find((d) => d.id === id),
    }),
    [docs, loaded, deviceAccess, scanning, requestAccess, syncDevice, importPdf, addFromBytes, duplicate, remove, rename, replaceContent, shareUri, patch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const l = useContext(Ctx);
  if (!l) throw new Error('useLibrary must be used inside LibraryProvider');
  return l;
}

/* ---------- formatting ---------- */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function formatDate(ts: number) {
  const d = new Date(ts);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export const pagesLabel = (n: number) => (n > 0 ? `${n} ${n === 1 ? 'page' : 'pages'}` : 'PDF');
