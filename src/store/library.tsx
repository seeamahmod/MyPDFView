import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import * as Legacy from 'expo-file-system/legacy';
import { fromByteArray } from 'base64-js';
import type { Annotation } from '../pdf/annotations';
import { usePdfEngine } from '../pdf/PdfEngine';

export type Source = 'Documents' | 'Downloads' | 'WhatsApp' | 'Email';
export const SOURCES: Source[] = ['Documents', 'Downloads', 'WhatsApp', 'Email'];

export type PdfDoc = {
  id: string;
  name: string; // without .pdf
  size: number;
  pages: number;
  source: Source;
  starred: boolean;
  addedAt: number;
  modifiedAt: number;
  openedAt?: number;
  lastPage?: number;
  bookmarks: number[];
  highlights: Annotation[];
  thumb?: string;
};

const pdfDir = new Directory(Paths.document, 'pdfs');
const thumbDir = new Directory(Paths.document, 'thumbs');
const dbFile = new File(Paths.document, 'library.json');

export const fileFor = (id: string) => new File(pdfDir, `${id}.pdf`);
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
    return list.filter((d) => fileFor(d.id).exists);
  } catch {
    return []; // corrupted db → start fresh; files remain on disk
  }
}

type Library = {
  docs: PdfDoc[];
  loaded: boolean;
  importPdf: (uri: string, nameHint?: string, opts?: { source?: Source }) => Promise<PdfDoc>;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => Promise<PdfDoc>;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<PdfDoc>) => void;
  replaceContent: (id: string, bytes: Uint8Array) => Promise<void>;
  addFromBytes: (bytes: Uint8Array, name: string, source: Source) => Promise<PdfDoc>;
  base64Of: (id: string) => Promise<string>;
  get: (id: string) => PdfDoc | undefined;
};

const Ctx = createContext<Library | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const engine = usePdfEngine();
  const [docs, setDocs] = useState<PdfDoc[]>(loadLibrary);
  const loaded = true;
  const docsRef = useRef<PdfDoc[]>(docs);

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
    async (id: string) => {
      const b64 = await fileFor(id).base64();
      const info = await engine.load(id, b64);
      let thumb: string | undefined;
      try {
        const url = await engine.renderPage(id, 1, 360, 'image/jpeg', 0.8);
        const t = new File(thumbDir, `${id}-${Date.now()}.jpg`);
        t.writeSync(url.split(',')[1], { encoding: 'base64' });
        thumb = t.uri;
      } catch {}
      engine.unload(id).catch(() => {});
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

  const addFromBytes = useCallback(
    async (bytes: Uint8Array, name: string, source: Source) => {
      const id = newId();
      const f = fileFor(id);
      f.writeSync(bytes);
      const { pages, thumb } = await analyze(id);
      const now = Date.now();
      const doc: PdfDoc = { id, name: stripPdf(name), size: f.size, pages, source, starred: false, addedAt: now, modifiedAt: now, bookmarks: [], highlights: [], thumb };
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

      // Opening the same file again reuses the copy already in the library.
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
      let pages = 0;
      let thumb: string | undefined;
      try {
        ({ pages, thumb } = await analyze(id));
      } catch {
        dest.delete();
        throw new Error('This file could not be opened as a PDF.');
      }
      const now = Date.now();
      const doc: PdfDoc = {
        id,
        name: stripPdf(name),
        size: dest.size,
        pages,
        source: opts?.source ?? detectSource(uri, name),
        starred: false,
        addedAt: now,
        modifiedAt: now,
        bookmarks: [],
        highlights: [],
        thumb,
      };
      commit([doc, ...docsRef.current]);
      return doc;
    },
    [analyze, commit],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const src = docsRef.current.find((d) => d.id === id)!;
      const nid = newId();
      fileFor(id).copySync(fileFor(nid));
      let thumb: string | undefined;
      if (src.thumb) {
        const t = new File(thumbDir, `${nid}-${Date.now()}.jpg`);
        try {
          new File(src.thumb).copySync(t);
          thumb = t.uri;
        } catch {}
      }
      const now = Date.now();
      const doc: PdfDoc = { ...src, id: nid, name: `${src.name} copy`, addedAt: now, modifiedAt: now, openedAt: undefined, starred: false, thumb };
      const idx = docsRef.current.findIndex((d) => d.id === id);
      const next = [...docsRef.current];
      next.splice(idx + 1, 0, doc);
      commit(next);
      return doc;
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      const d = docsRef.current.find((x) => x.id === id);
      try {
        fileFor(id).delete();
      } catch {}
      dropThumb(d);
      commit(docsRef.current.filter((x) => x.id !== id));
    },
    [commit],
  );

  const replaceContent = useCallback(
    async (id: string, bytes: Uint8Array) => {
      const f = fileFor(id);
      f.writeSync(bytes);
      const old = docsRef.current.find((d) => d.id === id);
      const { pages, thumb } = await analyze(id);
      dropThumb(old);
      patch(id, { size: f.size, pages, thumb, modifiedAt: Date.now() });
    },
    [analyze, patch],
  );

  const value = useMemo<Library>(
    () => ({
      docs,
      loaded,
      importPdf,
      addFromBytes,
      duplicate,
      remove,
      replaceContent,
      update: patch,
      rename: (id, name) => patch(id, { name: stripPdf(name), modifiedAt: Date.now() }),
      base64Of: (id) => fileFor(id).base64(),
      get: (id) => docsRef.current.find((d) => d.id === id),
    }),
    [docs, loaded, importPdf, addFromBytes, duplicate, remove, replaceContent, patch],
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
export const pagesLabel = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;
