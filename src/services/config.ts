import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const DEFAULT_PADDING = 20;
const DEFAULT_SECTION_SPACING = 12;
const DEFAULT_ALBUM_ART_SPACING = 16;
const DEFAULT_CONTROL_BUTTON_SPACING = 12;
const DEFAULT_BASE_FONT_SIZE = 15;
const DEFAULT_TITLE_FONT_SIZE = 1.1;
const DEFAULT_ARTIST_FONT_SIZE = 1.0;
const DEFAULT_ALBUM_FONT_SIZE = 0.9;
const DEFAULT_TIME_FONT_SIZE = 0.85;
const DEFAULT_ALBUM_ART_BORDER_RADIUS = 8;

export interface Config {
  popupWidth?: number;
  albumArtSize?: number;
  progressBarHeight?: number;
  playPauseButtonSize?: number;
  controlButtonSize?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  sectionSpacing?: number;
  albumArtSpacing?: number;
  controlButtonSpacing?: number;
  baseFontSize?: number;
  titleFontSize?: number;
  artistFontSize?: number;
  albumFontSize?: number;
  timeFontSize?: number;
  albumArtBorderRadius?: number;
}

const DEFAULT_CONFIG: Config = {
  popupWidth: 420,
  albumArtSize: 100,
  progressBarHeight: 6,
  playPauseButtonSize: 48,
  controlButtonSize: 36,
  padding: DEFAULT_PADDING,
  paddingTop: 20,
  paddingBottom: 25,
  paddingLeft: 20,
  paddingRight: 20,
  sectionSpacing: DEFAULT_SECTION_SPACING,
  albumArtSpacing: DEFAULT_ALBUM_ART_SPACING,
  controlButtonSpacing: DEFAULT_CONTROL_BUTTON_SPACING,
  baseFontSize: DEFAULT_BASE_FONT_SIZE,
  titleFontSize: DEFAULT_TITLE_FONT_SIZE,
  artistFontSize: DEFAULT_ARTIST_FONT_SIZE,
  albumFontSize: DEFAULT_ALBUM_FONT_SIZE,
  timeFontSize: DEFAULT_TIME_FONT_SIZE,
  albumArtBorderRadius: DEFAULT_ALBUM_ART_BORDER_RADIUS,
};

export class ConfigService {
  private config: Config = { ...DEFAULT_CONFIG };

  get popupWidth(): number {
    return this.config.popupWidth ?? DEFAULT_CONFIG.popupWidth!;
  }

  get albumArtSize(): number {
    return this.config.albumArtSize ?? DEFAULT_CONFIG.albumArtSize!;
  }

  get progressBarHeight(): number {
    return this.config.progressBarHeight ?? DEFAULT_CONFIG.progressBarHeight!;
  }

  get playPauseButtonSize(): number {
    return this.config.playPauseButtonSize ?? DEFAULT_CONFIG.playPauseButtonSize!;
  }

  get controlButtonSize(): number {
    return this.config.controlButtonSize ?? DEFAULT_CONFIG.controlButtonSize!;
  }

  get paddingTop(): number {
    return this.config.paddingTop ?? this.config.padding ?? DEFAULT_PADDING;
  }

  get paddingBottom(): number {
    return this.config.paddingBottom ?? this.config.padding ?? DEFAULT_PADDING;
  }

  get paddingLeft(): number {
    return this.config.paddingLeft ?? this.config.padding ?? DEFAULT_PADDING;
  }

  get paddingRight(): number {
    return this.config.paddingRight ?? this.config.padding ?? DEFAULT_PADDING;
  }

  get sectionSpacing(): number {
    return this.config.sectionSpacing ?? DEFAULT_SECTION_SPACING;
  }

  get albumArtSpacing(): number {
    return this.config.albumArtSpacing ?? DEFAULT_ALBUM_ART_SPACING;
  }

  get controlButtonSpacing(): number {
    return this.config.controlButtonSpacing ?? DEFAULT_CONTROL_BUTTON_SPACING;
  }

  get baseFontSize(): number {
    return this.config.baseFontSize ?? DEFAULT_BASE_FONT_SIZE;
  }

  get titleFontSize(): number {
    return this.config.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
  }

  get artistFontSize(): number {
    return this.config.artistFontSize ?? DEFAULT_ARTIST_FONT_SIZE;
  }

  get albumFontSize(): number {
    return this.config.albumFontSize ?? DEFAULT_ALBUM_FONT_SIZE;
  }

  get timeFontSize(): number {
    return this.config.timeFontSize ?? DEFAULT_TIME_FONT_SIZE;
  }

  get albumArtBorderRadius(): number {
    return this.config.albumArtBorderRadius ?? DEFAULT_ALBUM_ART_BORDER_RADIUS;
  }

  loadSync(): void {
    const configDir = GLib.get_user_config_dir();
    const configPath = GLib.build_filenamev([configDir, 'garak', 'config.json']);
    const file = Gio.File.new_for_path(configPath);

    try {
      const [success, contents] = file.load_contents(null);
      if (success) {
        const decoder = new TextDecoder('utf-8');
        const json = decoder.decode(contents);
        const parsed = JSON.parse(json);
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      if (e instanceof Error && !e.message.includes('No such file')) {
        console.warn('Config load error, using defaults:', e);
      }
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  async load(): Promise<void> {
    const configDir = GLib.get_user_config_dir();
    const configPath = GLib.build_filenamev([configDir, 'garak', 'config.json']);
    const file = Gio.File.new_for_path(configPath);

    try {
      const [contents] = await new Promise<[Uint8Array, string | null]>((resolve, reject) => {
        file.load_contents_async(null, (source, result) => {
          try {
            const [success, contents, etag] = (source as Gio.File).load_contents_finish(result);
            if (success) {
              resolve([contents, etag]);
            } else {
              reject(new Error('Failed to load config file'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      const decoder = new TextDecoder('utf-8');
      const json = decoder.decode(contents);
      const parsed = JSON.parse(json);
      this.config = { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      if (e instanceof Error && !e.message.includes('No such file')) {
        console.warn('Config load error, using defaults:', e);
      }
      this.config = { ...DEFAULT_CONFIG };
    }
  }
}
