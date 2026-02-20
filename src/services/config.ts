import {
  buildGarakConfigPath,
  isJsonObject,
  loadJsonFileSync,
  readNumber,
  readStringArray,
} from './json-file.js';

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
const CONFIG_FILE_NAME = 'config.json';

const POPUP_WIDTH_MIN = 260;
const POPUP_WIDTH_MAX = 1600;
const PIXEL_VALUE_MIN = 0;
const PIXEL_VALUE_MAX = 400;
const FONT_SCALE_MIN = 0.5;
const FONT_SCALE_MAX = 3;

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
  cursorOffsetX?: number;
  cursorOffsetY?: number;
  centerOnCursor?: boolean;
  preferredPlayers?: string[];
}

const DEFAULT_CONFIG: Required<Config> = {
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
  cursorOffsetX: 0,
  cursorOffsetY: -4,
  centerOnCursor: false,
  preferredPlayers: [],
};

export class ConfigService {
  private _config: Readonly<Required<Config>> = DEFAULT_CONFIG;

  get config(): Readonly<Required<Config>> {
    return this._config;
  }

  loadSync(): void {
    const configPath = buildGarakConfigPath(CONFIG_FILE_NAME);
    try {
      const parsed = loadJsonFileSync(configPath);
      this._config = this.normalizeConfig(parsed);
    } catch (error) {
      console.warn(`Config load error at ${configPath}, using defaults:`, error);
      this._config = { ...DEFAULT_CONFIG };
    }
  }

  private normalizeConfig(input: unknown): Required<Config> {
    if (!isJsonObject(input)) {
      return { ...DEFAULT_CONFIG };
    }

    const sharedPadding = readNumber(input.padding, DEFAULT_CONFIG.padding, PIXEL_VALUE_MIN, 200);

    return {
      popupWidth: readNumber(
        input.popupWidth,
        DEFAULT_CONFIG.popupWidth,
        POPUP_WIDTH_MIN,
        POPUP_WIDTH_MAX
      ),
      albumArtSize: readNumber(
        input.albumArtSize,
        DEFAULT_CONFIG.albumArtSize,
        48,
        PIXEL_VALUE_MAX
      ),
      progressBarHeight: readNumber(
        input.progressBarHeight,
        DEFAULT_CONFIG.progressBarHeight,
        2,
        32
      ),
      playPauseButtonSize: readNumber(
        input.playPauseButtonSize,
        DEFAULT_CONFIG.playPauseButtonSize,
        24,
        PIXEL_VALUE_MAX
      ),
      controlButtonSize: readNumber(
        input.controlButtonSize,
        DEFAULT_CONFIG.controlButtonSize,
        20,
        PIXEL_VALUE_MAX
      ),
      padding: sharedPadding,
      paddingTop: readNumber(input.paddingTop, sharedPadding, PIXEL_VALUE_MIN, 200),
      paddingBottom: readNumber(input.paddingBottom, sharedPadding, PIXEL_VALUE_MIN, 200),
      paddingLeft: readNumber(input.paddingLeft, sharedPadding, PIXEL_VALUE_MIN, 200),
      paddingRight: readNumber(input.paddingRight, sharedPadding, PIXEL_VALUE_MIN, 200),
      sectionSpacing: readNumber(
        input.sectionSpacing,
        DEFAULT_CONFIG.sectionSpacing,
        PIXEL_VALUE_MIN,
        80
      ),
      albumArtSpacing: readNumber(
        input.albumArtSpacing,
        DEFAULT_CONFIG.albumArtSpacing,
        PIXEL_VALUE_MIN,
        120
      ),
      controlButtonSpacing: readNumber(
        input.controlButtonSpacing,
        DEFAULT_CONFIG.controlButtonSpacing,
        PIXEL_VALUE_MIN,
        80
      ),
      baseFontSize: readNumber(input.baseFontSize, DEFAULT_CONFIG.baseFontSize, 8, 72),
      titleFontSize: readNumber(
        input.titleFontSize,
        DEFAULT_CONFIG.titleFontSize,
        FONT_SCALE_MIN,
        FONT_SCALE_MAX
      ),
      artistFontSize: readNumber(
        input.artistFontSize,
        DEFAULT_CONFIG.artistFontSize,
        FONT_SCALE_MIN,
        FONT_SCALE_MAX
      ),
      albumFontSize: readNumber(
        input.albumFontSize,
        DEFAULT_CONFIG.albumFontSize,
        FONT_SCALE_MIN,
        FONT_SCALE_MAX
      ),
      timeFontSize: readNumber(
        input.timeFontSize,
        DEFAULT_CONFIG.timeFontSize,
        FONT_SCALE_MIN,
        FONT_SCALE_MAX
      ),
      albumArtBorderRadius: readNumber(
        input.albumArtBorderRadius,
        DEFAULT_CONFIG.albumArtBorderRadius,
        PIXEL_VALUE_MIN,
        100
      ),
      cursorOffsetX: readNumber(input.cursorOffsetX, DEFAULT_CONFIG.cursorOffsetX, -200, 200),
      cursorOffsetY: readNumber(input.cursorOffsetY, DEFAULT_CONFIG.cursorOffsetY, -200, 200),
      centerOnCursor:
        typeof input.centerOnCursor === 'boolean'
          ? input.centerOnCursor
          : DEFAULT_CONFIG.centerOnCursor,
      preferredPlayers: readStringArray(input.preferredPlayers),
    };
  }
}
