import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

interface ControlSizes {
  playPause: number;
  control: number;
  spacing?: number;
}

export class Controls extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        Signals: {
          'play-pause': { param_types: [] },
          next: { param_types: [] },
          previous: { param_types: [] },
        },
      },
      this
    );
  }

  private prevButton: Gtk.Button;
  private playPauseButton: Gtk.Button;
  private nextButton: Gtk.Button;
  private playPauseIcon: Gtk.Image;

  constructor(sizes: ControlSizes) {
    super({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: sizes.spacing ?? 12,
      halign: Gtk.Align.CENTER,
      cssClasses: ['controls'],
    });

    const prevIcon = new Gtk.Image({
      iconName: 'media-skip-backward-symbolic',
    });

    this.prevButton = new Gtk.Button({
      child: prevIcon,
      widthRequest: sizes.control,
      heightRequest: sizes.control,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
      hexpand: false,
      vexpand: false,
      cssClasses: ['circular', 'control-button'],
      tooltipText: 'Previous',
    });

    this.playPauseIcon = new Gtk.Image({
      iconName: 'media-playback-start-symbolic',
    });

    this.playPauseButton = new Gtk.Button({
      child: this.playPauseIcon,
      widthRequest: sizes.playPause,
      heightRequest: sizes.playPause,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
      hexpand: false,
      vexpand: false,
      cssClasses: ['circular', 'suggested-action', 'play-pause-button'],
      tooltipText: 'Play/Pause',
    });

    const nextIcon = new Gtk.Image({
      iconName: 'media-skip-forward-symbolic',
    });

    this.nextButton = new Gtk.Button({
      child: nextIcon,
      widthRequest: sizes.control,
      heightRequest: sizes.control,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
      hexpand: false,
      vexpand: false,
      cssClasses: ['circular', 'control-button'],
      tooltipText: 'Next',
    });

    this.prevButton.connect('clicked', () => {
      this.emit('previous');
    });

    this.playPauseButton.connect('clicked', () => {
      this.emit('play-pause');
    });

    this.nextButton.connect('clicked', () => {
      this.emit('next');
    });

    this.append(this.prevButton);
    this.append(this.playPauseButton);
    this.append(this.nextButton);
  }

  setPlaying(isPlaying: boolean): void {
    this.playPauseIcon.set_from_icon_name(
      isPlaying ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic'
    );
  }

  setCanGoNext(canGoNext: boolean): void {
    this.nextButton.set_sensitive(canGoNext);
  }

  setCanGoPrevious(canGoPrevious: boolean): void {
    this.prevButton.set_sensitive(canGoPrevious);
  }
}
