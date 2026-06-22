# Context ZIP Utility

## Overview

The context ZIP utility streamlines context sharing between the CCW repository and ChatGPT/Codex. It solves the recurring problem of manually finding, selecting, and uploading many repository files, generated artifacts, and git outputs whenever an assistant asks for project context.

The high-level workflow is:

1. Copy the assistant's request.
2. Run `ctx` or call `node tools/context_zip.js` directly.
3. Generate `chat_context_YYYYMMDD_HHMMSS.zip`.
4. Copy the ZIP from Explorer.
5. Paste the ZIP into ChatGPT/Codex.

Benefits:

- Single ZIP upload instead of many manual attachments.
- Preserved directory structure inside the package.
- Optional inclusion of useful git outputs.
- Reduced manual work when sharing context.
- Suitable for large context packages spanning source files, docs, generated artifacts, snapshots, and command outputs.

## Components

### `tools/context_zip.js`

Node.js utility that collects requested files, simple wildcard matches, directories, and optional git command outputs into a temporary upload directory, then compresses that directory into a timestamped ZIP file.

The utility is intended for read-only packaging. It does not modify repository source files, write git state, or access the network.

### `ctx.bat`

Convenience wrapper for clipboard mode:

```bat
ctx
```

This runs:

```bat
node tools\context_zip.js --from-clipboard
```

### `_chat_upload`

Temporary staging directory created at the repository root. The utility copies requested files into this directory while preserving their repository-relative paths.

The directory is deleted and recreated on every execution. Its contents are temporary and ephemeral, used only as packaging workspace before ZIP creation. Users should not edit `_chat_upload` manually.

### `chat_context_YYYYMMDD_HHMMSS.zip`

Timestamped ZIP package created at the repository root.

Example:

```text
chat_context_20260619_090802.zip
```

This is the file intended to be copied from Explorer and pasted into ChatGPT/Codex.

### `_manifest.txt`

Manifest file written inside `_chat_upload` and included in the ZIP. It records when the package was generated, the repository root used for the run, and the files or command outputs added to the package.

### `_commands/`

Directory inside the package that stores captured command outputs. Git outputs requested with command flags are written here as text files.

Examples:

```text
_commands/git_status_short.txt
_commands/git_log_oneline_5.txt
_commands/git_diff_stat.txt
```

## Supported Inputs

### Individual Files

```bat
node tools/context_zip.js backlog/current.md
```

### Wildcards

```bat
node tools/context_zip.js analysis/generated/foo/*
```

Wildcard collection matches files in the target directory and preserves their repository-relative paths in the ZIP.

### Directories

```bat
node tools/context_zip.js live
```

Directory collection includes files directly inside the requested directory.

### Git Commands

```bat
node tools/context_zip.js --git-status
node tools/context_zip.js --git-log
node tools/context_zip.js --git-diff
```

Supported git command flags:

- `--git-status` writes `_commands/git_status_short.txt`.
- `--git-log` writes `_commands/git_log_oneline_5.txt`.
- `--git-diff` writes `_commands/git_diff_stat.txt`.

These are read-only git commands used for assistant context and auditability.

### Clipboard Mode

```bat
node tools/context_zip.js --from-clipboard
```

Or use the convenience wrapper:

```bat
ctx
```

Clipboard mode reads the current clipboard text and attempts to detect repository-relative file paths, simple wildcard expressions, and supported git command requests. Unrelated text is ignored.

## Clipboard Workflow

The intended daily workflow is:

1. Copy the ChatGPT/Codex request.
2. Run:

```bat
ctx
```

3. Wait for completion and the terminal beep, which indicates that packaging and ZIP generation completed successfully.
4. Press F5 in Explorer if the generated ZIP is not visible yet.
5. Copy the generated ZIP.
6. Paste the ZIP into ChatGPT/Codex.

## Package Structure Example

```text
chat_context_20260619_090802.zip
|-- backlog/
|-- docs/
|-- live/
|-- _commands/
|   |-- git_status_short.txt
|   |-- git_log_oneline_5.txt
|   `-- git_diff_stat.txt
`-- _manifest.txt
```

## Manifest Example

Example `_manifest.txt` contents:

```text
CCW Chat Upload Manifest
Generated: 2026-06-19T12:08:02.000Z
Root: C:\Users\Yaco\Desktop\ccw

FILE: backlog/current.md
FILE: docs/02_architecture.md
FILE: live/snapshots/2026-06-21_live_snapshot.md
COMMAND: _commands/git_status_short.txt
COMMAND: _commands/git_log_oneline_5.txt
COMMAND: _commands/git_diff_stat.txt
```

The manifest provides a compact audit trail for the package. It helps the assistant and user confirm what was included, when the ZIP was generated, and which repository root was used.

If a requested path is missing, the manifest records it as:

```text
NOT FOUND: requested/path
```

## ZIP Retention Policy

ZIP files are timestamped using the pattern:

```text
chat_context_YYYYMMDD_HHMMSS.zip
```

Only the last 5 `chat_context` ZIPs are retained automatically. Older matching ZIPs are deleted during cleanup after a new ZIP is created.

## Design Principles

- Research tooling only.
- No repository modifications.
- No git writes.
- No network access.
- Read-only packaging utility.
- Minimize operational friction.
- Preserve reproducibility and auditability.
