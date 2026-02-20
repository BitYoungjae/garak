---
name: release
description: 'Tag release, create GitHub release, update PKGBUILD checksums, and push to AUR.'
disable-model-invocation: true
allowed-tools: Read, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: '[version]'
---

# release

Creates a git tag, GitHub release, updates PKGBUILD checksums, and pushes to AUR.

## Guardrails

- Run only from `master`.
- Abort unless both current branch and `origin` default branch are `master`.
- Abort on dirty working tree unless user explicitly approves.
- Never force-push tags or branches.
- Always use annotated tags for releases (not lightweight tags).
- AUR requires packaging-only files (`PKGBUILD` and `.SRCINFO`).

## Prerequisites

- `git`
- `gh`
- `jq`
- `curl`
- `makepkg`
- `updpkgsums` (`pacman-contrib`)

## Workflow

### 1) Branch safety and clean tree

```bash
set -euo pipefail

current_branch="$(git branch --show-current)"
origin_default_branch="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
printf "current_branch=%s\norigin_default_branch=%s\n" "$current_branch" "$origin_default_branch"
git status --short
```

- Stop if default branch detection fails.
- Stop if either branch is not `master`.
- Stop on dirty tree unless user explicitly allows.

### 2) Resolve target version and current state

**$ARGUMENTS** — If provided, use as version (e.g., `1.2.0` or `v1.2.0`).

If not provided, extract from `package.json`:

```bash
app_version="$(jq -r '.version' package.json)"
tag="v${app_version}"
app_expected="${app_version}-1"
```

Check tag, release, and AUR state:

```bash
tag_exists_remote=false
git ls-remote --exit-code --tags origin "refs/tags/${tag}" >/dev/null 2>&1 && tag_exists_remote=true

release_exists=false
gh release view "${tag}" --json tagName >/dev/null 2>&1 && release_exists=true

aur_json="$(curl -fsSL 'https://aur.archlinux.org/rpc/?v=5&type=info&arg[]=garak')"
aur_version="$(jq -r '.results[] | select(.Name=="garak") | .Version // ""' <<<"$aur_json")"

local_version="$(awk -F= '/^pkgver=/{v=$2}/^pkgrel=/{r=$2} END{print v "-" r}' PKGBUILD)"

printf "tag=%s\ntag_exists_remote=%s\nrelease_exists=%s\naur_version=%s\nlocal_version=%s\napp_expected=%s\n" \
  "$tag" "$tag_exists_remote" "$release_exists" "$aur_version" "$local_version" "$app_expected"
```

### 3) Decide if release/sync is needed

```bash
need_release=false

if [ "$local_version" != "$app_expected" ]; then
  need_release=true
fi
if [ "$aur_version" != "$app_expected" ]; then
  need_release=true
fi
if [ "$tag_exists_remote" = false ] || [ "$release_exists" = false ]; then
  need_release=true
fi

printf "need_release=%s\n" "$need_release"
```

- If `false`, report "already synchronized" and stop.

### 4) Update PKGBUILD version

```bash
sed -i "s/^pkgver=.*/pkgver=${app_version}/" PKGBUILD
sed -i "s/^pkgrel=.*/pkgrel=1/" PKGBUILD
```

### 5) Create and push tag

Skip if tag already exists remotely.

```bash
git pull origin master

if [ "$tag_exists_remote" = false ]; then
  git tag -a "${tag}" -m "Release ${tag}"
  git push origin "${tag}"
fi
```

Output: `Created and pushed tag: vX.Y.Z`

### 6) Create/update GitHub release

```bash
if gh release view "${tag}" --json tagName >/dev/null 2>&1; then
  gh release edit "${tag}" \
    --draft=false \
    --latest \
    --title "garak ${tag}"
else
  gh release create "${tag}" \
    --verify-tag \
    --title "garak ${tag}" \
    --generate-notes
fi
```

### 7) Update checksum

Wait briefly for GitHub to generate the tarball, then update checksums:

```bash
sleep 5
updpkgsums
```

If checksum generation fails, ask user: "Checksum generation failed. Retry or skip?"

### 8) Regenerate .SRCINFO

```bash
makepkg --printsrcinfo > .SRCINFO
```

### 9) Commit and push metadata to origin/master

```bash
git add PKGBUILD .SRCINFO

if ! git diff --cached --quiet; then
  git commit -m "$(cat <<'EOF'
chore: update sha256sums for vX.Y.Z
EOF
  )"
  git push origin master
fi
```

### 10) Push to AUR via git worktree

Ensure AUR remote:

```bash
git remote get-url aur >/dev/null 2>&1 || git remote add aur ssh://aur@aur.archlinux.org/garak.git
```

Push packaging files using a temporary worktree:

```bash
repo_root="$(git rev-parse --show-toplevel)"
tmpdir="$(mktemp -d)"

git worktree add "$tmpdir" --detach
(
  cd "$tmpdir"
  if git ls-remote --exit-code aur refs/heads/master >/dev/null 2>&1; then
    git fetch aur master
    git checkout -B aur-sync FETCH_HEAD
  else
    git checkout --orphan aur-sync
    git rm -rf --cached . >/dev/null 2>&1 || true
    find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  fi

  git --git-dir="$repo_root/.git" show master:PKGBUILD > PKGBUILD
  git --git-dir="$repo_root/.git" show master:.SRCINFO > .SRCINFO

  git add PKGBUILD .SRCINFO
  git commit -m "Update garak to ${tag}" || true
  git push aur HEAD:master
)
git worktree remove "$tmpdir" --force
```

### 11) Post-verify and report

```bash
curl -fsSL 'https://aur.archlinux.org/rpc/?v=5&type=info&arg[]=garak' | jq -r '.results[] | "\(.Name)\t\(.Version)"'
gh release view "${tag}" --json url,isDraft,isPrerelease,publishedAt,tagName --jq '{tagName,isDraft,isPrerelease,publishedAt,url}'
```

Report:

```
Release vX.Y.Z completed!

Tag: vX.Y.Z (pushed to origin)
GitHub: https://github.com/bityoungjae/garak/releases/tag/vX.Y.Z
Checksum: updated
AUR: pushed — https://aur.archlinux.org/packages/garak
```

## Error Handling

| Situation                 | Action                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| Not on master             | Ask user to confirm or abort                                                 |
| Dirty working tree        | Ask user to confirm or abort                                                 |
| Tag already exists        | Skip tag creation, proceed with release/sync                                 |
| jq not installed          | Error: "jq is required. Install with: sudo pacman -S jq"                     |
| gh not installed          | Error: "gh is required. Install with: sudo pacman -S github-cli"             |
| updpkgsums not installed  | Error: "updpkgsums is required. Install with: sudo pacman -S pacman-contrib" |
| Checksum generation fails | Retry or skip with user confirmation                                         |
| Push fails                | Show error, suggest manual resolution                                        |
| AUR remote not configured | Auto-add `ssh://aur@aur.archlinux.org/garak.git`                             |
| AUR auth failure          | Stop and report SSH key/remote issue                                         |
| AUR non-fast-forward      | Fetch AUR master first, then replay packaging files and push                 |

## AUR Architecture

AUR repositories require:

- Only `PKGBUILD` and `.SRCINFO` files (no source code)
- Push to `master` branch only
- Clean git history without unrelated files

This skill uses `git worktree` to:

1. Create a temporary detached worktree
2. Fetch AUR's `master` or create an orphan branch (first-time)
3. Copy only `PKGBUILD` and `.SRCINFO` from main project
4. Commit and push to AUR's required `master` branch
5. Clean up the temporary worktree

This approach avoids modifying the main working tree or switching branches.
