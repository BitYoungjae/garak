# Repository Guidelines

## Project Structure

- `src/` — TypeScript source. Entry point is `src/main.ts`.
  - `src/window.ts` — Main window UI
  - `src/services/` — Business logic (theme, player, config)
  - `src/widgets/` — Reusable UI components
- `dist/` — Build output used by GJS at runtime.
- `bin/garak` — Launcher script for Waybar integration.
- `config.example.json` — Template for user config at `~/.config/garak/config.json`.

## Commands

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm install`         | Install dev dependencies                 |
| `npm run build`       | Bundle TypeScript to `dist/`             |
| `npm start`           | Build and run with GJS                   |
| `npm run start:debug` | Build and run with verbose error logging |
| `npm run check`       | Type check with `tsc --noEmit`           |

## Coding Style

- TypeScript with `strict` and `noImplicitAny` enabled.
- ES module syntax (`import`/`export`).
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
