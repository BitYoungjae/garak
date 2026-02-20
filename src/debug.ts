import GLib from 'gi://GLib';

const enabled = GLib.getenv('GARAK_DEBUG') !== null;

export function debug(...args: unknown[]): void {
  if (enabled) {
    console.log('[DBG]', ...args);
  }
}
