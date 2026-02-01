import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Playerctl from 'gi://Playerctl';

export interface PlayerMetadata {
  title: string;
  artist: string;
  album: string;
  artUrl: string | null;
  length: number; // microseconds
}

export interface PlayerState {
  status: 'playing' | 'paused' | 'stopped';
  position: number; // microseconds
  canGoNext: boolean;
  canGoPrevious: boolean;
  canPlay: boolean;
  canPause: boolean;
}

export class PlayerService extends GObject.Object {
  static {
    GObject.registerClass(
      {
        Signals: {
          'metadata-changed': { param_types: [] },
          'state-changed': { param_types: [] },
          'position-changed': { param_types: [] },
          'player-vanished': { param_types: [] },
        },
      },
      this
    );
  }

  private player: Playerctl.Player | null = null;
  private positionPollId: number | null = null;

  private _metadata: PlayerMetadata = {
    title: '',
    artist: '',
    album: '',
    artUrl: null,
    length: 0,
  };

  private _state: PlayerState = {
    status: 'stopped',
    position: 0,
    canGoNext: false,
    canGoPrevious: false,
    canPlay: false,
    canPause: false,
  };

  get metadata(): PlayerMetadata {
    return this._metadata;
  }

  get state(): PlayerState {
    return this._state;
  }

  get hasPlayer(): boolean {
    return this.player !== null;
  }

  constructor() {
    super();
    this.initPlayer();
  }

  private initPlayer(): void {
    try {
      // Try to connect to any available player
      // Playerctl.Player.new() auto-connects to the first available player
      this.player = new Playerctl.Player();
      this.setupPlayerSignals();
      this.updateMetadata();
      this.updateState();
      this.startPositionPolling();
    } catch (e) {
      // No player available
      console.log('No player available:', e);
      this.player = null;
    }
  }

  private setupPlayerSignals(): void {
    if (!this.player) return;

    this.player.connect('metadata', () => {
      this.updateMetadata();
      this.emit('metadata-changed');
    });

    this.player.connect('playback-status', () => {
      this.updateState();
      this.emit('state-changed');

      if (this._state.status === 'playing') {
        this.startPositionPolling();
      } else {
        this.stopPositionPolling();
      }
    });

    this.player.connect('seeked', () => {
      this.updatePosition();
      this.emit('position-changed');
    });

    this.player.connect('exit', () => {
      this.player = null;
      this.stopPositionPolling();
      this.resetState();
      this.emit('player-vanished');
    });
  }

  private updateMetadata(): void {
    if (!this.player) return;

    try {
      // Use get_* methods instead of property access
      this._metadata = {
        title: this.player.get_title() || 'Unknown',
        artist: this.player.get_artist() || '',
        album: this.player.get_album() || '',
        artUrl: this.getArtUrl(),
        length: this.getLength(),
      };
    } catch (e) {
      console.log('Failed to get metadata:', e);
    }
  }

  private getArtUrl(): string | null {
    if (!this.player) return null;
    try {
      // Access metadata variant for artUrl
      const metadata = (this.player as unknown as { metadata: GLib.Variant | null }).metadata;
      if (!metadata) return null;

      const value = metadata.lookup_value('mpris:artUrl', null);
      if (!value) return null;

      const typeStr = value.get_type_string();
      if (typeStr === 's') {
        return value.get_string()[0] || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getLength(): number {
    if (!this.player) return 0;
    try {
      const metadata = (this.player as unknown as { metadata: GLib.Variant | null }).metadata;
      if (!metadata) return 0;

      const value = metadata.lookup_value('mpris:length', null);
      if (!value) return 0;

      const typeStr = value.get_type_string();
      if (typeStr === 'x') {
        return Number(value.get_int64());
      } else if (typeStr === 't') {
        return Number(value.get_uint64());
      } else if (typeStr === 'i') {
        return value.get_int32();
      } else if (typeStr === 'u') {
        return value.get_uint32();
      } else if (typeStr === 'd') {
        return Math.floor(value.get_double());
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private updateState(): void {
    if (!this.player) return;

    try {
      // Access properties via snake_case in GJS
      const player = this.player as unknown as {
        playback_status: Playerctl.PlaybackStatus;
        can_go_next: boolean;
        can_go_previous: boolean;
        can_play: boolean;
        can_pause: boolean;
      };

      const status = player.playback_status;
      let statusStr: 'playing' | 'paused' | 'stopped' = 'stopped';

      if (status === Playerctl.PlaybackStatus.PLAYING) {
        statusStr = 'playing';
      } else if (status === Playerctl.PlaybackStatus.PAUSED) {
        statusStr = 'paused';
      }

      this._state = {
        status: statusStr,
        position: this.getPosition(),
        canGoNext: player.can_go_next || false,
        canGoPrevious: player.can_go_previous || false,
        canPlay: player.can_play || false,
        canPause: player.can_pause || false,
      };
    } catch (e) {
      console.log('Failed to get state:', e);
    }
  }

  private getPosition(): number {
    if (!this.player) return 0;
    try {
      return this.player.get_position();
    } catch {
      return 0;
    }
  }

  private updatePosition(): void {
    if (!this.player) return;
    this._state.position = this.getPosition();
  }

  private startPositionPolling(): void {
    if (this.positionPollId) return;

    this.positionPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this.updatePosition();
      this.emit('position-changed');
      return GLib.SOURCE_CONTINUE;
    });
  }

  private stopPositionPolling(): void {
    if (this.positionPollId) {
      GLib.source_remove(this.positionPollId);
      this.positionPollId = null;
    }
  }

  private resetState(): void {
    this._metadata = {
      title: '',
      artist: '',
      album: '',
      artUrl: null,
      length: 0,
    };
    this._state = {
      status: 'stopped',
      position: 0,
      canGoNext: false,
      canGoPrevious: false,
      canPlay: false,
      canPause: false,
    };
    this.emit('metadata-changed');
    this.emit('state-changed');
  }

  // Playback controls
  playPause(): void {
    if (this.player) {
      this.player.play_pause();
    }
  }

  next(): void {
    if (this.player && this._state.canGoNext) {
      this.player.next();
    }
  }

  previous(): void {
    if (this.player && this._state.canGoPrevious) {
      this.player.previous();
    }
  }

  setPosition(positionUs: number): void {
    if (this.player) {
      try {
        this.player.set_position(positionUs);
      } catch (e) {
        console.error('Failed to seek:', e);
      }
    }
  }

  destroy(): void {
    this.stopPositionPolling();
    this.player = null;
  }
}
