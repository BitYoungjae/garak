import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export interface ThemeColors {
  background: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  accent: {
    playing: string;
    paused: string;
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

const DEFAULT_THEME: Theme = {
  colors: {
    background: 'rgba(9, 9, 11, 0.95)',
    border: '#71717A',
    text: {
      primary: '#E4E4E7',
      secondary: '#A1A1AA',
      muted: '#71717A',
    },
    accent: {
      playing: '#81C784',
      paused: '#52525B',
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

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class ThemeService {
  private theme: Theme = deepClone(DEFAULT_THEME);

  get colors(): ThemeColors {
    return this.theme.colors;
  }

  get borderRadius(): number {
    return this.theme.borderRadius ?? DEFAULT_THEME.borderRadius!;
  }

  get fontFamily(): string {
    return this.theme.fontFamily ?? DEFAULT_THEME.fontFamily!;
  }

  async load(): Promise<void> {
    const configDir = GLib.get_user_config_dir();
    const themePath = GLib.build_filenamev([configDir, 'garak', 'theme.json']);
    const file = Gio.File.new_for_path(themePath);

    try {
      const [contents] = await new Promise<[Uint8Array, string | null]>((resolve, reject) => {
        file.load_contents_async(null, (source, result) => {
          try {
            const [success, contents, etag] = (source as Gio.File).load_contents_finish(result);
            if (success) {
              resolve([contents, etag]);
            } else {
              reject(new Error('Failed to load theme file'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      const decoder = new TextDecoder('utf-8');
      const json = decoder.decode(contents);
      const parsed = JSON.parse(json);
      this.theme = this.mergeTheme(parsed);
    } catch (e) {
      if (e instanceof Error && !e.message.includes('No such file')) {
        console.warn('Theme load error, using defaults:', e);
      }
      this.theme = deepClone(DEFAULT_THEME);
    }
  }

  private mergeTheme(parsed: Partial<Theme>): Theme {
    return {
      colors: {
        background: parsed.colors?.background ?? DEFAULT_THEME.colors.background,
        border: parsed.colors?.border ?? DEFAULT_THEME.colors.border,
        text: {
          primary: parsed.colors?.text?.primary ?? DEFAULT_THEME.colors.text.primary,
          secondary: parsed.colors?.text?.secondary ?? DEFAULT_THEME.colors.text.secondary,
          muted: parsed.colors?.text?.muted ?? DEFAULT_THEME.colors.text.muted,
        },
        accent: {
          playing: parsed.colors?.accent?.playing ?? DEFAULT_THEME.colors.accent.playing,
          paused: parsed.colors?.accent?.paused ?? DEFAULT_THEME.colors.accent.paused,
        },
        progress: {
          track: parsed.colors?.progress?.track ?? DEFAULT_THEME.colors.progress.track,
          fill: parsed.colors?.progress?.fill ?? DEFAULT_THEME.colors.progress.fill,
          knob: parsed.colors?.progress?.knob ?? DEFAULT_THEME.colors.progress.knob,
        },
        button: {
          normal: parsed.colors?.button?.normal ?? DEFAULT_THEME.colors.button.normal,
          hover: parsed.colors?.button?.hover ?? DEFAULT_THEME.colors.button.hover,
          disabled: parsed.colors?.button?.disabled ?? DEFAULT_THEME.colors.button.disabled,
        },
      },
      borderRadius: parsed.borderRadius ?? DEFAULT_THEME.borderRadius,
      fontFamily: parsed.fontFamily ?? DEFAULT_THEME.fontFamily,
    };
  }
}
