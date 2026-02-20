import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

const SEEK_COMMIT_DELAY_MS = 140;

export class Progress extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        Signals: {
          seek: { param_types: [GObject.TYPE_INT64] },
        },
      },
      this
    );
  }

  private scale: Gtk.Scale;
  private adjustment: Gtk.Adjustment;
  private currentTimeLabel: Gtk.Label;
  private totalTimeLabel: Gtk.Label;
  private isDragging: boolean = false;
  private currentLength: number = 0;
  private seekCommitTimeoutId: number | null = null;
  private suppressSeekSignal: boolean = false;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
      cssClasses: ['progress-container'],
    });

    this.adjustment = new Gtk.Adjustment({
      value: 0,
      lower: 0,
      upper: 100,
      stepIncrement: 1,
      pageIncrement: 10,
    });

    this.scale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: this.adjustment,
      drawValue: false,
      hexpand: true,
      cssClasses: ['progress-scale'],
    });

    this.scale.connect('change-value', (_scale, _scroll, value) => {
      if (this.currentLength <= 0) {
        return false;
      }

      this.isDragging = true;
      const seekPosition = this.positionFromPercent(value);
      this.currentTimeLabel.set_label(this.formatTime(seekPosition));
      this.scheduleSeekCommit();
      return false;
    });

    const clickGesture = new Gtk.GestureClick();
    clickGesture.connect('released', () => {
      this.commitSeek();
    });
    this.scale.add_controller(clickGesture);

    this.adjustment.connect('value-changed', () => {
      if (this.suppressSeekSignal || !this.isDragging || this.currentLength <= 0) {
        return;
      }

      const seekPosition = this.positionFromPercent(this.adjustment.get_value());
      this.currentTimeLabel.set_label(this.formatTime(seekPosition));
      this.scheduleSeekCommit();
    });

    this.connect('destroy', () => {
      this.clearSeekCommitTimeout();
    });

    const timeBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      homogeneous: false,
    });

    this.currentTimeLabel = new Gtk.Label({
      label: '0:00',
      xalign: 0,
      cssClasses: ['time-label', 'current-time'],
      hexpand: true,
    });

    this.totalTimeLabel = new Gtk.Label({
      label: '0:00',
      xalign: 1,
      cssClasses: ['time-label', 'total-time'],
    });

    timeBox.append(this.currentTimeLabel);
    timeBox.append(this.totalTimeLabel);

    this.append(this.scale);
    this.append(timeBox);
  }

  setProgress(position: number, length: number): void {
    this.currentLength = length;

    if (!this.isDragging) {
      const fraction = length > 0 ? (position / length) * 100 : 0;
      this.suppressSeekSignal = true;
      this.adjustment.set_value(Math.min(100, Math.max(0, fraction)));
      this.suppressSeekSignal = false;
      this.currentTimeLabel.set_label(this.formatTime(position));
    }

    this.totalTimeLabel.set_label(this.formatTime(length));
  }

  private positionFromPercent(percent: number): number {
    const bounded = Math.min(100, Math.max(0, percent));
    return Math.floor((bounded / 100) * this.currentLength);
  }

  private scheduleSeekCommit(): void {
    this.clearSeekCommitTimeout();
    this.seekCommitTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SEEK_COMMIT_DELAY_MS, () => {
      this.commitSeek();
      return GLib.SOURCE_REMOVE;
    });
  }

  private clearSeekCommitTimeout(): void {
    if (this.seekCommitTimeoutId !== null) {
      GLib.source_remove(this.seekCommitTimeoutId);
      this.seekCommitTimeoutId = null;
    }
  }

  private commitSeek(): void {
    if (!this.isDragging || this.currentLength <= 0) {
      this.clearSeekCommitTimeout();
      return;
    }

    this.clearSeekCommitTimeout();
    this.isDragging = false;
    this.emit('seek', this.positionFromPercent(this.adjustment.get_value()));
  }

  private formatTime(microseconds: number): string {
    const totalSeconds = Math.floor(microseconds / 1000000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
