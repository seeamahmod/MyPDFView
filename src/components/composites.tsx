import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadows, space } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { AppText, DragHandle, IconButton, Tag } from './primitives';

/* ---------- List Item ---------- */
export function ListItem({
  title,
  subtitle,
  icon,
  onPress,
  selected,
  destructive,
  disabled,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  const { c } = useTheme();
  const ic = disabled ? c.iconDisabled : destructive ? c.iconDanger : selected ? c.iconBrand : c.iconSecondary;
  const tc = disabled ? c.textDisabled : destructive ? c.textDanger : selected ? c.textBrand : c.textPrimary;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.listItem,
        { backgroundColor: selected ? c.bgBrandSubtle : pressed ? c.bgSubtle : 'transparent' },
      ]}
    >
      {icon && <Icon name={icon} size={24} color={ic} />}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="labelLg" color={tc} numberOfLines={1}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText variant="bodySm" color={disabled ? c.textDisabled : c.textTertiary} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {trailing ?? (selected ? <Icon name="check" size={24} color={c.iconBrand} /> : null)}
    </Pressable>
  );
}

/* ---------- Bottom Nav ---------- */
export type NavKey = 'files' | 'recent' | 'starred';
const NAV: { key: NavKey; label: string; icon: IconName }[] = [
  { key: 'files', label: 'Files', icon: 'folder' },
  { key: 'recent', label: 'Recent', icon: 'clock' },
  { key: 'starred', label: 'Starred', icon: 'star' },
];
export function BottomNavBar({ active, onChange }: { active: NavKey; onChange: (k: NavKey) => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { backgroundColor: c.bgSurface, borderTopColor: c.borderSubtle, paddingBottom: insets.bottom + 16 }]}>
      {NAV.map((n) => {
        const on = n.key === active;
        return (
          <Pressable
            key={n.key}
            style={styles.navItem}
            onPress={() => onChange(n.key)}
            accessibilityRole="tab"
            accessibilityLabel={n.label}
            accessibilityState={{ selected: on }}
          >
            {({ pressed }) => (
              <>
                {/* Press feedback lives on the fully rounded pill, as in the design. */}
                <View style={[styles.navPill, { backgroundColor: on ? (pressed ? c.bgBrandPressed : c.bgBrand) : pressed ? c.bgSubtlePressed : 'transparent' }]}>
                  <Icon name={n.icon} size={24} color={on ? c.iconOnBrand : c.iconTertiary} />
                </View>
                <AppText variant="labelMd" color={on ? c.textPrimary : c.textTertiary}>
                  {n.label}
                </AppText>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Tool Item ---------- */
export function ToolItem({ label, icon, selected, disabled, onPress }: { label: string; icon: IconName; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={styles.toolItem}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.toolPill, { backgroundColor: selected ? (pressed ? c.bgBrandPressed : c.bgBrand) : pressed ? c.bgSubtlePressed : 'transparent' }]}>
            <Icon name={icon} size={22} color={selected ? c.iconOnBrand : disabled ? c.iconDisabled : c.iconSecondary} />
          </View>
          <AppText variant="labelSm" color={selected ? c.textBrand : disabled ? c.textDisabled : c.textSecondary} numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

/* ---------- Top App Bar ---------- */
export function TopAppBar({
  type,
  title,
  eyebrow,
  onBack,
  actions,
}: {
  type: 'home' | 'viewer' | 'editor';
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (type === 'home')
    return (
      <View style={[styles.bar, { paddingTop: insets.top + 16, paddingBottom: 8, paddingLeft: 20, paddingRight: 8, backgroundColor: c.bgCanvas }]}>
        <View style={{ flex: 1, gap: 2 }}>
          {!!eyebrow && (
            <AppText variant="bodySm" color={c.textTertiary}>
              {eyebrow}
            </AppText>
          )}
          <AppText variant="h1">{title}</AppText>
        </View>
        <View style={styles.actions}>{actions}</View>
      </View>
    );
  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top + 8, paddingBottom: 8, paddingLeft: 4, paddingRight: 8, minHeight: insets.top + 64, backgroundColor: c.bgSurface, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, gap: 4 },
      ]}
    >
      <IconButton icon={type === 'viewer' ? 'arrow-left' : 'close'} onPress={onBack} label={type === 'viewer' ? 'Back' : 'Close editor'} />
      <View style={{ flex: 1, paddingLeft: 4 }}>
        {type === 'editor' && !!eyebrow && (
          <AppText variant="overline" color={c.textBrand}>
            {eyebrow}
          </AppText>
        )}
        <AppText variant="titleMd" numberOfLines={1}>
          {title}
        </AppText>
        {type === 'viewer' && !!eyebrow && (
          <AppText variant="bodySm" color={c.textTertiary}>
            {eyebrow}
          </AppText>
        )}
      </View>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

/* ---------- Bottom Sheet ---------- */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [y] = useState(() => new Animated.Value(400));
  useEffect(() => {
    if (visible) {
      y.setValue(400);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    }
  }, [visible, y]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.bgScrim }]} onPress={onClose} accessibilityLabel="Close sheet" />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.bgSurfaceRaised, shadowColor: c.shadow, paddingBottom: insets.bottom + 24, maxHeight: height - insets.top - 48, transform: [{ translateY: y }] },
          ]}
        >
          <DragHandle />
          {!!title && <SheetHeader title={title} subtitle={subtitle} onClose={onClose} />}
          {scroll ? (
            <ScrollView style={{ flexGrow: 0, maxHeight: 600 }} contentContainerStyle={{ paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingVertical: 8 }}>{children}</View>
          )}
          {footer && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16 }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: 20, paddingRight: 8, paddingVertical: 4, gap: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="h3" numberOfLines={1}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText variant="bodySm" color={c.textTertiary} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {onClose && <IconButton icon="close" onPress={onClose} label="Close" />}
    </View>
  );
}

/* ---------- Thumbnails ---------- */
function Thumb({ uri, style }: { uri?: string; style: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      ) : (
        <Icon name="file" size={28} color={c.iconDisabled} />
      )}
    </View>
  );
}

export function FileCard({
  name,
  meta,
  pages,
  starred,
  thumb,
  width,
  onPress,
  onMore,
}: {
  name: string;
  meta: string;
  pages: string;
  starred?: boolean;
  thumb?: string;
  width: number;
  onPress: () => void;
  onMore: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ width, gap: 8 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
        {({ pressed }) => (
          <View>
            <Thumb
              uri={thumb}
              style={{
                width,
                height: Math.round(width * 1.34),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: c.borderSubtle,
                padding: 12,
                backgroundColor: pressed ? c.bgSubtlePressed : c.bgSurface,
                shadowColor: c.shadow,
                ...shadows.xs,
              }}
            />
            <View style={{ position: 'absolute', left: 8, bottom: 8 }}>
              <Tag label={pages} />
            </View>
            {starred && (
              <View style={[styles.starBadge, { backgroundColor: c.bgSurface, shadowColor: c.shadow }]}>
                <Icon name="star-filled" size={16} color={c.iconStar} />
              </View>
            )}
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="labelLg" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="bodySm" color={c.textTertiary} numberOfLines={1}>
            {meta}
          </AppText>
        </View>
        <IconButton icon="more-vertical" onPress={onMore} label={`More options for ${name}`} />
      </View>
    </View>
  );
}

export function FileRow({
  name,
  meta,
  starred,
  thumb,
  onPress,
  onMore,
}: {
  name: string;
  meta: string;
  starred?: boolean;
  thumb?: string;
  onPress: () => void;
  onMore: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => [styles.fileRow, { backgroundColor: pressed ? c.bgSubtle : c.bgSurface, shadowColor: c.shadow }]}
    >
      <Thumb uri={thumb} style={{ width: 40, height: 52, borderRadius: radius.xs, borderWidth: 1, borderColor: c.borderDefault }} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText variant="labelLg" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </AppText>
          {starred && <Icon name="star-filled" size={16} color={c.iconStar} />}
        </View>
        <AppText variant="bodySm" color={c.textTertiary} numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <IconButton icon="more-vertical" onPress={onMore} label={`More options for ${name}`} />
    </Pressable>
  );
}

export function PageThumbnail({ uri, page, current, onPress, width = 104 }: { uri?: string; page: number; current?: boolean; onPress?: () => void; width?: number }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ width, alignItems: 'center', gap: 8 }} accessibilityLabel={`Page ${page}`}>
      <Thumb
        uri={uri}
        style={{ width, height: Math.round(width * 1.34), borderRadius: radius.sm, borderWidth: current ? 2 : 1, borderColor: current ? c.borderBrand : c.borderSubtle }}
      />
      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: current ? c.bgBrand : 'transparent' }}>
        <AppText variant="labelMd" color={current ? c.textOnBrand : c.textSecondary}>
          {page}
        </AppText>
      </View>
    </Pressable>
  );
}

export function FormatOption({
  title,
  description,
  icon,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  icon: IconName;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityState={{ selected, disabled }}
      style={{
        flexBasis: '30%',
        flexGrow: 1,
        gap: 6,
        padding: 12,
        borderRadius: radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.borderBrand : c.borderDefault,
        backgroundColor: selected ? c.bgBrandSubtle : disabled ? c.bgDisabled : c.bgSurface,
      }}
    >
      <Icon name={icon} size={24} color={selected ? c.iconBrand : disabled ? c.iconDisabled : c.iconSecondary} />
      <AppText variant="labelLg" color={selected ? c.textBrand : disabled ? c.textDisabled : c.textPrimary}>
        {title}
      </AppText>
      <AppText variant="bodySm" color={disabled ? c.textDisabled : c.textTertiary}>
        {description}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space[16], minHeight: 56, paddingHorizontal: space[20], paddingVertical: space[8] },
  nav: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  navPill: { width: 56, height: 32, borderRadius: radius.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  toolItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  toolPill: { width: 44, height: 32, borderRadius: radius.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  sheet: { borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], paddingTop: 4, ...shadows.sheet },
  starBadge: { position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...shadows.xs },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 12, borderRadius: radius.md, ...shadows.xs },
});
