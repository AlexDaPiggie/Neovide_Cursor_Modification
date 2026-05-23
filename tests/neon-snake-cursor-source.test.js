const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "neon-snake-cursor.js");
const source = fs.readFileSync(sourcePath, "utf8");

assert.match(source, /class DampedSpringAnimation\b/);
assert.match(source, /class Corner\b/);
assert.match(source, /function createNeovideCursor\b/);
assert.match(source, /function createTrailSegment\b/);
assert.match(source, /function drawTrailConnector\(ctx, from, to, width, alpha, glowScale, isHighSpeed, controlPoint, isEditorGroupJump\)/);
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
  /const connectorHighSpeed = isEditorGroupJump \|\| isHighSpeed/,
  "connector should treat editor-group jumps as a high-intensity connector state"
);
assert.match(
  connectorSource,
  /strokeStyle = connectorHighSpeed \? CONFIG\.midColor : CONFIG\.coreColor/,
  "connector body should use midColor when high intensity, otherwise coreColor"
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
  /shadowBlur = CONFIG\.movingGlow \* connectorGlowScale/,
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
assert.match(source, /const isHighSpeed = total >= CONFIG\.highSpeedThreshold/);
assert.match(
    source,
    /drawTrailConnector\([\s\S]*?highSpeedGlowScale,[\s\S]*?isHighSpeed,[\s\S]*?\);/
  );
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
assert.match(source, /editorGroupJumpWidthBoost/);
assert.match(source, /editorGroupJumpGlowBoost/);
assert.match(source, /editorGroupJumpAlphaBoost/);
assert.match(source, /jumpThreshold: 100/);
assert.match(source, /jumpArcHeightFactor: 0\.3/);
assert.match(
  source,
  /const arcHeight =[\s\S]*?Math\.abs\(toCenter\.x - fromCenter\.x\) \* CONFIG\.jumpArcHeightFactor/,
  "jump arc height should follow the design spec's horizontal-distance formula"
);
assert.match(
  source,
  /if \(isEditorGroupJump \|\| dist > CONFIG\.jumpThreshold\)/,
  "editor-group jumps should always receive a curved arc control point"
);
assert.match(
  source,
  /drawTrailConnector\([\s\S]*?currentCenter,[\s\S]*?isHighSpeed,[\s\S]*?newest\.controlPoint,[\s\S]*?newest\.isEditorGroupJump[\s\S]*?\);/,
  "leading retired trail connector should receive the jump control point and editor-group jump style"
);
assert.match(
  source,
  /function getCursorElements\b[\s\S]*?\.part\.editor[\s\S]*?getElementsByClassName\("cursor"\)[\s\S]*?\.monaco-editor \.cursor/,
  "cursor scanning should track all editor cursors under .part.editor before falling back to Monaco cursors"
);
assert.match(
  source,
  /const elements = getCursorElements\(\)/,
  "scan should use shared cursor discovery"
);
assert.match(source, /primaryCursorId/, "manager should track the primary cursor identity");
assert.match(
  source,
  /this\.primaryCursorId !== primaryEntry\.id/,
  "manager should detect editor-group jumps as primary cursor identity changes"
);
assert.match(
  source,
  /if \(isPrimary && \(primaryChanged \|\| entry\.moved\)\)/,
  "primary cursor movement should keep triggering trails inside the same editor"
);
assert.match(
  source,
  /this\.addRetiredTrail\(source,\s*center,\s*sourceSize \|\| size,\s*primaryChanged\)/,
  "primary cursor changes should mark editor-group trails separately from same-editor movement"
);
assert.match(
  source,
  /isEditorGroupJump:\s*Boolean\(isEditorGroupJump\)/,
  "retired trails should store whether they came from an editor-group focus jump"
);
assert.match(
  source,
  /const connectorWidth = isEditorGroupJump[\s\S]*?CONFIG\.editorGroupJumpWidthBoost/,
  "editor-group jump connectors should render wider than normal connectors"
);
assert.match(
  source,
  /const connectorGlowScale = glowScale \* \(isEditorGroupJump[\s\S]*?CONFIG\.editorGroupJumpGlowBoost/,
  "editor-group jump connectors should render with a stronger glow"
);

const cursorSelectorMatch = source.match(
  /function getCursorElements\b[\s\S]*?\n  }\n\n  class DampedSpringAnimation/
);
assert.ok(cursorSelectorMatch, "getCursorElements function should be present");
const getCursorElementsSource = cursorSelectorMatch[0].replace(
  /\n\n  class DampedSpringAnimation[\s\S]*$/,
  ""
);

const cursorPriorityMatch = source.match(
  /function getCursorPriority\b[\s\S]*?\n  }\n\n  class DampedSpringAnimation/
);
assert.ok(cursorPriorityMatch, "getCursorPriority function should be present");
const getCursorPrioritySource = cursorPriorityMatch[0].replace(
  /\n\n  class DampedSpringAnimation[\s\S]*$/,
  ""
);

function createCursorElement(name) {
  return {
    name,
  };
}

function createEditor(name, options = {}) {
  const cursor = createCursorElement(`${name}-cursor`);
  return {
    name,
    cursor,
    focused: options.focused || false,
    querySelectorAll(selector) {
      return selector === ".cursor" ? [cursor] : [];
    },
  };
}

function runGetCursorElements({ focusedEditors = [], activeEditor = null, allEditors = [] }) {
  const partEditor = {
    getElementsByClassName(className) {
      return className === "cursor"
        ? allEditors.flatMap((editor) => editor.querySelectorAll(".cursor"))
        : [];
    },
  };
  const documentStub = {
    activeElement: activeEditor
      ? {
          closest(selector) {
            return selector === ".monaco-editor" ? activeEditor : null;
          },
        }
      : null,
    querySelector(selector) {
      return selector === ".part.editor" ? partEditor : null;
    },
    querySelectorAll(selector) {
      if (selector === ".monaco-editor.focused .cursor") {
        return focusedEditors.flatMap((editor) => editor.querySelectorAll(".cursor"));
      }
      if (selector === ".monaco-editor .cursor") {
        return allEditors.flatMap((editor) => editor.querySelectorAll(".cursor"));
      }
      return [];
    },
  };

  const getCursorElements = Function(
    "document",
    `${getCursorElementsSource}; return getCursorElements;`
  )(documentStub);

  return Array.from(getCursorElements());
}

function runRawGetCursorElements({ rawEditorCursors }) {
  const documentStub = {
    activeElement: null,
    querySelector(selector) {
      if (selector === ".part.editor") {
        return {
          getElementsByClassName(className) {
            return className === "cursor" ? rawEditorCursors : [];
          },
        };
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  const getCursorElements = Function(
    "document",
    `${getCursorElementsSource}; return getCursorElements;`
  )(documentStub);

  return getCursorElements();
}

function createClassList(classes) {
  return {
    contains(className) {
      return classes.includes(className);
    },
  };
}

function createPriorityCursor({ editorClasses = [], groupClasses = [] }) {
  const editor = {
    classList: createClassList(editorClasses),
    contains(element) {
      return element === cursor;
    },
  };
  const group = {
    classList: createClassList(groupClasses),
  };
  const cursor = {
    closest(selector) {
      if (selector === ".monaco-editor") {
        return editor;
      }
      if (selector === ".editor-group-container, .group") {
        return group;
      }
      if (
        selector ===
        ".editor-group-container.active, .editor-group-container.focused, .group.active, .group.focused"
      ) {
        return groupClasses.includes("active") || groupClasses.includes("focused")
          ? group
          : null;
      }
      return null;
    },
  };

  return cursor;
}

function createPriorityCursorWithMaskedActiveGroup() {
  const editor = {
    classList: createClassList([]),
    contains(element) {
      return element === cursor;
    },
  };
  const inactiveNearGroup = {
    classList: createClassList([]),
  };
  const activeEditorGroup = {
    classList: createClassList(["active"]),
  };
  const cursor = {
    closest(selector) {
      if (selector === ".monaco-editor") {
        return editor;
      }
      if (selector === ".editor-group-container, .group") {
        return inactiveNearGroup;
      }
      if (
        selector ===
        ".editor-group-container.active, .editor-group-container.focused, .group.active, .group.focused"
      ) {
        return activeEditorGroup;
      }
      return null;
    },
  };

  return cursor;
}

function runGetCursorPriority(cursor, activeElement = null) {
  const documentStub = {
    activeElement,
  };

  const getCursorPriority = Function(
    "document",
    `${getCursorPrioritySource}; return getCursorPriority;`
  )(documentStub);

  return getCursorPriority(cursor);
}

{
  const leftEditor = createEditor("left");
  const rightEditor = createEditor("right");
  const cursors = runGetCursorElements({
    activeEditor: rightEditor,
    allEditors: [leftEditor, rightEditor],
  });

  assert.deepStrictEqual(
    cursors,
    [leftEditor.cursor, rightEditor.cursor],
    "cursor scanning should keep all editor-group cursors available for movement history"
  );
}

{
  const cursor = createCursorElement("html-collection-cursor");
  const htmlCollectionLike = {
    0: cursor,
    length: 1,
    item(index) {
      return this[index] || null;
    },
  };
  const cursors = runRawGetCursorElements({
    rawEditorCursors: htmlCollectionLike,
  });

  assert.ok(
    Array.isArray(cursors),
    "cursor scanning should normalize HTMLCollection results before scan calls forEach"
  );
  assert.deepStrictEqual(cursors, [cursor]);
}

{
  const leftCursor = createPriorityCursor({
    groupClasses: [],
  });
  const rightCursor = createPriorityCursor({
    groupClasses: ["active"],
  });

  assert.ok(
    runGetCursorPriority(rightCursor) > runGetCursorPriority(leftCursor),
    "cursor priority should follow the active editor group container when Monaco focus is not exposed"
  );
}

{
  const inactiveCursor = createPriorityCursor({
    groupClasses: [],
  });
  const activeCursor = createPriorityCursorWithMaskedActiveGroup();

  assert.ok(
    runGetCursorPriority(activeCursor) > runGetCursorPriority(inactiveCursor),
    "cursor priority should find an active editor-group ancestor even when a nearer generic group is inactive"
  );
}

console.log("neon-snake-cursor source structure ok");
