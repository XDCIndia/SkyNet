export const tokens = {
  background: {
    void: '#020408',
    deep: '#05080F',
    surface: '#080D18',
    raised: '#0C1220',
    lifted: '#101828',
  },
  blue: {
    50: '#E6F4FF',
    100: '#B3DEFF',
    200: '#80C8FF',
    300: '#4DB2FF',
    400: '#1E90FF',
    500: '#1873CC',
    600: '#125699',
  },
  text: {
    primary: '#F0F4F8',
    secondary: '#94A3B8',
    muted: '#64748B',
    dimmed: '#475569',
  },
  border: {
    subtle: 'rgba(30, 144, 255, 0.06)',
    card: 'rgba(30, 144, 255, 0.12)',
    glow: 'rgba(77, 178, 255, 0.30)',
    input: 'rgba(30, 144, 255, 0.10)',
    interactive: 'rgba(77, 178, 255, 0.40)',
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.50)',
    md: '0 4px 12px rgba(0,0,0,0.60), 0 0 24px -4px rgba(77,178,255,0.15)',
    lg: '0 8px 24px rgba(0,0,0,0.70), 0 0 32px -4px rgba(77,178,255,0.15)',
    inset: 'inset 0 1px 2px rgba(0,0,0,0.40)',
    blueGlow: 'rgba(77,178,255,0.15)',
  },
  font: {
    heading: 'var(--font-dm-sans)',
    body: 'var(--font-dm-sans)',
    mono: 'var(--font-jetbrains-mono)',
    section: 'var(--font-jetbrains-mono)',
  },
} as const;
