(() => {
  "use strict";

  const canvas = document.getElementById("lily");
  const hint = document.getElementById("hint");
  const errorMessage = document.getElementById("error");
  const ctx = canvas.getContext("2d", { alpha: true });

  const LETTERS = "LudmiLUDMI";

  const CROP = { sx: 80, sy: 20, sw: 354, sh: 450 };

  const CONFIG = {
    desktopColumns: 74,
    mobileColumns: 52,
    smoothing: 0.12
  };

  const source = new Image();
  let particles = [];
  let animationId = 0;
  let columns = 0;
  let rows = 0;

  let targetProgress = 0;
  let currentProgress = 0;

  function hash(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function setCanvasResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || Math.min(window.innerWidth * 0.92, 420);
    const h = rect.height || (w / (CROP.sw / CROP.sh));

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function updateHint() {
    if (!hint) return;
    if (targetProgress > 0.05) {
      hint.classList.add("is-hidden");
    } else {
      hint.classList.remove("is-hidden");
    }
  }

  function makeAsciiFlower() {
    try {
      if (!source.naturalWidth || !source.naturalHeight) {
        showError("No se pudo cargar la imagen del lirio.");
        return;
      }

      setCanvasResolution();

      const isMobile = window.innerWidth <= 600;
      columns = isMobile ? CONFIG.mobileColumns : CONFIG.desktopColumns;

      const cropAspect = CROP.sw / CROP.sh;
      rows = Math.round((columns / cropAspect) * 0.58);

      const sampler = document.createElement("canvas");
      sampler.width = columns;
      sampler.height = rows;

      const sampleCtx = sampler.getContext("2d", { willReadFrequently: true });
      sampleCtx.clearRect(0, 0, columns, rows);
      sampleCtx.drawImage(
        source,
        CROP.sx, CROP.sy, CROP.sw, CROP.sh,
        0, 0, columns, rows
      );

      const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
      particles = [];

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const index = (y * columns + x) * 4;
          const alpha = pixels[index + 3] / 255;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;

          if (alpha < 0.15 || brightness < 0.05) continue;

          const boost = 1.14;
          const r = Math.min(255, Math.round(red * boost));
          const g = Math.min(255, Math.round(green * boost));
          const b = Math.min(255, Math.round(blue * boost));

          const baseIndex = (x * 3 + y * 5 + Math.floor(brightness * 7)) % LETTERS.length;
          const color = `rgb(${r}, ${g}, ${b})`;

          const verticalPosition = y / Math.max(1, rows - 1);
          const centerDist = Math.abs(x / columns - 0.5);
          const delay = (1 - verticalPosition) * 0.72 + centerDist * 0.14 + hash(x, y) * 0.10;

          particles.push({
            x,
            y,
            baseIndex,
            brightness,
            color,
            alpha,
            delay,
            phase: hash(y, x) * Math.PI * 2
          });
        }
      }

      updateHint();
      cancelAnimationFrame(animationId);
      animationId = requestAnimationFrame(render);
    } catch (err) {
      showError("Error al procesar el arte ASCII: " + err.message);
    }
  }

  function prepareText() {
    const cellWidth = canvas.width / columns;
    const cellHeight = canvas.height / rows;
    const fontSize = cellHeight * 0.90;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `700 ${fontSize}px -apple-system-ui-monospace, "SF Mono", Menlo, Monaco, "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    return { cellWidth, cellHeight };
  }

  function render(now) {
    currentProgress += (targetProgress - currentProgress) * CONFIG.smoothing;
    if (Math.abs(targetProgress - currentProgress) < 0.0005) {
      currentProgress = targetProgress;
    }

    const { cellWidth, cellHeight } = prepareText();
    const tick = Math.floor(now / 180);
    const isMobile = window.innerWidth <= 600;

    ctx.shadowColor = "rgba(244, 154, 193, 0.4)";
    ctx.shadowBlur = isMobile ? 2.5 : 4.5;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const localProgress = (currentProgress - p.delay) / Math.max(0.05, 1 - p.delay);
      if (localProgress <= 0) continue;

      const fade = Math.min(1, localProgress * 2.6);
      const shimmer = currentProgress >= 0.98
        ? 0.88 + Math.sin(now / 950 + p.phase) * 0.12
        : 0.75 + fade * 0.25;

      const shift = Math.sin(tick * 0.35 + p.phase) > 0.72 ? 1 : 0;
      const letter = LETTERS[(p.baseIndex + shift) % LETTERS.length];

      ctx.globalAlpha = Math.min(1, p.alpha * fade * shimmer);
      ctx.fillStyle = p.color;

      ctx.fillText(
        letter,
        (p.x + 0.5) * cellWidth,
        (p.y + 0.5) * cellHeight
      );
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    animationId = requestAnimationFrame(render);
  }

  function showError(msg) {
    if (!errorMessage) return;
    errorMessage.textContent = msg;
    errorMessage.hidden = false;
  }

  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartProgress = 0;
  let touchStartTime = 0;
  let isTouching = false;
  let isDragging = false;

  window.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    isTouching = true;
    isDragging = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartProgress = targetProgress;
    touchStartTime = performance.now();
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!isTouching || e.touches.length !== 1) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = touchStartY - currentY;
    const deltaX = Math.abs(currentX - touchStartX);

    if (Math.abs(deltaY) > 6 || deltaX > 6) {
      isDragging = true;
    }

    const travel = Math.max(200, window.innerHeight * 0.42);
    targetProgress = Math.min(1, Math.max(0, touchStartProgress + deltaY / travel));
    updateHint();
  }, { passive: true });

  window.addEventListener("touchend", () => {
    if (!isTouching) return;
    const duration = performance.now() - touchStartTime;

    if (!isDragging && duration < 280) {
      targetProgress = targetProgress > 0.5 ? 0 : 1;
      updateHint();
    }

    isTouching = false;
    isDragging = false;
  }, { passive: true });

  window.addEventListener("wheel", (e) => {
    targetProgress = Math.min(1, Math.max(0, targetProgress + e.deltaY * 0.0012));
    updateHint();
  }, { passive: true });

  let isMouseDown = false;
  let mouseStartY = 0;
  let mouseStartProgress = 0;
  let mouseStartTime = 0;
  let mouseMoved = false;

  window.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isMouseDown = true;
    mouseMoved = false;
    mouseStartY = e.clientY;
    mouseStartProgress = targetProgress;
    mouseStartTime = performance.now();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;
    const deltaY = mouseStartY - e.clientY;
    if (Math.abs(deltaY) > 5) mouseMoved = true;
    const travel = Math.max(200, window.innerHeight * 0.45);
    targetProgress = Math.min(1, Math.max(0, mouseStartProgress + deltaY / travel));
    updateHint();
  });

  window.addEventListener("mouseup", () => {
    if (!isMouseDown) return;
    if (!mouseMoved && performance.now() - mouseStartTime < 280) {
      targetProgress = targetProgress > 0.5 ? 0 : 1;
      updateHint();
    }
    isMouseDown = false;
  });

  source.addEventListener("load", makeAsciiFlower);
  source.addEventListener("error", () => {
    showError("No se pudo cargar lirio.png. Verificá que el archivo esté en la misma carpeta.");
  });
  source.src = "lirio.png";

  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(makeAsciiFlower, 150);
  });
})();
