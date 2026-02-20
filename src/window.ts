import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import GtkLayerShell from 'gi://Gtk4LayerShell';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import { PlayerService } from './services/player.js';
import { ConfigService } from './services/config.js';
import { ThemeService } from './services/theme.js';
import { AlbumArt } from './widgets/album-art.js';
import { TrackInfo } from './widgets/track-info.js';
import { Controls } from './widgets/controls.js';
import { Progress } from './widgets/progress.js';

interface HyprMonitor {
  width: number;
  scale: number;
  focused?: boolean;
  reserved?: unknown;
}

export class PopupWindow extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(this);
  }

  private playerService: PlayerService;
  private configService: ConfigService;
  private themeService: ThemeService;
  private albumArt!: AlbumArt;
  private trackInfo!: TrackInfo;
  private controls!: Controls;
  private progress!: Progress;
  private contentStack!: Gtk.Stack;
  private emptyStateBox!: Gtk.Box;
  private playerBox!: Gtk.Box;
  private popupWidth: number = 360;

  constructor(app: Adw.Application, configService: ConfigService, themeService: ThemeService) {
    super({ application: app });

    this.configService = configService;
    this.themeService = themeService;
    this.popupWidth = configService.config.popupWidth;

    this.playerService = new PlayerService();

    this.initLayerShell();
    this.setupKeyController();
    this.setupFocusHandler();
    this.loadCSS();
    this.buildUI();
    this.connectPlayerService();
    this.updateUI();
  }

  private initLayerShell(): void {
    if (!GtkLayerShell.is_supported()) {
      console.warn('gtk4-layer-shell is not supported in this session; using regular window mode.');
      return;
    }

    GtkLayerShell.init_for_window(this);

    if (!GtkLayerShell.is_layer_window(this)) {
      console.warn(
        'gtk4-layer-shell failed to initialize for this window; using regular window mode.'
      );
      return;
    }

    GtkLayerShell.set_namespace(this, 'garak');
    GtkLayerShell.set_layer(this, GtkLayerShell.Layer.TOP);
    GtkLayerShell.set_keyboard_mode(this, GtkLayerShell.KeyboardMode.ON_DEMAND);

    // Anchor to top and left for precise positioning
    GtkLayerShell.set_anchor(this, GtkLayerShell.Edge.TOP, true);
    GtkLayerShell.set_anchor(this, GtkLayerShell.Edge.LEFT, true);

    const cursorPos = this.getCursorPosition();
    const focusedMonitor = this.getFocusedMonitor();
    if (!cursorPos || !focusedMonitor) {
      return;
    }

    const { cursorOffsetX, cursorOffsetY } = this.configService.config;
    const monitorWidth = focusedMonitor.width / focusedMonitor.scale;
    const topReservedInset = this.getTopReservedInset(focusedMonitor);

    // Clamp to screen bounds (left and right)
    const centered = cursorPos.x + cursorOffsetX - this.popupWidth / 2;
    const maxLeft = monitorWidth - this.popupWidth;
    const leftMargin = Math.max(0, Math.min(centered, maxLeft));
    const topMargin = Math.max(0, cursorPos.y - topReservedInset + cursorOffsetY);

    GtkLayerShell.set_margin(this, GtkLayerShell.Edge.TOP, topMargin);
    GtkLayerShell.set_margin(this, GtkLayerShell.Edge.LEFT, leftMargin);
  }

  private runCommand(commandLine: string): string | null {
    const [program] = commandLine.split(' ');
    if (!program || !GLib.find_program_in_path(program)) {
      return null;
    }

    try {
      const [ok, stdout] = GLib.spawn_command_line_sync(commandLine);
      if (!ok || !stdout) {
        return null;
      }

      return new TextDecoder().decode(stdout).trim();
    } catch (error) {
      console.warn(`Failed to run command: ${commandLine}`, error);
      return null;
    }
  }

  private getCursorPosition(): { x: number; y: number } | null {
    const output = this.runCommand('hyprctl cursorpos');
    if (output) {
      const match = output.match(/(-?\d+),\s*(-?\d+)/);
      if (match) {
        return {
          x: parseInt(match[1], 10),
          y: parseInt(match[2], 10),
        };
      }
    }

    return null;
  }

  private getFocusedMonitor(): HyprMonitor | null {
    const output = this.runCommand('hyprctl monitors -j');
    if (!output) return null;

    try {
      const monitors = JSON.parse(output) as HyprMonitor[];
      return monitors.find((m) => m.focused) ?? monitors[0] ?? null;
    } catch (error) {
      console.warn('Failed to parse monitor info from hyprctl:', error);
      return null;
    }
  }

  private getTopReservedInset(monitor: HyprMonitor | null): number {
    const reserved = monitor?.reserved;
    if (Array.isArray(reserved) && reserved.length >= 2) {
      const topInset = Number(reserved[1]);
      if (Number.isFinite(topInset) && topInset >= 0) {
        return topInset;
      }
    }
    return 0;
  }

  private setupKeyController(): void {
    const keyController = new Gtk.EventControllerKey();
    keyController.connect('key-pressed', (_controller, keyval) => {
      if (keyval === Gdk.KEY_Escape) {
        this.close();
        return true;
      }
      return false;
    });
    this.add_controller(keyController);
  }

  private setupFocusHandler(): void {
    // DEBUG_NO_AUTO_CLOSE=1 로 자동 닫힘 비활성화
    if (GLib.getenv('DEBUG_NO_AUTO_CLOSE')) {
      return;
    }
    this.connect('notify::is-active', () => {
      if (!this.is_active) {
        this.close();
      }
    });
  }

  private loadCSS(): void {
    const { colors, borderRadius, fontFamily } = this.themeService;
    const {
      albumArtSize,
      progressBarHeight,
      playPauseButtonSize,
      controlButtonSize,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
      baseFontSize,
      titleFontSize,
      artistFontSize,
      albumFontSize,
      timeFontSize,
      albumArtBorderRadius,
    } = this.configService.config;

    const css = `
      window {
        background: transparent;
      }

      .popup-container {
        background-color: ${colors.background};
        border: 1px solid ${colors.border};
        border-radius: ${borderRadius}px;
        padding-top: ${paddingTop}px;
        padding-bottom: ${paddingBottom}px;
        padding-left: ${paddingLeft}px;
        padding-right: ${paddingRight}px;
        font-family: ${fontFamily};
        font-size: ${baseFontSize}px;
      }

      .album-art-container {
        min-width: ${albumArtSize}px;
        min-height: ${albumArtSize}px;
        border-radius: ${albumArtBorderRadius}px;
      }

      .album-art {
        border-radius: ${albumArtBorderRadius}px;
      }

      .album-art-placeholder-box {
        background-color: ${colors.progress.track};
        border-radius: ${albumArtBorderRadius}px;
      }

      .album-art-placeholder {
        opacity: 0.5;
        color: ${colors.text.muted};
      }

      .track-title {
        font-weight: bold;
        font-size: ${titleFontSize}em;
        color: ${colors.text.primary};
      }

      .track-artist {
        font-size: ${artistFontSize}em;
        color: ${colors.text.secondary};
      }

      .track-album {
        color: ${colors.text.muted};
        font-size: ${albumFontSize}em;
      }

      .play-pause-button,
      .control-button {
        border-radius: 9999px;
        padding: 0;
        color: ${colors.button.normal};
      }

      .play-pause-button:hover,
      .control-button:hover {
        color: ${colors.button.hover};
      }

      .play-pause-button:disabled,
      .control-button:disabled {
        color: ${colors.button.disabled};
      }

      .play-pause-button {
        min-width: ${playPauseButtonSize}px;
        min-height: ${playPauseButtonSize}px;
      }

      .control-button {
        min-width: ${controlButtonSize}px;
        min-height: ${controlButtonSize}px;
      }

      .progress-scale trough {
        min-height: ${progressBarHeight}px;
        background-color: ${colors.progress.track};
        border-radius: ${progressBarHeight / 2}px;
      }

      .progress-scale trough highlight {
        background-color: ${colors.progress.fill};
        border-radius: ${progressBarHeight / 2}px;
      }

      .progress-scale slider {
        min-width: 16px;
        min-height: 16px;
        margin: -5px;
        background-color: ${colors.progress.knob};
        border-radius: 8px;
      }

      .time-label {
        font-size: ${timeFontSize}em;
        color: ${colors.text.muted};
      }

      .empty-state {
        padding: 24px;
      }

      .empty-state-icon {
        color: ${colors.text.muted};
        opacity: 0.3;
      }

      .empty-state-label {
        color: ${colors.text.secondary};
        opacity: 0.6;
        margin-top: 12px;
      }
    `;

    const cssProvider = new Gtk.CssProvider();
    cssProvider.load_from_string(css);
    Gtk.StyleContext.add_provider_for_display(
      Gdk.Display.get_default()!,
      cssProvider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );
  }

  private buildUI(): void {
    const {
      albumArtSize,
      sectionSpacing,
      albumArtSpacing,
      controlButtonSpacing,
      playPauseButtonSize,
      controlButtonSize,
    } = this.configService.config;

    const mainBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: sectionSpacing,
      cssClasses: ['popup-container'],
    });

    // Initialize widgets with config values
    this.albumArt = new AlbumArt(albumArtSize);
    this.trackInfo = new TrackInfo();
    this.controls = new Controls({
      playPause: playPauseButtonSize,
      control: controlButtonSize,
      spacing: controlButtonSpacing,
    });
    this.progress = new Progress();

    // Player content
    this.playerBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: sectionSpacing,
    });

    // Top row: album art + track info
    const topRow = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: albumArtSpacing,
    });

    topRow.append(this.albumArt);
    topRow.append(this.trackInfo);

    this.playerBox.append(topRow);
    this.playerBox.append(this.progress);
    this.playerBox.append(this.controls);

    // Empty state
    this.emptyStateBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
      cssClasses: ['empty-state'],
    });

    const emptyIcon = new Gtk.Image({
      iconName: 'audio-x-generic-symbolic',
      pixelSize: 48,
      cssClasses: ['empty-state-icon'],
    });

    const emptyLabel = new Gtk.Label({
      label: '재생 중인 미디어 없음',
      cssClasses: ['empty-state-label'],
    });

    this.emptyStateBox.append(emptyIcon);
    this.emptyStateBox.append(emptyLabel);

    // Stack
    this.contentStack = new Gtk.Stack({
      transitionType: Gtk.StackTransitionType.CROSSFADE,
      transitionDuration: 200,
    });

    this.contentStack.add_named(this.playerBox, 'player');
    this.contentStack.add_named(this.emptyStateBox, 'empty');

    mainBox.append(this.contentStack);

    this.set_content(mainBox);
    this.set_default_size(this.popupWidth, -1);
  }

  private connectPlayerService(): void {
    this.playerService.connect('metadata-changed', () => {
      this.updateMetadata();
      this.updateProgress();
    });

    this.playerService.connect('state-changed', () => {
      this.updateState();
    });

    this.playerService.connect('position-changed', () => {
      this.updateProgress();
    });

    this.playerService.connect('player-vanished', () => {
      this.updateUI();
    });

    this.controls.connect('play-pause', () => {
      this.playerService.playPause();
    });

    this.controls.connect('next', () => {
      this.playerService.next();
    });

    this.controls.connect('previous', () => {
      this.playerService.previous();
    });

    // Connect progress seek to player setPosition
    this.progress.connect('seek', (_widget, positionUs: number) => {
      this.playerService.setPosition(positionUs);
    });
  }

  private updateUI(): void {
    if (this.playerService.hasPlayer) {
      this.contentStack.set_visible_child_name('player');
      this.updateMetadata();
      this.updateState();
      this.updateProgress();
    } else {
      this.contentStack.set_visible_child_name('empty');
    }
  }

  private updateMetadata(): void {
    const meta = this.playerService.metadata;
    this.albumArt.setArtUrl(meta.artUrl);
    this.trackInfo.setTrackInfo(meta.title, meta.artist, meta.album);
  }

  private updateState(): void {
    const state = this.playerService.state;
    this.controls.setPlaying(state.status === 'playing');
    this.controls.setCanGoNext(state.canGoNext);
    this.controls.setCanGoPrevious(state.canGoPrevious);
  }

  private updateProgress(): void {
    const state = this.playerService.state;
    const meta = this.playerService.metadata;
    this.progress.setProgress(state.position, meta.length);
  }

  override vfunc_close_request(): boolean {
    this.playerService.destroy();
    return super.vfunc_close_request();
  }
}
