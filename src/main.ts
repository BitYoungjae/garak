import 'gi://Gtk4LayerShell?version=1.0';
import 'gi://Gtk?version=4.0';
import 'gi://Adw?version=1';

import GObject from 'gi://GObject';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { PopupWindow } from './window.js';
import { ConfigService } from './services/config.js';
import { ThemeService } from './services/theme.js';

const APP_ID = 'com.github.bityoungjae.waybar-mpris';

class MprisPopupApplication extends Adw.Application {
  static {
    GObject.registerClass(this);
  }

  private window: PopupWindow | null = null;
  private configService: ConfigService;
  private themeService: ThemeService;

  constructor() {
    super({
      applicationId: APP_ID,
      flags: Gio.ApplicationFlags.FLAGS_NONE,
    });

    this.configService = new ConfigService();
    this.themeService = new ThemeService();
  }

  override vfunc_startup(): void {
    super.vfunc_startup();
    // Load config and theme synchronously to ensure they're ready before window creation
    this.configService.loadSync();
    this.themeService.loadSync();
  }

  override vfunc_activate(): void {
    if (this.window) {
      // Toggle: if window exists, close the app
      this.window.close();
      return;
    }

    this.window = new PopupWindow(this, this.configService, this.themeService);
    this.window.connect('destroy', () => {
      this.window = null;
    });
    this.window.present();
  }
}

const app = new MprisPopupApplication();
app.run(null);
