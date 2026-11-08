import { Directory, File, Paths } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { toByteArray } from 'base64-js';
import { bytesToBase64, srcFile, type PdfDoc } from '../store/library';
import { flattenAnnotations } from './annotations';

export type ExportFormat = 'PDF' | 'PNG' | 'JPG' | 'Text';
type Engine = {
  load: (key: string, b64: string) => Promise<{ pages: number }>;
  renderPage: (key: string, page: number, width: number, format?: 'image/jpeg' | 'image/png', quality?: number) => Promise<string>;
  text: (key: string) => Promise<string>;
  unload: (key: string) => Promise<void>;
};

const safe = (n: string) => n.replace(/[\\/:*?"<>|]/g, '_');

function outDir() {
  const d = new Directory(Paths.cache, 'exports');
  if (d.exists) d.delete();
  d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Runs an export and returns a short status message for a toast. */
export async function exportDoc(
  engine: Engine,
  doc: PdfDoc,
  o: { format: ExportFormat; pages: number[]; includeAnnotations: boolean; compress: boolean },
  onProgress?: (msg: string) => void,
): Promise<string> {
  const src = srcFile(doc);
  const all = o.pages.length === doc.pages;
  const anns = o.includeAnnotations ? doc.highlights : [];
  const dir = outDir();

  const flattened = async () => {
    if (!anns.length && all && o.format !== 'PDF') return null;
    return flattenAnnotations(await src.bytes(), anns, { pageNumbers: o.format === 'PDF' ? o.pages : undefined, objectStreams: o.compress });
  };

  if (o.format === 'PDF') {
    onProgress?.('Preparing PDF…');
    let file = src;
    if (doc.external && !(anns.length || !all || o.compress)) {
      // Files on the phone are shared via an app-owned copy.
      file = new File(dir, `${safe(doc.name)}.pdf`);
      src.copySync(file);
    } else if (anns.length || !all || o.compress) {
      const bytes = await flattenAnnotations(await src.bytes(), anns, { pageNumbers: o.pages, objectStreams: o.compress });
      file = new File(dir, `${safe(doc.name)}.pdf`);
      file.writeSync(bytes);
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `Export ${doc.name}` });
    return 'PDF ready to share';
  }

  if (o.format === 'Text') {
    onProgress?.('Extracting text…');
    const key = `export-${doc.id}`;
    await engine.load(key, await src.base64());
    const text = await engine.text(key);
    engine.unload(key).catch(() => {});
    const f = new File(dir, `${safe(doc.name)}.txt`);
    f.writeSync(text || '');
    await Sharing.shareAsync(f.uri, { mimeType: 'text/plain', dialogTitle: `Export ${doc.name}` });
    return text.trim() ? 'Text ready to share' : 'No selectable text found in this PDF';
  }

  // Images
  const png = o.format === 'PNG';
  const key = `export-${doc.id}`;
  const flat = await flattened();
  await engine.load(key, flat ? bytesToBase64(flat) : await src.base64());
  const files: File[] = [];
  for (const [i, p] of o.pages.entries()) {
    onProgress?.(`Rendering page ${i + 1} of ${o.pages.length}…`);
    const url = await engine.renderPage(key, p, png ? 1600 : 1400, png ? 'image/png' : 'image/jpeg', 0.9);
    const f = new File(dir, `${safe(doc.name)}-p${p}.${png ? 'png' : 'jpg'}`);
    f.writeSync(toByteArray(url.split(',')[1]));
    files.push(f);
  }
  engine.unload(key).catch(() => {});

  if (files.length === 1) {
    await Sharing.shareAsync(files[0].uri, { mimeType: png ? 'image/png' : 'image/jpeg', dialogTitle: `Export ${doc.name}` });
    return 'Image ready to share';
  }
  const perm = await requestPermissionsAsync(true);
  if (perm.status !== 'granted') {
    await Sharing.shareAsync(files[0].uri, { mimeType: png ? 'image/png' : 'image/jpeg' });
    return 'Gallery access denied — shared page 1 only';
  }
  onProgress?.('Saving to Gallery…');
  let album = await Album.get('MyPDF View');
  for (const f of files) {
    const asset = await Asset.create(f.uri, album ?? undefined);
    if (!album) album = await Album.create('MyPDF View', [asset], false);
  }
  return `${files.length} images saved to Gallery › MyPDF View`;
}
