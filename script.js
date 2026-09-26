(function () {
  'use strict';

  const canvas = document.getElementById('reveal-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const hero = document.getElementById('hero');
  const resetBtn = document.getElementById('reset-btn');

  // Load IMAGE 1
  const img1 = new Image();
  img1.src = 'image1.jpg';
  let img1Loaded = false;
  img1.onload = () => {
    img1Loaded = true;
    renderInitialCover();
  };

  // State tracking
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Follower physics
  let sx = 0, sy = 0; // smoothed follower position
  let tx = 0, ty = 0; // target cursor position
  let lastStampX = 0, lastStampY = 0;
  let hasEntered = false;
  let isCursorInside = false;
  let lastTime = performance.now();

  // Brush stamp collection
  // Each stamp: { x, y, baseRadius, angle, born, seed, speed }
  const stamps = [];
  const STAMP_LIFETIME = 2.7; // 2.7 seconds exactly
  const SAMPLE_COUNT = 48; // ~48 perimeter samples

  // Compute cover destination rectangle matching CSS object-fit: cover
  function getCoverRect(imgW, imgH, containerW, containerH) {
    if (!imgW || !imgH) return { x: 0, y: 0, width: containerW, height: containerH };
    const imgRatio = imgW / imgH;
    const containerRatio = containerW / containerH;
    let renderW, renderH, offsetX, offsetY;

    if (containerRatio > imgRatio) {
      renderW = containerW;
      renderH = containerW / imgRatio;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    } else {
      renderH = containerH;
      renderW = containerH * imgRatio;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    }
    return { x: offsetX, y: offsetY, width: renderW, height: renderH };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  window.addEventListener('resize', resize);
  resize();

  function renderInitialCover() {
    if (!img1Loaded) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const rect = getCoverRect(img1.naturalWidth, img1.naturalHeight, width, height);
    ctx.drawImage(img1, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  // Catmull-Rom closed curve conversion to cubic Bézier
  function traceCatmullRomClosed(context, pts) {
    const n = pts.length;
    if (n < 3) return;
    context.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    context.closePath();
  }

  // Build procedural dry-brush polygon points with multiscale harmonics + directional stretch
  function getBrushPerimeter(stamp, currentRadius, currentTime) {
    const pts = [];
    const baseR = currentRadius;
    const seed = stamp.seed;
    const time = (currentTime - stamp.born) * 0.4;
    const dirAngle = stamp.angle;

    // Slight stretch in movement direction (not over-stretched or over-rotated)
    const stretchRatio = Math.min(1.30, 1.08 + (stamp.speed || 0) * 0.00035);
    const compressRatio = 1 / Math.sqrt(stretchRatio);

    const cosDir = Math.cos(dirAngle);
    const sinDir = Math.sin(dirAngle);

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const a = (i / SAMPLE_COUNT) * Math.PI * 2;

      // Specified multi-frequency radius formula + additional micro-irregularities
      const harmonic1 = 0.085 * Math.sin(3 * a + time + seed);
      const harmonic2 = 0.048 * Math.sin(5 * a - time * 1.15 + seed * 2.1);
      const harmonic3 = 0.022 * Math.sin(9 * a + time * 0.6 + seed * 3.7);

      // Additional high-frequency dry-bristle serration & torn edge notches
      const bristleJitter = 0.035 * Math.sin(17 * a + seed * 4.3) +
                            0.018 * Math.cos(31 * a - seed * 1.7);

      // Deep occasional dry-bristle clefts
      const notch = (Math.sin(6 * a + seed * 1.5) > 0.88) ? -0.12 : 0;

      const r = baseR * Math.max(0.2, (1 + harmonic1 + harmonic2 + harmonic3 + bristleJitter + notch));

      // Local coordinates stretched along direction
      const localX = r * stretchRatio * Math.cos(a);
      const localY = r * compressRatio * Math.sin(a);

      // Rotate to align with movement angle
      const rotX = stamp.x + (localX * cosDir - localY * sinDir);
      const rotY = stamp.y + (localX * sinDir + localY * cosDir);

      pts.push({ x: rotX, y: rotY });
    }
    return pts;
  }

  // Add a stamp at (px, py)
  function addStamp(px, py, angle, speed, now) {
    const baseRadius = Math.min(width, height) * 0.18; // 15-20% of smaller viewport dimension
    stamps.push({
      x: px,
      y: py,
      baseRadius: baseRadius,
      angle: angle,
      born: now,
      seed: Math.random() * 1000,
      speed: speed
    });
  }

  // Mouse / Pointer handlers
  function handlePointerMove(clientX, clientY) {
    const now = performance.now() / 1000;

    if (!hasEntered) {
      // Immediately set follower to cursor position so no unwanted stroke connects from old position
      sx = clientX;
      sy = clientY;
      tx = clientX;
      ty = clientY;
      lastStampX = clientX;
      lastStampY = clientY;
      hasEntered = true;
      isCursorInside = true;
      // Add first stamp at initial touch/entry
      addStamp(clientX, clientY, 0, 0, now);
      return;
    }

    if (!isCursorInside) {
      // Re-entering: start fresh from new cursor position without connecting
      sx = clientX;
      sy = clientY;
      tx = clientX;
      ty = clientY;
      lastStampX = clientX;
      lastStampY = clientY;
      isCursorInside = true;
      addStamp(clientX, clientY, 0, 0, now);
      return;
    }

    tx = clientX;
    ty = clientY;
  }

  hero.addEventListener('pointerenter', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  hero.addEventListener('pointermove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  hero.addEventListener('pointerleave', () => {
    isCursorInside = false;
  });

  // Mobile Touch Handling with exact same behavior
  hero.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      handlePointerMove(t.clientX, t.clientY);
    }
  }, { passive: true });

  hero.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      handlePointerMove(t.clientX, t.clientY);
    }
  }, { passive: true });

  hero.addEventListener('touchend', () => {
    isCursorInside = false;
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stamps.length = 0;
      renderInitialCover();
    });
  }

  // Main Animation Loop
  function animate(nowMs) {
    requestAnimationFrame(animate);

    const now = nowMs / 1000;
    const dt = Math.min((nowMs - lastTime) / 1000, 0.1);
    lastTime = nowMs;

    // Smooth cursor following
    if (isCursorInside) {
      const k = 1 - Math.pow(1 - 0.17, dt * 60);
      const prevSx = sx;
      const prevSy = sy;

      sx += (tx - sx) * k;
      sy += (ty - sy) * k;

      const dx = sx - lastStampX;
      const dy = sy - lastStampY;
      const distFromLast = Math.hypot(dx, dy);

      const baseRadius = Math.min(width, height) * 0.18;
      // Continuous spacing: approximately brushRadius * 0.09
      const stepDist = baseRadius * 0.09;

      if (distFromLast >= stepDist) {
        const steps = Math.floor(distFromLast / stepDist);
        const moveAngle = Math.atan2(sy - prevSy, sx - prevSx) || 0;
        const instSpeed = distFromLast / Math.max(dt, 0.001);

        for (let i = 1; i <= steps; i++) {
          const fraction = i / steps;
          const px = lastStampX + dx * fraction;
          const py = lastStampY + dy * fraction;
          addStamp(px, py, moveAngle, instSpeed, now);
        }
        lastStampX += dx * (steps / (distFromLast / stepDist));
        lastStampY += dy * (steps / (distFromLast / stepDist));
      }
    }

    // Clean up expired stamps
    for (let i = stamps.length - 1; i >= 0; i--) {
      const age = now - stamps[i].born;
      if (age >= STAMP_LIFETIME) {
        stamps.splice(i, 1);
      }
    }

    if (!img1Loaded) return;

    // Render frame
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear frame
    ctx.clearRect(0, 0, width, height);

    // 2. Draw IMAGE 1 (top default image)
    const rect = getCoverRect(img1.naturalWidth, img1.naturalHeight, width, height);
    ctx.drawImage(img1, rect.x, rect.y, rect.width, rect.height);

    // 3. Cut out active brush stamps using destination-out
    if (stamps.length > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';

      for (let i = 0; i < stamps.length; i++) {
        const stamp = stamps[i];
        const age = now - stamp.born;
        const life = Math.max(0, 1 - age / STAMP_LIFETIME);

        // Physical shrinking formula specified:
        // radius = originalRadius * Math.pow(life, 0.85)
        // (new = large, 1s = smaller, 2s = very small, 2.7s = gone)
        const currentRadius = stamp.baseRadius * Math.pow(life, 0.85);

        if (currentRadius <= 0.5) continue;

        // Generate organic Catmull-Rom perimeter
        const perimeterPts = getBrushPerimeter(stamp, currentRadius, now);

        ctx.beginPath();
        traceCatmullRomClosed(ctx, perimeterPts);

        // Realistic dry-brush internal elongated bristle slits/holes
        // These internal cutouts use evenodd so they leave fine strands of Image 1 intact
        const holeCount = 2 + Math.floor((stamp.seed % 3));
        for (let h = 0; h < holeCount; h++) {
          const hSeed = stamp.seed + h * 137.5;
          const hOffsetDist = currentRadius * (0.15 + (Math.sin(hSeed) * 0.5 + 0.5) * 0.45);
          const hOffsetAngle = stamp.angle + Math.PI / 2 + ((h % 2 === 0) ? 0 : Math.PI);
          const hcx = stamp.x + Math.cos(hOffsetAngle) * hOffsetDist;
          const hcy = stamp.y + Math.sin(hOffsetAngle) * hOffsetDist;

          const hLength = currentRadius * (0.35 + Math.sin(hSeed * 1.3) * 0.15);
          const hWidth = currentRadius * (0.05 + Math.sin(hSeed * 2.1) * 0.02);

          // Elongated irregular capsule aligned along stroke
          const hCos = Math.cos(stamp.angle);
          const hSin = Math.sin(stamp.angle);
          const pCos = -hSin;
          const pSin = hCos;

          // Draw hole counter to main contour for evenodd winding
          ctx.moveTo(hcx - hCos * hLength, hcy - hSin * hLength);
          ctx.bezierCurveTo(
            hcx - hCos * hLength + pCos * hWidth, hcy - hSin * hLength + pSin * hWidth,
            hcx + hCos * hLength + pCos * hWidth, hcy + hSin * hLength + pSin * hWidth,
            hcx + hCos * hLength, hcy + hSin * hLength
          );
          ctx.bezierCurveTo(
            hcx + hCos * hLength - pCos * hWidth, hcy + hSin * hLength - pSin * hWidth,
            hcx - hCos * hLength - pCos * hWidth, hcy - hSin * hLength - pSin * hWidth,
            hcx - hCos * hLength, hcy - hSin * hLength
          );
        }

        ctx.fill('evenodd');
      }

      // 4. Reset composite operation to source-over
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  requestAnimationFrame(animate);
})();
