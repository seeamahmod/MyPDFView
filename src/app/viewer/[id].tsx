import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, FormatOption, ListItem, PageThumbnail, ToolItem, TopAppBar } from '../../components/composites';
import { Icon } from '../../components/Icon';
import { AppText, Banner, Button, Chip, ColorSwatch, IconButton, InputField, PageIndicator, Toggle, ZoomControl } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import type { Annotation } from '../../pdf/annotations';
import { exportDoc, type ExportFormat } from '../../pdf/exportDoc';
import { usePdfEngine } from '../../pdf/PdfEngine';
import { PdfView, type PdfViewHandle, type PdfViewMessage } from '../../pdf/PdfView';
import { fileFor, formatSize, useLibrary } from '../../store/library';
import { useTheme } from '../../theme/ThemeProvider';
import { annotation, radius, shadows, type as T } from '../../theme/tokens';

type Sheet = null | 'more' | 'bookmarks' | 'highlights' | 'pages' | 'export' | 'goto';
const HL = Object.values(annotation.highlight);

export default function Viewer() {
  const { id, mode: initialMode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const engine = usePdfEngine();
  const toast = useToast();
  const doc = lib.docs.find((d) => d.id === id);
  const pdf = useRef<PdfViewHandle>(null);

  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(doc?.lastPage ?? 1);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'viewer' | 'highlight'>(initialMode === 'highlight' ? 'highlight' : 'viewer');
  const [hlColor, setHlColor] = useState<string>(annotation.highlight.yellow);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [night, setNight] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ total: number; pages: number; index: number } | null>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [gotoVal, setGotoVal] = useState('');

  // export state
  const [fmt, setFmt] = useState<ExportFormat>('PDF');
  const [range, setRange] = useState<'all' | 'current' | 'custom'>('all');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState(String(doc?.pages ?? 1));
  const [includeAnn, setIncludeAnn] = useState(true);
  const [compress, setCompress] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (doc) lib.update(doc.id, { openedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doc && page !== doc.lastPage && lib.update(doc.id, { lastPage: page }), 600);
    return () => clearTimeout(t);
  }, [page, doc, lib]);

  useEffect(() => {
    pdf.current?.setTool({ mode, hlColor });
  }, [mode, hlColor, loaded]);

  const onMessage = useCallback(
    async (m: PdfViewMessage) => {
      if (!doc) return;
      switch (m.type) {
        case 'ready':
          pdf.current?.open({
            data: await lib.base64Of(doc.id),
            annotations: doc.highlights,
            mode,
            page: doc.lastPage ?? 1,
            bg: c.bgCanvas,
            padTop: 12,
            padBottom: 220,
            night,
          });
          break;
        case 'loaded':
          setLoaded(true);
          if (m.pages !== doc.pages) lib.update(doc.id, { pages: m.pages });
          break;
        case 'page':
          setPage(m.page);
          break;
        case 'zoom':
          setZoom(m.zoom);
          break;
        case 'annotations':
          setCanUndo(m.canUndo);
          setCanRedo(m.canRedo);
          if (!m.initial) lib.update(doc.id, { highlights: m.annotations as Annotation[] });
          break;
        case 'search':
          setHits({ total: m.total, pages: m.pages, index: m.index });
          break;
        case 'toast':
          toast(m.message);
          break;
        case 'error':
          toast(m.message);
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc?.id, mode, night, c.bgCanvas],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQ('');
    setHits(null);
    pdf.current?.search('');
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'highlight') {
        setMode('viewer');
        return true;
      }
      if (searchOpen) {
        closeSearch();
        return true;
      }
      // Opened from another app ("Open with"): go to the library instead of exiting.
      if (!router.canGoBack()) {
        router.replace('/');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [mode, searchOpen, closeSearch]);

  // Page thumbnails for the Pages sheet, rendered lazily by the engine.
  useEffect(() => {
    if (sheet !== 'pages' || !doc) return;
    let cancelled = false;
    (async () => {
      const key = `thumbs-${doc.id}`;
      await engine.load(key, await lib.base64Of(doc.id));
      for (let p = 1; p <= Math.min(doc.pages, 120) && !cancelled; p++) {
        if (thumbs[p]) continue;
        try {
          const url = await engine.renderPage(key, p, 220, 'image/jpeg', 0.7);
          if (!cancelled) setThumbs((t) => ({ ...t, [p]: url }));
        } catch {}
      }
      engine.unload(key).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  if (!doc)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCanvas, gap: 16 }}>
        <AppText variant="h3">This PDF is no longer available</AppText>
        <Button label="Back to My PDFs" onPress={() => router.replace('/')} />
      </View>
    );

  const bookmarked = doc.bookmarks.includes(page);
  const toggleBookmark = () => {
    const b = bookmarked ? doc.bookmarks.filter((x) => x !== page) : [...doc.bookmarks, page].sort((a, z) => a - z);
    lib.update(doc.id, { bookmarks: b });
    toast(bookmarked ? `Removed bookmark on page ${page}` : `Bookmarked page ${page}`);
  };
  const goTo = (p: number) => {
    setSheet(null);
    pdf.current?.goTo(p);
  };
  const pageList = (): number[] => {
    if (range === 'current') return [page];
    if (range === 'custom') {
      const a = Math.max(1, Math.min(doc.pages, parseInt(from, 10) || 1));
      const b = Math.max(a, Math.min(doc.pages, parseInt(to, 10) || doc.pages));
      return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    }
    return Array.from({ length: doc.pages }, (_, i) => i + 1);
  };
  const runExport = async () => {
    const pages = pageList();
    setBusy('Preparing…');
    try {
      const msg = await exportDoc(engine, doc, { format: fmt, pages, includeAnnotations: includeAnn, compress }, setBusy);
      setSheet(null);
      toast(msg);
    } catch (e: any) {
      toast(e?.message ?? 'Export failed');
    } finally {
      setBusy(null);
    }
  };
  const highlightPages = Array.from(new Set(doc.highlights.map((h) => h.page))).sort((a, b) => a - b);
  const exportCount = pageList().length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
      {searchOpen ? (
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bgSurface, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
          <IconButton icon="arrow-left" onPress={closeSearch} label="Close search" />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => pdf.current?.search(q)}
            returnKeyType="search"
            placeholder="Search in document"
            placeholderTextColor={c.textTertiary}
            cursorColor={c.borderFocus}
            style={[T.bodyLg, { flex: 1, color: c.textPrimary, paddingVertical: 8 }]}
          />
          {hits && (
            <AppText variant="labelMd" color={c.textTertiary}>
              {hits.total ? `${hits.index + 1}/${hits.pages} pages` : 'No results'}
            </AppText>
          )}
          <IconButton icon="chevron-up" disabled={!hits?.pages} onPress={() => pdf.current?.searchNext(-1)} label="Previous result" />
          <IconButton icon="chevron-down" disabled={!hits?.pages} onPress={() => pdf.current?.searchNext(1)} label="Next result" />
        </View>
      ) : (
        <TopAppBar
          type="viewer"
          title={doc.name}
          eyebrow={mode === 'highlight' ? 'Highlighting' : `Page ${page} of ${doc.pages}`}
          onBack={() => (mode === 'highlight' ? setMode('viewer') : router.canGoBack() ? router.back() : router.replace('/'))}
          actions={
            mode === 'highlight' ? (
              <Button size="small" label="Done" onPress={() => setMode('viewer')} style={{ marginRight: 8 }} />
            ) : (
              <>
                <IconButton icon="search" onPress={() => setSearchOpen(true)} label="Search" />
                <IconButton icon={bookmarked ? 'bookmark-filled' : 'bookmark'} onPress={toggleBookmark} label="Bookmark page" />
                <IconButton icon="pages" onPress={() => setSheet('pages')} label="Pages" />
                <IconButton icon="more-vertical" onPress={() => setSheet('more')} label="More" />
              </>
            )
          }
        />
      )}
      {mode === 'highlight' && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <Banner message="Tap any line of text to highlight it. Tap again to remove." />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <PdfView ref={pdf} onMessage={onMessage} bg={c.bgCanvas} />
        {!loaded && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCanvas }}>
            <ActivityIndicator color={c.iconBrand} size="large" />
          </View>
        )}
      </View>

      {/* Viewer Bottom Bar */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12, alignItems: 'center' }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' }}>
          <PageIndicator label={`${page} / ${doc.pages}`} />
          <ZoomControl value={zoom} onIn={() => pdf.current?.zoom(1)} onOut={() => pdf.current?.zoom(-1)} />
        </View>
        {mode === 'highlight' ? (
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: radius.lg, backgroundColor: c.bgSurfaceRaised, shadowColor: c.shadow, ...shadows.md }}>
            {HL.map((col) => (
              <ColorSwatch key={col} color={col} selected={hlColor === col} onPress={() => setHlColor(col)} />
            ))}
            <View style={{ flex: 1 }} />
            <IconButton icon="undo" disabled={!canUndo} onPress={() => pdf.current?.undo()} label="Undo" />
            <IconButton icon="redo" disabled={!canRedo} onPress={() => pdf.current?.redo()} label="Redo" />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, backgroundColor: c.bgSurfaceRaised, shadowColor: c.shadow, ...shadows.lg }}>
            {(
              [
                ['Edit', 'edit', () => router.push(`/editor/${doc.id}`)],
                ['Highlight', 'highlighter', () => setMode('highlight')],
                ['Export', 'export', () => setSheet('export')],
                ['Share', 'share', () => Sharing.shareAsync(fileFor(doc.id).uri, { mimeType: 'application/pdf', dialogTitle: doc.name })],
              ] as const
            ).map(([l, i, f]) => (
              <View key={l} style={{ width: 60 }}>
                <ToolItem label={l} icon={i} onPress={f} />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* More */}
      <BottomSheet visible={sheet === 'more'} onClose={() => setSheet(null)} title="Document options">
        <ListItem title="Go to page" icon="hash" onPress={() => { setGotoVal(''); setSheet('goto'); }} />
        <ListItem title="Bookmarks" subtitle={`${doc.bookmarks.length} saved`} icon="bookmark" onPress={() => setSheet('bookmarks')} />
        <ListItem title="Highlights" subtitle={`${doc.highlights.length} in this document`} icon="highlighter" onPress={() => setSheet('highlights')} />
        <ListItem title="Fit to width" icon="fit-width" onPress={() => { pdf.current?.fitWidth(); setSheet(null); }} />
        <ListItem
          title="Night reading"
          subtitle="Invert page colors"
          icon="moon"
          onPress={() => { setNight(!night); pdf.current?.night(!night); }}
          trailing={<Toggle value={night} onChange={(v) => { setNight(v); pdf.current?.night(v); }} />}
        />
      </BottomSheet>

      {/* Go to page */}
      <BottomSheet
        visible={sheet === 'goto'}
        onClose={() => setSheet(null)}
        title="Go to page"
        footer={
          <>
            <Button label="Cancel" kind="outline" fill onPress={() => setSheet(null)} />
            <Button
              label="Go"
              fill
              disabled={!(parseInt(gotoVal, 10) >= 1 && parseInt(gotoVal, 10) <= doc.pages)}
              onPress={() => goTo(parseInt(gotoVal, 10))}
            />
          </>
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <InputField label="Page number" value={gotoVal} onChangeText={(t) => setGotoVal(t.replace(/\D/g, ''))} keyboardType="number-pad" autoFocus helper={`1 – ${doc.pages}`} />
        </View>
      </BottomSheet>

      {/* Bookmarks */}
      <BottomSheet visible={sheet === 'bookmarks'} onClose={() => setSheet(null)} title="Bookmarks">
        {doc.bookmarks.length ? (
          doc.bookmarks.map((b) => (
            <ListItem
              key={b}
              title={`Page ${b}`}
              icon="bookmark-filled"
              onPress={() => goTo(b)}
              trailing={<IconButton icon="close" label="Remove bookmark" onPress={() => lib.update(doc.id, { bookmarks: doc.bookmarks.filter((x) => x !== b) })} />}
            />
          ))
        ) : (
          <EmptyState icon="bookmark" title="No bookmarks yet" body="Tap the bookmark icon in the top bar to save a page." />
        )}
      </BottomSheet>

      {/* Highlights */}
      <BottomSheet visible={sheet === 'highlights'} onClose={() => setSheet(null)} title="Highlights">
        {highlightPages.length ? (
          highlightPages.map((p) => (
            <ListItem key={p} title={`Page ${p}`} subtitle={`${doc.highlights.filter((h) => h.page === p).length} highlights`} icon="highlighter" onPress={() => goTo(p)} />
          ))
        ) : (
          <EmptyState icon="highlighter" title="No highlights yet" body="Tap Highlight in the bottom bar, then tap a line of text." />
        )}
      </BottomSheet>

      {/* Pages */}
      <BottomSheet visible={sheet === 'pages'} onClose={() => setSheet(null)} title="Pages" subtitle={`${doc.pages} pages`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 20, justifyContent: 'flex-start' }}>
          {Array.from({ length: Math.min(doc.pages, 120) }, (_, i) => i + 1).map((p) => (
            <PageThumbnail key={p} page={p} uri={thumbs[p]} current={p === page} onPress={() => goTo(p)} width={100} />
          ))}
        </View>
      </BottomSheet>

      {/* Export */}
      <BottomSheet
        visible={sheet === 'export'}
        onClose={() => !busy && setSheet(null)}
        title="Export"
        footer={
          <>
            <AppText variant="bodySm" color={c.textSecondary} style={{ flex: 1 }}>
              {busy ?? `${exportCount} ${exportCount === 1 ? 'page' : 'pages'} · ~${formatSize(Math.round((doc.size * exportCount) / Math.max(1, doc.pages)))}`}
            </AppText>
            <Button label={busy ? 'Exporting…' : `Export ${fmt}`} disabled={!!busy} onPress={runExport} />
          </>
        }
      >
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <AppText variant="labelMd" color={c.textSecondary}>
            Format
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <FormatOption title="PDF" description="Flattened copy" icon="file-text" selected={fmt === 'PDF'} onPress={() => setFmt('PDF')} />
            <FormatOption title="PNG" description="Image per page" icon="image" selected={fmt === 'PNG'} onPress={() => setFmt('PNG')} />
            <FormatOption title="JPG" description="Smaller images" icon="image" selected={fmt === 'JPG'} onPress={() => setFmt('JPG')} />
            <FormatOption title="Word" description="Coming soon" icon="file" disabled />
            <FormatOption title="Text" description="Plain .txt" icon="text" selected={fmt === 'Text'} onPress={() => setFmt('Text')} />
          </View>
          <AppText variant="labelMd" color={c.textSecondary} style={{ marginTop: 8 }}>
            Pages
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="All" count={doc.pages} selected={range === 'all'} onPress={() => setRange('all')} />
            <Chip label="Current" count={page} selected={range === 'current'} onPress={() => setRange('current')} />
            <Chip label="Custom range" selected={range === 'custom'} onPress={() => setRange('custom')} />
          </View>
          {range === 'custom' && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <InputField style={{ flex: 1 }} label="From" value={from} onChangeText={(t) => setFrom(t.replace(/\D/g, ''))} keyboardType="number-pad" />
              <InputField style={{ flex: 1 }} label="To" value={to} onChangeText={(t) => setTo(t.replace(/\D/g, ''))} keyboardType="number-pad" />
            </View>
          )}
        </View>
        <View style={{ marginTop: 8 }}>
          <ListItem
            title="Include highlights & annotations"
            subtitle="Burn markup into the exported file"
            icon="highlighter"
            disabled={fmt === 'Text'}
            onPress={() => setIncludeAnn(!includeAnn)}
            trailing={<Toggle value={includeAnn && fmt !== 'Text'} disabled={fmt === 'Text'} onChange={setIncludeAnn} />}
          />
          <ListItem
            title="Compress"
            subtitle="Reduce file size for sharing"
            icon="compress"
            disabled={fmt !== 'PDF'}
            onPress={() => setCompress(!compress)}
            trailing={<Toggle value={compress && fmt === 'PDF'} disabled={fmt !== 'PDF'} onChange={setCompress} />}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function EmptyState({ icon, title, body }: { icon: 'bookmark' | 'highlighter'; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <Pressable style={{ alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 24, paddingHorizontal: 40 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.bgSubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={c.iconSecondary} />
      </View>
      <AppText variant="labelLg">{title}</AppText>
      <AppText variant="bodySm" color={c.textTertiary} style={{ textAlign: 'center' }}>
        {body}
      </AppText>
    </Pressable>
  );
}
