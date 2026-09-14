(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const portraitQuery = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
  const compactQuery = window.matchMedia("(max-width: 820px), (max-height: 560px)");
  const IS_MOBILE_PORTRAIT = portraitQuery.matches;
  const IS_COMPACT_VIEW = compactQuery.matches;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const ui = {
    hud: document.querySelector("#hud"),
    stageNumber: document.querySelector("#stageNumber"),
    stageName: document.querySelector("#stageName"),
    lives: document.querySelector("#lives"),
    stageProgress: document.querySelector("#stageProgress"),
    timeLeft: document.querySelector("#timeLeft"),
    productSlots: document.querySelector("#productSlots"),
    boostStatus: document.querySelector("#boostStatus"),
    boostGauge: document.querySelector("#boostGauge"),
    boostLabel: document.querySelector("#boostLabel"),
    loadingScreen: document.querySelector("#loadingScreen"),
    loadingBar: document.querySelector("#loadingBar"),
    introScreen: document.querySelector("#introScreen"),
    stageClearScreen: document.querySelector("#stageClearScreen"),
    pauseScreen: document.querySelector("#pauseScreen"),
    gameOverScreen: document.querySelector("#gameOverScreen"),
    victoryScreen: document.querySelector("#victoryScreen"),
    startButton: document.querySelector("#startButton"),
    nextStageButton: document.querySelector("#nextStageButton"),
    retryButton: document.querySelector("#retryButton"),
    victoryRetryButton: document.querySelector("#victoryRetryButton"),
    pauseButton: document.querySelector("#pauseButton"),
    resumeButton: document.querySelector("#resumeButton"),
    restartButton: document.querySelector("#restartButton"),
    jumpButton: document.querySelector("#jumpButton"),
    boostButton: document.querySelector("#boostButton"),
    countdown: document.querySelector("#countdown"),
    notice: document.querySelector("#notice"),
    clearStageLabel: document.querySelector("#clearStageLabel"),
    recoveryCase: document.querySelector("#recoveryCase"),
    recoveredProduct: document.querySelector("#recoveredProduct"),
    recoveredProductName: document.querySelector("#recoveredProductName"),
    productLink: document.querySelector("#productLink"),
    recoveryCount: document.querySelector("#recoveryCount"),
    failedRecovered: document.querySelector("#failedRecovered"),
    victoryProducts: document.querySelector("#victoryProducts"),
  };

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = 605;
  const STAGE_SECONDS = 30;
  const BOOST_CHARGE_SECONDS = 10;
  const BOOST_SECONDS = 3;
  const GRAVITY = 1940;
  const BASE_SPEED = IS_MOBILE_PORTRAIT ? 520 : 600;
  const MAX_SPEED = IS_MOBILE_PORTRAIT ? 780 : 900;
  const BOOST_SPEED = IS_MOBILE_PORTRAIT ? 1250 : 1450;
  const CRASH_SPEED = IS_MOBILE_PORTRAIT ? 390 : 430;
  const SPEED_ACCELERATION = IS_MOBILE_PORTRAIT ? 40 : 46;
  const OBSTACLE_VISUAL_SCALE = IS_MOBILE_PORTRAIT ? 1.3 : 1.1;
  const VEHICLE_FRAME_RATIO = (1870 / 8) / (841 / 6);
  const ASSET_VERSION = "1.4.0";
  const paths = {
    root: "./assets/game/",
    ui: "./assets/game/ui/items/",
    effects: "./assets/game/effects/vfx/",
    recovery: "./assets/game/effects/recovery/",
    products: "./assets/game/product/",
  };

  const stages = [
    {
      name: "도심 추격",
      palette: "#162342",
      backgrounds: ["s1bg1", "s1bg2", "s1bg3", "s1bg4"],
      obstacles: [
        { key: "s1o1", w: 72, h: 72, kind: "box" },
        { key: "s1o2", w: 52, h: 76, kind: "cone" },
        { key: "s1o3", w: 155, h: 88, kind: "barricade" },
        { key: "s1o4", w: 78, h: 78, kind: "drum", rolling: true },
        { key: "s1o5", w: 205, h: 60, kind: "gap", low: true },
      ],
    },
    {
      name: "강변도로",
      palette: "#0c2d58",
      backgrounds: ["s2bg"],
      obstacles: [
        { key: "s2o1", w: 78, h: 78, kind: "tire", rolling: true },
        { key: "s2o2", w: 135, h: 78, kind: "cargo" },
        { key: "s2o3", w: 145, h: 72, kind: "bike" },
        { key: "s2o4", w: 180, h: 54, kind: "puddle", low: true },
        { key: "s2o5", w: 220, h: 66, kind: "gap", low: true },
      ],
    },
    {
      name: "산속 은신처",
      palette: "#133844",
      backgrounds: ["s3bg"],
      obstacles: [
        { key: "s3o1", w: 88, h: 88, kind: "boulder", rolling: true },
        { key: "s3o2", w: 165, h: 72, kind: "log" },
        { key: "s3o3", w: 150, h: 64, kind: "thorns" },
        { key: "s3o4", w: 180, h: 54, kind: "mud", low: true },
        { key: "s3o5", w: 230, h: 72, kind: "gap", low: true },
      ],
    },
  ];

  const products = {
    1: {
      name: "RimoMic Lite UC 미니무선마이크세트",
      url: "https://www.callamedia.kr/goods/goods_search.php?adUrl=%2Fgoods%2Fgoods_view.php%3FgoodsNo%3D3500&keyword=Rimo&recentCount=3",
    },
    2: {
      name: "MinBo M2 양방향 지향성 샷건마이크",
      url: "https://www.callamedia.kr/goods/goods_search.php?reSearchKeyword%5B%5D=MinBo&reSearchKey%5B%5D=all&sort=&pageNum=150&reSearch=y&key=goodsNm&keyword=%EC%83%B7%EA%B1%B4%EB%A7%88%EC%9D%B4%ED%81%AC",
    },
    3: {
      name: "고출력 바이컬러 LED 라이트",
      url: "https://www.callamedia.kr/goods/goods_search.php?reSearchKeyword%5B%5D=%EA%B3%A0%EC%B6%9C%EB%A0%A5&reSearchKey%5B%5D=all&sort=&pageNum=150&key=goodsNm&keyword=%EC%B9%BC%EB%9D%BC+0",
    },
    4: {
      name: "파라볼릭 소프트박스",
      url: "https://www.callamedia.kr/goods/goods_search.php?adUrl=%2Fgoods%2Fgoods_view.php%3FgoodsNo%3D3500&keyword=%ED%8C%8C%EB%9D%BC%EB%B3%BC%EB%A6%AD&recentCount=3",
    },
    5: {
      name: "크로마키 배경천(조립식)",
      url: "https://www.callamedia.kr/goods/goods_search.php?adUrl=%2Fgoods%2Fgoods_view.php%3FgoodsNo%3D3500&keyword=CBD-&recentCount=3",
    },
    6: {
      name: "카메라가방(사진영상용 가방)",
      url: "https://www.callamedia.kr/goods/goods_search.php?reSearchKeyword%5B%5D=%EC%B9%B4%EB%A9%94%EB%9D%BC%EA%B0%80%EB%B0%A9&reSearchKey%5B%5D=all&sort=&pageNum=150&reSearch=y&key=goodsNm&keyword=CCB",
    },
    7: {
      name: "HDMI 리피터 광케이블(HDMI 2.0)",
      url: "https://www.callamedia.kr/goods/goods_view.php?goodsNo=3754",
    },
    8: {
      name: "COB타입 LED 라이트",
      url: "https://www.callamedia.kr/goods/goods_search.php?adUrl=%2Fgoods%2Fgoods_view.php%3FgoodsNo%3D3500&keyword=sk-d&recentCount=3",
    },
    9: {
      name: "소카니 X50 RGB LED 라이트",
      url: "https://www.callamedia.kr/goods/goods_search.php?adUrl=%2Fgoods%2Fgoods_view.php%3FgoodsNo%3D3310&keyword=sokani&recentCount=3",
    },
    10: {
      name: "코미카 무선마이크 세트",
      url: "https://www.callamedia.kr/goods/goods_search.php?reSearchKeyword%5B%5D=%EC%BD%94%EB%AF%B8%EC%B9%B4&reSearchKey%5B%5D=all&sort=&pageNum=150&reSearch=y&key=goodsNm&keyword=%EB%AC%B4%EC%84%A0%EB%A7%88%EC%9D%B4%ED%81%AC",
    },
  };

  const manifest = {
    heroVehicle: "hero-vehicle.png",
    thiefVehicle: "thief-vehicle.png",
    s1bg1: "stage 1/bg-1.png",
    s1bg2: "stage 1/bg-2.png",
    s1bg3: "stage 1/bg-3.png",
    s1bg4: "stage 1/bg-4.png",
    s2bg: "stage 2/bg-stage-2-parallax.png",
    s3bg: "stage 3/bg-stage-3-parallax.png",
  };

  for (let stage = 1; stage <= 3; stage += 1) {
    for (let obstacle = 1; obstacle <= 5; obstacle += 1) {
      const filename = stage === 1 ? `obstacle-${obstacle}.png` : `obstacle-${stage}-${obstacle}.png`;
      manifest[`s${stage}o${obstacle}`] = `stage ${stage}/${filename}`;
    }
  }
  for (let product = 1; product <= 10; product += 1) manifest[`product${product}`] = `product/product-${product}.png`;
  for (const group of ["boost", "shield", "dust", "collision", "recovery-sparkle"]) {
    for (let frame = 1; frame <= 6; frame += 1) {
      const n = String(frame).padStart(2, "0");
      manifest[`${group}${frame}`] = `effects/vfx/${group}-${n}.png`;
    }
  }
  for (let frame = 1; frame <= 8; frame += 1) {
    const n = String(frame).padStart(2, "0");
    manifest[`case${frame}`] = `effects/recovery/case-${n}.png`;
  }

  const assets = {};
  let state = "loading";
  let stageIndex = 0;
  let stageElapsed = 0;
  let worldDistance = 0;
  let speed = BASE_SPEED;
  let lives = 3;
  let safeTime = 0;
  let boostReady = false;
  let boostTime = 0;
  let invulnerableTime = 0;
  let screenShake = 0;
  let nextObstacleIn = 1.8;
  let thiefThrowTime = 0;
  let lastTime = performance.now();
  let noticeTimer = 0;
  let recoveryTimer = 0;
  let audioContext = null;
  let selectedProducts = [];
  let recoveredProducts = [];
  let obstacles = [];
  let effects = [];
  let player = createPlayer();
  let renderedLives = -1;
  let renderedGauge = "";

  function createPlayer() {
    const width = IS_MOBILE_PORTRAIT ? 270 : 226;
    const height = Math.round(width / VEHICLE_FRAME_RATIO);
    return { x: IS_MOBILE_PORTRAIT ? 82 : 138, y: GROUND_Y - height, w: width, h: height, vy: 0, jumps: 0, hurt: 0, land: 0 };
  }

  function loadImage(key, source) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = async () => {
        try { await image.decode(); } catch {}
        resolve({ key, image });
      };
      image.onerror = () => resolve({ key, image: null });
      image.src = `${paths.root}${source}?v=${ASSET_VERSION}`;
    });
  }

  function warmObstacleTextures() {
    ctx.save();
    ctx.globalAlpha = .01;
    for (const stage of stages) {
      for (const config of stage.obstacles) {
        const image = assets[config.key];
        if (!image) continue;
        ctx.drawImage(image, 0, 0, config.w * OBSTACLE_VISUAL_SCALE, config.h * OBSTACLE_VISUAL_SCALE);
      }
    }
    ctx.restore();
  }

  async function preload() {
    const entries = Object.entries(manifest);
    let loaded = 0;
    const tasks = entries.map(([key, source]) => loadImage(key, source).then((result) => {
      loaded += 1;
      ui.loadingBar.style.width = `${Math.round((loaded / entries.length) * 100)}%`;
      assets[result.key] = result.image;
    }));
    await Promise.all(tasks);
    if (document.fonts?.ready) await document.fonts.ready;
    warmObstacleTextures();
    state = "menu";
    ui.loadingScreen.classList.remove("is-visible");
    ui.introScreen.classList.add("is-visible");
    prepareProductSlots();
    updateHud();
  }

  function prepareProductSlots() {
    ui.productSlots.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const slot = document.createElement("span");
      slot.className = "product-slot";
      slot.setAttribute("aria-label", `${index + 1}번째 상품 미회수`);
      ui.productSlots.append(slot);
    }
  }

  function chooseProducts() {
    const pool = Object.keys(products).map(Number);
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap], pool[index]];
    }
    return pool.slice(0, 3);
  }

  function resetCampaign() {
    stageIndex = 0;
    lives = 3;
    selectedProducts = chooseProducts();
    recoveredProducts = [];
    prepareProductSlots();
    hideAllScreens();
    beginStage(0);
  }

  function hideAllScreens() {
    for (const screen of [ui.introScreen, ui.stageClearScreen, ui.pauseScreen, ui.gameOverScreen, ui.victoryScreen]) {
      screen.classList.remove("is-visible");
    }
  }

  function beginStage(index) {
    stageIndex = index;
    stageElapsed = 0;
    worldDistance = 0;
    speed = BASE_SPEED;
    safeTime = 0;
    boostReady = false;
    boostTime = 0;
    invulnerableTime = 0;
    nextObstacleIn = 2.8;
    thiefThrowTime = 0;
    obstacles = [];
    effects = [];
    player = createPlayer();
    state = "countdown";
    hideAllScreens();
    updateHud();
    runCountdown();
  }

  function runCountdown() {
    let count = 3;
    ui.countdown.textContent = count;
    ui.countdown.classList.add("is-visible");
    playTone(360, .06, "square", .025);
    const timer = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        ui.countdown.textContent = count;
        playTone(360, .06, "square", .025);
        return;
      }
      if (count === 0) {
        ui.countdown.textContent = "GO!";
        playTone(620, .1, "square", .03);
        return;
      }
      window.clearInterval(timer);
      ui.countdown.classList.remove("is-visible");
      state = "playing";
      lastTime = performance.now();
    }, 650);
  }

  function queueJump() {
    if (state !== "playing" || player.jumps >= 2) return;
    player.jumps += 1;
    player.vy = player.jumps === 1 ? -735 : -655;
    addEffect("dust", player.x + 78, GROUND_Y - 22, 118, .35);
    showNotice(player.jumps === 2 ? "더블점프!" : "점프!");
    playTone(player.jumps === 1 ? 310 : 440, .07, "square", .022);
  }

  function useBoost() {
    if (state !== "playing" || !boostReady) return;
    boostReady = false;
    safeTime = 0;
    boostTime = BOOST_SECONDS;
    invulnerableTime = Math.max(invulnerableTime, BOOST_SECONDS);
    showNotice("부스트 발동! 장애물 무적");
    playTone(720, .22, "sawtooth", .035);
    updateHud();
  }

  function update(dt) {
    if (state !== "playing") return;

    stageElapsed += dt;
    invulnerableTime = Math.max(0, invulnerableTime - dt);
    player.hurt = Math.max(0, player.hurt - dt);
    player.land = Math.max(0, player.land - dt);
    thiefThrowTime = Math.max(0, thiefThrowTime - dt);

    if (boostTime > 0) {
      boostTime = Math.max(0, boostTime - dt);
      if (boostTime === 0) showNotice("부스트 종료");
    } else if (!boostReady) {
      safeTime = Math.min(BOOST_CHARGE_SECONDS, safeTime + dt);
      if (safeTime >= BOOST_CHARGE_SECONDS) {
        boostReady = true;
        showNotice("부스트 준비 완료!");
        playTone(860, .12, "square", .026);
      }
    }

    if (boostTime <= 0) speed = Math.min(MAX_SPEED, speed + SPEED_ACCELERATION * dt);
    const worldSpeed = boostTime > 0 ? BOOST_SPEED : speed;
    worldDistance += worldSpeed * dt;

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y - player.h) {
      if (player.vy > 250) {
        player.land = .16;
        addEffect("dust", player.x + 100, GROUND_Y - 15, 145, .38);
      }
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.jumps = 0;
    }

    nextObstacleIn -= dt;
    if (nextObstacleIn <= 0 && stageElapsed < STAGE_SECONDS - 2.3) spawnObstacle();

    for (const obstacle of obstacles) {
      obstacle.x -= worldSpeed * dt;
      if (obstacle.rolling) obstacle.angle -= dt * (worldSpeed / 55);
      if (obstacle.airborne) {
        obstacle.airPhase += dt * 5;
        obstacle.y = obstacle.baseY + Math.sin(obstacle.airPhase) * 20;
        obstacle.angle -= dt * 3.2;
      }
      if (!obstacle.hit && intersects(playerHitbox(), obstacleHitbox(obstacle))) collide(obstacle);
    }
    obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.w > -80 && !obstacle.destroyed);

    for (const effect of effects) effect.age += dt;
    effects = effects.filter((effect) => effect.age < effect.duration);

    if (boostTime > 0 && Math.random() < dt * 16) addEffect("boost", player.x - 12, player.y + 52, 145, .35);

    if (stageElapsed >= STAGE_SECONDS) completeStage();
    updateHud();
  }

  function spawnObstacle() {
    const options = stages[stageIndex].obstacles;
    const config = options[Math.floor(Math.random() * options.length)];
    const airborne = Boolean(config.airborne && Math.random() < .48);
    const obstacle = {
      ...config,
      x: W + 30,
      y: airborne ? GROUND_Y - config.h - 105 : GROUND_Y - config.h,
      baseY: airborne ? GROUND_Y - config.h - 105 : GROUND_Y - config.h,
      airborne,
      airPhase: Math.random() * Math.PI,
      angle: 0,
      hit: false,
      destroyed: false,
    };
    obstacles.push(obstacle);
    const accelerationRatio = (speed - BASE_SPEED) / Math.max(1, MAX_SPEED - BASE_SPEED);
    nextObstacleIn = Math.max(1.8, 2.65 - accelerationRatio * .5) + Math.random() * .75;
    thiefThrowTime = .7;
  }

  function playerHitbox() {
    return {
      x: player.x + player.w * .19,
      y: player.y + player.h * .32,
      w: player.w * .62,
      h: player.h * .53,
    };
  }

  function obstacleHitbox(obstacle) {
    const insetX = obstacle.low ? 13 : 9;
    const insetY = obstacle.low ? 10 : 7;
    return { x: obstacle.x + insetX, y: obstacle.y + insetY, w: obstacle.w - insetX * 2, h: obstacle.h - insetY };
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function collide(obstacle) {
    obstacle.hit = true;
    if (boostTime > 0) {
      obstacle.destroyed = true;
      addEffect("collision", obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, 165, .48);
      playTone(560, .055, "square", .018);
      return;
    }
    if (invulnerableTime > 0) return;
    lives -= 1;
    invulnerableTime = 1.8;
    player.hurt = .5;
    screenShake = .36;
    speed = CRASH_SPEED;
    safeTime = 0;
    boostReady = false;
    addEffect("collision", player.x + player.w - 25, player.y + 35, 175, .55);
    showNotice(`충돌! 생명 ${lives}개`);
    playTone(120, .18, "sawtooth", .04);
    if (lives <= 0) endGame();
  }

  function addEffect(type, x, y, size, duration) {
    effects.push({ type, x, y, size, duration, age: 0 });
  }

  function showNotice(message) {
    ui.notice.textContent = message;
    ui.notice.classList.add("is-visible");
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => ui.notice.classList.remove("is-visible"), 850);
  }

  function completeStage() {
    if (state !== "playing") return;
    state = "stage-clear";
    obstacles = [];
    boostTime = 0;
    const productNumber = selectedProducts[stageIndex];
    const product = products[productNumber];
    recoveredProducts.push(productNumber);
    ui.clearStageLabel.textContent = `스테이지 ${stageIndex + 1}`;
    ui.recoveryCount.textContent = `상품 회수 ${recoveredProducts.length} / 3`;
    ui.recoveredProduct.src = `${paths.products}product-${productNumber}.png`;
    ui.recoveredProduct.alt = product.name;
    ui.recoveredProduct.classList.remove("is-visible");
    ui.recoveredProductName.textContent = product.name;
    ui.productLink.href = product.url;
    ui.productLink.setAttribute("aria-label", `${product.name} 상품 페이지 새 창에서 열기`);
    ui.nextStageButton.textContent = stageIndex === 2 ? "탈환 결과 보기" : "다음 추격";
    ui.nextStageButton.disabled = true;
    ui.recoveryCase.src = `${paths.recovery}case-01.png`;
    ui.stageClearScreen.classList.add("is-visible");
    updateProductSlots();
    animateRecovery();
    playTone(680, .12, "square", .03);
  }

  function animateRecovery() {
    window.clearInterval(recoveryTimer);
    let frame = 1;
    recoveryTimer = window.setInterval(() => {
      frame += 1;
      ui.recoveryCase.src = `${paths.recovery}case-${String(Math.min(frame, 8)).padStart(2, "0")}.png`;
      if (frame === 6) {
        ui.recoveredProduct.classList.add("is-visible");
        playTone(930, .16, "square", .025);
      }
      if (frame >= 8) {
        window.clearInterval(recoveryTimer);
        ui.nextStageButton.disabled = false;
      }
    }, 125);
  }

  function updateProductSlots() {
    [...ui.productSlots.children].forEach((slot, index) => {
      slot.replaceChildren();
      if (index < recoveredProducts.length) {
        slot.classList.add("is-filled");
        const image = document.createElement("img");
        image.src = `${paths.products}product-${recoveredProducts[index]}.png`;
        image.alt = `${index + 1}번째 회수 상품`;
        slot.append(image);
        slot.setAttribute("aria-label", `${index + 1}번째 상품 회수 완료`);
      } else {
        slot.classList.remove("is-filled");
        slot.setAttribute("aria-label", `${index + 1}번째 상품 미회수`);
      }
    });
  }

  function endGame() {
    if (state === "game-over") return;
    state = "game-over";
    ui.failedRecovered.textContent = recoveredProducts.length;
    ui.gameOverScreen.classList.add("is-visible");
    ui.hud.style.opacity = "0";
    playTone(105, .4, "sawtooth", .035);
  }

  function showVictory() {
    state = "victory";
    ui.stageClearScreen.classList.remove("is-visible");
    ui.victoryProducts.replaceChildren();
    for (const productNumber of recoveredProducts) {
      const image = document.createElement("img");
      image.src = `${paths.products}product-${productNumber}.png`;
      image.alt = `회수한 상품 ${productNumber}`;
      ui.victoryProducts.append(image);
    }
    ui.victoryScreen.classList.add("is-visible");
    ui.hud.style.opacity = "0";
    playWinJingle();
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      ui.pauseScreen.classList.add("is-visible");
    } else if (state === "paused") {
      state = "playing";
      ui.pauseScreen.classList.remove("is-visible");
      lastTime = performance.now();
    }
  }

  function updateHud() {
    ui.hud.style.opacity = ["playing", "paused", "countdown", "stage-clear"].includes(state) ? "1" : "0";
    ui.stageNumber.textContent = `STAGE ${stageIndex + 1}`;
    ui.stageName.textContent = stages[stageIndex].name;
    ui.stageProgress.style.width = `${Math.min(100, (stageElapsed / STAGE_SECONDS) * 100)}%`;
    ui.timeLeft.textContent = String(Math.max(0, Math.ceil(STAGE_SECONDS - stageElapsed)));
    if (renderedLives !== lives) {
      renderedLives = lives;
      ui.lives.replaceChildren();
      for (let index = 0; index < 3; index += 1) {
        const image = document.createElement("img");
        image.src = `${paths.ui}${index < lives ? "heart-full" : "heart-empty"}.png`;
        image.alt = "";
        ui.lives.append(image);
      }
      ui.lives.setAttribute("aria-label", `남은 생명 ${lives}개`);
    }

    let gauge = "boost-gauge-empty";
    if (boostReady || boostTime > 0) gauge = "boost-gauge-ready";
    else if (safeTime > 0) gauge = "boost-gauge-charging";
    if (gauge !== renderedGauge) {
      renderedGauge = gauge;
      ui.boostGauge.src = `${paths.ui}${gauge}.png`;
    }
    if (boostTime > 0) ui.boostLabel.textContent = `부스트 ${boostTime.toFixed(1)}초`;
    else if (boostReady) ui.boostLabel.textContent = "사용 가능!";
    else ui.boostLabel.textContent = `${safeTime.toFixed(1)} / 10초`;
    ui.boostStatus.classList.toggle("is-ready", boostReady);
    ui.boostButton.disabled = !boostReady || state !== "playing";
    ui.boostButton.classList.toggle("is-ready", boostReady && state === "playing");
  }

  function draw() {
    ctx.save();
    if (screenShake > 0 && state === "playing") {
      screenShake = Math.max(0, screenShake - 1 / 60);
      ctx.translate((Math.random() - .5) * 12, (Math.random() - .5) * 8);
    }
    drawBackground();
    drawSpeedLines();
    drawThief();
    drawObstacles();
    drawEffects();
    drawPlayer();
    drawSpeedReadout();
    ctx.restore();
  }

  function drawBackground() {
    ctx.fillStyle = stages[stageIndex].palette;
    ctx.fillRect(0, 0, W, H);
    if (stageIndex === 0) {
      drawRepeating(assets.s1bg1, worldDistance * .1);
      drawRepeating(assets.s1bg2, worldDistance * .3);
      drawRepeating(assets.s1bg3, worldDistance * .62);
      drawRepeating(assets.s1bg4, worldDistance * 1.18);
    } else if (stageIndex === 1) {
      drawBandedParallax(assets.s2bg, [0, .45, .59, .8, 1], [.1, .28, .62, 1.12]);
    } else {
      drawBandedParallax(assets.s3bg, [0, .34, .46, .76, 1], [.08, .22, .55, 1.08]);
    }
    const roadShade = ctx.createLinearGradient(0, GROUND_Y - 90, 0, H);
    roadShade.addColorStop(0, "#06132900");
    roadShade.addColorStop(1, "#02071188");
    ctx.fillStyle = roadShade;
    ctx.fillRect(0, GROUND_Y - 90, W, H - GROUND_Y + 90);
  }

  function drawRepeating(image, offset) {
    if (!image) return;
    const drawHeight = H;
    const drawWidth = image.width * (drawHeight / image.height);
    const wrapped = ((offset % drawWidth) + drawWidth) % drawWidth;
    for (let x = -wrapped; x < W + drawWidth; x += drawWidth) ctx.drawImage(image, x, 0, drawWidth, drawHeight);
  }

  function drawBandedParallax(image, boundaries, speeds) {
    if (!image) return;
    const drawHeight = H;
    const drawWidth = image.width * (drawHeight / image.height);
    for (let index = 0; index < speeds.length; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      const sourceY = Math.round(image.height * start);
      const sourceHeight = Math.max(1, Math.round(image.height * end) - sourceY);
      const destinationY = Math.round(drawHeight * start);
      const destinationHeight = Math.max(1, Math.round(drawHeight * end) - destinationY + 1);
      const offset = worldDistance * speeds[index];
      const wrapped = ((offset % drawWidth) + drawWidth) % drawWidth;
      for (let x = -wrapped; x < W + drawWidth; x += drawWidth) {
        ctx.drawImage(
          image,
          0,
          sourceY,
          image.width,
          sourceHeight,
          x,
          destinationY,
          drawWidth,
          destinationHeight,
        );
      }
    }
  }

  function drawSpeedLines() {
    const boosting = boostTime > 0;
    const intensity = boosting ? 1 : .35 + ((speed - CRASH_SPEED) / (MAX_SPEED - CRASH_SPEED)) * .35;
    const count = boosting ? 20 : 12;
    ctx.fillStyle = boosting ? "#25def1aa" : `rgba(216, 239, 255, ${Math.max(.12, intensity * .32)})`;
    const lineTop = 108;
    const lineRange = Math.max(240, GROUND_Y - lineTop - 18);
    for (let index = 0; index < count; index += 1) {
      const y = lineTop + ((index * 43 + worldDistance * (boosting ? 1.25 : .72)) % lineRange);
      const length = (boosting ? 105 : 48) + (index % 5) * (boosting ? 36 : 19);
      const x = W - ((worldDistance * (boosting ? 3.1 : 1.75) + index * 137) % (W + 300));
      ctx.fillRect(x, y, length, boosting ? 6 : 3);
    }
  }

  function drawPlayer() {
    const row = player.hurt > 0 ? 5 : boostTime > 0 ? 2 : player.jumps > 0 ? (player.jumps === 2 ? 4 : 3) : 0;
    const column = Math.floor(worldDistance / (boostTime > 0 ? 32 : 44)) % 8;
    const flicker = invulnerableTime > 0 && boostTime <= 0 && Math.floor(invulnerableTime * 14) % 2 === 0;
    if (!flicker) drawSheetFrame(assets.heroVehicle, 8, 6, column, row, player.x, player.y, player.w, player.h);
    if (boostTime > 0) {
      const frame = (Math.floor((BOOST_SECONDS - boostTime) * 12) % 6) + 1;
      const shield = assets[`shield${frame}`];
      const shieldSize = IS_MOBILE_PORTRAIT ? 250 : 220;
      if (shield) ctx.drawImage(shield, player.x + player.w / 2 - shieldSize / 2, player.y + player.h / 2 - shieldSize / 2, shieldSize, shieldSize);
    }
  }

  function drawThief() {
    const row = thiefThrowTime > 0 ? 3 : boostTime > 0 ? 1 : 0;
    const column = Math.floor(worldDistance / 48) % 8;
    if (IS_MOBILE_PORTRAIT) {
      const chaseSpeed = boostTime > 0 ? BOOST_SPEED : speed;
      const retreat = Math.max(0, Math.min(55, ((chaseSpeed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)) * 55));
      const width = 240;
      const height = Math.round(width / VEHICLE_FRAME_RATIO);
      drawSheetFrame(assets.thiefVehicle, 8, 6, column, row, W - 300 - retreat, GROUND_Y - height, width, height);
      return;
    }
    const width = 202;
    const height = Math.round(width / VEHICLE_FRAME_RATIO);
    const drawX = Math.max(885, Math.min(1070, 1005 + (BASE_SPEED - (boostTime > 0 ? 1180 : speed)) * .28));
    drawSheetFrame(assets.thiefVehicle, 8, 6, column, row, drawX, GROUND_Y - height, width, height);
  }

  function drawSheetFrame(image, columns, rows, column, row, x, y, width, height) {
    if (!image) return;
    const sw = image.width / columns;
    const sh = image.height / rows;
    ctx.drawImage(image, column * sw, row * sh, sw, sh, x, y, width, height);
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      const image = assets[obstacle.key];
      if (!image) continue;
      ctx.save();
      ctx.translate(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2);
      if (obstacle.rolling || obstacle.airborne) ctx.rotate(obstacle.angle);
      ctx.scale(OBSTACLE_VISUAL_SCALE, OBSTACLE_VISUAL_SCALE);
      ctx.drawImage(image, -obstacle.w / 2, -obstacle.h / 2, obstacle.w, obstacle.h);
      ctx.restore();
    }
  }

  function drawEffects() {
    for (const effect of effects) {
      const progress = Math.min(.999, effect.age / effect.duration);
      const frame = Math.min(6, Math.floor(progress * 6) + 1);
      const image = assets[`${effect.type}${frame}`];
      if (!image) continue;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, progress - .76) / .24);
      ctx.drawImage(image, effect.x - effect.size / 2, effect.y - effect.size / 2, effect.size, effect.size);
      ctx.globalAlpha = 1;
    }
  }

  function drawSpeedReadout() {
    if (!["playing", "paused", "countdown"].includes(state)) return;
    const displayFactor = IS_MOBILE_PORTRAIT ? .25 : .22;
    const kmh = Math.round((boostTime > 0 ? BOOST_SPEED : speed) * displayFactor);
    const panel = IS_COMPACT_VIEW
      ? { x: 18, y: H - 58, width: 178, height: 37, textX: 31, textY: H - 32 }
      : { x: 18, y: H - 70, width: 218, height: 49, textX: 35, textY: H - 38 };
    ctx.fillStyle = "#06152ddd";
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.strokeStyle = "#476c92";
    ctx.lineWidth = 3;
    ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
    ctx.fillStyle = boostTime > 0 ? "#25def1" : "#ffd43d";
    ctx.font = '22px "DOSGothic", monospace';
    ctx.fillText(`속도 ${kmh} KM/H`, panel.textX, panel.textY);
  }

  function playTone(frequency, duration, type = "square", volume = .025) {
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) {
      // Audio is optional; gameplay remains fully functional when unavailable.
    }
  }

  function playWinJingle() {
    [520, 660, 780, 1040].forEach((tone, index) => window.setTimeout(() => playTone(tone, .15, "square", .024), index * 125));
  }

  function loop(now) {
    const dt = Math.min(.034, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    draw();
    window.requestAnimationFrame(loop);
  }

  ui.startButton.addEventListener("click", () => { playTone(460, .07); resetCampaign(); });
  ui.nextStageButton.addEventListener("click", () => stageIndex === 2 ? showVictory() : beginStage(stageIndex + 1));
  ui.retryButton.addEventListener("click", resetCampaign);
  ui.victoryRetryButton.addEventListener("click", resetCampaign);
  ui.pauseButton.addEventListener("click", togglePause);
  ui.resumeButton.addEventListener("click", togglePause);
  ui.restartButton.addEventListener("click", resetCampaign);
  ui.jumpButton.addEventListener("pointerdown", (event) => { event.preventDefault(); queueJump(); });
  ui.boostButton.addEventListener("pointerdown", (event) => { event.preventDefault(); useBoost(); });

  window.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) queueJump();
    }
    if (["KeyB", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) useBoost();
    }
    if (["KeyP", "Escape"].includes(event.code) && !event.repeat) togglePause();
    if (event.code === "Enter" && state === "menu") resetCampaign();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") togglePause();
  });

  portraitQuery.addEventListener("change", () => window.location.reload());

  window.requestAnimationFrame(loop);
  preload();
})();
