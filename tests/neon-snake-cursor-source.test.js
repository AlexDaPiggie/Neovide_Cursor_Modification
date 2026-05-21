const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "neon-snake-cursor.js");
const source = fs.readFileSync(sourcePath, "utf8");

assert.match(source, /class DampedSpringAnimation\b/);
assert.match(source, /class Corner\b/);
assert.match(source, /function createNeovideCursor\b/);
assert.match(source, /function createTrailSegment\b/);
assert.match(source, /function drawTrailConnector\b/);
assert.match(source, /drawRetiredTrailConnectors\b/);
assert.match(source, /retiredTrails/);
assert.doesNotMatch(source, /function pushSegment\b/);
assert.doesNotMatch(source, /function updateSegments\b/);

const connectorMatch = source.match(
  /function drawTrailConnector\b[\s\S]*?\n  }\n\n  function drawStationaryCursor/
);
assert.ok(connectorMatch, "drawTrailConnector function should be present");
const connectorSource = connectorMatch[0];
assert.doesNotMatch(
  connectorSource,
  /const drawPass/,
  "connector should render as one simple stroke, not stacked passes"
);
assert.doesNotMatch(
  connectorSource,
  /drawPass\(\s*CONFIG\.outerColor/,
  "connector body strokes should not use outerColor"
);
assert.match(
  connectorSource,
  /strokeStyle = CONFIG\.coreColor/,
  "connector body should use the moving cursor core color"
);
assert.match(
  connectorSource,
  /shadowColor = CONFIG\.midColor/,
  "connector glow should match the moving cursor glow color"
);
assert.doesNotMatch(
  connectorSource,
  /globalCompositeOperation = "source-over"/,
  "connector should not use the flatter stationary-style blend mode"
);
assert.match(
  connectorSource,
  /globalCompositeOperation = "lighter"/,
  "connector should use the same additive blend mode as the moving cursor"
);
assert.doesNotMatch(
  connectorSource,
  /lineWidth = width \+/,
  "connector should not inflate bridge width with extra body layers"
);
assert.doesNotMatch(
  connectorSource,
  /stationaryGlow/,
  "connector should not use the weaker stationary glow"
);
assert.match(
  connectorSource,
  /shadowBlur = CONFIG\.movingGlow \* glowScale/,
  "connector glow should scale from the moving cursor glow strength"
);
assert.doesNotMatch(
  connectorSource,
  /globalAlpha = alpha \* 0\.62/,
  "connector should not dim the moving glow color with an extra alpha multiplier"
);
assert.doesNotMatch(
  source,
  /CONFIG\.connectorAlpha \*/,
  "connector alpha should not be capped below the moving cursor alpha"
);
const connectorStrokeCount = (connectorSource.match(/\.stroke\(\)/g) || []).length;
assert.strictEqual(connectorStrokeCount, 1, "connector should draw one stroke");
assert.doesNotMatch(source, /function createBridgeGradient\b/);
assert.match(source, /connectorHighSpeedGlowBoost/);
assert.match(source, /const highSpeedGlowScale =[\s\S]*?1 \+ Math\.min\(total,\s*CONFIG\.maxRetiredTrails\) \* CONFIG\.connectorHighSpeedGlowBoost/);

assert.match(source, /stationaryGradientTop/);
assert.match(source, /stationaryGradientLowerMid/);
assert.match(source, /function createStationaryGradient\b/);
assert.match(source, /ctx\.createLinearGradient\(x,\s*y,\s*x,\s*y \+ height\)/);
assert.match(source, /stationaryGradientTop: "#1f96de"/);
assert.match(source, /stationaryGradientMid: "#47b7eb"/);
assert.match(source, /stationaryGradientLowerMid: "#9ee4f5"/);
assert.match(source, /stationaryGradientBottom: "#d9fbff"/);
assert.match(source, /gradient\.addColorStop\(0\.42,\s*CONFIG\.stationaryGradientMid\)/);
assert.match(source, /gradient\.addColorStop\(0\.78,\s*CONFIG\.stationaryGradientLowerMid\)/);
assert.doesNotMatch(source, /moving \? CONFIG\.midColor : createStationaryGradient/);
assert.match(source, /if \(!moving\) \{[\s\S]*?createStationaryGradient/);
assert.match(source, /if \(!moving\) \{[\s\S]*?globalCompositeOperation = "source-over"/);
assert.match(source, /ctx\.fillStyle = CONFIG\.midColor/);
assert.match(source, /if \(moving\) \{[\s\S]*?fillStyle = CONFIG\.coreColor/);

assert.match(source, /highSpeedThreshold: 4/);

console.log("neon-snake-cursor source structure ok");
