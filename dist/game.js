(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const ui = {
    score: document.querySelector("#score"),
    time: document.querySelector("#time"),
    startOverlay: document.querySelector("#startOverlay"),
    resultOverlay: document.querySelector("#resultOverlay"),
    startButton: document.querySelector("#startButton"),
    retryButton: document.querySelector("#retryButton"),
    finalScore: document.querySelector("#finalScore"),
    finalItems: document.querySelector("#finalItems"),
    finalCombo: document.querySelector("#finalCombo"),
    resultRank: document.querySelector("#resultRank"),
    resultMessage: document.querySelector("#resultMessage"),
    toast: document.querySelector("#toast"),
  };

  const W = canvas.width;
  const H = canvas.height;
  const SPRITE_CELL = 362;
  const GAME_SECONDS = 45;
  const input = { left: false, right: false, jumpHeld: false, jumpQueued: false };
  const playerImage = new Image();
  playerImage.src = "./assets/warehouse-worker.png";

  let state = "menu";
  let player;
  let platforms = [];
  let items = [];
  let particles = [];
  let score = 0;
  let collected = 0;
  let combo = 0;
  let maxCombo = 0;
  let lastCollectAt = -10;
  let timeLeft = GAME_SECONDS;
  let elapsed = 0;
  let lastTime = performance.now();
  let toastTimer = 0;
  let platformId = 0;

  const colors = {
    bg: "#171421",
    bg2: "#242133",
    line: "#3a3447",
    pink: "#f27490",
    yellow: "#ffcf4a",
    orange: "#ff8a30",
    cream: "#fff4d6",
    navy: "#163657",
  };

  function resetGame() {
    score = 0;
    collected = 0;
    combo = 0;
    maxCombo = 0;
    lastCollectAt = -10;
    timeLeft = GAME_SECONDS;
    elapsed = 0;
    platformId = 0;
    particles = [];
    input.left = false;
    input.right = false;
    input.jumpHeld = false;
    input.jumpQueued = false;
    player = {
      x: 154,
      y: 522,
      w: 50,
      h: 58,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      coyote: .12,
      jumpBuffer: 0,
      landing: 0,
      collectPose: 0,
      hurt: 0,
    };

    platforms = [
      makePlatform(104, 580, 152, "floor"),
      makePlatform(22, 490, 95),
      makePlatform(188, 421, 110, "belt"),
      makePlatform(67, 340, 92),
      makePlatform(219, 266, 104),
      makePlatform(96, 188, 98, "belt"),
      makePlatform(10, 112, 88),
    ];

    items = [
      makeItem(53, 453, "box"),
      makeItem(234, 382, "shoe"),
      makeItem(104, 299, "shirt"),
      makeItem(270, 225, "box"),
      makeItem(141, 147, "clock"),
      makeItem(45, 70, "shoe"),
    ];
    syncUI();
  }

  function makePlatform(x, y, w, type = "crate") {
    return { id: platformId++, x, y, w, h: type === "floor" ? 24 : 14, type };
  }

  function makeItem(x, y, type) {
    return { x, y, w: 28, h: 28, type, active: true, bob: Math.random() * Math.PI * 2 };
  }

  function startGame() {
    resetGame();
    state = "playing";
    ui.startOverlay.classList.remove("is-visible");
    ui.resultOverlay.classList.remove("is-visible");
    lastTime = performance.now();
    playTone(420, .06, "square", .025);
    requestAnimationFrame(loop);
  }

  function endGame(reason) {
    if (state !== "playing") return;
    state = "ended";
    input.left = false;
    input.right = false;
    const rank = score >= 2200 ? "대방출 히어로" : score >= 1200 ? "재고 달인" : score >= 500 ? "창고 에이스" : "재고 신입";
    ui.finalScore.textContent = score.toLocaleString("ko-KR");
    ui.finalItems.textContent = `${collected}개`;
    ui.finalCombo.textContent = maxCombo;
    ui.resultRank.textContent = rank;
    ui.resultMessage.textContent = reason === "fall" ? "발판을 놓쳤어요. 다시 회수해볼까요?" : "제한 시간 동안 열심히 회수했어요!";
    ui.resultOverlay.classList.add("is-visible");
    playTone(160, .18, "sawtooth", .03);
  }

  function queueJump() {
    if (state !== "playing") return;
    input.jumpQueued = true;
    player.jumpBuffer = .13;
  }

  function update(dt) {
    elapsed += dt;
    timeLeft = Math.max(0, GAME_SECONDS - elapsed);
    if (timeLeft <= 0) return endGame("time");

    if (elapsed - lastCollectAt > 1.5 && combo !== 0) combo = 0;

    const acceleration = player.grounded ? 1250 : 760;
    const target = input.left ? -185 : input.right ? 185 : 0;
    const delta = target - player.vx;
    const change = Math.sign(delta) * Math.min(Math.abs(delta), acceleration * dt);
    player.vx += change;
    if (input.left) player.facing = -1;
    if (input.right) player.facing = 1;

    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyote = player.grounded ? .12 : Math.max(0, player.coyote - dt);
    player.landing = Math.max(0, player.landing - dt);
    player.collectPose = Math.max(0, player.collectPose - dt);
    player.hurt = Math.max(0, player.hurt - dt);

    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = -430;
      player.grounded = false;
      player.coyote = 0;
      player.jumpBuffer = 0;
      input.jumpQueued = false;
      playTone(260, .055, "square", .018);
    }

    if (!input.jumpHeld && player.vy < -190) player.vy += 900 * dt;
    player.vy = Math.min(620, player.vy + 1050 * dt);

    const previousBottom = player.y + player.h;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(-4, Math.min(W - player.w + 4, player.x));
    player.grounded = false;

    if (player.vy >= 0) {
      for (const platform of platforms) {
        const nextBottom = player.y + player.h;
        if (
          previousBottom <= platform.y + 4 &&
          nextBottom >= platform.y &&
          player.x + player.w - 10 > platform.x &&
          player.x + 10 < platform.x + platform.w
        ) {
          player.y = platform.y - player.h;
          player.vy = 0;
          player.grounded = true;
          player.landing = .11;
          break;
        }
      }
    }

    const cameraLine = 242;
    if (player.y < cameraLine && player.vy < 0) {
      const shift = cameraLine - player.y;
      player.y = cameraLine;
      for (const platform of platforms) platform.y += shift;
      for (const item of items) item.y += shift;
      score += Math.floor(shift * .32);
    }

    platforms = platforms.filter((p) => p.y < H + 70);
    items = items.filter((item) => item.y < H + 60);
    generateWorld();

    for (const item of items) {
      item.bob += dt * 4;
      if (!item.active) continue;
      const itemY = item.y + Math.sin(item.bob) * 3;
      if (overlap(player.x + 7, player.y + 7, player.w - 14, player.h - 10, item.x, itemY, item.w, item.h)) {
        collectItem(item);
      }
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 220 * dt;
      particle.life -= dt;
    }
    particles = particles.filter((particle) => particle.life > 0);

    if (player.y > H + 45) endGame("fall");
    syncUI();
  }

  function generateWorld() {
    let highest = Math.min(...platforms.map((p) => p.y));
    while (highest > -50) {
      const gap = 68 + Math.random() * 25;
      const width = 78 + Math.random() * 42;
      const x = 12 + Math.random() * (W - width - 24);
      highest -= gap;
      const type = Math.random() < .22 ? "belt" : "crate";
      platforms.push(makePlatform(x, highest, width, type));
      const roll = Math.random();
      const itemType = roll < .11 ? "clock" : roll < .55 ? "box" : roll < .78 ? "shoe" : "shirt";
      items.push(makeItem(x + width / 2 - 14, highest - 37, itemType));
    }
  }

  function collectItem(item) {
    item.active = false;
    combo = elapsed - lastCollectAt <= 1.5 ? combo + 1 : 1;
    maxCombo = Math.max(maxCombo, combo);
    lastCollectAt = elapsed;
    collected += 1;
    const base = item.type === "clock" ? 250 : 100;
    const gained = base * Math.min(combo, 5);
    score += gained;
    player.collectPose = .18;
    if (item.type === "clock") elapsed = Math.max(0, elapsed - 3);
    showToast(item.type === "clock" ? `TIME +3 · +${gained}` : combo > 1 ? `${combo} COMBO · +${gained}` : `GET! +${gained}`);
    burst(item.x + 14, item.y + 14, item.type === "clock" ? colors.yellow : colors.pink);
    playTone(item.type === "clock" ? 760 : 560 + combo * 45, .07, "square", .022);
  }

  function burst(x, y, color) {
    for (let i = 0; i < 9; i++) {
      particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: -40 - Math.random() * 100, life: .45 + Math.random() * .25, color });
    }
  }

  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 650);
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function syncUI() {
    ui.score.textContent = String(score).padStart(4, "0");
    ui.time.textContent = String(Math.ceil(timeLeft)).padStart(2, "0");
    ui.time.style.color = timeLeft <= 10 ? colors.pink : colors.yellow;
  }

  function draw() {
    drawBackground();
    drawPlatforms();
    drawItems();
    drawParticles();
    drawPlayer();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, colors.bg2);
    gradient.addColorStop(1, colors.bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#201c2a";
    for (let x = 0; x < W; x += 90) ctx.fillRect(x + 5, 0, 10, H);
    ctx.fillStyle = colors.line;
    for (let y = -20; y < H; y += 96) {
      ctx.fillRect(0, y, W, 3);
      for (let x = 20; x < W; x += 110) ctx.fillRect(x, y - 29, 46, 3);
    }

    ctx.fillStyle = "rgba(242,116,144,.07)";
    ctx.beginPath();
    ctx.moveTo(140, 0);
    ctx.lineTo(300, H);
    ctx.lineTo(350, H);
    ctx.lineTo(220, 0);
    ctx.fill();
  }

  function drawPlatforms() {
    for (const p of platforms) {
      if (p.type === "floor") {
        ctx.fillStyle = "#34303e";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = colors.yellow;
        for (let x = p.x; x < p.x + p.w; x += 18) ctx.fillRect(x, p.y, 9, 5);
        continue;
      }
      if (p.type === "belt") {
        ctx.fillStyle = "#0e0c13";
        ctx.fillRect(p.x - 3, p.y - 2, p.w + 6, p.h + 5);
        ctx.fillStyle = "#747080";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#302c3a";
        for (let x = p.x + 6; x < p.x + p.w - 4; x += 17) {
          ctx.beginPath(); ctx.arc(x, p.y + 7, 4, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = "#0d0b11";
        ctx.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
        ctx.fillStyle = "#a95b2b";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#d98643";
        ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 4);
        ctx.fillStyle = "#6e371f";
        ctx.fillRect(p.x + p.w / 2 - 2, p.y, 4, p.h);
      }
    }
  }

  function drawItems() {
    for (const item of items) {
      if (!item.active) continue;
      const y = Math.round(item.y + Math.sin(item.bob) * 3);
      ctx.save();
      ctx.translate(Math.round(item.x), y);
      ctx.fillStyle = "rgba(255,207,74,.16)";
      ctx.fillRect(-4, -4, 36, 36);
      ctx.fillStyle = "#0c0a10";
      ctx.fillRect(2, 2, 24, 24);
      if (item.type === "box") {
        ctx.fillStyle = colors.orange; ctx.fillRect(4, 5, 20, 19);
        ctx.fillStyle = "#ffc078"; ctx.fillRect(7, 7, 14, 4);
        ctx.fillStyle = "#a64d23"; ctx.fillRect(13, 5, 3, 19);
      } else if (item.type === "shoe") {
        ctx.fillStyle = colors.pink; ctx.fillRect(6, 9, 8, 10); ctx.fillRect(12, 15, 11, 7);
        ctx.fillStyle = "white"; ctx.fillRect(7, 20, 17, 3);
      } else if (item.type === "shirt") {
        ctx.fillStyle = "#55c6d7"; ctx.fillRect(8, 7, 12, 17); ctx.fillRect(4, 9, 20, 7);
        ctx.fillStyle = colors.bg; ctx.fillRect(12, 7, 4, 4);
      } else {
        ctx.fillStyle = colors.yellow;
        ctx.beginPath(); ctx.arc(14, 14, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors.bg; ctx.fillRect(13, 7, 2, 8); ctx.fillRect(14, 13, 5, 2);
      }
      ctx.restore();
    }
  }

  function drawPlayer() {
    if (!playerImage.complete || !playerImage.naturalWidth) {
      ctx.fillStyle = colors.pink;
      ctx.fillRect(player.x + 8, player.y + 6, player.w - 16, player.h - 6);
      return;
    }
    let frame = 0;
    if (player.hurt > 0) frame = 10;
    else if (player.collectPose > 0) frame = 9;
    else if (player.landing > 0) frame = 7;
    else if (player.vy < -70) frame = 4;
    else if (player.vy > 70) frame = 6;
    else if (Math.abs(player.vx) > 30) frame = Math.floor(elapsed * 8) % 2;
    else frame = Math.floor(elapsed * 3) % 2;

    const sx = (frame % 4) * SPRITE_CELL;
    const sy = Math.floor(frame / 4) * SPRITE_CELL;
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(Math.round(player.x + player.w), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(playerImage, sx, sy, SPRITE_CELL, SPRITE_CELL, 0, Math.round(player.y - 2), player.w, player.h + 4);
    } else {
      ctx.drawImage(playerImage, sx, sy, SPRITE_CELL, SPRITE_CELL, Math.round(player.x), Math.round(player.y - 2), player.w, player.h + 4);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 5, 5);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (state !== "playing") {
      draw();
      return;
    }
    const dt = Math.min(.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    if (state === "playing") requestAnimationFrame(loop);
  }

  function playTone(frequency, duration, type, volume) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      playTone.context ||= new AudioContext();
      const audio = playTone.context;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch (_) {}
  }

  const movementKeys = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  };
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW"].includes(event.code)) event.preventDefault();
    if (movementKeys[event.code]) input[movementKeys[event.code]] = true;
    if (["ArrowUp", "Space", "KeyW"].includes(event.code) && !event.repeat) {
      input.jumpHeld = true;
      queueJump();
    }
  }, { passive: false });
  window.addEventListener("keyup", (event) => {
    if (movementKeys[event.code]) input[movementKeys[event.code]] = false;
    if (["ArrowUp", "Space", "KeyW"].includes(event.code)) input.jumpHeld = false;
  });

  function bindHold(button, property, onDown) {
    const activePointers = new Set();
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      activePointers.add(event.pointerId);
      input[property] = true;
      button.classList.add("is-pressed");
      if (onDown) onDown();
    });
    const release = (event) => {
      activePointers.delete(event.pointerId);
      if (activePointers.size === 0) {
        input[property] = false;
        button.classList.remove("is-pressed");
      }
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  bindHold(document.querySelector("#leftButton"), "left");
  bindHold(document.querySelector("#rightButton"), "right");
  bindHold(document.querySelector("#jumpButton"), "jumpHeld", queueJump);

  ui.startButton.addEventListener("click", startGame);
  ui.retryButton.addEventListener("click", startGame);
  window.addEventListener("blur", () => {
    input.left = false;
    input.right = false;
    input.jumpHeld = false;
  });

  resetGame();
  playerImage.addEventListener("load", draw);
  draw();
})();
