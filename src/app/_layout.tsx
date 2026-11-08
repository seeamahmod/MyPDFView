import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../components/Toast';
import { PdfEngineProvider } from '../pdf/PdfEngine';
import { LibraryProvider } from '../store/library';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

function Shell() {
  const { c, isDark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bgCanvas).catch(() => {});
  }, [c.bgCanvas]);
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bgCanvas }, animation: 'slide_from_right' }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <PdfEngineProvider>
            <LibraryProvider>
              <Shell />
            </LibraryProvider>
          </PdfEngineProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
