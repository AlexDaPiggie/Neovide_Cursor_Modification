# Spec: High-Speed Bridge Color Snap

Implement a speed-based color transition for the cursor's bridge (connectors between trail segments) that "snaps" to a light blue glow color when the cursor is moving rapidly.

## 1. Goal
The bridge should change its color and glow to match the "moving" mode's light blue glow when the cursor exceeds a specific speed threshold. The bridge should also exhibit a fading effect similar to the trail segments.

## 2. Requirements
- **Speed Detection:** Use the number of retired trail segments as a proxy for speed (Approach 1: Trail-Count Threshold).
- **Color Snap:** The transition must be an immediate "snap" rather than a gradual fade.
- **Visual Style:** 
    - Single-pass line for the bridge.
    - Color: Light blue glow (matching `CONFIG.coreColor` and `CONFIG.midColor` properties).
    - Fading: Older segments should be more transparent/thinner, matching the trail's fade.
- **Performance:** Maintain a single-pass rendering approach for the bridge connectors.

## 3. Implementation Plan

### 3.1 Configuration Updates
Modify the `CONFIG` object to include:
- `highSpeedThreshold`: The number of retired trail segments required to trigger the high-speed color (default: 4).
- `highSpeedBridgeColor`: The specific color for the high-speed bridge (e.g., `CONFIG.coreColor` or a specific light blue hex/rgba).

### 3.2 Logic Updates
In `GlobalCursorManager.loop` and `drawRetiredTrailConnectors`:
- Calculate `isHighSpeed` based on `this.retiredTrails.length >= CONFIG.highSpeedThreshold`.
- Pass this state down to the connector drawing functions.

### 3.3 Rendering Updates
Update `drawTrailConnector`:
- Add a `color` parameter or use the `isHighSpeed` state to select the stroke color.
- Ensure the `shadowColor` and `shadowBlur` are boosted in high-speed mode to create the "glow" effect.
- Maintain the `orderAlpha` logic to ensure older segments fade out.

## 4. Verification Plan
- **Visual Check:** Confirm the bridge snaps to light blue when moving fast.
- **Fading Check:** Confirm the bridge segments fade out as they age.
- **Performance Check:** Ensure no noticeable frame rate drop during high-speed movement.
