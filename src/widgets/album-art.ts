import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk';

export class AlbumArt extends Gtk.Box {
  static {
    GObject.registerClass(this);
  }

  private picture: Gtk.Picture;
  private placeholderIcon: Gtk.Image;
  private placeholderBox: Gtk.Box;
  private stack: Gtk.Stack;
  private currentUrl: string | null = null;
  private _size: number = 80;

  constructor(size: number = 80) {
    super({
      cssClasses: ['album-art-container'],
      hexpand: false,
      vexpand: false,
      halign: Gtk.Align.START,
      valign: Gtk.Align.START,
      overflow: Gtk.Overflow.HIDDEN,
      widthRequest: size,
      heightRequest: size,
    });

    this._size = size;

    // Stack for switching between placeholder and image
    // hexpand/vexpand true to fill the fixed-size parent container
    this.stack = new Gtk.Stack({
      transitionType: Gtk.StackTransitionType.CROSSFADE,
      transitionDuration: 200,
      hexpand: true,
      vexpand: true,
    });

    // Picture with content-fit COVER (like CSS object-fit: cover)
    // Fills parent and crops to maintain aspect ratio
    this.picture = new Gtk.Picture({
      canShrink: true,
      contentFit: Gtk.ContentFit.COVER,
      hexpand: true,
      vexpand: true,
      widthRequest: size,
      heightRequest: size,
      cssClasses: ['album-art'],
    });

    this.placeholderIcon = new Gtk.Image({
      iconName: 'audio-x-generic-symbolic',
      pixelSize: Math.floor(size * 0.5),
      cssClasses: ['album-art-placeholder'],
    });

    this.placeholderBox = new Gtk.Box({
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
      hexpand: true,
      vexpand: true,
      cssClasses: ['album-art-placeholder-box'],
    });
    this.placeholderBox.append(this.placeholderIcon);

    this.stack.add_named(this.placeholderBox, 'placeholder');
    this.stack.add_named(this.picture, 'image');
    this.stack.set_visible_child_name('placeholder');

    this.append(this.stack);
  }

  get size(): number {
    return this._size;
  }

  setArtUrl(url: string | null): void {
    if (url === this.currentUrl) return;
    this.currentUrl = url;

    if (!url) {
      this.showPlaceholder();
      return;
    }

    this.loadImage(url);
  }

  private showPlaceholder(): void {
    this.stack.set_visible_child_name('placeholder');
  }

  /**
   * Scale and crop pixbuf to fixed size (cover mode)
   * This is necessary because GTK4's widthRequest/heightRequest only sets MINIMUM size,
   * and Gtk.Picture will expand based on its paintable's intrinsic size.
   */
  private setScaledPixbuf(pixbuf: GdkPixbuf.Pixbuf): void {
    const srcWidth = pixbuf.get_width();
    const srcHeight = pixbuf.get_height();
    const targetSize = this._size;

    // Calculate scale to cover (fill entire target, may crop)
    const scale = Math.max(targetSize / srcWidth, targetSize / srcHeight);
    const scaledWidth = Math.round(srcWidth * scale);
    const scaledHeight = Math.round(srcHeight * scale);

    // Scale the pixbuf
    const scaled = pixbuf.scale_simple(scaledWidth, scaledHeight, GdkPixbuf.InterpType.BILINEAR);
    if (!scaled) {
      this.showPlaceholder();
      return;
    }

    // Crop to target size (center crop)
    const offsetX = Math.round((scaledWidth - targetSize) / 2);
    const offsetY = Math.round((scaledHeight - targetSize) / 2);
    const cropped = scaled.new_subpixbuf(offsetX, offsetY, targetSize, targetSize);

    const texture = Gdk.Texture.new_for_pixbuf(cropped);
    this.picture.set_paintable(texture);
    this.stack.set_visible_child_name('image');
  }

  private async loadImage(url: string): Promise<void> {
    try {
      const file = Gio.File.new_for_uri(url);

      if (url.startsWith('file://')) {
        // Local file - load and scale
        file.read_async(0, null, (source, result) => {
          try {
            const stream = (source as Gio.File).read_finish(result);
            const pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);
            this.setScaledPixbuf(pixbuf);
            stream.close(null);
          } catch (e) {
            console.error('Failed to load album art:', e);
            this.showPlaceholder();
          }
        });
      } else {
        // Remote URL - load asynchronously
        file.read_async(0, null, (source, result) => {
          try {
            const stream = (source as Gio.File).read_finish(result);
            const pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);
            this.setScaledPixbuf(pixbuf);
            stream.close(null);
          } catch (e) {
            console.error('Failed to load album art:', e);
            this.showPlaceholder();
          }
        });
      }
    } catch (e) {
      console.error('Failed to load album art:', e);
      this.showPlaceholder();
    }
  }
}
