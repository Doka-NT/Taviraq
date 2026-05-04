export interface ThemeColors {
  bgWindow: string
  bgTitlebar: string
  bgTabbar: string
  bgTerminal: string
  bgSidebar: string
  bgCard: string
  bgComboboxList: string
  bgModal: string

  textPrimary: string
  textSecondary: string
  textMuted: string
  textGhost: string
  textIconDefault: string
  textIconHover: string

  borderStrong: string
  borderDefault: string
  borderSubtle: string

  accentBrand: string
  accentCyan: string
  accentGreen: string
  accentAmber: string
  accentRed: string
  accentRedText: string
  accentBrandSelection: string
  accentCyanSelection: string

  bgHover4: string
  bgHover6: string
  bgHover7: string
  bgHover9: string
  bgHover10: string
  bgHover14: string

  overlayBackdrop: string
  scrollbarColor: string

  surfaceRgb: string
  accentBrandRgb: string
  accentCyanRgb: string
  accentGreenRgb: string
  accentAmberRgb: string
  accentRedRgb: string
}

export interface TerminalColors {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface AppTheme {
  id: string
  name: string
  appearance: 'dark' | 'light'
  colors: ThemeColors
  terminal: TerminalColors
}
