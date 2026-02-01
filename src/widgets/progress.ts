import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

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

    // Track drag state using change-value signal
    this.scale.connect('change-value', (_scale, _scroll, value) => {
      this.isDragging = true;
      // Update time label to show seek position during drag
      const seekPosition = (value / 100) * this.currentLength;
      this.currentTimeLabel.set_label(this.formatTime(seekPosition));
      return false; // Let default handler run
    });

    // Emit seek signal when value changes and we were dragging
    this.adjustment.connect('value-changed', () => {
      if (this.isDragging) {
        this.isDragging = false;
        const value = this.adjustment.get_value();
        const seekPosition = Math.floor((value / 100) * this.currentLength);
        this.emit('seek', seekPosition);
      }
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
    // position and length are in microseconds
    this.currentLength = length;

    // Only update if not dragging
    if (!this.isDragging) {
      const fraction = length > 0 ? (position / length) * 100 : 0;
      this.adjustment.set_value(Math.min(100, Math.max(0, fraction)));
      this.currentTimeLabel.set_label(this.formatTime(position));
    }

    this.totalTimeLabel.set_label(this.formatTime(length));
  }

  private formatTime(microseconds: number): string {
    const totalSeconds = Math.floor(microseconds / 1000000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
