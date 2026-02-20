import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export type JsonObject = Record<string, unknown>;

export function buildGarakConfigPath(fileName: string): string {
  return GLib.build_filenamev([GLib.get_user_config_dir(), 'garak', fileName]);
}

export function loadJsonFileSync(filePath: string): unknown | null {
  const file = Gio.File.new_for_path(filePath);
  if (!file.query_exists(null)) {
    return null;
  }

  const [ok, contents] = file.load_contents(null);
  if (!ok) {
    throw new Error(`Failed to read file: ${filePath}`);
  }

  const jsonText = new TextDecoder('utf-8').decode(contents);
  return JSON.parse(jsonText) as unknown;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
