import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadows, space, type as T } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

/* ---------- Typography ---------- */
export type TextVariant = keyof typeof T;
export function AppText({ variant = 'bodyMd', color, style, ...rest }: TextProps & { variant?: TextVariant; color?: string }) {
  const { c } = useTheme();
  return <Text {...rest} style={[T[variant], { color: color ?? c.textPrimary }, style]} />;
}

/* ---------- Button ---------- */
type ButtonStyle = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export function Button({
  label,
  onPress,
  kind = 'primary',
  size = 'large',
  disabled,
  leadingIcon,
  trailingIcon,
  style,
  fill,
}: {
  label: string;
  onPress?: () => void;
  kind?: ButtonStyle;
  size?: 'large' | 'small';
  disabled?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  fill?: boolean;
}) {
  const { c } = useTheme();
  const map = {
    primary: { bg: c.bgBrand, bgP: c.bgBrandPressed, fg: c.textOnBrand },
    secondary: { bg: c.bgBrandSubtle, bgP: c.bgBrandSubtlePressed, fg: c.textBrand },
    outline: { bg: c.bgSurface, bgP: c.bgSubtle, fg: c.textPrimary, border: c.borderDefault },
    ghost: { bg: 'transparent', bgP: c.bgSubtlePressed, fg: c.textBrand },
    danger: { bg: c.bgDanger, bgP: c.bgDangerPressed, fg: c.textOnBrand },
  }[kind];
  const fg = disabled ? c.textDisabled : map.fg;
  const isz = size === 'large' ? 20 : 18;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          height: size === 'large' ? 48 : 32,
          paddingHorizontal: size === 'large' ? space[20] : space[16],
          backgroundColor: disabled ? (kind === 'ghost' ? 'transparent' : c.bgDisabled) : pressed ? map.bgP : map.bg,
          borderColor: 'border' in map ? (disabled ? c.borderSubtle : map.border) : 'transparent',
          borderWidth: 'border' in map ? 1 : 0,
        },
        fill && { flex: 1 },
        style,
      ]}
    >
      {leadingIcon && <Icon name={leadingIcon} size={isz} color={fg} />}
      <AppText variant="labelLg" color={fg} numberOfLines={1}>
        {label}
      </AppText>
      {trailingIcon && <Icon name={trailingIcon} size={isz} color={fg} />}
    </Pressable>
  );
}

/* ---------- Icon Button ---------- */
export function IconButton({
  icon,
  onPress,
  kind = 'ghost',
  selected,
  disabled,
  size = 40,
  color,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  kind?: 'ghost' | 'tonal' | 'filled';
  selected?: boolean;
  disabled?: boolean;
  size?: number;
  color?: string;
  label?: string;
}) {
  const { c } = useTheme();
  const base = kind === 'filled' ? c.bgBrand : kind === 'tonal' ? c.bgSubtle : 'transparent';
  const iconColor = disabled
    ? c.iconDisabled
    : kind === 'filled'
      ? c.iconOnBrand
      : selected
        ? c.iconBrand
        : (color ?? c.iconPrimary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          backgroundColor: disabled
            ? kind === 'ghost'
              ? 'transparent'
              : c.bgDisabled
            : selected
              ? kind === 'filled'
                ? c.bgBrandPressed
                : c.bgBrandSubtle
              : pressed
                ? kind === 'filled'
                  ? c.bgBrandPressed
                  : c.bgSubtlePressed
                : base,
        },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.6)} color={iconColor} />
    </Pressable>
  );
}

/* ---------- Chip ---------- */
export function Chip({
  label,
  count,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  count?: number | string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.bgBrand : disabled ? c.bgDisabled : pressed ? c.bgSubtlePressed : c.bgSurface,
          borderColor: selected ? c.bgBrand : disabled ? c.borderSubtle : c.borderDefault,
        },
      ]}
    >
      {selected && <Icon name="check" size={16} color={c.iconOnBrand} />}
      <AppText variant="labelLg" color={selected ? c.textOnBrand : disabled ? c.textDisabled : c.textSecondary}>
        {label}
      </AppText>
      {count !== undefined && count !== '' && (
        <AppText variant="labelMd" color={selected ? c.textOnBrand : c.textTertiary} style={selected && { opacity: 0.8 }}>
          {count}
        </AppText>
      )}
    </Pressable>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ value, onChange, disabled }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange?.(!value)}
      hitSlop={8}
      style={[
        styles.toggle,
        {
          backgroundColor: value ? c.bgBrand : c.bgSubtlePressed,
          borderColor: c.borderStrong,
          borderWidth: value ? 0 : 2,
          justifyContent: value ? 'flex-end' : 'flex-start',
          paddingLeft: value ? 4 : 6,
          paddingRight: value ? 4 : 2,
          opacity: disabled ? 0.38 : 1,
        },
      ]}
    >
      <View
        style={{
          width: value ? 24 : 16,
          height: value ? 24 : 16,
          borderRadius: 12,
          backgroundColor: value ? c.textOnBrand : c.iconSecondary,
        }}
      />
    </Pressable>
  );
}

/* ---------- Input Field ---------- */
export function InputField({
  label,
  suffix,
  helper,
  error,
  disabled,
  leadingIcon,
  style,
  ...input
}: TextInputProps & {
  label?: string;
  suffix?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  leadingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.borderDanger : focused ? c.borderFocus : disabled ? c.borderSubtle : c.borderDefault;
  return (
    <View style={[{ gap: space[6] }, style]}>
      <View
        style={[
          styles.field,
          { backgroundColor: disabled ? c.bgDisabled : c.bgSurface, borderColor, borderWidth: error || focused ? 2 : 1 },
        ]}
      >
        {leadingIcon && <Icon name={leadingIcon} size={20} color={disabled ? c.iconDisabled : c.iconSecondary} />}
        <View style={{ flex: 1 }}>
          {!!label && (
            <AppText variant="labelSm" color={error ? c.textDanger : focused ? c.textBrand : disabled ? c.textDisabled : c.textSecondary}>
              {label}
            </AppText>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              {...input}
              editable={!disabled}
              onFocus={(e) => {
                setFocused(true);
                input.onFocus?.(e);
              }}
              onBlur={(e) => {
                setFocused(false);
                input.onBlur?.(e);
              }}
              placeholderTextColor={c.textTertiary}
              selectionColor={c.borderFocus}
              cursorColor={c.borderFocus}
              style={[T.bodyLg, { flex: 1, color: disabled ? c.textDisabled : c.textPrimary, padding: 0, margin: 0 }]}
            />
            {!!suffix && (
              <AppText variant="bodyLg" color={c.textTertiary}>
                {suffix}
              </AppText>
            )}
          </View>
        </View>
        {focused && !!input.value && (
          <Pressable hitSlop={10} onPress={() => input.onChangeText?.('')} accessibilityLabel="Clear">
            <Icon name="close" size={20} color={c.iconTertiary} />
          </Pressable>
        )}
      </View>
      {(error || helper) && (
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: space[16] }}>
          {!!error && <Icon name="alert" size={14} color={c.iconDanger} />}
          <AppText variant="bodySm" color={error ? c.textDanger : c.textTertiary}>
            {error || helper}
          </AppText>
        </View>
      )}
    </View>
  );
}

/* ---------- Tag ---------- */
export function Tag({ label, kind = 'overlay' }: { label: string; kind?: 'overlay' | 'brand' | 'neutral' | 'danger' }) {
  const { c } = useTheme();
  const m = {
    overlay: [c.bgInverse, c.textInverse],
    brand: [c.bgBrandSubtle, c.textBrand],
    neutral: [c.bgSubtle, c.textSecondary],
    danger: [c.bgDangerSubtle, c.textDanger],
  }[kind];
  return (
    <View style={{ backgroundColor: m[0], borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 2, opacity: kind === 'overlay' ? 0.85 : 1 }}>
      <AppText variant="labelSm" color={m[1]}>
        {label}
      </AppText>
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.borderSubtle, marginHorizontal: inset }} />;
}

export function DragHandle() {
  const { c } = useTheme();
  return (
    <View style={{ height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderDefault }} />
    </View>
  );
}

/* ---------- Color Swatch / Stroke Size ---------- */
export function ColorSwatch({ color, selected, onPress }: { color: string; selected?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Color ${color}`}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 0,
        borderColor: c.borderBrand,
      }}
    >
      <View
        style={{
          width: selected ? 26 : 28,
          height: selected ? 26 : 28,
          borderRadius: 14,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: c.borderSubtle,
        }}
      />
    </Pressable>
  );
}

export function StrokeSize({ size, selected, onPress }: { size: 'S' | 'M' | 'L'; selected?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const d = size === 'S' ? 6 : size === 'M' ? 10 : 14;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Stroke size ${size}`}
      accessibilityState={{ selected }}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? c.bgBrandSubtle : 'transparent',
      }}
    >
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: selected ? c.iconBrand : c.iconSecondary }} />
    </Pressable>
  );
}

/* ---------- Banner ---------- */
export function Banner({ message, icon = 'info', kind = 'info' }: { message: string; icon?: IconName; kind?: 'info' | 'neutral' | 'warning' }) {
  const { c } = useTheme();
  const m = {
    info: [c.bgBrandSubtle, c.textBrand, c.iconBrand],
    neutral: [c.bgInverse, c.textInverse, c.iconInverse],
    warning: [c.bgWarningSubtle, c.textWarning, c.iconPrimary],
  }[kind];
  return (
    <View style={{ flexDirection: 'row', gap: space[8], alignItems: 'center', backgroundColor: m[0], borderRadius: radius.md, paddingHorizontal: space[16], paddingVertical: space[10] }}>
      <Icon name={icon} size={18} color={m[2]} />
      <AppText variant="bodySm" color={m[1]} style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

/* ---------- FAB / Page indicator / Zoom ---------- */
export function FAB({ icon = 'plus', onPress, style }: { icon?: IconName; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Import PDF"
      onPress={onPress}
      style={({ pressed }) => [
        { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.bgBrandPressed : c.bgBrand, shadowColor: c.shadow, ...shadows.lg },
        style,
      ]}
    >
      <Icon name={icon} size={24} color={c.iconOnBrand} />
    </Pressable>
  );
}

export function PageIndicator({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 44, justifyContent: 'center', backgroundColor: c.bgSurfaceRaised, borderRadius: radius.full, paddingHorizontal: 16, shadowColor: c.shadow, ...shadows.md }}>
      <AppText variant="labelMd" color={c.textPrimary}>
        {label}
      </AppText>
    </View>
  );
}

export function ZoomControl({ value, onIn, onOut }: { value: number; onIn: () => void; onOut: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, padding: 2, borderRadius: radius.full, backgroundColor: c.bgSurfaceRaised, shadowColor: c.shadow, ...shadows.md }}>
      <IconButton icon="minus" onPress={onOut} label="Zoom out" />
      <AppText variant="labelMd" style={{ width: 44, textAlign: 'center' }}>
        {Math.round(value * 100)}%
      </AppText>
      <IconButton icon="plus" onPress={onIn} label="Zoom in" />
    </View>
  );
}

/** Appears only while zoomed; one tap returns the page to screen width. */
export function FitButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fit to screen"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 16,
        borderRadius: radius.full,
        backgroundColor: pressed ? c.bgBrandPressed : c.bgBrand,
        shadowColor: c.shadow,
        ...shadows.md,
      })}
    >
      <Icon name="fit-width" size={20} color={c.iconOnBrand} />
      <AppText variant="labelLg" color={c.textOnBrand}>
        Fit
      </AppText>
    </Pressable>
  );
}

/* ---------- Surface helper ---------- */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.md, shadowColor: c.shadow, ...shadows.xs }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8], borderRadius: radius.full },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space[6], height: 32, paddingHorizontal: space[12], borderRadius: radius.full, borderWidth: 1 },
  toggle: { width: 52, height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: space[8], minHeight: 56, paddingHorizontal: space[16], paddingVertical: space[8], borderRadius: radius.md },
});
