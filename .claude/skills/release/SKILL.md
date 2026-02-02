---
name: release
description: 'Tag release and update PKGBUILD checksums after PR merge.'
disable-model-invocation: true
allowed-tools: Read, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: '[version]'
---

# release

Creates a git tag and updates PKGBUILD checksums after PR merge.

## Critical Rules

- NEVER run on non-master/main branch without user confirmation
- NEVER force push tags
- ALWAYS verify tag doesn't already exist before creating
- ALWAYS use annotated tags for releases (not lightweight tags)

## Dependencies

- `jq` — JSON parsing for version extraction
- `pacman-contrib` — Provides `updpkgsums` for automatic checksum updates

## Workflow

### 1. Verify Environment

```bash
git branch --show-current
git remote show origin | grep 'HEAD branch'
```

If not on master/main → Use AskUserQuestion to confirm proceeding.

### 2. Determine Version

**$ARGUMENTS** — If provided, use as version (e.g., `1.1.1` or `v1.1.1`).

If not provided, extract from `package.json`:

```bash
jq -r '.version' package.json
```

Normalize version: ensure tag format is `vX.Y.Z` (add `v` prefix if missing).

### 3. Check Tag Status

```bash
git tag -l "vX.Y.Z"
git ls-remote --tags origin | grep "vX.Y.Z"
```

- Tag exists locally or remotely → Error: "Tag vX.Y.Z already exists."
- No tag → Proceed

### 4. Create and Push Tag

Use annotated tag with release message:

```bash
git pull origin master
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Output: `Created and pushed tag: vX.Y.Z`

### 5. Update Checksum

Wait briefly for GitHub to generate the tarball, then use `updpkgsums` to automatically update PKGBUILD checksums:

```bash
updpkgsums
```

If checksum generation fails → Use AskUserQuestion: "Checksum generation failed. Retry or skip?"

### 6. Regenerate .SRCINFO

```bash
makepkg --printsrcinfo > .SRCINFO
```

### 7. Commit Checksum Update

```bash
git add PKGBUILD .SRCINFO
git commit -m "$(cat <<'EOF'
chore: update sha256sums for vX.Y.Z
EOF
)"
git push origin master
```

### 8. Output

```
Release vX.Y.Z completed!

Tag: vX.Y.Z (pushed)
Checksum: updated

URL: https://github.com/{owner}/{repo}/releases/tag/vX.Y.Z
```

## Error Handling

| Situation                 | Action                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| Not on master/main        | Ask user to confirm or abort                                                 |
| Tag already exists        | Error and abort                                                              |
| jq not installed          | Error: "jq is required. Install with: sudo pacman -S jq"                     |
| updpkgsums not installed  | Error: "updpkgsums is required. Install with: sudo pacman -S pacman-contrib" |
| Checksum generation fails | Retry or skip with user confirmation                                         |
| Push fails                | Show error, suggest manual resolution                                        |
