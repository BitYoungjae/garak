import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Playerctl from 'gi://Playerctl';
import { debug } from '../debug.js';

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
}

function createDefaultMetadata(): PlayerMetadata {
  return { title: '', artist: '', album: '', artUrl: null, length: 0 };
}

function createDefaultState(): PlayerState {
  return {
    status: 'stopped',
    position: 0,
    canGoNext: false,
    canGoPrevious: false,
  };
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
  private managerSignalIds: number[] = [];
  private playerSignalIds: Map<Playerctl.Player, number[]> = new Map();
  private managedPlayers: Playerctl.Player[] = [];

  private _metadata: PlayerMetadata = createDefaultMetadata();
  private _state: PlayerState = createDefaultState();
  private seekSuppressUntil: number = 0;

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
    this.connectManagerSignal(
      'name-appeared',
      (_mgr: Playerctl.PlayerManager, name: Playerctl.PlayerName) => {
        try {
          const player = Playerctl.Player.new_from_name(name);
          const playerName = this.getPlayerName(player);
          if (this.isProxyPlayer(playerName) || this.isManagedPlayerName(playerName)) {
            return;
          }
          this.manager.manage_player(player);
        } catch {
          // Player may have disappeared before it can be managed
        }
      }
    );

    this.connectManagerSignal(
      'player-appeared',
      (_mgr: Playerctl.PlayerManager, player: Playerctl.Player) => {
        const playerName = this.getPlayerName(player);
        debug(`player-appeared: ${playerName}`);
        if (this.isProxyPlayer(playerName) || this.isManagedPlayerName(playerName)) {
          debug(`player-appeared: skipped (proxy or duplicate)`);
          return;
        }

        this.managedPlayers.push(player);
        this.connectPlayerSignals(player);
        this.selectBestPlayer();
      }
    );

    this.connectManagerSignal(
      'player-vanished',
      (_mgr: Playerctl.PlayerManager, player: Playerctl.Player) => {
        const playerName = this.getPlayerName(player);
        debug(`player-vanished: ${playerName}`);
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

  private connectManagerSignal<T extends keyof Playerctl.PlayerManager.SignalSignatures>(
    signal: T,
    callback: GObject.SignalCallback<
      Playerctl.PlayerManager,
      Playerctl.PlayerManager.SignalSignatures[T]
    >
  ): void {
    this.managerSignalIds.push(this.manager.connect(signal, callback));
  }

  private isProxyPlayer(name: string): boolean {
    return name === 'playerctld' || name.startsWith('playerctld.');
  }

  private isManagedPlayerName(name: string): boolean {
    return this.managedPlayers.some((managedPlayer) => this.getPlayerName(managedPlayer) === name);
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
          if (this.isManagedPlayerName(playerName)) continue;
          try {
            const player = new Playerctl.Player({ player_name: playerName });
            this.manager.manage_player(player);
          } catch {
            // Player may have disappeared
          }
        }
      }
    } catch (error) {
      console.warn('Failed to initialize existing players:', error);
    }
  }

  private connectPlayerSignals(player: Playerctl.Player): void {
    const ids: number[] = [];

    ids.push(
      player.connect('playback-status', () => {
        const name = this.getPlayerName(player);
        const status = this.getPlaybackStatus(player);
        debug(`playback-status signal: player=${name}, status=${status}`);
        this.onPlaybackStatusChanged(player);
      })
    );

    ids.push(
      player.connect('metadata', () => {
        const isCurrent = player === this.player;
        const name = this.getPlayerName(player);
        debug(`metadata signal: player=${name}, isCurrent=${isCurrent}`);
        if (isCurrent) {
          this.updateMetadata();
          debug(
            `after updateMetadata: title="${this._metadata.title}", length=${this._metadata.length}`
          );
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
    const best =
      players.find((p) => this.getPlaybackStatus(p) === Playerctl.PlaybackStatus.PLAYING) ??
      players.find((p) => this.getPlaybackStatus(p) === Playerctl.PlaybackStatus.PAUSED) ??
      players[0];

    if (best !== this.player) {
      this.switchToPlayer(best);
    }
  }

  private switchToPlayer(newPlayer: Playerctl.Player): void {
    const name = this.getPlayerName(newPlayer);
    debug(`switchToPlayer: ${name}`);
    this.stopPositionPolling();
    this.player = newPlayer;
    this.updateMetadata();
    this.updateState();
    debug(
      `switchToPlayer done: title="${this._metadata.title}", length=${this._metadata.length}, status=${this._state.status}`
    );
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
    } catch (error) {
      console.warn('Failed to read metadata:', error);
    }
  }

  private getPlayerMetadataVariant(): GLib.Variant | null {
    if (!this.player) return null;
    return (this.player as unknown as { metadata: GLib.Variant | null }).metadata ?? null;
  }

  private getArtUrl(): string | null {
    try {
      const value = this.getPlayerMetadataVariant()?.lookup_value('mpris:artUrl', null);
      if (!value || value.get_type_string() !== 's') return null;
      return value.get_string()[0] || null;
    } catch {
      return null;
    }
  }

  private getLength(): number {
    const length = this.parseLengthVariant(
      this.getPlayerMetadataVariant()?.lookup_value('mpris:length', null)
    );
    if (length > 0) return length;

    // Playerctl cache can be stale after track changes — read directly from D-Bus
    return this.getLengthFromDBus();
  }

  private getLengthFromDBus(): number {
    if (!this.player) return 0;
    try {
      const playerName = this.getPlayerName(this.player);
      const busName = `org.mpris.MediaPlayer2.${playerName}`;
      const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
      const reply = bus.call_sync(
        busName,
        '/org/mpris/MediaPlayer2',
        'org.freedesktop.DBus.Properties',
        'Get',
        new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'Metadata']),
        GLib.VariantType.new('(v)'),
        Gio.DBusCallFlags.NONE,
        -1,
        null
      );
      const metadata = reply.get_child_value(0).get_variant();
      return this.parseLengthVariant(metadata?.lookup_value('mpris:length', null));
    } catch {
      return 0;
    }
  }

  private parseLengthVariant(value: GLib.Variant | null | undefined): number {
    if (!value) return 0;
    try {
      const typeStr = value.get_type_string();
      if (typeStr === 'x') return Number(value.get_int64());
      if (typeStr === 't') return Number(value.get_uint64());
      if (typeStr === 'i') return value.get_int32();
      if (typeStr === 'u') return value.get_uint32();
      if (typeStr === 'd') return Math.floor(value.get_double());
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
      };
    } catch (error) {
      console.warn('Failed to read playback state:', error);
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
    if (GLib.get_monotonic_time() < this.seekSuppressUntil) return;
    this._state.position = this.getPosition();
  }

  private startPositionPolling(): void {
    if (this.positionPollId) return;

    this.positionPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this.updatePosition();

      if (this._metadata.length === 0) {
        const playerctlLen = this.parseLengthVariant(
          this.getPlayerMetadataVariant()?.lookup_value('mpris:length', null)
        );
        const dbusLen = this.getLengthFromDBus();
        const length = playerctlLen > 0 ? playerctlLen : dbusLen;
        debug(
          `poll: length was 0, playerctl=${playerctlLen}, dbus=${dbusLen}, title="${this._metadata.title}"`
        );
        if (length > 0) {
          this._metadata.length = length;
          this.emit('metadata-changed');
        }
      }

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
    this._metadata = createDefaultMetadata();
    this._state = createDefaultState();
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
        const maxPosition =
          this._metadata.length > 0 ? this._metadata.length : Number.MAX_SAFE_INTEGER;
        const boundedPosition = Math.max(0, Math.min(positionUs, maxPosition));
        this._state.position = boundedPosition;
        this.seekSuppressUntil = GLib.get_monotonic_time() + 500000;
        this.player.set_position(boundedPosition);
      } catch (error) {
        console.error('Failed to seek:', error);
      }
    }
  }

  destroy(): void {
    this.stopPositionPolling();
    for (const signalId of this.managerSignalIds) {
      try {
        this.manager.disconnect(signalId);
      } catch {
        // Manager may already be disposed
      }
    }
    this.managerSignalIds = [];

    for (const player of this.managedPlayers) {
      this.disconnectPlayerSignals(player);
    }
    this.managedPlayers = [];
    this.player = null;
  }
}
