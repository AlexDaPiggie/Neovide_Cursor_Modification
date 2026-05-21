# High-Speed Glow Boost Design

The goal is to implement a glow intensity boost for trail connectors that scales with the number of "retired trails" currently active. This creates a more intense visual effect when the cursor is moving rapidly and generating many segments.

## Proposed Approaches

### Option 1: Inline Calculation in `drawRetiredTrailConnectors` (Recommended)
Calculate the `highSpeedGlowScale` directly within the `drawRetiredTrailConnectors` method and pass it to `drawTrailConnector`.

*   **Pros:** Minimal changes, keeps logic close to where it's used, matches the pattern suggested by the failing test.
*   **Cons:** Spreads scaling logic if other parts of the system ever need it.
*   **Recommendation:** This is the most direct path to satisfying the test and achieving the visual goal without over-engineering.

### Option 2: Utility Function for Glow Scaling
Extract the scaling logic into a helper function (e.g., `calculateGlowBoost(totalRetired)`) used by the manager.

*   **Pros:** Reusable if other elements (like the polygons themselves) should also boost.
*   **Cons:** Slightly more boilerplate for a very simple linear calculation.

## Proposed Architecture

1.  **Modify `drawRetiredTrailConnectors`**:
    *   Calculate `const highSpeedGlowScale = 1 + Math.min(total, CONFIG.maxRetiredTrails) * CONFIG.connectorHighSpeedGlowBoost;`
    *   Pass this scale into the `drawTrailConnector` calls.

2.  **Modify `drawRetiredTrails`**:
    *   Use the same `highSpeedGlowScale` calculation.
    *   Pass this scale to the `trail.draw` method.

3.  **Update `drawTrailConnector`**:
    *   Ensure it uses the `glowScale` parameter to multiply `shadowBlur`.

4.  **Update `drawPolygon` and `trail.draw`**:
    *   Modify `drawPolygon` to accept a `glowScale`.
    *   Update `trail.draw` (both for retired trails and the active cursor) to pass an appropriate `glowScale`.

### Implementation Detail: Unified Scaling
Since the boost depends on the state of the `GlobalCursorManager` (the number of retired trails), we should ideally calculate it once in the `loop()` or `draw` sequence and pass it down, or ensure both `drawRetiredTrails` and `drawRetiredTrailConnectors` use the same formula.

Does this expanded scope (boosting polygons too) look right to you?