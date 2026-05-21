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
    stationaryAlpha: 0.38,
    movingAlpha: 0.96,
    stationaryGlow: 9,
    movingGlow: 30,
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
    minMoveDistance: 0.5,
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
      ctx.shadowBlur = shadowBlur;
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
      CONFIG.movingGlow * glowScale,
      0.72
    );
    drawPass(
      CONFIG.midColor,
      CONFIG.midColor,
      CONFIG.movingGlow * 0.58 * glowScale,
      0.92
    );
    drawPass(
      CONFIG.coreColor,
      CONFIG.coreColor,
      CONFIG.movingGlow * 0.2 * glowScale,
      0.78
    );
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

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.shadowColor = CONFIG.midColor;
    ctx.shadowBlur = glow;
    ctx.fillStyle = CONFIG.midColor;
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = clamp(alpha + 0.14, 0, 1);
    ctx.shadowColor = CONFIG.coreColor;
    ctx.shadowBlur = glow * 0.42;
    ctx.fillStyle = CONFIG.coreColor;
    ctx.fillRect(x + width * 0.18, y, Math.max(1, width * 0.42), height);
    ctx.restore();
  }

  function createTrailSegment(fromCenter, toCenter, dim) {
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

      draw(ctx, alpha) {
        drawPolygon(ctx, this.corners, alpha, 1);
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
      const elements = document.querySelectorAll(".monaco-editor .cursor");

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

    addRetiredTrail(fromCenter, toCenter, dim) {
      if (!fromCenter || !toCenter) {
        return;
      }
      if (distance(fromCenter, toCenter) <= CONFIG.minMoveDistance) {
        return;
      }

      this.retiredTrails.push(createTrailSegment(fromCenter, toCenter, dim));
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
      this.retiredTrails.forEach((trail, index) => {
        const orderAlpha = 0.48 + 0.52 * ((index + 1) / Math.max(total, 1));
        trail.draw(this.ctx, CONFIG.movingAlpha * orderAlpha);
      });
    }

    loop() {
      const now = performance.now();
      const dt = Math.min((now - this.lastFrame) / 1000, 1 / 30);
      this.lastFrame = now;

      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let isAnyAnimating = this.updateRetiredTrails(dt, this.isScrolling);
      let currentCenter = null;
      let currentSize = null;

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
        const size = sizeFromRect(rect);
        const moved = distance(data.lastCenter, center) > CONFIG.minMoveDistance;
        const becameActive = isActive && !data.active;

        if (becameActive || moved) {
          const source =
            becameActive && globalCursorState.lastCenter
              ? globalCursorState.lastCenter
              : data.lastCenter;
          const sourceSize = data.lastSize || size;
          this.addRetiredTrail(source, center, sourceSize);
          data.instance.updateSize(size.width, size.height);
          data.instance.move(
            rect.left,
            rect.top,
            becameActive && globalCursorState.lastCenter
              ? globalCursorState.lastCenter
              : null
          );
          data.lastCenter = center;
          data.lastSize = size;
          this.lastAnimationTime = now;
        }

        data.active = true;
        currentCenter = center;
        currentSize = size;
        globalCursorState.lastCenter = center;
        globalCursorState.lastSize = size;

        if (data.instance.updateLoop(this.isScrolling)) {
          isAnyAnimating = true;
        }
        data.instance.draw(this.ctx, CONFIG.movingAlpha);
      }

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
