import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { AppText } from './primitives';

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
      }, 2600);
    },
    [opacity],
  );
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, opacity, alignItems: 'center' }}>
          <View style={{ backgroundColor: c.bgInverse, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 420 }}>
            <AppText variant="bodyMd" color={c.textInverse}>
              {msg}
            </AppText>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
