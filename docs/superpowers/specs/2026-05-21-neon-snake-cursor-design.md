# Neon Snake Cursor Design

## Goal

Create a standalone VS Code cursor effect file at:

`C:\Users\alexh\.vscode\neon-snake-cursor.js`

The file should preserve the desired cursor design independently of cursor-effect extension folders. VS Code will load it through the existing `vscode_custom_css.imports` setting from the Custom CSS and JS extension.

## Source Of Truth

The new standalone file becomes the only JavaScript cursor renderer. VS Code settings should keep the existing gradient cursor CSS and replace the two extension-owned cursor scripts with the new standalone JS file.

Expected imports:

- `file:///C:/Users/alexh/.vscode/gradient-cursor.css`
- `file:///C:/Users/alexh/.vscode/neon-snake-cursor.js`

The old injected files should be removed from `vscode_custom_css.imports`:

- `file:///c%3A/Users/alexh/.vscode/extensions/30d98f9b2.neovide-cursor-1.0.1/neovide-cursor.js`
- `file://c:\Users\alexh\.vscode\extensions\yesitsfebreeze.smearcursor-1.3.0\_smearcursor.js`

## Visual Behavior

The cursor should look like a bright cyan-blue neon cursor with a soft glow.

When stationary, the cursor remains visible with a weaker glow so it does not interfere with typing.

During motion, the cursor glow becomes stronger and leaves a long luminous trail. The trail should resemble the provided reference images: a bright core with larger blue glow around it.

When moving between split editor groups, the trail should draw across the viewport from the previous editor cursor location to the new editor cursor location.

## Trail Behavior

The renderer should keep multiple jump segments alive at the same time. For jumps `A -> B -> C -> D`, it should retain these segments briefly:

- `A -> B`
- `B -> C`
- `C -> D`

Segments shrink in order. The oldest segment collapses first, then the next segment, then the newest segment. This creates a snake-like trail instead of replacing the old trail whenever a new jump arrives.

The shrink speed must increase as the number of active segments increases. Fast repeated jumps should accelerate old segment decay so the trail does not linger long enough to look laggy.

## Rendering Approach

Use one full-window fixed canvas overlay with `pointer-events: none`.

Observe Monaco cursor DOM nodes using viewport coordinates from `getBoundingClientRect()`.

Hide or de-emphasize the native Monaco cursor while custom rendering is active, then allow a subtle stationary custom cursor to remain visible when animation settles.

Keep the original Neovide-style trail mechanics as the base: four independent cursor corners use damped spring animation, rank-based leading/trailing corner behavior, hard snap for leading corners, and per-frame DOM position tracking.

Add the snake effect by keeping a short queue of retired Neovide-style spring trails. When a new jump starts, older spring trails continue shrinking toward their previous targets instead of being replaced. Older queued trails update faster than newer trails, and the whole queue speeds up as it grows.

Use canvas shadows and layered fills for cyan-blue neon glow around both the moving spring polygons and the weaker stationary cursor.

## Constraints

Keep the implementation standalone and dependency-free.

Do not modify extension-owned cursor scripts.

Keep changes scoped to:

- Creating `C:\Users\alexh\.vscode\neon-snake-cursor.js`
- Updating `C:\Users\alexh\AppData\Roaming\Code\User\settings.json`

Because both target files are outside this workspace's writable root, file edits require escalation approval.

## Verification

After installation, VS Code should be reloaded and the Custom CSS and JS command should be re-enabled if needed.

Manual verification should cover:

- Short horizontal cursor movement while typing
- Fast line jumps in one editor
- Repeated jumps `A -> B -> C -> D`
- Jumping between split editor groups
- Stationary cursor readability
- Confirming the old trail does not disappear immediately when a new jump starts
- Confirming fast repeated jumps do not leave a laggy screen-filling trail
