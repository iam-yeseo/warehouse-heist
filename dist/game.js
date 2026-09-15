(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const portraitQuery = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
  const compactQuery = window.matchMedia("(max-width: 820px), (max-height: 560px)");
  let IS_MOBILE_PORTRAIT = portraitQuery.matches;
  let IS_COMPACT_VIEW = compactQuery.matches;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const ui = {
    hud: document.querySelector("#hud"),
    stageNumber: document.querySelector("#stageNumber"),
    stageName: document.querySelector("#stageName"),
    lives: document.querySelector("#lives"),
    stageProgress: document.querySelector("#stageProgress"),
    timeLeft: document.querySelector("#timeLeft"),
    mobileSpeed: document.querySelector("#mobileSpeed"),
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

  let W = 1280;
  let H = 720;
  let GROUND_Y = 605;
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
  const ASSET_VERSION = "1.6.0";
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
        { key: "s1o5", w: 500, h: 150, kind: "manhole", terrain: true, surfaceStart: .35, surfaceEnd: .65 },
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
        { key: "s2o4", w: 520, h: 160, kind: "puddle", terrain: true, surfaceStart: .12, surfaceEnd: .88 },
        { key: "s2o5", w: 680, h: 190, kind: "gap", terrain: true, surfaceStart: .35, surfaceEnd: .65 },
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
        { key: "s3o4", w: 560, h: 170, kind: "mud", terrain: true, surfaceStart: .12, surfaceEnd: .88 },
        { key: "s3o5", w: 700, h: 200, kind: "gap", terrain: true, surfaceStart: .35, surfaceEnd: .65 },
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
    heroVehicle: "hero-vehicle.webp",
    thiefVehicle: "thief-vehicle.webp",
    s1bg1: "stage-1/bg-1.webp",
    s1bg2: "stage-1/bg-2.webp",
    s1bg3: "stage-1/bg-3.webp",
    s1bg4: "stage-1/bg-4.webp",
    s2bg: "stage-2/bg-stage-2-parallax.webp",
    s3bg: "stage-3/bg-stage-3-parallax.webp",
  };

  for (let stage = 1; stage <= 3; stage += 1) {
    for (let obstacle = 1; obstacle <= 5; obstacle += 1) {
      const filename = stage === 1 ? `obstacle-${obstacle}.webp` : `obstacle-${stage}-${obstacle}.webp`;
      manifest[`s${stage}o${obstacle}`] = `stage-${stage}/${filename}`;
    }
  }

  for (const group of ["boost", "shield", "dust", "collision"]) {
    for (let frame = 1; frame <= 6; frame += 1) {
      const n = String(frame).padStart(2, "0");
      manifest[`${group}${frame}`] = `effects/vfx/${group}-${n}.webp`;
    }
  }

  const assets = {};
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem("heist-record") || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return {
        muted: value.muted === true,
        maxRecovered: Math.max(0, Math.min(3, Number(value.maxRecovered) || 0)),
        completed: value.completed === true,
        bestSeconds: Number.isFinite(value.bestSeconds) && value.bestSeconds > 0 ? value.bestSeconds : undefined,
      };
    } catch { return {}; }
  }
  let record = readSaved();
  let muted = record.muted === true;
  let campaignElapsed = 0;
  const track = (event, parameters = {}) => window.heistTrack?.(event, parameters);
  const productCopy = ["", "가볍게 챙기는 무선 녹음 장비", "양방향 지향성으로 담는 현장의 소리", "촬영 공간을 밝히는 바이컬러 조명", "부드러운 빛을 만드는 촬영 액세서리", "다양한 장면을 위한 크로마키 배경", "촬영 장비를 담아 함께 떠나는 가방", "HDMI 2.0 신호를 전하는 광케이블", "촬영을 위한 COB LED 조명", "RGB 컬러로 연출하는 촬영 조명", "자유롭게 움직이며 녹음하는 무선마이크"];
  function saveRecord(completed = false) {
    record.maxRecovered = Math.max(Number(record.maxRecovered) || 0, recoveredProducts.length);
    if (completed) {
      record.completed = true;
      record.bestSeconds = Math.min(Number(record.bestSeconds) || Infinity, campaignElapsed);
    }
    record.muted = muted;
    try { localStorage.setItem("heist-record", JSON.stringify(record)); } catch {}
    document.querySelector("#recordSummary").textContent = record.completed
      ? `탈환 성공 기록 · 최고 ${Number(record.bestSeconds).toFixed(1)}초`
      : record.maxRecovered ? `지난번 ${record.maxRecovered}/3개 회수! 이번엔 끝까지 달려보세요.` : "";
  }
  function productUrl(id, placement, stage = recoveredProducts.indexOf(id) + 1) {
    const url = new URL(products[id].url);
    for (const [key, value] of Object.entries({utm_source:"heist", utm_medium:"game", utm_campaign:"warehouse", utm_content:`${placement}_stage${stage}`})) url.searchParams.set(key, value);
    return url.href;
  }
  function bindProductLink(link, id, placement, stage) {
    link.href = productUrl(id, placement, stage);
    link.dataset.productId = id;
    link.dataset.stage = stage;
    link.dataset.placement = placement;
  }
  function renderProductCards(container, ids, placement) {
    container.replaceChildren();
    for (const id of ids) {
      const link = document.createElement("a");
      link.className = "product-card";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      bindProductLink(link, id, placement, recoveredProducts.indexOf(id) + 1);
      const image = document.createElement("img");
      image.src = `${paths.products}product-${id}.webp`;
      image.alt = products[id].name;
      const name = document.createElement("strong");
      name.textContent = products[id].name;
      const action = document.createElement("span");
      action.textContent = "상품 보러가기 ↗";
      link.append(image, name, action);
      container.append(link);
    }
  }
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
  let spawnedHazards = 0;
  let surfaceKind = "";
  let effects = [];
  let player = createPlayer();
  let renderedLives = -1;
  let renderedGauge = "";

  function createPlayer() {
    const width = IS_MOBILE_PORTRAIT ? 180 : 226;
    const height = Math.round(width / VEHICLE_FRAME_RATIO);
    return { x: IS_MOBILE_PORTRAIT ? 45 : 138, y: GROUND_Y - height, w: width, h: height, vy: 0, jumps: 0, hurt: 0, land: 0, fallTime: 0 };
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

  const pendingAssets = new Map();
  function ensureAsset(key) {
    if (assets[key]) return Promise.resolve();
    if (!pendingAssets.has(key)) pendingAssets.set(key, loadImage(key, manifest[key]).then(result => {
      if (!result.image) throw new Error(`Asset unavailable: ${key}`);
      assets[key] = result.image;
    }).finally(() => pendingAssets.delete(key)));
    return pendingAssets.get(key);
  }
  function ensureStage(index) {
    return Promise.all(Object.keys(manifest).filter(key => key.startsWith(`s${index + 1}`)).map(ensureAsset));
  }
  async function preload() {
    const started = performance.now();
    const entries = Object.keys(manifest).filter(key => !/^s[23]/.test(key));
    let loaded = 0;
    document.querySelector("#loadingRetry").hidden = true;
    const results = await Promise.allSettled(entries.map(key => ensureAsset(key).then(() => {
      loaded += 1;
      ui.loadingBar.style.width = `${Math.round(loaded / entries.length * 100)}%`;
      document.querySelector("#loadingCount").textContent = `${loaded} / ${entries.length}`;
    })));
    if (results.some(result => result.status === "rejected")) {
      document.querySelector("#loadingCount").textContent = "일부 이미지를 받지 못했어요. 다시 시도해 주세요.";
      document.querySelector("#loadingRetry").hidden = false;
      return;
    }
    if (document.fonts?.ready) await document.fonts.ready;
    warmObstacleTextures();
    state = "menu";
    ui.loadingScreen.classList.remove("is-visible");
    ui.introScreen.classList.add("is-visible");
    prepareProductSlots();
    updateHud();
    track("game_load", {loading_ms: Math.round(performance.now() - started)});
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
    if (["loading", "stage-loading", "countdown"].includes(state)) return;
    campaignElapsed = 0;
    track("game_start", {device: matchMedia("(pointer: coarse)").matches ? "touch" : "desktop", orientation: portraitQuery.matches ? "portrait" : "landscape"});
    ensureStage(1).then(() => ensureStage(2)).catch(() => {});
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

  async function beginStage(index) {
    if (state === "stage-loading") return;
    state = "stage-loading";
    ui.nextStageButton.disabled = true;
    try { await ensureStage(index); } catch {
      state = "stage-clear";
      ui.nextStageButton.disabled = false;
      showNotice("도로를 불러오지 못했어요. 다시 눌러 주세요.");
      return;
    }
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
    spawnedHazards = 0;
    surfaceKind = "";
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
      if (document.hidden) return;
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
    if (state !== "playing" || player.jumps >= 2 || player.fallTime > 0) return;
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
    campaignElapsed += dt;
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
    surfaceKind = "";
    const surface = obstacles.find(obstacle => obstacle.terrain && ["mud", "puddle"].includes(obstacle.kind) && touchesTerrain(obstacle));
    if (surface && boostTime <= 0 && player.fallTime <= 0) {
      surfaceKind = surface.kind;
      if (!surface.hit) {
        surface.hit = true;
        showNotice(surface.kind === "mud" ? "진흙길! 점프로 빠져나오세요" : "물웅덩이! 속도가 줄어들어요");
      }
    }
    const terrainDrag = surfaceKind === "mud" ? .52 : surfaceKind === "puddle" ? .72 : 1;
    const worldSpeed = boostTime > 0 ? BOOST_SPEED : speed * terrainDrag;
    worldDistance += worldSpeed * dt;

    if (player.fallTime > 0) {
      player.fallTime = Math.max(0, player.fallTime - dt);
      if (player.fallTime === 0) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.jumps = 0;
      }
    }
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.fallTime <= 0 && player.y >= GROUND_Y - player.h) {
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
      if (obstacle.terrain) {
        if (["gap", "manhole"].includes(obstacle.kind) && !obstacle.hit && touchesTerrain(obstacle)) collide(obstacle);
      } else if (!obstacle.hit && intersects(playerHitbox(), obstacleHitbox(obstacle))) collide(obstacle);
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
    // Alternate props and road sections so every stage visibly contains its terrain.
    const terrain = options.filter(option => option.terrain);
    const props = options.filter(option => !option.terrain);
    const isRoadSection = spawnedHazards % 2 === 1;
    const config = isRoadSection ? terrain[Math.floor(spawnedHazards / 2) % terrain.length] : props[Math.floor(Math.random() * props.length)];
    spawnedHazards += 1;
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
    if (config.terrain) nextObstacleIn += config.w / Math.max(CRASH_SPEED, speed);
    thiefThrowTime = config.terrain ? 0 : .7;
  }

  function terrainBounds(obstacle) {
    return {left: obstacle.x + obstacle.w * obstacle.surfaceStart, right: obstacle.x + obstacle.w * obstacle.surfaceEnd};
  }

  function touchesTerrain(obstacle) {
    const {left, right} = terrainBounds(obstacle);
    const wheelContact = player.x + player.w * .5;
    return wheelContact > left && wheelContact < right && player.y + player.h >= GROUND_Y - 12 && player.fallTime <= 0;
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
      if (obstacle.terrain) return;
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
    if (obstacle.terrain) {
      player.fallTime = .48;
      player.vy = 180;
      showNotice(`도로 이탈! 생명 ${lives}개`);
    } else showNotice(`충돌! 생명 ${lives}개`);
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
    window.clearTimeout(noticeTimer);
    ui.notice.classList.remove("is-visible");
    obstacles = [];
    boostTime = 0;
    const productNumber = selectedProducts[stageIndex];
    const product = products[productNumber];
    recoveredProducts.push(productNumber);
    ui.clearStageLabel.textContent = `스테이지 ${stageIndex + 1}`;
    ui.recoveryCount.textContent = `상품 회수 ${recoveredProducts.length} / 3`;
    ui.recoveredProduct.src = `${paths.products}product-${productNumber}.webp`;
    ui.recoveredProduct.alt = product.name;
    ui.recoveredProduct.classList.remove("is-visible");
    ui.recoveredProductName.textContent = product.name;
    bindProductLink(ui.productLink, productNumber, "recovery", stageIndex + 1);
    bindProductLink(document.querySelector("#productImageLink"), productNumber, "recovery_image", stageIndex + 1);
    document.querySelector("#recoveredProductCopy").textContent = productCopy[productNumber];
    saveRecord();
    track("stage_clear", {stage:stageIndex + 1, time_left:Math.max(0, STAGE_SECONDS - stageElapsed), hearts:lives});
    ui.productLink.setAttribute("aria-label", `${product.name} 상품 페이지 새 창에서 열기`);
    ui.nextStageButton.textContent = stageIndex === 2 ? "탈환 결과 보기" : "다음 추격";
    ui.nextStageButton.disabled = true;
    ui.recoveryCase.src = `${paths.recovery}case-01.webp`;
    ui.stageClearScreen.classList.add("is-visible");
    updateProductSlots();
    updateHud();
    animateRecovery();
    playTone(680, .12, "square", .03);
  }

  function animateRecovery() {
    window.clearInterval(recoveryTimer);
    let frame = 1;
    recoveryTimer = window.setInterval(() => {
      frame += 1;
      ui.recoveryCase.src = `${paths.recovery}case-${String(Math.min(frame, 8)).padStart(2, "0")}.webp`;
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
        image.src = `${paths.products}product-${recoveredProducts[index]}.webp`;
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
    window.clearTimeout(noticeTimer);
    ui.notice.classList.remove("is-visible");
    saveRecord();
    track("game_over", {stage:stageIndex + 1, recovered_count:recoveredProducts.length});
    renderProductCards(document.querySelector("#failedProducts"), recoveredProducts, "failure");
    updateHud();
    ui.failedRecovered.textContent = recoveredProducts.length;
    ui.gameOverScreen.classList.add("is-visible");
    ui.hud.style.opacity = "0";
    playTone(105, .4, "sawtooth", .035);
  }

  function showVictory() {
    state = "victory";
    ui.stageClearScreen.classList.remove("is-visible");
    renderProductCards(ui.victoryProducts, recoveredProducts, "complete");
    saveRecord(true);
    track("game_complete", {total_seconds:Number(campaignElapsed.toFixed(2))});
    updateHud();
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
    const active = ["playing", "paused", "countdown"].includes(state);
    document.querySelector("#gameFrame").dataset.state = state;
    ui.hud.style.opacity = active ? "1" : "0";
    ui.hud.inert = !active;
    document.querySelector(".mobile-actions").inert = state !== "playing";
    ui.stageNumber.textContent = `STAGE ${stageIndex + 1}`;
    ui.stageName.textContent = stages[stageIndex].name;
    ui.stageProgress.style.width = `${Math.min(100, (stageElapsed / STAGE_SECONDS) * 100)}%`;
    ui.timeLeft.textContent = String(Math.max(0, Math.ceil(STAGE_SECONDS - stageElapsed)));
    if (renderedLives !== lives) {
      renderedLives = lives;
      ui.lives.replaceChildren();
      for (let index = 0; index < 3; index += 1) {
        const image = document.createElement("img");
        image.src = `${paths.ui}${index < lives ? "heart-full" : "heart-empty"}.webp`;
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
      ui.boostGauge.src = `${paths.ui}${gauge}.webp`;
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
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    if (!reducedMotion.matches && screenShake > 0 && state === "playing") {
      screenShake = Math.max(0, screenShake - 1 / 60);
      ctx.translate((Math.random() - .5) * 12, (Math.random() - .5) * 8);
    }
    drawBackground();
    drawTerrain();
    if (!reducedMotion.matches) drawSpeedLines();
    drawThief();
    drawObstacles();
    if (!reducedMotion.matches) drawEffects();
    drawPlayer();
    drawSpeedReadout();
    ctx.restore();
  }

  function drawBackground() {
    ctx.fillStyle = stages[stageIndex].palette;
    ctx.fillRect(0, 0, W, H);
    const backdrop = backgroundLayout();
    const sky = assets[stages[stageIndex].backgrounds[0]];
    if (sky && backdrop.top > 0) {
      ctx.drawImage(sky, 0, 0, sky.width, 1, 0, 0, W, Math.ceil(backdrop.top) + 1);
      const roadBottom = Math.floor(backdrop.top + backdrop.height);
      ctx.drawImage(sky, 0, sky.height - 1, sky.width, 1, 0, roadBottom - 1, W, H - roadBottom + 1);
    }
    if (stageIndex === 0) {
      drawRepeating(assets.s1bg1, worldDistance * .1);
      drawRepeating(assets.s1bg2, worldDistance * .3);
      drawRepeating(assets.s1bg3, worldDistance * .62);
      drawRepeating(assets.s1bg4, worldDistance);
    } else if (stageIndex === 1) {
      drawBandedParallax(assets.s2bg, [0, .45, .59, .8, 1], [.1, .28, .62, 1]);
    } else {
      drawBandedParallax(assets.s3bg, [0, .34, .46, .76, 1], [.08, .22, .55, 1]);
    }
    const roadShade = ctx.createLinearGradient(0, GROUND_Y - 90, 0, H);
    roadShade.addColorStop(0, "#06132900");
    roadShade.addColorStop(1, "#02071188");
    ctx.fillStyle = roadShade;
    ctx.fillRect(0, GROUND_Y - 90, W, H - GROUND_Y + 90);
  }

  function backgroundLayout() {
    // Scale scenery around the road, independently of vehicles and collision geometry.
    const height = IS_MOBILE_PORTRAIT ? Math.min(H, 900) : H;
    return { height, top: GROUND_Y * (1 - height / H) };
  }

  function drawRepeating(image, offset) {
    if (!image) return;
    const { height: drawHeight, top } = backgroundLayout();
    const drawWidth = image.width * (drawHeight / image.height);
    const wrapped = ((offset % drawWidth) + drawWidth) % drawWidth;
    for (let x = -wrapped; x < W + drawWidth; x += drawWidth) ctx.drawImage(image, x, top, drawWidth, drawHeight);
  }

  function drawBandedParallax(image, boundaries, speeds) {
    if (!image) return;
    const { height: drawHeight, top } = backgroundLayout();
    const drawWidth = image.width * (drawHeight / image.height);
    for (let index = 0; index < speeds.length; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      const sourceY = Math.round(image.height * start);
      const sourceHeight = Math.max(1, Math.round(image.height * end) - sourceY);
      const destinationY = Math.round(top + drawHeight * start);
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
    const flicker = !reducedMotion.matches && invulnerableTime > 0 && boostTime <= 0 && Math.floor(invulnerableTime * 14) % 2 === 0;
    if (!flicker) drawSheetFrame(assets.heroVehicle, 8, 6, column, row, player.x, player.y, player.w, player.h);
    if (boostTime > 0) {
      const frame = (Math.floor((BOOST_SECONDS - boostTime) * 12) % 6) + 1;
      const shield = assets[`shield${frame}`];
      const shieldSize = IS_MOBILE_PORTRAIT ? player.w + 20 : 220;
      if (shield) ctx.drawImage(shield, player.x + player.w / 2 - shieldSize / 2, player.y + player.h / 2 - shieldSize / 2, shieldSize, shieldSize);
    }
  }

  function thiefJumpHeight(x, width) {
    const contact = x + width * .5;
    for (const obstacle of obstacles) {
      if (!["gap", "manhole"].includes(obstacle.kind)) continue;
      const {left, right} = terrainBounds(obstacle);
      const progress = (contact - left + 110) / (right - left + 220);
      if (progress > 0 && progress < 1) return Math.sin(progress * Math.PI) * 125;
    }
    return 0;
  }

  function drawThief() {
    const row = thiefThrowTime > 0 ? 3 : boostTime > 0 ? 1 : 0;
    const column = Math.floor(worldDistance / 48) % 8;
    if (IS_MOBILE_PORTRAIT) {
      const chaseSpeed = boostTime > 0 ? BOOST_SPEED : speed;
      const retreat = Math.max(0, Math.min(55, ((chaseSpeed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)) * 55));
      const width = 180;
      const height = Math.round(width / VEHICLE_FRAME_RATIO);
      const x = W - width - 60 - retreat;
      drawSheetFrame(assets.thiefVehicle, 8, 6, column, row, x, GROUND_Y - height - thiefJumpHeight(x, width), width, height);
      return;
    }
    const width = 202;
    const height = Math.round(width / VEHICLE_FRAME_RATIO);
    const drawX = Math.max(W - 395, Math.min(W - 210, W - 275 + (BASE_SPEED - (boostTime > 0 ? 1180 : speed)) * .28));
    drawSheetFrame(assets.thiefVehicle, 8, 6, column, row, drawX, GROUND_Y - height - thiefJumpHeight(drawX, width), width, height);
  }

  function drawSheetFrame(image, columns, rows, column, row, x, y, width, height) {
    if (!image) return;
    const sw = image.width / columns;
    const sh = image.height / rows;
    ctx.drawImage(image, column * sw, row * sh, sw, sh, x, y, width, height);
  }

  function drawTerrain() {
    for (const obstacle of obstacles) {
      if (!obstacle.terrain) continue;
      const image = assets[obstacle.key];
      if (!image) continue;
      if (obstacle.kind === "gap") {
        const roadTop = H * (stageIndex === 2 ? .76 : .8);
        const height = H - roadTop + 18;
        const {left, right} = terrainBounds(obstacle);
        // Remove the road and lane paint below the opening before adding the supplied cliff art.
        ctx.fillStyle = "#020b18";
        ctx.beginPath();
        ctx.moveTo(left, roadTop);
        ctx.lineTo(right, roadTop);
        ctx.lineTo(obstacle.x + obstacle.w * .82, H);
        ctx.lineTo(obstacle.x + obstacle.w * .18, H);
        ctx.closePath();
        ctx.fill();
        ctx.drawImage(image, obstacle.x, roadTop - 18, obstacle.w, height);
      } else {
        const height = obstacle.kind === "manhole" ? 145 : 180;
        ctx.drawImage(image, obstacle.x, GROUND_Y - height * .56, obstacle.w, height);
      }
    }
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      if (obstacle.terrain) continue;
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
    const kmh = Math.round((boostTime > 0 ? BOOST_SPEED : speed * (surfaceKind === "mud" ? .52 : surfaceKind === "puddle" ? .72 : 1)) * displayFactor);
    ui.mobileSpeed.textContent = String(kmh);
    if (IS_MOBILE_PORTRAIT) return;
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
    if (muted) return;
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

  // Keep the game surface free of browser menus, text selection, and image dragging.
  for (const eventName of ["contextmenu", "dragstart", "selectstart"]) {
    document.addEventListener(eventName, (event) => event.preventDefault(), { capture: true });
  }

  window.addEventListener("keydown", (event) => {
    if (event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
    if (["Space", "Enter"].includes(event.code) && event.target.closest?.("button, a")) return;
    if (["Space", "ArrowUp", "KeyW"].includes(event.code) && state === "playing") {
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

  function resizeGame() {
    const oldGround = GROUND_Y;
    const oldPlayerX = player.x;
    IS_MOBILE_PORTRAIT = portraitQuery.matches;
    IS_COMPACT_VIEW = compactQuery.matches;
    const rect = canvas.getBoundingClientRect();
    W = IS_MOBILE_PORTRAIT ? 1080 : 1280;
    H = IS_MOBILE_PORTRAIT ? Math.round(W * rect.height / Math.max(1, rect.width)) : 720;
    GROUND_Y = H - 115;
    player.x = IS_MOBILE_PORTRAIT ? 45 : 138;
    const oldPlayerHeight = player.h;
    player.w = IS_MOBILE_PORTRAIT ? 180 : 226;
    player.h = Math.round(player.w / VEHICLE_FRAME_RATIO);
    player.y += GROUND_Y - oldGround + oldPlayerHeight - player.h;
    for (const obstacle of obstacles) {
      obstacle.x += player.x - oldPlayerX;
      obstacle.y += GROUND_Y - oldGround;
      obstacle.baseY += GROUND_Y - oldGround;
    }
    for (const effect of effects) { effect.x += player.x - oldPlayerX; effect.y += GROUND_Y - oldGround; }
    const scale = Math.min(1, rect.width * Math.min(window.devicePixelRatio || 1, 2) / W);
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    ctx.imageSmoothingEnabled = false;
    if (state === "playing") togglePause();
  }
  new ResizeObserver(resizeGame).observe(canvas);
  document.querySelector("#loadingRetry").addEventListener("click", preload);
  const soundButton = document.querySelector("#soundButton");
  function updateSoundButton() {
    soundButton.textContent = muted ? "소리 끔" : "소리 켬";
    soundButton.setAttribute("aria-pressed", String(muted));
    soundButton.setAttribute("aria-label", muted ? "효과음 켜기" : "효과음 끄기");
  }
  soundButton.addEventListener("click", () => {
    muted = !muted;
    if (muted) audioContext?.suspend();
    saveRecord();
    updateSoundButton();
  });
  updateSoundButton();
  saveRecord();
  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-product-id]");
    if (link) track("product_click", {product_id:Number(link.dataset.productId), stage:Number(link.dataset.stage), placement:link.dataset.placement});
  });
  const browse = document.querySelector("#browseProducts");
  browse.href += "?utm_source=heist&utm_medium=game&utm_campaign=warehouse&utm_content=failure_browse";
  browse.addEventListener("click", () => track("shop_click", {stage:stageIndex + 1, recovered_count:recoveredProducts.length}));
  for (const button of document.querySelectorAll(".share-button")) button.addEventListener("click", async () => {
    const url = "https://heist.yeseo.im/";
    try {
      if (navigator.share) await navigator.share({title:"창고 탈환 작전", text:"도둑을 추격하고 상품 3개를 되찾으세요!", url});
      else { await navigator.clipboard.writeText(url); button.textContent = "링크 복사 완료!"; }
    } catch (error) {
      if (error.name !== "AbortError") { button.textContent = "주소를 복사해 주세요"; window.prompt("공유할 링크", url); }
    }
  });

  window.requestAnimationFrame(loop);
  preload();
})();
