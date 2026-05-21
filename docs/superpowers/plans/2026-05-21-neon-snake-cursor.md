# Neon Snake Cursor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone VS Code neon cursor renderer with queued snake-like jump trails.

**Architecture:** Create a single dependency-free JavaScript file that preserves the Neovide cursor extension's spring-corner trail physics, draws a fixed full-window canvas overlay, and stores a queue of retired spring trails so old trail pieces shrink in order instead of disappearing. Update VS Code `settings.json` so Custom CSS and JS Loader imports the standalone file instead of extension-owned cursor scripts.

**Tech Stack:** Browser JavaScript injected into VS Code workbench, Monaco editor DOM, Canvas 2D, VS Code user settings JSON.

---

## File Structure

- Create source artifact: `C:\Users\alexh\Coding\Neovide_Cursor\neon-snake-cursor.js`
  - Workspace copy of the standalone cursor renderer for review and future backup.
- Install artifact: `C:\Users\alexh\.vscode\neon-snake-cursor.js`
  - Runtime file loaded by Custom CSS and JS Loader.
- Modify: `C:\Users\alexh\AppData\Roaming\Code\User\settings.json`
  - Replace extension-owned cursor JS imports with the standalone runtime file while keeping `gradient-cursor.css`.

## Task 1: Create Standalone Cursor Renderer

**Files:**
- Create: `C:\Users\alexh\Coding\Neovide_Cursor\neon-snake-cursor.js`

- [ ] **Step 1: Create the renderer file**

Use `apply_patch` to add `neon-snake-cursor.js` in the workspace. The implementation must:

- Install only once by checking `window.__neonSnakeCursorInstalled`.
- Draw on one `canvas.neon-snake-cursor-layer`.
- Track cursor movement using `.part.editor .cursor`.
- Store a queue of retired Neovide-style spring trails.
- Shrink old segments first.
- Increase decay speed as the segment queue grows.
- Keep a weak stationary glow cursor visible.

Core constants to include:

```javascript
const CONFIG = {
  colorCore: "rgba(211, 251, 255, 0.96)",
  colorMid: "rgba(91, 213, 255, 0.78)",
  colorOuter: "rgba(0, 166, 255, 0.34)",
  stationaryAlpha: 0.42,
  movingAlpha: 1,
  stationaryGlow: 9,
  movingGlow: 28,
  maxSegments: 8,
  baseSegmentLifetime: 520,
  minSegmentLifetime: 135,
  queueDecayBoost: 0.22,
  maxTrailLength: 620,
  minMoveDistance: 1.5,
  cursorPollMs: 45,
  hideNativeWhileMovingMs: 90,
};
```

Essential Neovide-style model:

```javascript
class DampedSpringAnimation {}
class Corner {}
function createNeovideCursor() {}
function createTrailSegment() {}
```

Trail behavior:

```javascript
const retiredTrails = [];
// On movement, push a createTrailSegment(fromCenter, toCenter, size).
// Each trail uses the same Corner and DampedSpringAnimation classes as the live cursor.
// Older retired trails receive a larger timeScale so A->B collapses before B->C.
```

- [ ] **Step 2: Syntax check the renderer**

Run:

```powershell
node --check .\neon-snake-cursor.js
```

Expected:

```text
```

`node --check` exits with code `0` and prints no syntax errors.

## Task 2: Install Runtime File

**Files:**
- Create/overwrite: `C:\Users\alexh\.vscode\neon-snake-cursor.js`

- [ ] **Step 1: Copy the reviewed workspace file to the VS Code user folder**

Run with escalation because the destination is outside the writable workspace:

```powershell
Copy-Item -LiteralPath "C:\Users\alexh\Coding\Neovide_Cursor\neon-snake-cursor.js" -Destination "C:\Users\alexh\.vscode\neon-snake-cursor.js" -Force
```

Expected:

```text
```

The command exits with code `0`.

- [ ] **Step 2: Confirm the runtime file exists**

Run:

```powershell
Get-Item -LiteralPath "C:\Users\alexh\.vscode\neon-snake-cursor.js" | Select-Object FullName,Length
```

Expected: output includes `C:\Users\alexh\.vscode\neon-snake-cursor.js` and a non-zero `Length`.

## Task 3: Update VS Code Imports

**Files:**
- Modify: `C:\Users\alexh\AppData\Roaming\Code\User\settings.json`

- [ ] **Step 1: Update `vscode_custom_css.imports`**

Use a JSON-aware PowerShell script with escalation because the settings file is outside the writable workspace:

```powershell
$settingsPath = "C:\Users\alexh\AppData\Roaming\Code\User\settings.json"
$json = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$json.vscode_custom_css.imports = @(
  "file:///C:/Users/alexh/.vscode/gradient-cursor.css",
  "file:///C:/Users/alexh/.vscode/neon-snake-cursor.js"
)
$json | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $settingsPath -Encoding UTF8
```

Expected: the old extension-owned cursor JS imports are removed and the new standalone JS import is present.

- [ ] **Step 2: Verify imports**

Run:

```powershell
(Get-Content -LiteralPath "C:\Users\alexh\AppData\Roaming\Code\User\settings.json" -Raw | ConvertFrom-Json).vscode_custom_css.imports
```

Expected:

```text
file:///C:/Users/alexh/.vscode/gradient-cursor.css
file:///C:/Users/alexh/.vscode/neon-snake-cursor.js
```

## Task 4: Manual VS Code Verification

**Files:**
- No code changes.

- [ ] **Step 1: Reload VS Code and enable custom CSS/JS if needed**

In VS Code, run:

```text
Developer: Reload Window
```

If the Custom CSS and JS extension requires reapplying changes, run:

```text
Enable Custom CSS and JS
```

- [ ] **Step 2: Verify cursor behavior manually**

Expected behavior:

- Stationary cursor has a subtle blue neon glow.
- Horizontal typing movement has a short glow trail and does not obscure text.
- Fast jumps between lines leave multiple queued segments.
- For repeated jumps `A -> B -> C -> D`, segment `A -> B` shrinks first, then `B -> C`, then `C -> D`.
- Jumping between split editor groups draws one cross-group trail through viewport space.
- Fast repeated jumps accelerate decay and do not create the lagging screen-filling effect shown in `lagging_error.png`.

---

## Self-Review

Spec coverage:

- Standalone file path is covered by Task 1 and Task 2.
- Settings import migration is covered by Task 3.
- Multiple queued spring trails are covered by Task 1.
- Ordered shrinking is covered by Task 1 `retiredTrails`.
- Queue-length decay acceleration is covered by Task 1 retired trail time scaling.
- Stationary weak glow and stronger motion glow are covered by Task 1 draw requirements.
- Cross-editor movement is covered by viewport-based cursor tracking in Task 1 and manual verification in Task 4.

Placeholder scan:

- No placeholder tasks remain.
- The only manual verification step is intentionally manual because the visible effect must be checked inside VS Code after reloading injected custom JS.
