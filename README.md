# Garak

A GTK4/Libadwaita MPRIS media popup for Hyprland on Wayland/Linux. The name **Garak** (가락) comes from the Korean word for "melody" or "tune" (as in 한 가락 — one song).

[![한국어](https://img.shields.io/badge/lang-한국어-blue)](README.ko.md)
![GTK4](https://img.shields.io/badge/GTK4-4.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Album art, track info display and playback controls
- Auto-detection of MPRIS players
- Native Wayland layer-shell support
- Customizable size, colors, and fonts

## Preview

<https://github.com/user-attachments/assets/ae6f014f-0e22-47e5-8cd2-9b5e928f9924>

## Requirements

### Runtime Dependencies

- `gjs` - GNOME JavaScript runtime
- `gtk4` - GTK4 widget toolkit
- `libadwaita` - Adwaita design library for GTK4
- `gtk4-layer-shell` - Layer shell protocol for Wayland popups
- `playerctl` - MPRIS player controller library

### Compositor

- **Hyprland** — Required for cursor-based popup positioning

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/garak.git
cd garak

# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

### Arch Linux (AUR)

```bash
# Using makepkg
makepkg -si

# Or using an AUR helper (e.g., yay)
yay -S garak
```

## Configuration

### User Config

Create `~/.config/garak/config.json`:

```json
{
  "popupWidth": 420,
  "albumArtSize": 100,
  "albumArtBorderRadius": 8,
  "progressBarHeight": 6,
  "playPauseButtonSize": 48,
  "controlButtonSize": 36,
  "padding": 20,
  "paddingTop": 20,
  "paddingBottom": 25,
  "paddingLeft": 20,
  "paddingRight": 20,
  "sectionSpacing": 12,
  "albumArtSpacing": 16,
  "controlButtonSpacing": 12,
  "baseFontSize": 15,
  "titleFontSize": 1.1,
  "artistFontSize": 1.0,
  "albumFontSize": 0.9,
  "timeFontSize": 0.85,
  "cursorOffsetX": 0,
  "cursorOffsetY": -4
}
```

See `config.example.json` for all available options.

### Theme

Create `~/.config/garak/theme.json` to customize colors:

```json
{
  "colors": {
    "background": "rgba(9, 9, 11, 0.95)",
    "border": "#71717A",
    "text": {
      "primary": "#E4E4E7",
      "secondary": "#A1A1AA",
      "muted": "#71717A"
    },
    "progress": {
      "track": "#27272A",
      "fill": "#94A3B8",
      "knob": "#E4E4E7"
    },
    "button": {
      "normal": "#E4E4E7",
      "hover": "#FFFFFF",
      "disabled": "#52525B"
    }
  },
  "borderRadius": 14,
  "fontFamily": "Pretendard, sans-serif"
}
```

## Launching

Garak is a toggle — running it opens the popup, running it again closes it.

### Hyprland keybinding

```ini
bind = $mainMod, M, exec, garak
```

### Waybar button

```json
"modules-right": ["custom/garak"],

"custom/garak": {
  "format": "♪",
  "on-click": "/usr/bin/garak",
  "tooltip": false
}
```

## Development

```bash
# Type checking
npm run check

# Build
npm run build

# Run with debug logging
npm run start:debug
```

### Debug Logging

Set the `GARAK_DEBUG` environment variable to enable debug output. When enabled, internal events like player detection, metadata updates, and playback status changes are logged to the console with a `[DBG]` prefix.

```bash
# Using npm script (recommended)
npm run start:debug

# Or manually
GARAK_DEBUG=1 ./bin/garak
```

To add debug logging in your code, import and use the `debug()` function:

```ts
import { debug } from '../debug.js';

debug('my message', someValue);
// → [DBG] my message <someValue>
```

## Project Structure

```
├── src/
│   ├── main.ts           # Application entry point
│   ├── window.ts         # Main popup window
│   ├── services/         # Player, config, theme services
│   └── widgets/          # UI components
├── bin/garak             # Launcher script
└── config.example.json   # Configuration template
```

## License

MIT License - see LICENSE file for details.
