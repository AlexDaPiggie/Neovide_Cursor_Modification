(function () {
  "use strict";

  if (window.__neonSnakeCursorInstalled) {
    return;
  }
  window.__neonSnakeCursorInstalled = true;

  const CONFIG = {
    coreColor: "rgba(211, 251, 255, 0.96)",
    midColor: "rgba(91, 213, 255, 0.72)",
    outerColor: "rgba(0, 166, 255, 0.34)",
    stationaryGradientTop: "#1f96de",
    stationaryGradientMid: "#47b7eb",
    stationaryGradientLowerMid: "#9ee4f5",
    stationaryGradientBottom: "#d9fbff",
    stationaryAlpha: 0.52,
    movingAlpha: 0.96,
    stationaryGlow: 6,
    movingGlow: 20,
    animationLength: 0.125,
    shortAnimationLength: 0.05,
    shortMoveThreshold: 8,
    rank0TrailFactor: 1.0,
    rank1TrailFactor: 0.9,
    rank2TrailFactor: 0.5,
    rank3TrailFactor: 0.3,
    useHardSnap: true,
    leadingSnapFactor: 0.1,
    leadingSnapThreshold: 0.5,
    animationResetThreshold: 0.075,
    maxTrailDistanceFactor: 100,
    snapAnimationLength: 0.02,
    cursorUpdatePollingRate: 100,
    nativeRevealDelay: 70,
    maxRetiredTrails: 7,
    retiredQueueSpeedBoost: 0.32,
    retiredOldnessSpeedBoost: 0.48,
    connectorHighSpeedGlowBoost: 0.1,
    connectorWidthFactor: 0.32,
    editorGroupJumpWidthBoost: 2.2,
    editorGroupJumpGlowBoost: 1.65,
    editorGroupJumpAlphaBoost: 1.15,
    minMoveDistance: 0.5,
    highSpeedThreshold: 4,
    jumpThreshold: 100,
    jumpArcHeightFactor: 0.3,
  };

  const cursorRelativeCorners = [
    { x: -0.5, y: -0.5 },
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
    { x: -0.5, y: 0.5 },
  ];

  const globalCursorState = {
    lastCenter: null,
    lastSize: null,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalize(v) {
    const length = Math.hypot(v.x, v.y);
    return length ? { x: v.x / length, y: v.y / length } : { x: 0, y: 0 };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function centerFromRect(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function sizeFromRect(rect) {
    return {
      width: Math.max(rect.width || 2, 2),
      height: Math.max(rect.height || 18, 8),
    };
  }

  function getCursorElements() {
    const editor = document.querySelector(".part.editor");
    if (editor) {
      const editorCursors = Array.from(
        editor.getElementsByClassName("cursor")
      );
      if (editorCursors.length) {
        return editorCursors;
      }
    }

    const activeEditor =
      document.activeElement && document.activeElement.closest
        ? document.activeElement.closest(".monaco-editor")
        : null;
    if (activeEditor) {
      const activeCursorElements = Array.from(
        activeEditor.querySelectorAll(".cursor")
      );
      if (activeCursorElements.length) {
        return activeCursorElements;
      }
    }

    return Array.from(document.querySelectorAll(".monaco-editor .cursor"));
  }

  function getCursorPriority(element) {
    const editor =
      element && element.closest ? element.closest(".monaco-editor") : null;
    if (!editor) {
      return 0;
    }

    const activeEditor =
      document.activeElement && document.activeElement.closest
        ? document.activeElement.closest(".monaco-editor")
        : null;
    if (activeEditor && activeEditor.contains(element)) {
      return 3;
    }

    if (editor.classList && editor.classList.contains("focused")) {
      return 2;
    }

    const editorGroup =
      element && element.closest
        ? element.closest(
            ".editor-group-container.active, .editor-group-container.focused, .group.active, .group.focused"
          )
        : null;
    if (editorGroup) {
      return 2;
    }

    return 1;
  }

  class DampedSpringAnimation {
    constructor(animationLength) {
      this.position = 0;
      this.velocity = 0;
      this.animationLength = animationLength;
    }

    update(dt) {
      if (this.animationLength <= dt || Math.abs(this.position) < 0.001) {
        this.reset();
        return false;
      }

      const omega = 4.0 / this.animationLength;
      const a = this.position;
      const b = this.position * omega + this.velocity;
      const c = Math.exp(-omega * dt);
      this.position = (a + b * dt) * c;
      this.velocity = c * (-a * omega - b * dt * omega + b);
      return Math.abs(this.position) >= 0.01;
    }

    reset() {
      this.position = 0;
      this.velocity = 0;
    }
  }

  class Corner {
    constructor(relativePoint) {
      this.rp = relativePoint;
      this.cp = { x: 0, y: 0 };
      this.pd = { x: -1e5, y: -1e5 };
      this.ax = new DampedSpringAnimation(CONFIG.animationLength);
      this.ay = new DampedSpringAnimation(CONFIG.animationLength);
      this.targetDim = { width: 8, height: 18 };
    }

    getDest(center, dim) {
      return {
        x: center.x + this.rp.x * dim.width,
        y: center.y + this.rp.y * dim.height,
      };
    }

    calculateDirectionAlignment(dim, destCenter) {
      const cornerDest = this.getDest(destCenter, dim);
      const travelDir = normalize({
        x: cornerDest.x - this.cp.x,
        y: cornerDest.y - this.cp.y,
      });
      const cornerDir = normalize(this.rp);
      return travelDir.x * cornerDir.x + travelDir.y * cornerDir.y;
    }

    jump(center, dim, rank) {
      this.targetDim = { ...dim };
      const target = this.getDest(center, dim);
      const jumpVector = {
        x: (target.x - this.pd.x) / dim.width,
        y: (target.y - this.pd.y) / dim.height,
      };
      const isShortMove =
        Math.abs(jumpVector.x) <= CONFIG.shortMoveThreshold &&
        Math.abs(jumpVector.y) <= 0.001;
      const baseTime = isShortMove
        ? CONFIG.shortAnimationLength
        : CONFIG.animationLength;
      const direction = normalize(jumpVector);
      const leadingAlignment =
        direction.x * normalize(this.rp).x + direction.y * normalize(this.rp).y;

      let factor;
      if (
        CONFIG.useHardSnap &&
        leadingAlignment > CONFIG.leadingSnapThreshold
      ) {
        factor = CONFIG.leadingSnapFactor;
      } else {
        const factors = [
          CONFIG.rank0TrailFactor,
          CONFIG.rank1TrailFactor,
          CONFIG.rank2TrailFactor,
          CONFIG.rank3TrailFactor,
        ];
        factor = factors[rank] || 1.0;
      }

      const length =
        leadingAlignment > CONFIG.leadingSnapThreshold && CONFIG.useHardSnap
          ? CONFIG.snapAnimationLength
          : baseTime * clamp(factor, 0, 1);

      this.ax.animationLength = length;
      this.ay.animationLength = length;

      if (length > CONFIG.animationResetThreshold) {
        this.ax.reset();
        this.ay.reset();
      }
    }

    update(dim, center, dt, immediate) {
      const dest = this.getDest(center, dim);

      if (dest.x !== this.pd.x || dest.y !== this.pd.y) {
        this.ax.position = dest.x - this.cp.x;
        this.ay.position = dest.y - this.cp.y;
        this.pd = { ...dest };
      }

      if (immediate) {
        this.cp = dest;
        this.ax.reset();
        this.ay.reset();
        return false;
      }

      this.ax.update(dt);
      this.ay.update(dt);

      const maxDistance =
        Math.max(dim.width, dim.height) * CONFIG.maxTrailDistanceFactor;
      this.ax.position = clamp(this.ax.position, -maxDistance, maxDistance);
      this.ay.position = clamp(this.ay.position, -maxDistance, maxDistance);

      this.cp.x = dest.x - this.ax.position;
      this.cp.y = dest.y - this.ay.position;

      return (
        Math.abs(this.ax.position) > 0.5 || Math.abs(this.ay.position) > 0.5
      );
    }
  }

  function rankCorners(corners, dim, center) {
    return corners
      .map((corner, index) => ({
        index,
        value: corner.calculateDirectionAlignment(dim, center),
      }))
      .sort((a, b) => a.value - b.value)
      .map((item, rank) => ({ index: item.index, rank }))
      .reduce((acc, item) => {
        acc[item.index] = item.rank;
        return acc;
      }, []);
  }

  function initCornersAt(corners, center, dim) {
    corners.forEach((corner) => {
      corner.targetDim = { ...dim };
      const dest = corner.getDest(center, dim);
      corner.cp = { ...dest };
      corner.pd = { ...dest };
      corner.ax.reset();
      corner.ay.reset();
    });
  }

  function drawPolygon(ctx, corners, alpha, glowScale) {
    if (!corners.length || alpha <= 0) {
      return;
    }

    const drawPass = (fillStyle, shadowColor, shadowBlur, passAlpha) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * passAlpha;
      ctx.fillStyle = fillStyle;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur * glowScale;
      ctx.beginPath();
      ctx.moveTo(corners[0].cp.x, corners[0].cp.y);
      for (let index = 1; index < corners.length; index += 1) {
        ctx.lineTo(corners[index].cp.x, corners[index].cp.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawPass(
      CONFIG.outerColor,
      CONFIG.outerColor,
      CONFIG.movingGlow,
      0.85 // Was 0.72
    );
    drawPass(
      CONFIG.midColor,
      CONFIG.midColor,
      CONFIG.movingGlow * 0.50, // Was 0.58
      1.00 // Was 0.92
    );
    drawPass(
      CONFIG.coreColor,
      CONFIG.coreColor,
      CONFIG.movingGlow * 0.15, // Was 0.2
      0.95 // Was 0.78
    );
  }

  function drawTrailConnector(ctx, from, to, width, alpha, glowScale, isHighSpeed, controlPoint, isEditorGroupJump) {
    if (!from || !to || alpha <= 0 || distance(from, to) < 0.5) {
      return;
    }

    const connectorWidth = isEditorGroupJump
      ? width * CONFIG.editorGroupJumpWidthBoost
      : width;
    const connectorGlowScale = glowScale * (isEditorGroupJump
      ? CONFIG.editorGroupJumpGlowBoost
      : 1);
    const connectorAlpha = clamp(
      alpha * (isEditorGroupJump ? CONFIG.editorGroupJumpAlphaBoost : 1),
      0,
      1
    );
    const connectorHighSpeed = isEditorGroupJump || isHighSpeed;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = connectorAlpha;
    ctx.strokeStyle = connectorHighSpeed ? CONFIG.midColor : CONFIG.coreColor;
    ctx.lineWidth = Math.max(1, connectorWidth);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = CONFIG.midColor;
    ctx.shadowBlur = CONFIG.movingGlow * connectorGlowScale;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    if (controlPoint) {
      ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, to.x, to.y);
    } else {
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function createStationaryGradient(ctx, x, y, height) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, CONFIG.stationaryGradientTop);
    gradient.addColorStop(0.42, CONFIG.stationaryGradientMid);
    gradient.addColorStop(0.78, CONFIG.stationaryGradientLowerMid);
    gradient.addColorStop(1, CONFIG.stationaryGradientBottom);
    return gradient;
  }

  function drawStationaryCursor(ctx, center, dim, moving) {
    if (!center || !dim) {
      return;
    }

    const width = clamp(dim.width, 2, 8);
    const height = clamp(dim.height, 10, 48);
    const x = center.x - width / 2;
    const y = center.y - height / 2;
    const alpha = moving ? CONFIG.movingAlpha : CONFIG.stationaryAlpha;
    const glow = moving ? CONFIG.movingGlow : CONFIG.stationaryGlow;

    if (!moving) {
      const gradient = createStationaryGradient(ctx, x, y, height);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.shadowColor = CONFIG.midColor;
      ctx.shadowBlur = glow;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = clamp(alpha + 0.36, 0, 0.85);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.shadowColor = CONFIG.midColor;
    ctx.shadowBlur = glow;
    ctx.fillStyle = CONFIG.midColor;
    ctx.fillRect(x, y, width, height);
    if (moving) {
      ctx.globalAlpha = clamp(alpha + 0.14, 0, 1);
      ctx.shadowColor = CONFIG.coreColor;
      ctx.shadowBlur = glow * 0.42;
      ctx.fillStyle = CONFIG.coreColor;
      ctx.fillRect(x + width * 0.18, y, Math.max(1, width * 0.42), height);
    }
    ctx.restore();
  }

  function createTrailSegment(fromCenter, toCenter, dim, controlPoint = null, isEditorGroupJump = false) {
    const corners = cursorRelativeCorners.map((point) => new Corner(point));
    initCornersAt(corners, fromCenter, dim);
    const ranks = rankCorners(corners, dim, toCenter);
    corners.forEach((corner, index) => {
      corner.jump(toCenter, dim, ranks[index]);
    });

    return {
      center: { ...toCenter },
      dim: { ...dim },
      corners,
      controlPoint: controlPoint ? { ...controlPoint } : null,
      isEditorGroupJump: Boolean(isEditorGroupJump),
      age: 0,
      doneFrames: 0,

      update(dt, timeScale, isScrolling) {
        const scaledDt = dt * timeScale;
        this.age += scaledDt;
        let animating = false;
        this.corners.forEach((corner) => {
          if (corner.update(this.dim, this.center, scaledDt, isScrolling)) {
            animating = true;
          }
        });
        this.doneFrames = animating ? 0 : this.doneFrames + 1;
        return animating || this.doneFrames < 3;
      },

      draw(ctx, alpha, glowScale) {
        drawPolygon(ctx, this.corners, alpha, glowScale);
      },

      getCurrentCenter() {
        return this.corners.reduce(
          (acc, corner) => ({
            x: acc.x + corner.cp.x / this.corners.length,
            y: acc.y + corner.cp.y / this.corners.length,
          }),
          { x: 0, y: 0 }
        );
      },

      getConnectorWidth() {
        return Math.max(
          this.dim.width + 2,
          this.dim.height * CONFIG.connectorWidthFactor
        );
      },
    };
  }

  function createNeovideCursor() {
    let cursorDimensions = { width: 8, height: 18 };
    let centerDest = { x: 0, y: 0 };
    let initialized = false;
    let jumped = false;
    let lastTimestamp = performance.now();
    const corners = cursorRelativeCorners.map((point) => new Corner(point));

    return {
      move(x, y, fromSource) {
        if ((x <= 0 && y <= 0) || Number.isNaN(x) || Number.isNaN(y)) {
          return;
        }

        const newCenter = {
          x: x + cursorDimensions.width / 2,
          y: y + cursorDimensions.height / 2,
        };

        if (!initialized || fromSource) {
          const source = fromSource || newCenter;
          const sourceDim = globalCursorState.lastSize || cursorDimensions;
          initCornersAt(corners, source, sourceDim);
          initialized = true;
        }

        centerDest = newCenter;
        jumped = true;
        globalCursorState.lastCenter = { ...newCenter };
        globalCursorState.lastSize = { ...cursorDimensions };
      },

      updateSize(width, height) {
        if (width > 0) {
          cursorDimensions = { width, height };
        }
      },

      updateLoop(isScrolling) {
        if (!initialized) {
          return false;
        }

        const now = performance.now();
        const dt = Math.min((now - lastTimestamp) / 1000, 1 / 30);
        lastTimestamp = now;

        if (jumped) {
          const ranks = rankCorners(corners, cursorDimensions, centerDest);
          corners.forEach((corner, index) => {
            corner.jump(centerDest, cursorDimensions, ranks[index]);
          });
          jumped = false;
        }

        let animating = false;
        corners.forEach((corner) => {
          if (corner.update(cursorDimensions, centerDest, dt, isScrolling)) {
            animating = true;
          }
        });

        return animating;
      },

      draw(ctx, alpha) {
        drawPolygon(ctx, corners, alpha, 1);
      },

      getCenter() {
        return { ...centerDest };
      },

      getSize() {
        return { ...cursorDimensions };
      },
    };
  }

  class GlobalCursorManager {
    constructor() {
      this.cursors = new Map();
      this.retiredTrails = [];
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.isScrolling = false;
      this.lastFrame = performance.now();
      this.lastAnimationTime = 0;
      this.scanTimer = 0;
      this.scrollTimer = 0;
      this.primaryCursorId = null;
      this.primaryCenter = null;
      this.primarySize = null;
      this.devicePixelRatio = 1;
      this.init();
    }

    init() {
      const style = document.createElement("style");
      style.textContent = [
        ".monaco-editor .cursor { transition: none !important; }",
        "body.neon-snake-cursor-moving .monaco-editor .cursor { opacity: 0 !important; }",
        ".neon-snake-cursor-layer {",
        "  pointer-events: none !important;",
        "  position: fixed !important;",
        "  top: 0 !important;",
        "  left: 0 !important;",
        "  z-index: 2147483647 !important;",
        "}",
      ].join("\n");
      document.head.appendChild(style);

      this.canvas.className = "neon-snake-cursor-layer";
      this.canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(this.canvas);
      this.resizeCanvas();

      window.addEventListener("resize", () => this.resizeCanvas(), {
        passive: true,
      });
      document.addEventListener(
        "scroll",
        () => {
          this.isScrolling = true;
          clearTimeout(this.scrollTimer);
          this.scrollTimer = setTimeout(() => {
            this.isScrolling = false;
          }, 100);
        },
        { capture: true, passive: true }
      );

      this.loop();
      this.scanTimer = setInterval(
        () => this.scan(),
        CONFIG.cursorUpdatePollingRate
      );
      this.scan();
    }

    resizeCanvas() {
      this.devicePixelRatio = window.devicePixelRatio || 1;
      const width = Math.ceil(window.innerWidth * this.devicePixelRatio);
      const height = Math.ceil(window.innerHeight * this.devicePixelRatio);
      this.canvas.width = Math.max(1, width);
      this.canvas.height = Math.max(1, height);
      this.canvas.style.width = window.innerWidth + "px";
      this.canvas.style.height = window.innerHeight + "px";
      this.ctx.setTransform(
        this.devicePixelRatio,
        0,
        0,
        this.devicePixelRatio,
        0,
        0
      );
    }

    isVisibleCursor(element, rect) {
      if (!element || !element.isConnected) {
        return false;
      }
      if (element.closest(".minimap, .decorationsOverviewRuler, .scrollbar")) {
        return false;
      }
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }
      if (
        rect.right < 0 ||
        rect.bottom < 0 ||
        rect.left > window.innerWidth ||
        rect.top > window.innerHeight
      ) {
        return false;
      }

      const style = getComputedStyle(element);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !style.transform.includes("-10000px")
      );
    }

    scan() {
      const ids = new Set();
      const elements = getCursorElements();

      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (!this.isVisibleCursor(element, rect)) {
          return;
        }

        let id =
          element.dataset.neonSnakeCursorId ||
          "c" + Math.random().toString(36).slice(2, 7);
        element.dataset.neonSnakeCursorId = id;
        ids.add(id);

        if (!this.cursors.has(id)) {
          const instance = createNeovideCursor();
          const size = sizeFromRect(rect);
          const center = centerFromRect(rect);
          instance.updateSize(size.width, size.height);
          instance.move(
            rect.left,
            rect.top,
            globalCursorState.lastCenter
              ? { ...globalCursorState.lastCenter }
              : null
          );
          this.cursors.set(id, {
            instance,
            target: element,
            lastCenter: center,
            lastSize: size,
            active: false,
          });
        }
      });

      for (const id of this.cursors.keys()) {
        if (!ids.has(id)) {
          this.cursors.delete(id);
        }
      }
    }

    addRetiredTrail(fromCenter, toCenter, dim, isEditorGroupJump = false) {
      if (!fromCenter || !toCenter) {
        return;
      }
      const dist = distance(fromCenter, toCenter);
      if (dist <= CONFIG.minMoveDistance) {
        return;
      }

      let controlPoint = null;
      if (!isEditorGroupJump && dist > CONFIG.jumpThreshold) {
        const midX = (fromCenter.x + toCenter.x) / 2;
        const midY = (fromCenter.y + toCenter.y) / 2;
        const arcHeight =
          Math.abs(toCenter.x - fromCenter.x) * CONFIG.jumpArcHeightFactor;
        controlPoint = { x: midX, y: midY - arcHeight };
      }

      this.retiredTrails.push(
        createTrailSegment(
          fromCenter,
          toCenter,
          dim,
          controlPoint,
          isEditorGroupJump
        )
      );
      while (this.retiredTrails.length > CONFIG.maxRetiredTrails) {
        this.retiredTrails.shift();
      }
    }

    updateRetiredTrails(dt, isScrolling) {
      const count = this.retiredTrails.length;
      if (!count) {
        return false;
      }

      let anyAnimating = false;
      const queueBoost = 1 + Math.max(0, count - 1) * CONFIG.retiredQueueSpeedBoost;
      this.retiredTrails = this.retiredTrails.filter((trail, index) => {
        const oldness = count > 1 ? (count - 1 - index) / (count - 1) : 0;
        const timeScale =
          queueBoost + oldness * CONFIG.retiredOldnessSpeedBoost;
        const animating = trail.update(dt, timeScale, isScrolling);
        if (animating) {
          anyAnimating = true;
        }
        return animating;
      });

      return anyAnimating;
    }

    drawRetiredTrails() {
      const total = this.retiredTrails.length;
      if (!total) {
        return;
      }

      const highSpeedGlowScale = 1 + Math.min(total, CONFIG.maxRetiredTrails) * CONFIG.connectorHighSpeedGlowBoost;

      this.retiredTrails.forEach((trail, index) => {
        const orderAlpha = 0.48 + 0.52 * ((index + 1) / Math.max(total, 1));
        trail.draw(this.ctx, CONFIG.movingAlpha * orderAlpha, highSpeedGlowScale);
      });
    }

    drawRetiredTrailConnectors(currentCenter, currentSize) {
      const total = this.retiredTrails.length;
      if (!total) {
        return;
      }

      const isHighSpeed = total >= CONFIG.highSpeedThreshold;
      const highSpeedGlowScale = 1 + Math.min(total, CONFIG.maxRetiredTrails) * CONFIG.connectorHighSpeedGlowBoost;

      for (let index = 0; index < total - 1; index += 1) {
        const fromTrail = this.retiredTrails[index];
        const toTrail = this.retiredTrails[index + 1];
        const orderAlpha = 0.38 + 0.42 * ((index + 1) / total);
        drawTrailConnector(
          this.ctx,
          fromTrail.getCurrentCenter(),
          toTrail.getCurrentCenter(),
          Math.max(fromTrail.getConnectorWidth(), toTrail.getConnectorWidth()),
          CONFIG.movingAlpha * orderAlpha,
          highSpeedGlowScale,
          isHighSpeed,
          toTrail.controlPoint,
          toTrail.isEditorGroupJump
        );
      }

      if (currentCenter && currentSize) {
        const newest = this.retiredTrails[total - 1];
        drawTrailConnector(
          this.ctx,
          newest.getCurrentCenter(),
          currentCenter,
          Math.max(
            newest.getConnectorWidth(),
            currentSize.height * CONFIG.connectorWidthFactor
          ),
          CONFIG.movingAlpha,
          highSpeedGlowScale,
          isHighSpeed,
          newest.controlPoint,
          newest.isEditorGroupJump
        );
      }
    }

    loop() {
      const now = performance.now();
      const dt = Math.min((now - this.lastFrame) / 1000, 1 / 30);
      this.lastFrame = now;

      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let isAnyAnimating = this.updateRetiredTrails(dt, this.isScrolling);
      let currentCenter = null;
      let currentSize = null;
      const visibleEntries = [];

      for (const [id, data] of this.cursors) {
        if (!data.target || !data.target.isConnected) {
          this.cursors.delete(id);
          continue;
        }

        const rect = data.target.getBoundingClientRect();
        const isActive = this.isVisibleCursor(data.target, rect);
        if (!isActive) {
          data.active = false;
          continue;
        }

        const center = centerFromRect(rect);
        visibleEntries.push({
          id,
          data,
          rect,
          center,
          size: sizeFromRect(rect),
          moved: distance(data.lastCenter, center) > CONFIG.minMoveDistance,
          priority: getCursorPriority(data.target),
        });
      }

      let primaryEntry = null;
      visibleEntries.forEach((entry) => {
        if (
          !primaryEntry ||
          entry.priority > primaryEntry.priority ||
          (entry.priority === primaryEntry.priority &&
            entry.moved &&
            !primaryEntry.moved) ||
          (entry.priority === primaryEntry.priority &&
            entry.moved === primaryEntry.moved &&
            entry.id === this.primaryCursorId)
        ) {
          primaryEntry = entry;
        }
      });

      visibleEntries.forEach((entry) => {
        const { data, center, size } = entry;
        const isPrimary = primaryEntry && entry.id === primaryEntry.id;
        const primaryChanged =
          isPrimary &&
          this.primaryCursorId &&
          this.primaryCursorId !== primaryEntry.id;
        const source =
          primaryChanged && this.primaryCenter
            ? this.primaryCenter
            : data.lastCenter;
        const sourceSize =
          primaryChanged && this.primarySize ? this.primarySize : data.lastSize;

        if (isPrimary && (primaryChanged || entry.moved)) {
          this.addRetiredTrail(source, center, sourceSize || size, primaryChanged);
          data.instance.updateSize(size.width, size.height);
          data.instance.move(
            entry.rect.left,
            entry.rect.top,
            primaryChanged && this.primaryCenter ? this.primaryCenter : null
          );
          this.lastAnimationTime = now;
        } else {
          data.instance.updateSize(size.width, size.height);
        }

        data.lastCenter = center;
        data.lastSize = size;
        data.active = true;
      });

      if (primaryEntry) {
        const { data, center, size } = primaryEntry;
        this.primaryCursorId = primaryEntry.id;
        this.primaryCenter = center;
        this.primarySize = size;
        currentCenter = center;
        currentSize = size;
        globalCursorState.lastCenter = center;
        globalCursorState.lastSize = size;

        if (data.instance.updateLoop(this.isScrolling)) {
          isAnyAnimating = true;
        }
        data.instance.draw(this.ctx, CONFIG.movingAlpha);
      }

      this.drawRetiredTrailConnectors(currentCenter, currentSize);
      this.drawRetiredTrails();
      const moving =
        isAnyAnimating ||
        this.retiredTrails.length > 0 ||
        now - this.lastAnimationTime < CONFIG.nativeRevealDelay;
      document.body.classList.toggle("neon-snake-cursor-moving", moving);
      drawStationaryCursor(this.ctx, currentCenter, currentSize, moving);

      requestAnimationFrame(() => this.loop());
    }
  }

  function startNeonSnakeCursor() {
    if (!document.head || !document.body) {
      requestAnimationFrame(startNeonSnakeCursor);
      return;
    }
    new GlobalCursorManager();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startNeonSnakeCursor, {
      once: true,
    });
  } else {
    startNeonSnakeCursor();
  }
})();
