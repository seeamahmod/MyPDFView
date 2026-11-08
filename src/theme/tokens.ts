// Design tokens mirrored from the Figma "MyPDF View" design system.
// Primitives → semantic colors (Light / Dark), spacing, radius, size, type.

export const primitives = {
  charcoal: { 50: '#F2F2F3', 100: '#E4E4E6', 200: '#C9C9CC', 300: '#A3A3A8', 400: '#6E6E73', 500: '#4A4A4E', 600: '#2A2A2A', 700: '#1F1F1F', 800: '#161616', 900: '#0E0E0E' },
  neutral: { 0: '#FFFFFF', 25: '#F8F8FF', 50: '#F1F1F8', 100: '#E6E6EF', 200: '#D5D5E0', 300: '#B8B8C7', 400: '#9393A5', 500: '#6E6E82', 600: '#535366', 700: '#3D3D4E', 800: '#282836', 900: '#17171F', 950: '#0D0D14' },
  red: { 50: '#FEECEC', 100: '#FDD8D6', 300: '#F58A82', 500: '#E5463B', 600: '#D12A1F', 700: '#A8211A', 900: '#4A0E0B' },
  green: { 50: '#E8F7EF', 300: '#7FD3A8', 600: '#1F8A5B', 700: '#176B46', 900: '#0A2E1E' },
  amber: { 50: '#FFF6D6', 300: '#FFD666', 500: '#E8A317', 700: '#8A5A00', 900: '#3D2800' },
} as const;

const p = primitives;

export type ColorTokens = {
  bgCanvas: string; bgSurface: string; bgSurfaceRaised: string; bgSurfaceSunken: string;
  bgSubtle: string; bgSubtlePressed: string; bgDisabled: string; bgInverse: string; bgScrim: string;
  bgBrand: string; bgBrandPressed: string; bgBrandSubtle: string; bgBrandSubtlePressed: string;
  bgDanger: string; bgDangerPressed: string; bgDangerSubtle: string; bgWarningSubtle: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textDisabled: string;
  textOnBrand: string; textBrand: string; textDanger: string; textWarning: string; textInverse: string;
  iconPrimary: string; iconSecondary: string; iconTertiary: string; iconBrand: string; iconOnBrand: string;
  iconDanger: string; iconDisabled: string; iconInverse: string; iconStar: string;
  borderDefault: string; borderSubtle: string; borderStrong: string; borderBrand: string;
  borderFocus: string; borderFocusRing: string; borderDanger: string;
  shadow: string;
};

export const light: ColorTokens = {
  bgCanvas: p.neutral[25], bgSurface: p.neutral[0], bgSurfaceRaised: p.neutral[0], bgSurfaceSunken: p.neutral[50],
  bgSubtle: p.neutral[50], bgSubtlePressed: p.neutral[100], bgDisabled: p.neutral[100], bgInverse: p.neutral[900], bgScrim: 'rgba(13,13,20,0.4)',
  bgBrand: p.charcoal[600], bgBrandPressed: p.charcoal[800], bgBrandSubtle: p.charcoal[100], bgBrandSubtlePressed: p.charcoal[200],
  bgDanger: p.red[600], bgDangerPressed: p.red[700], bgDangerSubtle: p.red[50], bgWarningSubtle: p.amber[50],
  textPrimary: p.neutral[900], textSecondary: p.neutral[600], textTertiary: p.neutral[500], textDisabled: p.neutral[400],
  textOnBrand: p.neutral[0], textBrand: p.charcoal[600], textDanger: p.red[600], textWarning: p.amber[700], textInverse: p.neutral[0],
  iconPrimary: p.neutral[900], iconSecondary: p.neutral[600], iconTertiary: p.neutral[500], iconBrand: p.charcoal[600], iconOnBrand: p.neutral[0],
  iconDanger: p.red[600], iconDisabled: p.neutral[300], iconInverse: p.neutral[0], iconStar: p.amber[500],
  borderDefault: p.neutral[200], borderSubtle: p.neutral[100], borderStrong: p.neutral[400], borderBrand: p.charcoal[600],
  borderFocus: p.charcoal[600], borderFocusRing: p.charcoal[300], borderDanger: p.red[600],
  shadow: '#0D0D14',
};

export const dark: ColorTokens = {
  bgCanvas: p.neutral[950], bgSurface: p.neutral[900], bgSurfaceRaised: p.neutral[800], bgSurfaceSunken: p.neutral[950],
  bgSubtle: p.neutral[800], bgSubtlePressed: p.neutral[700], bgDisabled: p.neutral[800], bgInverse: p.neutral[50], bgScrim: 'rgba(13,13,20,0.6)',
  bgBrand: p.charcoal[50], bgBrandPressed: p.charcoal[200], bgBrandSubtle: p.charcoal[500], bgBrandSubtlePressed: p.charcoal[400],
  bgDanger: p.red[500], bgDangerPressed: p.red[600], bgDangerSubtle: p.red[900], bgWarningSubtle: p.amber[900],
  textPrimary: p.neutral[50], textSecondary: p.neutral[300], textTertiary: p.neutral[400], textDisabled: p.neutral[600],
  textOnBrand: p.neutral[900], textBrand: p.charcoal[50], textDanger: p.red[300], textWarning: p.amber[300], textInverse: p.neutral[900],
  iconPrimary: p.neutral[50], iconSecondary: p.neutral[300], iconTertiary: p.neutral[400], iconBrand: p.charcoal[50], iconOnBrand: p.neutral[900],
  iconDanger: p.red[300], iconDisabled: p.neutral[600], iconInverse: p.neutral[900], iconStar: p.amber[300],
  borderDefault: p.neutral[700], borderSubtle: p.neutral[800], borderStrong: p.neutral[500], borderBrand: p.charcoal[100],
  borderFocus: p.charcoal[100], borderFocusRing: p.charcoal[400], borderDanger: p.red[300],
  shadow: '#000000',
};

export const annotation = {
  highlight: { yellow: '#FFE066', green: '#69DB7C', blue: '#74C0FC', pink: '#F783AC', orange: '#FFC78A' },
  ink: { black: '#17171F', red: '#E03131', blue: '#1C4DF5', green: '#2F9E44', purple: '#7048E8', orange: '#F08C00' },
} as const;

export const space = { 0: 0, 2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 16: 16, 20: 20, 24: 24, 28: 28, 32: 32, 40: 40, 48: 48, 64: 64 } as const;
export const radius = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, full: 999 } as const;
export const size = { iconXs: 16, iconSm: 20, iconMd: 24, iconLg: 28, controlSm: 32, controlMd: 40, controlLg: 48, controlXl: 56 } as const;

// Text styles — Roboto is the Android system font.
type TS = { fontSize: number; lineHeight: number; fontWeight: '400' | '500' | '700'; letterSpacing?: number; textTransform?: 'uppercase' };
export const type: Record<
  'h1' | 'h2' | 'h3' | 'titleMd' | 'bodyLg' | 'bodyMd' | 'bodySm' | 'labelLg' | 'labelMd' | 'labelSm' | 'caption' | 'overline',
  TS
> = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  titleMd: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  bodyLg: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  labelLg: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  labelSm: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '400' },
  overline: { fontSize: 10, lineHeight: 14, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase' },
};

export const shadows = {
  xs: { elevation: 1, shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  sm: { elevation: 2, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  md: { elevation: 4, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  lg: { elevation: 8, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  sheet: { elevation: 16, shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: -8 } },
} as const;
