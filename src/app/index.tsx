import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, FlatList, ScrollView, View, useWindowDimensions } from 'react-native';
import { BottomNavBar, BottomSheet, FileCard, FileRow, ListItem, TopAppBar, type NavKey } from '../components/composites';
import { Icon } from '../components/Icon';
import { AppText, Button, Chip, Divider, FAB, IconButton, InputField } from '../components/primitives';
import { useToast } from '../components/Toast';
import { formatDate, formatSize, pagesLabel, SOURCES, useLibrary, type PdfDoc, type Source } from '../store/library';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

type Sort = 'date' | 'name' | 'size';
const SORTS: { key: Sort; title: string; sub: string; icon: 'clock' | 'text' | 'file' }[] = [
  { key: 'date', title: 'Date modified', sub: 'Newest first', icon: 'clock' },
  { key: 'name', title: 'Name', sub: 'A to Z', icon: 'text' },
  { key: 'size', title: 'Size', sub: 'Largest first', icon: 'file' },
];
const INVALID = /[\\/:*?"<>|]/;

export default function Home() {
  const { c } = useTheme();
  const lib = useLibrary();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<NavKey>('files');
  const [filter, setFilter] = useState<'All' | Source>('All');
  const [sort, setSort] = useState<Sort>('date');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'actions' | 'rename' | 'delete' | 'info' | 'sort'>(null);
  const [target, setTarget] = useState<PdfDoc | null>(null);
  const [newName, setNewName] = useState('');
  const [askAccess, setAskAccess] = useState(false);
  const dismissAsk = () => {
    setAskAccess(false);
    AsyncStorage.setItem('askedDeviceAccess', '1');
  };

  useEffect(() => {
    AsyncStorage.multiGet(['view', 'sort']).then((kv) => {
      const v = kv[0][1];
      const s = kv[1][1];
      if (v === 'grid' || v === 'list') setView(v);
      if (s === 'date' || s === 'name' || s === 'size') setSort(s);
    });
  }, []);
  useEffect(() => {
    if (!lib.deviceSupported || lib.deviceAccess) return;
    AsyncStorage.getItem('askedDeviceAccess').then((v) => {
      if (!v) setAskAccess(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveView = (v: 'grid' | 'list') => {
    setView(v);
    AsyncStorage.setItem('view', v);
  };
  const saveSort = (s: Sort) => {
    setSort(s);
    AsyncStorage.setItem('sort', s);
    setSheet(null);
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: lib.docs.length };
    SOURCES.forEach((s) => (m[s] = lib.docs.filter((d) => d.source === s).length));
    return m;
  }, [lib.docs]);
  const totalSize = useMemo(() => lib.docs.reduce((a, d) => a + d.size, 0), [lib.docs]);

  const list = useMemo(() => {
    let l = lib.docs;
    if (tab === 'recent') l = l.filter((d) => d.openedAt).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));
    else {
      if (tab === 'starred') l = l.filter((d) => d.starred);
      if (tab === 'files' && filter !== 'All') l = l.filter((d) => d.source === filter);
      l = [...l].sort((a, b) =>
        sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size - a.size : b.modifiedAt - a.modifiedAt,
      );
    }
    const q = query.trim().toLowerCase();
    return q ? l.filter((d) => d.name.toLowerCase().includes(q)) : l;
  }, [lib.docs, tab, filter, sort, query]);

  const importFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: false });
    if (res.canceled) return;
    let ok = 0;
    for (const [i, a] of res.assets.entries()) {
      setBusy(res.assets.length > 1 ? `Importing ${i + 1} of ${res.assets.length}…` : 'Importing…');
      try {
        await lib.importPdf(a.uri, a.name);
        ok++;
      } catch (e: any) {
        toast(`${a.name}: ${e?.message ?? 'import failed'}`);
      }
    }
    setBusy(null);
    if (ok) {
      setTab('files');
      setFilter('All');
      toast(ok === 1 ? 'PDF added' : `${ok} PDFs added`);
    }
  };

  const open = (d: PdfDoc) => router.push(`/viewer/${d.id}`);
  const more = (d: PdfDoc) => {
    setTarget(d);
    setSheet('actions');
  };
  const nameError = !newName.trim()
    ? 'Enter a file name'
    : INVALID.test(newName)
      ? 'Names can’t contain \\ / : * ? " < > |'
      : lib.docs.some((d) => d.id !== target?.id && d.name.toLowerCase() === newName.trim().toLowerCase())
        ? 'A file with this name already exists'
        : undefined;

  const gap = 16;
  const cardW = Math.floor((width - 40 - gap) / 2);
  const title = tab === 'files' ? 'My PDFs' : tab === 'recent' ? 'Recent' : 'Starred';

  const accessCard = lib.deviceSupported && !lib.deviceAccess && (
    <View style={{ marginHorizontal: 20, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.bgSurface }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.bgSubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="folder" size={20} color={c.iconSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="labelLg">Show all PDFs on your phone</AppText>
        <AppText variant="bodySm" color={c.textTertiary}>
          Allow file access to list them here
        </AppText>
      </View>
      <Button size="small" label="Allow" onPress={lib.requestDeviceAccess} />
    </View>
  );

  const header = (
    <View>
      {accessCard}
      {searching ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <InputField
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search your PDFs"
            leadingIcon="search"
            returnKeyType="search"
          />
        </View>
      ) : null}
      {tab === 'files' && lib.docs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 4 }}>
          {(['All', ...SOURCES] as const).map((s) => (
            <Chip key={s} label={s} count={counts[s]} selected={filter === s} onPress={() => setFilter(s)} />
          ))}
        </ScrollView>
      )}
      {lib.docs.length > 0 && tab !== 'recent' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, paddingRight: 20, paddingVertical: 8 }}>
          <Button size="small" kind="ghost" leadingIcon="sort" label={SORTS.find((s) => s.key === sort)!.title} onPress={() => setSheet('sort')} />
          <View style={{ flexDirection: 'row', backgroundColor: c.bgSubtle, borderRadius: radius.full, padding: 4 }}>
            <IconButton icon="grid" size={36} selected={view === 'grid'} onPress={() => saveView('grid')} label="Grid view" />
            <IconButton icon="list" size={36} selected={view === 'list'} onPress={() => saveView('list')} label="List view" />
          </View>
        </View>
      )}
      <View style={{ height: 8 }} />
    </View>
  );

  const empty = (
    <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 64, gap: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.bgSubtle, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tab === 'starred' ? 'star' : tab === 'recent' ? 'clock' : 'file'} size={32} color={c.iconSecondary} />
      </View>
      <AppText variant="labelLg">
        {query ? 'No matching PDFs' : tab === 'starred' ? 'No starred PDFs' : tab === 'recent' ? 'Nothing opened yet' : 'No PDFs yet'}
      </AppText>
      <AppText variant="bodySm" color={c.textTertiary} style={{ textAlign: 'center' }}>
        {query
          ? 'Try a different name.'
          : tab === 'starred'
            ? 'Star a PDF from its menu to keep it here.'
            : tab === 'recent'
              ? 'PDFs you open will show up here.'
              : 'Import a PDF from your phone to read, highlight and edit it.'}
      </AppText>
      {tab === 'files' && !query && <Button label="Import PDF" leadingIcon="plus" onPress={importFiles} style={{ marginTop: 8 }} />}
    </View>
  );

  const meta = (d: PdfDoc) => `${formatDate(d.modifiedAt)} · ${formatSize(d.size)}`;
  const rowMeta = (d: PdfDoc) => `${d.source} · ${d.pages} pp · ${formatSize(d.size)} · ${formatDate(tab === 'recent' && d.openedAt ? d.openedAt : d.modifiedAt)}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
      <TopAppBar
        type="home"
        title={title}
        eyebrow={`${lib.docs.length} ${lib.docs.length === 1 ? 'file' : 'files'} · ${formatSize(totalSize)}`}
        actions={
          <IconButton
            icon={searching ? 'close' : 'search'}
            label={searching ? 'Close search' : 'Search'}
            onPress={() => {
              setSearching(!searching);
              setQuery('');
            }}
          />
        }
      />
      {view === 'grid' && tab !== 'recent' ? (
        <FlatList
          key="grid"
          data={list}
          numColumns={2}
          keyExtractor={(d) => d.id}
          ListHeaderComponent={header}
          ListEmptyComponent={lib.loaded ? empty : undefined}
          columnWrapperStyle={{ gap, paddingHorizontal: 20, marginBottom: 20 }}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          refreshing={lib.scanning}
          onRefresh={lib.deviceAccess ? lib.syncDevice : undefined}
          renderItem={({ item: d }) => (
            <FileCard name={d.name} meta={meta(d)} pages={pagesLabel(d.pages)} starred={d.starred} thumb={d.thumb} width={cardW} onPress={() => open(d)} onMore={() => more(d)} />
          )}
        />
      ) : (
        <FlatList
          key="list"
          data={list}
          keyExtractor={(d) => d.id}
          ListHeaderComponent={header}
          ListEmptyComponent={lib.loaded ? empty : undefined}
          contentContainerStyle={{ paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          keyboardShouldPersistTaps="handled"
          refreshing={lib.scanning}
          onRefresh={lib.deviceAccess ? lib.syncDevice : undefined}
          renderItem={({ item: d }) => (
            <View style={{ paddingHorizontal: 20 }}>
              <FileRow name={d.name} meta={rowMeta(d)} starred={d.starred} thumb={d.thumb} onPress={() => open(d)} onMore={() => more(d)} />
            </View>
          )}
        />
      )}

      <FAB onPress={importFiles} style={{ position: 'absolute', right: 20, bottom: insets.bottom + 85 + 16 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <BottomNavBar active={tab} onChange={setTab} />
      </View>

      {busy && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bgScrim, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: c.bgSurfaceRaised, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 12, minWidth: 200 }}>
            <ActivityIndicator color={c.iconBrand} />
            <AppText variant="bodyMd">{busy}</AppText>
          </View>
        </View>
      )}

      {/* File actions */}
      <BottomSheet
        visible={sheet === 'actions'}
        onClose={() => setSheet(null)}
        title={target ? `${target.name}.pdf` : ''}
        subtitle={target ? `${pagesLabel(target.pages)} · ${formatSize(target.size)}` : ''}
      >
        {target && (
          <>
            <ListItem title="Open" icon="open" onPress={() => { setSheet(null); open(target); }} />
            <ListItem title="Edit PDF" icon="edit" onPress={() => { setSheet(null); router.push(`/editor/${target.id}`); }} />
            <ListItem title="Share" icon="share" onPress={async () => { setSheet(null); await Sharing.shareAsync(lib.shareUri(target.id), { mimeType: 'application/pdf', dialogTitle: target.name }); }} />
            <ListItem
              title={target.starred ? 'Remove from starred' : 'Add to starred'}
              icon={target.starred ? 'star-filled' : 'star'}
              onPress={() => { lib.update(target.id, { starred: !target.starred }); setSheet(null); toast(target.starred ? 'Removed from starred' : 'Added to starred'); }}
            />
            <ListItem title="Rename" icon="rename" onPress={() => { setNewName(target.name); setSheet('rename'); }} />
            <ListItem title="Duplicate" icon="duplicate" onPress={async () => { setSheet(null); await lib.duplicate(target.id); toast('Copy created'); }} />
            <ListItem title="File info" icon="info" onPress={() => setSheet('info')} />
            <Divider />
            <ListItem title="Delete" icon="trash" destructive onPress={() => setSheet('delete')} />
          </>
        )}
      </BottomSheet>

      {/* Rename */}
      <BottomSheet
        visible={sheet === 'rename'}
        onClose={() => setSheet(null)}
        title="Rename file"
        footer={
          <>
            <Button label="Cancel" kind="outline" fill onPress={() => setSheet(null)} />
            <Button
              label="Rename"
              fill
              disabled={!!nameError}
              onPress={async () => {
                if (!target) return;
                try {
                  await lib.rename(target.id, newName);
                  setSheet(null);
                  toast('Renamed');
                } catch (e: any) {
                  toast(e?.message ?? 'Could not rename this file');
                }
              }}
            />
          </>
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <InputField
            label="File name"
            value={newName}
            onChangeText={setNewName}
            suffix=".pdf"
            autoFocus
            selectTextOnFocus
            helper="Letters, numbers, spaces, - and _"
            error={newName && nameError ? nameError : undefined}
          />
        </View>
      </BottomSheet>

      {/* Delete */}
      <BottomSheet
        visible={sheet === 'delete'}
        onClose={() => setSheet(null)}
        title="Delete this PDF?"
        footer={
          <>
            <Button label="Cancel" kind="outline" fill onPress={() => setSheet(null)} />
            <Button
              label="Delete"
              kind="danger"
              fill
              onPress={async () => {
                if (!target) return;
                try {
                  await lib.remove(target.id);
                  setSheet(null);
                  toast('PDF deleted');
                } catch (e: any) {
                  toast(e?.message ?? 'Could not delete this file');
                }
              }}
            />
          </>
        }
      >
        <AppText variant="bodyMd" color={c.textSecondary} style={{ paddingHorizontal: 20 }}>
          “{target?.name}.pdf” will be permanently removed from this device. This can’t be undone.
        </AppText>
      </BottomSheet>

      {/* File info */}
      <BottomSheet visible={sheet === 'info'} onClose={() => setSheet(null)} title="File info">
        {target &&
          [
            ['Name', `${target.name}.pdf`],
            ['Size', formatSize(target.size)],
            ['Pages', String(target.pages)],
            ['Source', target.source],
            ['Location', target.external ? target.external.path.replace(/^\/storage\/emulated\/0\//, '') : 'MyPDF View'],
            ['Added', new Date(target.addedAt).toLocaleString()],
            ['Modified', new Date(target.modifiedAt).toLocaleString()],
            ['Bookmarks', String(target.bookmarks.length)],
            ['Highlights', String(target.highlights.length)],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 10 }}>
              <AppText variant="bodyMd" color={c.textTertiary}>
                {k}
              </AppText>
              <AppText variant="labelLg" style={{ flexShrink: 1, textAlign: 'right' }}>
                {v}
              </AppText>
            </View>
          ))}
      </BottomSheet>

      {/* First launch: ask to show the phone's PDFs */}
      <BottomSheet
        visible={askAccess}
        onClose={dismissAsk}
        title="See all your PDFs"
        footer={
          <>
            <Button label="Not now" kind="outline" fill onPress={dismissAsk} />
            <Button label="Allow access" fill onPress={() => { dismissAsk(); lib.requestDeviceAccess(); }} />
          </>
        }
      >
        <AppText variant="bodyMd" color={c.textSecondary} style={{ paddingHorizontal: 20 }}>
          MyPDF View can list every PDF already on your phone — Downloads, WhatsApp, email attachments and more — so you don’t have to add them one by one. Turn on “Allow access to manage all files” on the next screen. Your files stay on your phone.
        </AppText>
      </BottomSheet>

      {/* Sort */}
      <BottomSheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by">
        {SORTS.map((s) => (
          <ListItem key={s.key} title={s.title} subtitle={s.sub} icon={s.icon} selected={sort === s.key} onPress={() => saveSort(s.key)} />
        ))}
      </BottomSheet>
    </View>
  );
}
