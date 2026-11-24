(() => {
  "use strict";

  const TARGET_DATE = new Date("2026-11-25T00:30:00-03:00");
  const isPreview = new URLSearchParams(window.location.search).has("preview") || new URLSearchParams(window.location.search).has("test");

  const countdownScreen = document.getElementById("countdownScreen");
  const cdDays = document.getElementById("cdDays");
  const cdHours = document.getElementById("cdHours");
  const cdMinutes = document.getElementById("cdMinutes");
  const cdSeconds = document.getElementById("cdSeconds");
  const unitDays = document.getElementById("unitDays");
  const sepDays = document.getElementById("sepDays");

  const scene = document.getElementById("scene");
  const canvas = document.getElementById("clavel");
  const hint = document.getElementById("hint");
  const hintMore = document.getElementById("hintMore");
  const letter = document.getElementById("letter");
  const letterContent = document.getElementById("letterContent");
  const errorMessage = document.getElementById("error");
  const ctx = canvas.getContext("2d", { alpha: true });

  const LETTERS = "LudmiLUDMI";
  const CROP = { sx: 10, sy: 0, sw: 768, sh: 1238 };
  const CONFIG = {
    desktopColumns: 114,
    mobileColumns: 84,
    smoothing: 0.12
  };

  const source = new Image();
  let particles = [];
  let animationId = 0;
  let columns = 0;
  let rows = 0;

  let targetProgress = 0;
  let currentProgress = 0;
  let countdownInterval = 0;
  let isUnlocked = false;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function updateCountdown() {
    const now = Date.now();
    const diff = TARGET_DATE.getTime() - now;

    if (diff <= 0 || isPreview) {
      unlockPage();
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days <= 0) {
      if (unitDays) unitDays.style.display = "none";
      if (sepDays) sepDays.style.display = "none";
    } else {
      if (unitDays) unitDays.style.display = "flex";
      if (sepDays) sepDays.style.display = "inline";
      if (cdDays) cdDays.textContent = pad(days);
    }

    if (cdHours) cdHours.textContent = pad(hours);
    if (cdMinutes) cdMinutes.textContent = pad(minutes);
    if (cdSeconds) cdSeconds.textContent = pad(seconds);
  }

  function unlockPage() {
    if (isUnlocked) return;
    isUnlocked = true;
    if (countdownInterval) clearInterval(countdownInterval);

    if (countdownScreen) {
      countdownScreen.classList.add("is-unlocked");
      setTimeout(() => {
        countdownScreen.remove();
      }, 900);
    }

    if (scene) {
      scene.classList.remove("is-locked");
    }

    if (source.complete && source.naturalWidth) {
      makeAsciiFlower();
    } else {
      source.src = "clavel.png";
    }
  }

  function hash(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function setCanvasResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || Math.min(window.innerWidth * 0.92, 430);
    const h = rect.height || (w / (CROP.sw / CROP.sh));

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function updateHint() {
    if (hint) {
      if (targetProgress > 0.05) {
        hint.classList.add("is-hidden");
      } else {
        hint.classList.remove("is-hidden");
      }
    }
    if (hintMore) {
      if (targetProgress >= 0.95 && targetProgress <= 1.15) {
        hintMore.classList.remove("is-hidden");
      } else {
        hintMore.classList.add("is-hidden");
      }
    }
  }

  function makeAsciiFlower() {
    try {
      if (!source.naturalWidth || !source.naturalHeight) {
        showError("No se pudo cargar la imagen del clavel.");
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

          if (alpha < 0.10 || brightness < 0.035) continue;

          const boost = 1.18;
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
    const fontSize = cellHeight * 0.92;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `600 ${fontSize}px -apple-system-ui-monospace, "SF Mono", Menlo, Monaco, "Courier New", monospace`;
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
    const bloomProgress = Math.min(1, currentProgress);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const localProgress = (bloomProgress - p.delay) / Math.max(0.05, 1 - p.delay);
      if (localProgress <= 0) continue;

      const fade = Math.min(1, localProgress * 2.6);
      const shimmer = bloomProgress >= 0.98
        ? 0.90 + Math.sin(now / 950 + p.phase) * 0.10
        : 0.78 + fade * 0.22;

      const shift = Math.sin(tick * 0.35 + p.phase) > 0.72 ? 1 : 0;
      const letterChar = LETTERS[(p.baseIndex + shift) % LETTERS.length];

      ctx.globalAlpha = Math.min(1, p.alpha * fade * shimmer);
      ctx.fillStyle = p.color;

      ctx.fillText(
        letterChar,
        (p.x + 0.5) * cellWidth,
        (p.y + 0.5) * cellHeight
      );
    }

    ctx.globalAlpha = 1;

    if (currentProgress > 1) {
      const p2 = Math.min(1, Math.max(0, currentProgress - 1));
      if (letter) {
        letter.style.visibility = "visible";
        letter.style.opacity = String(p2);
        letter.style.transform = `translateY(${(1 - p2) * 36}px)`;
        letter.style.pointerEvents = p2 > 0.85 ? "auto" : "none";
      }
      if (canvas) {
        const scale = 1 - 0.12 * p2;
        const transY = -24 * p2;
        const opacity = 1 - 0.78 * p2;
        canvas.style.transform = `scale(${scale}) translateY(${transY}px)`;
        canvas.style.opacity = String(opacity);
      }
    } else {
      if (letter) {
        letter.style.visibility = "hidden";
        letter.style.opacity = "0";
        letter.style.pointerEvents = "none";
      }
      if (canvas) {
        canvas.style.transform = "none";
        canvas.style.opacity = "1";
      }
    }

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
  let letterScrollStart = 0;

  window.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    isTouching = true;
    isDragging = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartProgress = targetProgress;
    touchStartTime = performance.now();
    letterScrollStart = letterContent ? letterContent.scrollTop : 0;
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

    if (targetProgress >= 1.5 && letterContent && letterContent.contains(e.target)) {
      if (deltaY > 0) {
        return;
      }
      if (deltaY < 0 && letterScrollStart <= 2) {
        const travel = Math.max(160, window.innerHeight * 0.35);
        targetProgress = Math.min(2, Math.max(0, 2 + deltaY / travel));
        updateHint();
      }
      return;
    }

    const travel = Math.max(200, window.innerHeight * 0.40);
    targetProgress = Math.min(2, Math.max(0, touchStartProgress + deltaY / travel));
    updateHint();
  }, { passive: true });

  window.addEventListener("touchend", () => {
    if (!isTouching) return;
    const duration = performance.now() - touchStartTime;

    if (isDragging) {
      if (targetProgress > 1 && targetProgress < 1.7) {
        targetProgress = 1;
        updateHint();
      } else if (targetProgress >= 1.7) {
        targetProgress = 2;
        updateHint();
      }
    } else if (duration < 280) {
      if (targetProgress < 0.6) {
        targetProgress = 1;
      } else if (targetProgress < 1.4) {
        targetProgress = 2;
      } else {
        targetProgress = 1;
      }
      updateHint();
    }

    isTouching = false;
    isDragging = false;
  }, { passive: true });

  window.addEventListener("wheel", (e) => {
    if (targetProgress >= 1.5 && letterContent && letterContent.contains(e.target)) {
      if (e.deltaY < 0 && letterContent.scrollTop <= 2) {
        targetProgress = Math.min(2, Math.max(0, targetProgress + e.deltaY * 0.0015));
        updateHint();
      }
    } else {
      targetProgress = Math.min(2, Math.max(0, targetProgress + e.deltaY * 0.0012));
      updateHint();
    }
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
    letterScrollStart = letterContent ? letterContent.scrollTop : 0;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;
    const deltaY = mouseStartY - e.clientY;
    if (Math.abs(deltaY) > 5) mouseMoved = true;

    if (targetProgress >= 1.5 && letterContent && letterContent.contains(e.target)) {
      if (deltaY > 0) return;
      if (deltaY < 0 && letterScrollStart <= 2) {
        const travel = Math.max(160, window.innerHeight * 0.35);
        targetProgress = Math.min(2, Math.max(0, 2 + deltaY / travel));
        updateHint();
      }
      return;
    }

    const travel = Math.max(200, window.innerHeight * 0.45);
    targetProgress = Math.min(2, Math.max(0, mouseStartProgress + deltaY / travel));
    updateHint();
  });

  window.addEventListener("mouseup", () => {
    if (!isMouseDown) return;
    if (mouseMoved) {
      if (targetProgress > 1 && targetProgress < 1.7) {
        targetProgress = 1;
        updateHint();
      } else if (targetProgress >= 1.7) {
        targetProgress = 2;
        updateHint();
      }
    } else if (performance.now() - mouseStartTime < 280) {
      if (targetProgress < 0.6) {
        targetProgress = 1;
      } else if (targetProgress < 1.4) {
        targetProgress = 2;
      } else {
        targetProgress = 1;
      }
      updateHint();
    }
    isMouseDown = false;
  });

  if (hint) {
    hint.addEventListener("click", () => {
      targetProgress = 1;
      updateHint();
    });
  }

  if (hintMore) {
    hintMore.addEventListener("click", () => {
      targetProgress = 2;
      updateHint();
    });
  }

  if (letter) {
    letter.addEventListener("click", (e) => {
      if (e.target === letter) {
        targetProgress = 1;
        updateHint();
      }
    });
  }

  source.addEventListener("load", makeAsciiFlower);
  source.addEventListener("error", () => {
    showError("No se pudo cargar clavel.png. Verificá que el archivo esté en la misma carpeta.");
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(makeAsciiFlower, 150);
  });

  updateCountdown();
  if (!isUnlocked) {
    countdownInterval = setInterval(updateCountdown, 1000);
  }
})();
