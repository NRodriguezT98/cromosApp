export const Colors = {
  // Fondos
  bg: '#0B1120',
  bgCard: '#141E33',
  bgCardAlt: '#1A2540',
  bgSurface: '#0F1829',

  // Acentos principales
  red: '#E8003D',
  redDark: '#B5002F',
  redSoft: 'rgba(232,0,61,0.15)',

  // Dorado FOIL
  gold: '#FFD44D',
  goldDark: '#C8960A',
  goldGradientStart: '#FFE47A',
  goldGradientEnd: '#C8700A',

  // Estado de cromos
  owned: '#00C853',
  ownedSoft: 'rgba(0,200,83,0.15)',
  missing: '#3A4A6B',
  missingSoft: 'rgba(58,74,107,0.3)',
  duplicate: '#FF6D00',
  duplicateSoft: 'rgba(255,109,0,0.15)',

  // Texto
  textPrimary: '#FFFFFF',
  textSecondary: '#8A9BB5',
  textMuted: '#4A5A7A',
  textAccent: '#E8003D',

  // UI
  border: 'rgba(255,255,255,0.08)',
  borderBright: 'rgba(255,255,255,0.16)',
  overlay: 'rgba(11,17,32,0.85)',
  white: '#FFFFFF',
  black: '#000000',
};

// Escala tipográfica — diseño editorial deportivo
// Oswald Bold: encabezados, números grandes, nombres de selección
// DM Sans: texto de cuerpo, información secundaria
// DM Mono: códigos de cromo (MEX16, ARG7, etc.)
export const Typography = {
  // Display — números de progreso gigantes, portada
  displayXL: { fontFamily: 'Oswald_700Bold', fontSize: 80, lineHeight: 80, letterSpacing: -2 },
  displayL:  { fontFamily: 'Oswald_700Bold', fontSize: 56, lineHeight: 56, letterSpacing: -1 },
  displayM:  { fontFamily: 'Oswald_700Bold', fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },

  // Títulos — secciones, nombres de selección
  titleXL:   { fontFamily: 'Oswald_700Bold', fontSize: 32, lineHeight: 36, letterSpacing: 0 },
  titleL:    { fontFamily: 'Oswald_600SemiBold', fontSize: 26, lineHeight: 30, letterSpacing: 0 },
  titleM:    { fontFamily: 'Oswald_600SemiBold', fontSize: 20, lineHeight: 24, letterSpacing: 0.2 },
  titleS:    { fontFamily: 'Oswald_500Medium', fontSize: 16, lineHeight: 20, letterSpacing: 0.3 },

  // Cuerpo — DM Sans
  bodyL:     { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyM:     { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  bodyS:     { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 16, letterSpacing: 0 },

  // Énfasis — labels, badges, botones
  labelL:    { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 18, letterSpacing: 0.5 },
  labelM:    { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelS:    { fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 14, letterSpacing: 0.8 },

  // Monoespaciado — códigos de cromo
  codeL:     { fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
  codeM:     { fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cardStrong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  }),
};
