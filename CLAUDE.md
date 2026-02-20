# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is Garak?

A GTK4/Libadwaita MPRIS media popup widget for Waybar on Wayland/Linux. Written in TypeScript, bundled by esbuild, and executed by GJS (GNOME JavaScript runtime on SpiderMonkey). It shows album art, track info, playback controls, and a seek bar as a floating layer-shell overlay.

## Commands

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run build`        | Bundle TypeScript to `dist/main.js`      |
| `npm start`            | Build and run with GJS                   |
| `npm run start:debug`  | Build and run with verbose error logging |
| `npm run check`        | Type check with `tsc --noEmit`           |
| `npm run lint`         | ESLint                                   |
| `npm run lint:fix`     | ESLint with auto-fix                     |
| `npm run format`       | Prettier format                          |
| `npm run format:check` | Prettier check                           |
| `npm run knip`         | Dead code/dependency analysis            |

Pre-commit hooks (husky + lint-staged) run ESLint and Prettier on staged files.

## Architecture

### Build Pipeline

esbuild bundles `src/main.ts` → `dist/main.js` (single ESM file). Key config:

- `target: 'firefox115'` — JS dialect compatible with GJS's SpiderMonkey engine.
- `external: ['gi://*', 'resource://*', ...]` — GJS native imports resolved at runtime, not bundled.
- `platform: 'neutral'` — Neither browser nor Node.

The launcher script `bin/garak` LD_PRELOADs `libgtk4-layer-shell.so` then runs `gjs -m dist/main.js`.

### GJS/GObject Patterns

Every GObject subclass must register with the type system:

```ts
class Foo extends Gtk.Box {
  static {
    GObject.registerClass(this);
  }
}
```

For classes with custom signals:

```ts
static {
  GObject.registerClass({ Signals: { 'my-signal': { param_types: [] } } }, this);
}
```

GIR library imports use the `gi://` URI scheme. Version-locking side-effect imports must appear before the actual import (done in `main.ts`):

```ts
import 'gi://Gtk?version=4.0'; // side-effect: lock version
import Gtk from 'gi://Gtk'; // actual import
```

GObject virtual function overrides use the `vfunc_` prefix (e.g., `vfunc_startup`, `vfunc_activate`, `vfunc_close_request`).

GLib main loop timers: `GLib.timeout_add()` returns an ID, removed with `GLib.source_remove()`. Return `GLib.SOURCE_CONTINUE` to repeat, `GLib.SOURCE_REMOVE` to stop.

### Application Lifecycle

`main.ts`: `MprisPopupApplication extends Adw.Application`

- `vfunc_startup()` — Loads `ConfigService` and `ThemeService` synchronously.
- `vfunc_activate()` — Toggle behavior: if a window exists, close it; otherwise create a new `PopupWindow`.

### Data Flow

```
MprisPopupApplication
  ├── ConfigService  ← ~/.config/garak/config.json (layout/sizes)
  └── ThemeService   ← ~/.config/garak/theme.json (colors/fonts)

PopupWindow (window.ts)
  ├── Layer-shell positioning (hyprctl cursorpos/monitors, with fallback)
  ├── Dynamic CSS from theme + config → Gtk.CssProvider
  ├── Widget tree: Gtk.Stack switches between player view and empty state
  └── PlayerService (services/player.ts)
        ↕ D-Bus MPRIS via Playerctl
        Signals → Window → Widget updates:
          metadata-changed → albumArt.setArtUrl(), trackInfo.setTrackInfo()
          state-changed    → controls.setPlaying(), controls.setCanGoNext/Previous()
          position-changed → progress.setProgress()  (1s poll timer)
          player-vanished  → show empty state
        Widget signals → PlayerService:
          controls 'play-pause'/'next'/'previous' → playerService methods
          progress 'seek' → playerService.setPosition()
```

### PlayerService Internals

- Uses `Playerctl.PlayerManager` to watch D-Bus for MPRIS services.
- On startup, manually calls D-Bus `ListNames` to discover already-running players.
- Player selection: Playing > Paused > first available. Auto-switches when a non-current player starts playing.
- Position polling: 1-second `GLib.timeout_add` runs only while playing.
- All signal connection IDs are tracked in maps for proper cleanup in `destroy()`.
- GJS Playerctl bindings have incomplete TypeScript types; uses `as unknown as {...}` casts.

### Widget Notes

- **AlbumArt**: Async image loading via `Gio.File.read_async()` with a `loadRequestId` counter to discard stale responses. Manually scales/crops the pixbuf to exact dimensions.
- **Progress**: Seek drag uses debounce (140ms) via `GLib.timeout_add`. A `suppressSeekSignal` flag prevents feedback loops during programmatic updates.
- **CSS**: All styling is generated dynamically in `window.ts:loadCSS()` by interpolating theme colors and config sizes into a CSS string, then injected via `Gtk.CssProvider`.

## Coding Style

- TypeScript with `strict` and `noImplicitAny`.
- ES module syntax.
- Filenames: kebab-case (e.g., `track-info.ts`).
- Indentation: 2 spaces.

## Commit Guidelines

- Use short, imperative subjects (e.g., "Add Waybar toggle option").
- Use HEREDOC for multi-line commit messages.

## Version Bumping & Release

Update version in these files:

- `package.json` — Main version source
- `PKGBUILD` — `pkgver=X.Y.Z`
- `.SRCINFO` — `pkgver` and `source` URL
- `package-lock.json` — Run `npm install --package-lock-only`

### Release Workflow (with gitkkal)

```
# 1. Create release branch
/gitkkal:branch release vX.Y.Z

# 2. Update version files (package.json, PKGBUILD, .SRCINFO, package-lock.json)

# 3. Commit version bump
/gitkkal:commit version bump

# 4. Create PR and merge
/gitkkal:pr
# Review and merge on GitHub

# 5. Tag and update checksum (after merge)
git checkout master && git pull
/release vX.Y.Z
```

The `/release` skill automatically:

- Creates and pushes an annotated tag
- Updates PKGBUILD checksums via `updpkgsums`
- Regenerates `.SRCINFO`
- Commits and pushes the checksum update

## Runtime Dependencies

`gjs`, `gtk4`, `libadwaita`, `gtk4-layer-shell`, `playerctl`
