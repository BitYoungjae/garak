# Garak

Hyprland 환경을 위한 GTK4/Libadwaita 기반 MPRIS 미디어 팝업입니다.

**Garak(가락)**이라는 이름은 '노래 한 가락'할 때 그 가락, 즉 선율(melody)에서 따왔습니다.

![Garak Preview](https://img.shields.io/badge/GTK4-4.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 주요 기능

- 앨범 아트, 곡 정보 표시 및 재생 컨트롤
- MPRIS 플레이어 자동 감지
- Wayland 레이어 셸 네이티브 지원
- 크기, 색상, 폰트 등 커스터마이징

## 미리보기

<https://github.com/user-attachments/assets/ae6f014f-0e22-47e5-8cd2-9b5e928f9924>

## 필요한 것들

### 런타임 의존성

- `gjs` — GNOME JavaScript 런타임
- `gtk4` — GTK4 툴킷
- `libadwaita` — GTK4용 Adwaita 라이브러리
- `gtk4-layer-shell` — Wayland 레이어 셸 지원
- `playerctl` — MPRIS 플레이어 제어 라이브러리

### 컴포지터

- **Hyprland** — 마우스 위치 기반 팝업 포지셔닝에 필수

## 설치

### 소스에서 직접 빌드

```bash
git clone https://github.com/yourusername/garak.git
cd garak

npm install    # 의존성 설치
npm run build  # 빌드
npm start      # 실행
```

### Arch Linux (AUR)

```bash
# makepkg로 직접 빌드
makepkg -si

# 또는 AUR 헬퍼 사용
yay -S garak
```

## 설정

### 기본 설정

`~/.config/garak/config.json` 파일을 만들어서 원하는 대로 조정할 수 있습니다.

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

전체 옵션 목록은 `config.example.json`을 참고하세요.

### 테마

색상을 바꾸고 싶다면 `~/.config/garak/theme.json` 파일을 만드세요.

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

## 실행 방법

Garak은 토글 방식으로 동작합니다. 실행하면 팝업이 열리고, 다시 실행하면 닫힙니다.

### Hyprland 키바인딩

```ini
bind = $mainMod, M, exec, garak
```

### Waybar 버튼

```json
"modules-right": ["custom/garak"],

"custom/garak": {
  "format": "♪",
  "on-click": "/usr/bin/garak",
  "tooltip": false
}
```

## 개발

```bash
npm run check        # 타입 검사
npm run build        # 빌드
npm run start:debug  # 디버그 모드로 실행
```

### 디버그 로그

`GARAK_DEBUG` 환경 변수를 설정하면 디버그 로그가 활성화됩니다. 플레이어 감지, 메타데이터 갱신, 재생 상태 변경 등 내부 이벤트가 `[DBG]` 접두사와 함께 콘솔에 출력됩니다.

```bash
# npm 스크립트 사용 (권장)
npm run start:debug

# 또는 직접 실행
GARAK_DEBUG=1 ./bin/garak
```

코드에서 디버그 로그를 추가하려면 `debug()` 함수를 임포트해서 사용하면 됩니다:

```ts
import { debug } from '../debug.js';

debug('my message', someValue);
// → [DBG] my message <someValue>
```

## 프로젝트 구조

```
├── src/
│   ├── main.ts           # 진입점
│   ├── window.ts         # 메인 팝업 창
│   ├── services/         # 플레이어, 설정, 테마 관련
│   └── widgets/          # UI 컴포넌트들
├── bin/garak             # 실행 스크립트
└── config.example.json   # 설정 파일 예시
```

## 라이선스

MIT
