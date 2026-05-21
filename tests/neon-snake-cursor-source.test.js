const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "neon-snake-cursor.js");
const source = fs.readFileSync(sourcePath, "utf8");

assert.match(source, /class DampedSpringAnimation\b/);
assert.match(source, /class Corner\b/);
assert.match(source, /function createNeovideCursor\b/);
assert.match(source, /function createTrailSegment\b/);
assert.match(source, /retiredTrails/);
assert.doesNotMatch(source, /function pushSegment\b/);
assert.doesNotMatch(source, /function updateSegments\b/);

console.log("neon-snake-cursor source structure ok");
