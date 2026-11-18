(() => {
  'use strict';

  const canvas = document.getElementById('reveal-canvas');
  const hero = document.getElementById('hero');
  const resetButton = document.getElementById('reset-btn');
  const context = canvas?.getContext('2d', { alpha: true });
  if (!canvas || !hero || !context) return;

  const image = new Image();
  image.src = 'image1.jpg';

  const STAMP_LIFETIME = 2.7;
  const SAMPLE_COUNT = 36;
  const MAX_STAMPS = 240;
  const stamps = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let targetX = 0;
  let targetY = 0;
  let brushX = 0;
  let brushY = 0;
  let lastStampX = 0;
  let lastStampY = 0;
  let pointerActive = false;
  let hasPosition = false;
  let frameId = 0;
  let lastFrameTime = 0;

  function coverRect(imageWidth, imageHeight) {
    const scale = Math.max(width / imageWidth, height / imageHeight);
    const renderWidth = imageWidth * scale;
    const renderHeight = imageHeight * scale;
    return {
      x: (width - renderWidth) / 2,
      y: (height - renderHeight) / 2,
      width: renderWidth,
      height: renderHeight
    };
  }

  function resize() {
    const bounds = hero.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    draw(performance.now() / 1000);
  }

  function drawInitialImage() {
    if (!image.complete || !image.naturalWidth) return;
    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const rect = coverRect(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    context.restore();
  }

  function addStamp(x, y, angle, speed, now) {
    const radius = Math.min(width, height) * 0.18;
    stamps.push({ x, y, radius, angle, speed, born: now, seed: Math.random() * 1000 });
    if (stamps.length > MAX_STAMPS) stamps.splice(0, stamps.length - MAX_STAMPS);
  }

  function startAt(x, y) {
    targetX = brushX = lastStampX = x;
    targetY = brushY = lastStampY = y;
    pointerActive = true;
    hasPosition = true;
    addStamp(x, y, 0, 0, performance.now() / 1000);
    requestRender();
  }

  function onPointerMove(event) {
    // Coalesced events preserve fine pointer detail on high-rate devices without
    // forcing a render for every hardware sample.
    const samples = event.getCoalescedEvents?.() || [event];
    const point = samples[samples.length - 1];
    const bounds = hero.getBoundingClientRect();
    const x = point.clientX - bounds.left;
    const y = point.clientY - bounds.top;
    if (!hasPosition || !pointerActive) {
      startAt(x, y);
      return;
    }
    targetX = x;
    targetY = y;
    requestRender();
  }

  function traceBrush(stamp, radius, now) {
    const points = [];
    const age = now - stamp.born;
    const seed = stamp.seed;
    const stretch = Math.min(1.3, 1.08 + stamp.speed * 0.00035);
    const squeeze = 1 / Math.sqrt(stretch);
    const cosDirection = Math.cos(stamp.angle);
    const sinDirection = Math.sin(stamp.angle);
    const wobble = age * 0.4;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const angle = (i / SAMPLE_COUNT) * Math.PI * 2;
      const roughness =
        0.085 * Math.sin(3 * angle + wobble + seed) +
        0.048 * Math.sin(5 * angle - wobble * 1.15 + seed * 2.1) +
        0.022 * Math.sin(9 * angle + wobble * 0.6 + seed * 3.7) +
        0.035 * Math.sin(17 * angle + seed * 4.3) +
        0.018 * Math.cos(31 * angle - seed * 1.7) +
        (Math.sin(6 * angle + seed * 1.5) > 0.88 ? -0.12 : 0);
      const r = radius * Math.max(0.2, 1 + roughness);
      const localX = r * stretch * Math.cos(angle);
      const localY = r * squeeze * Math.sin(angle);
      points.push({
        x: stamp.x + localX * cosDirection - localY * sinDirection,
        y: stamp.y + localX * sinDirection + localY * cosDirection
      });
    }
    return points;
  }

  function traceClosedCurve(points) {
    const count = points.length;
    context.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < count; i++) {
      const p0 = points[(i - 1 + count) % count];
      const p1 = points[i];
      const p2 = points[(i + 1) % count];
      const p3 = points[(i + 2) % count];
      context.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6,
        p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6,
        p2.y - (p3.y - p1.y) / 6,
        p2.x,
        p2.y
      );
    }
    context.closePath();
  }

  function addBristleHoles(stamp, radius) {
    const holeCount = 2 + Math.floor(stamp.seed % 3);
    const alongX = Math.cos(stamp.angle);
    const alongY = Math.sin(stamp.angle);
    const acrossX = -alongY;
    const acrossY = alongX;

    for (let i = 0; i < holeCount; i++) {
      const seed = stamp.seed + i * 137.5;
      const offset = radius * (0.15 + (Math.sin(seed) * 0.5 + 0.5) * 0.45);
      const direction = stamp.angle + Math.PI / 2 + (i % 2 ? Math.PI : 0);
      const x = stamp.x + Math.cos(direction) * offset;
      const y = stamp.y + Math.sin(direction) * offset;
      const length = radius * (0.35 + Math.sin(seed * 1.3) * 0.15);
      const halfWidth = radius * (0.05 + Math.sin(seed * 2.1) * 0.02);

      context.moveTo(x - alongX * length, y - alongY * length);
      context.bezierCurveTo(
        x - alongX * length + acrossX * halfWidth,
        y - alongY * length + acrossY * halfWidth,
        x + alongX * length + acrossX * halfWidth,
        y + alongY * length + acrossY * halfWidth,
        x + alongX * length,
        y + alongY * length
      );
      context.bezierCurveTo(
        x + alongX * length - acrossX * halfWidth,
        y + alongY * length - acrossY * halfWidth,
        x - alongX * length - acrossX * halfWidth,
        y - alongY * length - acrossY * halfWidth,
        x - alongX * length,
        y - alongY * length
      );
    }
  }

  function draw(now) {
    if (!image.complete || !image.naturalWidth || !width || !height) return;
    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const rect = coverRect(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);

    context.globalCompositeOperation = 'destination-out';
    for (let i = stamps.length - 1; i >= 0; i--) {
      const stamp = stamps[i];
      const life = 1 - (now - stamp.born) / STAMP_LIFETIME;
      if (life <= 0) {
        stamps.splice(i, 1);
        continue;
      }
      const radius = stamp.radius * Math.pow(life, 0.85);
      if (radius <= 0.5) continue;
      const perimeter = traceBrush(stamp, radius, now);
      context.beginPath();
      traceClosedCurve(perimeter);
      addBristleHoles(stamp, radius);
      context.fill('evenodd');
    }
    context.restore();
  }

  function renderFrame(nowMs) {
    frameId = 0;
    const now = nowMs / 1000;
    const dt = lastFrameTime ? Math.min((nowMs - lastFrameTime) / 1000, 0.05) : 1 / 60;
    lastFrameTime = nowMs;

    if (pointerActive) {
      const smoothing = 1 - Math.pow(1 - 0.17, dt * 60);
      const previousX = brushX;
      const previousY = brushY;
      brushX += (targetX - brushX) * smoothing;
      brushY += (targetY - brushY) * smoothing;

      const dx = brushX - lastStampX;
      const dy = brushY - lastStampY;
      const distance = Math.hypot(dx, dy);
      const spacing = Math.max(4, Math.min(width, height) * 0.18 * 0.09);
      if (distance >= spacing) {
        const steps = Math.floor(distance / spacing);
        const angle = Math.atan2(brushY - previousY, brushX - previousX);
        const speed = distance / Math.max(dt, 0.001);
        const unitX = dx / distance;
        const unitY = dy / distance;
        for (let i = 1; i <= steps; i++) {
          addStamp(lastStampX + unitX * spacing * i, lastStampY + unitY * spacing * i, angle, speed, now);
        }
        lastStampX += unitX * spacing * steps;
        lastStampY += unitY * spacing * steps;
      }
    }

    draw(now);
    const stillFollowing = pointerActive && Math.hypot(targetX - brushX, targetY - brushY) > 0.5;
    if (stamps.length || stillFollowing) requestRender();
  }

  function requestRender() {
    if (!frameId) frameId = requestAnimationFrame(renderFrame);
  }

  hero.addEventListener('pointerenter', onPointerMove);
  hero.addEventListener('pointermove', onPointerMove);
  hero.addEventListener('pointerleave', () => {
    pointerActive = false;
    requestRender();
  });

  resetButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    stamps.length = 0;
    drawInitialImage();
  });

  image.addEventListener('load', drawInitialImage);
  image.addEventListener('error', () => console.error('Unable to load image1.jpg for the reveal canvas.'));
  window.addEventListener('resize', resize, { passive: true });
  resize();
})();
