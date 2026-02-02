# Repository Guidelines

## Project Structure & Module Organization

- `src/` holds the TypeScript source. Entry point is `src/main.ts`, with UI and services split into `src/window.ts`, `src/services/`, and `src/widgets/`.
- `dist/` is the build output used by GJS at runtime.
- `bin/` contains the `mpris-popup` launcher script for Waybar integration.
- `config.example.json` is the template for user configuration at `~/.config/garak/config.json`.

## Build, Test, and Development Commands

- `npm install` installs Node dev dependencies (esbuild, TypeScript).
- `npm run build` bundles TypeScript to `dist/` using `esbuild.config.js`.
- `npm start` builds, then runs `gjs -m dist/main.js`.
- `npm run start:debug` builds, then runs GJS with verbose JS error logging.
- `npm run check` runs `tsc --noEmit` for type checking.

## Coding Style & Naming Conventions

- TypeScript is compiled with `strict` and `noImplicitAny` enabled in `tsconfig.json`.
- Use ES module syntax (`import`/`export`), consistent with `"type": "module"` in `package.json`.
- Keep filenames kebab-case in `src/widgets/` and `src/services/` (e.g., `track-info.ts`).
- Indentation follows existing code style (2 spaces). If you introduce new patterns, keep them consistent within the edited file.

## Testing Guidelines

- There is no automated test framework configured yet.
- Use `npm run check` as the minimum verification step for type safety.
- If you add tests in the future, document how to run them and their naming conventions here.

## Commit & Pull Request Guidelines

- This repository currently has no Git commit history, so no established commit message convention exists.
- Until a convention is defined, use short, imperative subjects (e.g., “Add Waybar toggle option”).
- PRs should include: a concise summary, steps to test (commands run), and screenshots or gifs for UI changes.

## Version Bumping

Update version in these files:

- `package.json` — main version source
- `PKGBUILD` — `pkgver=X.Y.Z`
- `.SRCINFO` — `pkgver` and `source` URL
- `package-lock.json` — run `npm install --package-lock-only`

Note: After release, regenerate `sha256sums` in PKGBUILD with `makepkg -g`.

## Configuration & Runtime Notes

- Runtime dependencies include `gjs`, `gtk4`, `libadwaita`, `gtk4-layer-shell`, and `playerctl` (see `README.md`).
- Example config lives in `config.example.json`; document any new config keys there.
