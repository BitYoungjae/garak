import { buildGarakConfigPath, isJsonObject, loadJsonFileSync, readNumber } from './json-file.js';

export interface ThemeColors {
  background: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  progress: {
    track: string;
    fill: string;
    knob: string;
  };
  button: {
    normal: string;
    hover: string;
    disabled: string;
  };
}

export interface Theme {
  colors: ThemeColors;
  borderRadius?: number;
  fontFamily?: string;
}

type ResolvedTheme = Theme & {
  borderRadius: number;
  fontFamily: string;
};

const THEME_FILE_NAME = 'theme.json';
const BORDER_RADIUS_MIN = 0;
const BORDER_RADIUS_MAX = 100;

const DEFAULT_THEME: Readonly<ResolvedTheme> = {
  colors: {
    background: 'rgba(9, 9, 11, 0.95)',
    border: '#71717A',
    text: {
      primary: '#E4E4E7',
      secondary: '#A1A1AA',
      muted: '#71717A',
    },
    progress: {
      track: '#27272A',
      fill: '#94A3B8',
      knob: '#E4E4E7',
    },
    button: {
      normal: '#E4E4E7',
      hover: '#FFFFFF',
      disabled: '#52525B',
    },
  },
  borderRadius: 14,
  fontFamily: 'Pretendard, sans-serif',
};

function createDefaultTheme(): ResolvedTheme {
  return {
    ...DEFAULT_THEME,
    colors: {
      ...DEFAULT_THEME.colors,
      text: { ...DEFAULT_THEME.colors.text },
      progress: { ...DEFAULT_THEME.colors.progress },
      button: { ...DEFAULT_THEME.colors.button },
    },
  };
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export class ThemeService {
  private theme: ResolvedTheme = createDefaultTheme();

  get colors(): ThemeColors {
    return this.theme.colors;
  }

  get borderRadius(): number {
    return this.theme.borderRadius;
  }

  get fontFamily(): string {
    return this.theme.fontFamily;
  }

  loadSync(): void {
    const themePath = buildGarakConfigPath(THEME_FILE_NAME);
    try {
      const parsed = loadJsonFileSync(themePath);
      this.theme = this.mergeTheme(parsed);
    } catch (error) {
      console.warn(`Theme load error at ${themePath}, using defaults:`, error);
      this.theme = createDefaultTheme();
    }
  }

  private mergeTheme(input: unknown): ResolvedTheme {
    if (!isJsonObject(input)) {
      return createDefaultTheme();
    }

    const colors = isJsonObject(input.colors) ? input.colors : {};
    const text = isJsonObject(colors.text) ? colors.text : {};
    const progress = isJsonObject(colors.progress) ? colors.progress : {};
    const button = isJsonObject(colors.button) ? colors.button : {};
    const defaultBorderRadius = DEFAULT_THEME.borderRadius;
    const defaultFontFamily = DEFAULT_THEME.fontFamily;

    return {
      colors: {
        background: readString(colors.background, DEFAULT_THEME.colors.background),
        border: readString(colors.border, DEFAULT_THEME.colors.border),
        text: {
          primary: readString(text.primary, DEFAULT_THEME.colors.text.primary),
          secondary: readString(text.secondary, DEFAULT_THEME.colors.text.secondary),
          muted: readString(text.muted, DEFAULT_THEME.colors.text.muted),
        },
        progress: {
          track: readString(progress.track, DEFAULT_THEME.colors.progress.track),
          fill: readString(progress.fill, DEFAULT_THEME.colors.progress.fill),
          knob: readString(progress.knob, DEFAULT_THEME.colors.progress.knob),
        },
        button: {
          normal: readString(button.normal, DEFAULT_THEME.colors.button.normal),
          hover: readString(button.hover, DEFAULT_THEME.colors.button.hover),
          disabled: readString(button.disabled, DEFAULT_THEME.colors.button.disabled),
        },
      },
      borderRadius: readNumber(
        input.borderRadius,
        defaultBorderRadius,
        BORDER_RADIUS_MIN,
        BORDER_RADIUS_MAX
      ),
      fontFamily: readString(input.fontFamily, defaultFontFamily),
    };
  }
}
