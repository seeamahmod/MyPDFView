import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, ListItem, ToolItem, TopAppBar } from '../../components/composites';
import { Icon, type IconName } from '../../components/Icon';
import { AppText, Button, ColorSwatch, IconButton, InputField, StrokeSize } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { flattenAnnotations, type Annotation } from '../../pdf/annotations';
import { PdfView, type PdfViewHandle, type PdfViewMessage, type ToolState } from '../../pdf/PdfView';
import { useLibrary } from '../../store/library';
import { useTheme } from '../../theme/ThemeProvider';
import { annotation, radius, shadows } from '../../theme/tokens';

type Tool = 'edit' | 'text' | 'draw' | 'shapes' | 'erase';
const TOOLS: { key: Tool; label: string; icon: IconName }[] = [
  { key: 'edit', label: 'Edit', icon: 'text' },
  { key: 'text', label: 'Text', icon: 'text-add' },
  { key: 'draw', label: 'Draw', icon: 'draw' },
  { key: 'shapes', label: 'Shapes', icon: 'shapes' },
  { key: 'erase', label: 'Erase', icon: 'eraser' },
];
const INK = Object.values(annotation.ink);
const WIDTHS = { S: 1.5, M: 3, L: 6 } as const;

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const toast = useToast();
  const doc = lib.docs.find((d) => d.id === id);
  const pdf = useRef<PdfViewHandle>(null);

  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState<string>(annotation.ink.black);
  const [size, setSize] = useState<'S' | 'M' | 'L'>('M');
  const [shape, setShape] = useState<'rect' | 'circle' | 'line' | 'arrow'>('rect');
  const [fontSize, setFontSize] = useState(14);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [anns, setAnns] = useState<Annotation[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [menu, setMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [textReq, setTextReq] = useState<{ page: number; x: number; y: number } | null>(null);
  const [editReq, setEditReq] = useState<{ page: number; rect: { x: number; y: number; w: number; h: number }; text: string; fontSize: number } | null>(null);
  const [draft, setDraft] = useState('');

  const dirty = anns.length > 0;

  const toolState = useCallback(
    (): ToolState => ({ mode: 'editor', tool, color, width: WIDTHS[size], shape, fontSize, bold, italic }),
    [tool, color, size, shape, fontSize, bold, italic],
  );
  useEffect(() => {
    if (loaded) pdf.current?.setTool(toolState());
  }, [toolState, loaded]);

  // Reset color to a sensible default when switching tools.
  const pickTool = (t: Tool) => {
    setTool(t);
    if (t === 'text' || t === 'shapes' || t === 'draw') setColor((cur) => (INK.includes(cur as any) ? cur : annotation.ink.black));
  };

  const onMessage = useCallback(
    async (m: PdfViewMessage) => {
      if (!doc) return;
      if (m.type === 'ready')
        pdf.current?.open({ data: await lib.base64Of(doc.id), annotations: [], mode: 'editor', page: doc.lastPage ?? 1, bg: c.bgCanvas, padTop: 12, padBottom: 200 });
      else if (m.type === 'loaded') {
        setLoaded(true);
        pdf.current?.setTool(toolState());
      } else if (m.type === 'annotations') {
        setAnns(m.annotations);
        setCanUndo(m.canUndo);
        setCanRedo(m.canRedo);
      } else if (m.type === 'requestText') {
        setDraft('');
        setTextReq({ page: m.page, x: m.x, y: m.y });
      } else if (m.type === 'requestEdit') {
        setDraft(m.text);
        setEditReq(m);
      } else if (m.type === 'toast' || m.type === 'error') toast(m.message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc?.id, c.bgCanvas, toolState],
  );

  const leave = () => (dirty ? setDiscard(true) : router.back());
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dirty) {
        setDiscard(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [dirty]);

  const save = async (asCopy: boolean) => {
    if (!doc) return;
    setMenu(false);
    setDiscard(false);
    setSaving(true);
    try {
      const bytes = await flattenAnnotations(await lib.bytesOf(doc.id), anns);
      if (asCopy) {
        const copy = await lib.addFromBytes(bytes, `${doc.name} (edited)`, doc.source);
        toast('Saved as a copy');
        router.replace(`/viewer/${copy.id}`);
      } else {
        await lib.replaceContent(doc.id, bytes);
        toast('Changes saved');
        router.back();
      }
    } catch (e: any) {
      toast(e?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const clearAll = useCallback(() => pdf.current?.clearAll(), []);

  if (!doc) return null;

  const options = (() => {
    const swatches = (list: string[]) => list.map((col) => <ColorSwatch key={col} color={col} selected={color === col} onPress={() => setColor(col)} />);
    const divider = <View style={{ width: 1, height: 24, backgroundColor: c.borderSubtle, marginHorizontal: 4 }} />;
    switch (tool) {
      case 'draw':
        return (
          <>
            {swatches(INK)}
            <View style={{ flex: 1 }} />
            {divider}
            {(['S', 'M', 'L'] as const).map((s) => (
              <StrokeSize key={s} size={s} selected={size === s} onPress={() => setSize(s)} />
            ))}
          </>
        );
      case 'text':
        return (
          <>
            {swatches(INK.slice(0, 3))}
            {divider}
            <IconButton icon="bold" selected={bold} onPress={() => setBold(!bold)} label="Bold" />
            <IconButton icon="italic" selected={italic} onPress={() => setItalic(!italic)} label="Italic" />
            <View style={{ flex: 1 }} />
            {divider}
            <IconButton icon="minus" onPress={() => setFontSize((f) => Math.max(8, f - 2))} label="Smaller text" />
            <AppText variant="labelLg" style={{ width: 24, textAlign: 'center' }}>
              {fontSize}
            </AppText>
            <IconButton icon="plus" onPress={() => setFontSize((f) => Math.min(48, f + 2))} label="Larger text" />
          </>
        );
      case 'shapes':
        return (
          <>
            {(['rect', 'circle', 'line', 'arrow'] as const).map((s) => (
              <IconButton key={s} icon={s === 'rect' ? 'square' : s === 'circle' ? 'circle' : s === 'line' ? 'line' : 'arrow-up-right'} selected={shape === s} onPress={() => setShape(s)} label={s} />
            ))}
            <View style={{ flex: 1 }} />
            {divider}
            {swatches(INK.slice(0, 3))}
          </>
        );
      case 'erase':
        return <Hint icon="eraser" text="Tap a drawing, shape or text box to erase it" action={{ label: 'Clear all', onPress: clearAll, disabled: !dirty }} />;
      case 'edit':
        return <Hint icon="info" text="Tap a line of text to edit it" />;
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
      <TopAppBar
        type="editor"
        title={doc.name}
        eyebrow="Editing"
        onBack={leave}
        actions={
          <>
            <IconButton icon="undo" disabled={!canUndo} onPress={() => pdf.current?.undo()} label="Undo" />
            <IconButton icon="redo" disabled={!canRedo} onPress={() => pdf.current?.redo()} label="Redo" />
            <Button size="small" label="Save" trailingIcon="chevron-down" disabled={saving} onPress={() => setMenu(true)} />
          </>
        }
      />

      <View style={{ flex: 1 }}>
        <PdfView ref={pdf} onMessage={onMessage} bg={c.bgCanvas} />
        {(!loaded || saving) && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: saving ? c.bgScrim : c.bgCanvas }}>
            <ActivityIndicator color={c.iconBrand} size="large" />
            {saving && (
              <AppText variant="bodyMd" color={c.textInverse}>
                Saving…
              </AppText>
            )}
          </View>
        )}
      </View>

      {/* Editor Dock — one solid panel */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.bgSurface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderTopWidth: 1,
          borderColor: c.borderSubtle,
          paddingTop: 12,
          gap: 4,
          shadowColor: c.shadow,
          ...shadows.sheet,
        }}
      >
        <View style={{ marginHorizontal: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderDefault, backgroundColor: c.bgSurface }}>
          {options}
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 4, paddingBottom: insets.bottom + 20 }}>
          {TOOLS.map((t) => (
            <ToolItem key={t.key} label={t.label} icon={t.icon} selected={tool === t.key} onPress={() => pickTool(t.key)} />
          ))}
        </View>
      </View>

      {/* Save menu */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1 }} onPress={() => setMenu(false)}>
          <View style={{ position: 'absolute', top: insets.top + 60, right: 8, width: 268, borderRadius: radius.md, paddingVertical: 6, backgroundColor: c.bgSurfaceRaised, shadowColor: c.shadow, ...shadows.md }}>
            <ListItem title="Save" subtitle={`Overwrite ${doc.name}.pdf`} icon="save" disabled={!dirty} onPress={() => save(false)} />
            <ListItem title="Save as copy" subtitle="Keep the original untouched" icon="duplicate" disabled={!dirty} onPress={() => save(true)} />
          </View>
        </Pressable>
      </Modal>

      {/* Add text */}
      <BottomSheet
        visible={!!textReq}
        onClose={() => setTextReq(null)}
        title="Add text"
        footer={
          <>
            <Button label="Cancel" kind="outline" fill onPress={() => setTextReq(null)} />
            <Button
              label="Add"
              fill
              disabled={!draft.trim()}
              onPress={() => {
                if (textReq) pdf.current?.addText(textReq.page, textReq.x, textReq.y, draft.trim());
                setTextReq(null);
              }}
            />
          </>
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <InputField label="Text" value={draft} onChangeText={setDraft} autoFocus multiline helper={`${fontSize} pt${bold ? ' · bold' : ''}${italic ? ' · italic' : ''}`} />
        </View>
      </BottomSheet>

      {/* Edit text */}
      <BottomSheet
        visible={!!editReq}
        onClose={() => setEditReq(null)}
        title="Edit text"
        subtitle="The original line is covered and replaced"
        footer={
          <>
            <Button label="Cancel" kind="outline" fill onPress={() => setEditReq(null)} />
            <Button
              label="Apply"
              fill
              disabled={!editReq || draft === editReq.text}
              onPress={() => {
                if (editReq) pdf.current?.applyEdit({ ...editReq, text: draft });
                setEditReq(null);
              }}
            />
          </>
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <InputField label="Text" value={draft} onChangeText={setDraft} autoFocus multiline />
        </View>
      </BottomSheet>

      {/* Discard */}
      <BottomSheet
        visible={discard}
        onClose={() => setDiscard(false)}
        title="Save your changes?"
        footer={
          <>
            <Button
              label="Discard"
              kind="outline"
              fill
              onPress={() => {
                setDiscard(false);
                router.back();
              }}
            />
            <Button label="Save" fill onPress={() => save(false)} />
          </>
        }
      >
        <AppText variant="bodyMd" color={c.textSecondary} style={{ paddingHorizontal: 20 }}>
          You have unsaved edits in “{doc.name}”. Save them to the PDF or discard them.
        </AppText>
      </BottomSheet>
    </View>
  );
}

function Hint({ icon, text, action }: { icon: IconName; text: string; action?: { label: string; onPress: () => void; disabled?: boolean } }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingLeft: 8 }}>
      <Icon name={icon} size={20} color={c.iconBrand} />
      <AppText variant="bodySm" color={c.textSecondary} style={{ flex: 1 }}>
        {text}
      </AppText>
      {action && <Button size="small" kind="ghost" label={action.label} onPress={action.onPress} disabled={action.disabled} />}
    </View>
  );
}
