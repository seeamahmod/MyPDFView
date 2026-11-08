import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText, Button } from '../components/primitives';
import { useLibrary } from '../store/library';
import { useTheme } from '../theme/ThemeProvider';

export default function Incoming() {
  const { uri, share } = useLocalSearchParams<{ uri?: string; share?: string }>();
  const lib = useLibrary();
  const { c } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!lib.loaded || started.current) return;
    started.current = true;
    (async () => {
      try {
        // Expo Router already decoded the param once — use it as-is. Decoding again would
        // turn content://…/msf%3A1000 into a different URI that Android can't resolve.
        let target: string | null = uri ?? null;
        let name: string | undefined;
        if (!target || share) {
          const items = await Sharing.getResolvedSharedPayloadsAsync();
          const pdf = items.find((p) => p.contentUri && (p.contentMimeType?.includes('pdf') || p.originalName?.toLowerCase().endsWith('.pdf')));
          if (pdf?.contentUri) {
            target = pdf.contentUri;
            name = pdf.originalName ?? undefined;
          }
          Sharing.clearSharedPayloads();
        }
        if (!target) throw new Error('No PDF was shared with the app.');
        const doc = await lib.importPdf(target, name);
        router.replace(`/viewer/${doc.id}`);
      } catch (e: any) {
        setError(e?.message ?? 'Could not open this file.');
      }
    })();
  }, [lib.loaded, lib, uri, share]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: c.bgCanvas }}>
      {error ? (
        <>
          <AppText variant="h3">Couldn’t open file</AppText>
          <AppText variant="bodyMd" color={c.textSecondary} style={{ textAlign: 'center' }}>
            {error}
          </AppText>
          <Button label="Go to My PDFs" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={c.iconBrand} size="large" />
          <AppText variant="bodyMd" color={c.textSecondary}>
            Opening PDF…
          </AppText>
        </>
      )}
    </View>
  );
}
