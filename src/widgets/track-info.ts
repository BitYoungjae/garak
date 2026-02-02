import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

export class TrackInfo extends Gtk.Box {
  static {
    GObject.registerClass(this);
  }

  private titleLabel: Gtk.Label;
  private artistLabel: Gtk.Label;
  private albumLabel: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
      valign: Gtk.Align.CENTER,
      hexpand: true,
      cssClasses: ['track-info'],
    });

    this.titleLabel = new Gtk.Label({
      label: '',
      xalign: 0,
      wrap: true,
      wrapMode: Pango.WrapMode.WORD_CHAR,
      lines: 2,
      ellipsize: Pango.EllipsizeMode.END,
      maxWidthChars: 30,
      cssClasses: ['track-title'],
    });

    this.artistLabel = new Gtk.Label({
      label: '',
      xalign: 0,
      ellipsize: Pango.EllipsizeMode.END,
      maxWidthChars: 30,
      cssClasses: ['track-artist'],
    });

    this.albumLabel = new Gtk.Label({
      label: '',
      xalign: 0,
      ellipsize: Pango.EllipsizeMode.END,
      maxWidthChars: 30,
      cssClasses: ['track-album'],
    });

    this.append(this.titleLabel);
    this.append(this.artistLabel);
    this.append(this.albumLabel);
  }

  setTrackInfo(title: string, artist: string, album: string): void {
    this.titleLabel.set_label(title || 'Unknown');
    this.artistLabel.set_label(artist || '');
    this.albumLabel.set_label(album || '');

    // Hide empty labels
    this.artistLabel.set_visible(!!artist);
    this.albumLabel.set_visible(!!album);
  }
}
