import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
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

  private manager: Playerctl.PlayerManager;
  private player: Playerctl.Player | null = null;
  private positionPollId: number | null = null;
  private playerSignalIds: Map<Playerctl.Player, number[]> = new Map();
  private managedPlayers: Playerctl.Player[] = [];

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
    this.manager = new Playerctl.PlayerManager();
    this.setupManager();
    this.initExistingPlayers();
    this.selectBestPlayer();
  }

  private setupManager(): void {
    this.manager.connect(
      'name-appeared',
      (_mgr: Playerctl.PlayerManager, name: Playerctl.PlayerName) => {
        const player = Playerctl.Player.new_from_name(name);
        this.manager.manage_player(player);
      }
    );

    this.manager.connect(
      'player-appeared',
      (_mgr: Playerctl.PlayerManager, player: Playerctl.Player) => {
        if (this.isProxyPlayer(this.getPlayerName(player))) return;
        this.managedPlayers.push(player);
        this.connectPlayerSignals(player);
        this.selectBestPlayer();
      }
    );

    this.manager.connect(
      'player-vanished',
      (_mgr: Playerctl.PlayerManager, player: Playerctl.Player) => {
        this.managedPlayers = this.managedPlayers.filter((p) => p !== player);
        this.disconnectPlayerSignals(player);
        if (player === this.player) {
          this.player = null;
          this.stopPositionPolling();
          this.selectBestPlayer();
          if (!this.player) {
            this.resetState();
            this.emit('player-vanished');
          }
        }
      }
    );
  }

  private isProxyPlayer(name: string): boolean {
    return name === 'playerctld' || name.startsWith('playerctld.');
  }

  private initExistingPlayers(): void {
    const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
    try {
      const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
      const reply = bus.call_sync(
        'org.freedesktop.DBus',
        '/org/freedesktop/DBus',
        'org.freedesktop.DBus',
        'ListNames',
        null,
        GLib.VariantType.new('(as)'),
        Gio.DBusCallFlags.NONE,
        -1,
        null
      );
      const [busNames] = reply.deep_unpack() as [string[]];
      for (const name of busNames) {
        if (name.startsWith(MPRIS_PREFIX)) {
          const playerName = name.substring(MPRIS_PREFIX.length);
          if (this.isProxyPlayer(playerName)) continue;
          try {
            const player = new Playerctl.Player({ player_name: playerName });
            this.manager.manage_player(player);
          } catch {
            // Player may have disappeared
          }
        }
      }
    } catch (e) {
      console.log('Failed to init existing players:', e);
    }
  }

  private connectPlayerSignals(player: Playerctl.Player): void {
    const ids: number[] = [];

    ids.push(
      player.connect('playback-status', () => {
        this.onPlaybackStatusChanged(player);
      })
    );

    ids.push(
      player.connect('metadata', () => {
        if (player === this.player) {
          this.updateMetadata();
          this.emit('metadata-changed');
        }
      })
    );

    ids.push(
      player.connect('seeked', () => {
        if (player === this.player) {
          this.updatePosition();
          this.emit('position-changed');
        }
      })
    );

    this.playerSignalIds.set(player, ids);
  }

  private disconnectPlayerSignals(player: Playerctl.Player): void {
    const ids = this.playerSignalIds.get(player);
    if (ids) {
      for (const id of ids) {
        try {
          player.disconnect(id);
        } catch {
          // Player may already be disposed
        }
      }
      this.playerSignalIds.delete(player);
    }
  }

  private onPlaybackStatusChanged(changedPlayer: Playerctl.Player): void {
    // If a non-current player started playing and current isn't playing, switch
    if (changedPlayer !== this.player) {
      const status = this.getPlaybackStatus(changedPlayer);
      if (status === Playerctl.PlaybackStatus.PLAYING) {
        const currentStatus = this.player ? this.getPlaybackStatus(this.player) : null;
        if (currentStatus !== Playerctl.PlaybackStatus.PLAYING) {
          this.switchToPlayer(changedPlayer);
          return;
        }
      }
    }

    // Update UI for the current player
    if (changedPlayer === this.player) {
      this.updateState();
      this.emit('state-changed');
      if (this._state.status === 'playing') {
        this.startPositionPolling();
      } else {
        this.stopPositionPolling();
      }
    }
  }

  private getPlaybackStatus(player: Playerctl.Player): Playerctl.PlaybackStatus {
    return (player as unknown as { playback_status: Playerctl.PlaybackStatus }).playback_status;
  }

  private getPlayerName(player: Playerctl.Player): string {
    try {
      return (player as unknown as { player_name: string }).player_name || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private selectBestPlayer(): void {
    const players = this.managedPlayers;
    if (players.length === 0) {
      if (this.player) {
        this.player = null;
        this.stopPositionPolling();
        this.resetState();
        this.emit('player-vanished');
      }
      return;
    }

    // Prefer playing, then paused, then first available
    let best: Playerctl.Player | null = null;
    for (let i = 0; i < players.length; i++) {
      if (this.getPlaybackStatus(players[i]) === Playerctl.PlaybackStatus.PLAYING) {
        best = players[i];
        break;
      }
    }
    if (!best) {
      for (let i = 0; i < players.length; i++) {
        if (this.getPlaybackStatus(players[i]) === Playerctl.PlaybackStatus.PAUSED) {
          best = players[i];
          break;
        }
      }
    }
    if (!best) {
      best = players[0];
    }

    if (best !== this.player) {
      this.switchToPlayer(best);
    }
  }

  private switchToPlayer(newPlayer: Playerctl.Player): void {
    this.stopPositionPolling();
    this.player = newPlayer;
    this.updateMetadata();
    this.updateState();
    this.emit('metadata-changed');
    this.emit('state-changed');
    if (this._state.status === 'playing') {
      this.startPositionPolling();
    }
  }

  private updateMetadata(): void {
    if (!this.player) return;

    try {
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
    // Disconnect all player signals
    for (const [player, ids] of this.playerSignalIds) {
      for (const id of ids) {
        try {
          player.disconnect(id);
        } catch {
          // Player may already be disposed
        }
      }
    }
    this.playerSignalIds.clear();
    this.player = null;
  }
}
