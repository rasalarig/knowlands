const state = {
  player: {
    xp: 0,
    coins: 0,
    blocks: 0,
    level: 1,
    learnedConcepts: [],
    attempts: [],
    lastStudyAt: null
  },
  world: {
    width: 2560,
    height: 1440,
    viewWidth: 1280,
    viewHeight: 720,
    tileSize: 16,
    cols: 160,
    rows: 90,
    tiles: [],
    obstacles: [
      { x: 210, y: 330, w: 68, h: 52, kind: "house" },
      { x: 490, y: 205, w: 72, h: 56, kind: "house" },
      { x: 780, y: 400, w: 80, h: 60, kind: "house" },
      { x: 890, y: 330, w: 70, h: 50, kind: "rock" },
      { x: 1020, y: 180, w: 66, h: 50, kind: "house" }
    ],
    keys: new Set(),
    playerPos: { x: 160, y: 355 },
    speed: 1.45,
    playerDirection: "down",
    playerMoving: false,
    walkCycle: 0,
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.65,
      maxZoom: 1.8
    },
    pathTiles: new Set(),
    scenery: {
      trees: [],
      bushes: [],
      flowerBeds: []
    },
    pens: [],
    animals: [],
    activeInteraction: null,
    lockedAnimalId: null,
    rafId: null,
    lastTs: 0
  },
  islands: [
    {
      id: "ilha-direito",
      name: "Ilha do Direito",
      gate: { x: 250, y: 450 },
      challenge: {
        prompt: "Qual caso é referência clássica de controle de convencionalidade?",
        options: ["Almonacid Arellano vs Chile", "Marbury vs Madison", "HC 84.078", "Caso Dreyfus"],
        answer: "Almonacid Arellano vs Chile"
      },
      content: "Controle de convencionalidade e principais casos da Corte IDH.",
      questions: [
        {
          id: "d1",
          type: "tf",
          prompt: "Almonacid Arellano vs Chile é referência para controle de convencionalidade.",
          answer: "certo",
          concept: "Almonacid (1973/controle de convencionalidade)"
        },
        {
          id: "d2",
          type: "mcq",
          prompt: "Qual órgão consolidou o uso da súmula vinculante no Brasil?",
          options: ["STJ", "STF", "TST", "CNJ"],
          answer: "STF",
          concept: "Súmula vinculante no STF"
        },
        {
          id: "d3",
          type: "essay",
          prompt: "Explique em 2-3 linhas o que é controle de convencionalidade.",
          keywords: ["tratados", "direitos humanos", "compatibilidade"],
          concept: "Conceito de controle de convencionalidade"
        }
      ]
    },
    {
      id: "ilha-logica",
      name: "Ilha da Lógica",
      gate: { x: 510, y: 318 },
      challenge: {
        prompt: "No modus ponens, se A->B e A é verdadeiro, então:",
        options: ["B é falso", "B é verdadeiro", "A é falso", "não conclui nada"],
        answer: "B é verdadeiro"
      },
      content: "Treino de questões curtas e certo/errado para ganho de velocidade.",
      questions: [
        {
          id: "l1",
          type: "tf",
          prompt: "Se A implica B e A é verdadeiro, então B deve ser verdadeiro.",
          answer: "certo",
          concept: "Modus ponens"
        },
        {
          id: "l2",
          type: "mcq",
          prompt: "Qual é a negação de 'todos estudam'?",
          options: [
            "Ninguém estuda",
            "Pelo menos uma pessoa não estuda",
            "Todos não estudam",
            "Alguns estudam"
          ],
          answer: "Pelo menos uma pessoa não estuda",
          concept: "Quantificadores lógicos"
        }
      ]
    },
    {
      id: "ilha-portugues",
      name: "Ilha de Português",
      gate: { x: 865, y: 500 },
      challenge: {
        prompt: "Em redação oficial, o atributo prioritário é:",
        options: ["Metáfora", "Gíria", "Clareza", "Ambiguidade"],
        answer: "Clareza"
      },
      content: "Interpretação de texto e revisão periódica por blocos de conteúdo.",
      questions: [
        {
          id: "p1",
          type: "tf",
          prompt: "Coesão textual está relacionada às conexões linguísticas entre frases.",
          answer: "certo",
          concept: "Coesão textual"
        },
        {
          id: "p2",
          type: "mcq",
          prompt: "Em redação oficial, deve-se priorizar:",
          options: ["Ambiguidade", "Clareza", "Gírias", "Metáforas em excesso"],
          answer: "Clareza",
          concept: "Clareza em redação oficial"
        }
      ]
    }
  ],
  currentIsland: null,
  questionPool: [],
  questionIndex: 0,
  currentQuestion: null,
  selectedOption: null,
  currentChallenge: null,
  selectedChallengeOption: null,
  solvedChallenges: {},
  reviewQueue: [],
  notes: [],
  companion: {
    style: "abelha",
    mood: "gentil",
    goals: []
  },
  race: {
    running: false,
    cooldownUntil: 0,
    racers: [
      { name: "Você", progress: 0 },
      { name: "Bot A", progress: 0 },
      { name: "Bot B", progress: 0 }
    ],
    timer: null
  },
  npcMemory: {
    Mentor: [],
    Guardião: [],
    Bibliotecária: []
  }
};

const el = {
  worldCanvas: document.getElementById("worldCanvas"),
  worldHint: document.getElementById("worldHint"),
  flashcardBox: document.getElementById("flashcardBox"),
  fullscreenMapBtn: document.getElementById("fullscreenMapBtn"),
  phaseTitle: document.getElementById("phaseTitle"),
  contentBox: document.getElementById("contentBox"),
  islandChallengeBox: document.getElementById("islandChallengeBox"),
  challengeTitle: document.getElementById("challengeTitle"),
  challengeText: document.getElementById("challengeText"),
  challengeOptions: document.getElementById("challengeOptions"),
  checkChallengeBtn: document.getElementById("checkChallengeBtn"),
  challengeFeedback: document.getElementById("challengeFeedback"),
  questionCard: document.getElementById("questionCard"),
  questionText: document.getElementById("questionText"),
  optionsBox: document.getElementById("optionsBox"),
  essayAnswer: document.getElementById("essayAnswer"),
  checkAnswerBtn: document.getElementById("checkAnswerBtn"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),
  feedback: document.getElementById("feedback"),
  repeatMode: document.getElementById("repeatMode"),
  questionFilter: document.getElementById("questionFilter"),
  responseSize: document.getElementById("responseSize"),
  saveQuestionReviewBtn: document.getElementById("saveQuestionReviewBtn"),
  saveContentReviewBtn: document.getElementById("saveContentReviewBtn"),
  runReviewBtn: document.getElementById("runReviewBtn"),
  reviewList: document.getElementById("reviewList"),
  level: document.getElementById("level"),
  xp: document.getElementById("xp"),
  coins: document.getElementById("coins"),
  blocks: document.getElementById("blocks"),
  globalProgressBar: document.getElementById("globalProgressBar"),
  globalProgressText: document.getElementById("globalProgressText"),
  progressChart: document.getElementById("progressChart"),
  startRaceBtn: document.getElementById("startRaceBtn"),
  raceTrack: document.getElementById("raceTrack"),
  raceStatus: document.getElementById("raceStatus"),
  petStyle: document.getElementById("petStyle"),
  petMood: document.getElementById("petMood"),
  goalsInput: document.getElementById("goalsInput"),
  saveCompanionBtn: document.getElementById("saveCompanionBtn"),
  companionSpeech: document.getElementById("companionSpeech"),
  noteText: document.getElementById("noteText"),
  notePriority: document.getElementById("notePriority"),
  noteRatio: document.getElementById("noteRatio"),
  saveNoteBtn: document.getElementById("saveNoteBtn"),
  petRecallBtn: document.getElementById("petRecallBtn"),
  recallOutput: document.getElementById("recallOutput"),
  memoryPalace: document.getElementById("memoryPalace"),
  subjectsInput: document.getElementById("subjectsInput"),
  examDate: document.getElementById("examDate"),
  buildScheduleBtn: document.getElementById("buildScheduleBtn"),
  scheduleList: document.getElementById("scheduleList"),
  npcSelect: document.getElementById("npcSelect"),
  npcInput: document.getElementById("npcInput"),
  sendNpcBtn: document.getElementById("sendNpcBtn"),
  chatLog: document.getElementById("chatLog")
};

function init() {
  initWorld();
  initNpc();
  bindEvents();
  updateStats();
  renderReviewList();
  renderRace();
  companionNudge();
}

function bindEvents() {
  el.checkAnswerBtn.addEventListener("click", answerQuestion);
  el.nextQuestionBtn.addEventListener("click", nextQuestion);
  el.saveQuestionReviewBtn.addEventListener("click", () => saveForReview("question"));
  el.saveContentReviewBtn.addEventListener("click", () => saveForReview("content"));
  el.runReviewBtn.addEventListener("click", runReviewSession);
  el.startRaceBtn.addEventListener("click", startRace);
  el.saveCompanionBtn.addEventListener("click", saveCompanion);
  el.saveNoteBtn.addEventListener("click", saveNote);
  el.petRecallBtn.addEventListener("click", petRecall);
  el.buildScheduleBtn.addEventListener("click", buildSchedule);
  el.sendNpcBtn.addEventListener("click", sendNpcMessage);
  el.fullscreenMapBtn.addEventListener("click", toggleMapFullscreen);
  el.checkChallengeBtn.addEventListener("click", checkIslandChallenge);
  el.questionFilter.addEventListener("change", () => {
    if (state.currentIsland) loadIsland(state.currentIsland.id);
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  el.worldCanvas.addEventListener("wheel", onWorldWheel, { passive: false });
}

function initWorld() {
  generateOrganicTileMap();
  snapObstaclesToLand();
  placeIslandGatesOnLand();
  buildWorldScenery();
  ensurePlayerOnClearTile();
  el.worldCanvas.width = state.world.viewWidth;
  el.worldCanvas.height = state.world.viewHeight;
  state.world.camera.zoom = 1;
  centerCameraOnPlayer();
  if (state.world.rafId) cancelAnimationFrame(state.world.rafId);
  state.world.lastTs = performance.now();
  state.world.rafId = requestAnimationFrame(worldTick);
}

function onWorldWheel(event) {
  event.preventDefault();
  const camera = state.world.camera;
  const zoomStep = event.deltaY > 0 ? -0.08 : 0.08;
  camera.zoom = clamp(camera.zoom + zoomStep, camera.minZoom, camera.maxZoom);
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    state.world.keys.add(key);
  }

  if (key === "e") {
    event.preventDefault();
    interactWithGate();
  }

  if (key === "escape") {
    event.preventDefault();
    closeAnimalFlashcard();
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  state.world.keys.delete(key);
}

function worldTick(ts) {
  const dt = Math.min(2, (ts - state.world.lastTs) / 16.67);
  state.world.lastTs = ts;
  updatePlayerPosition(dt);
  updateAnimals(dt);
  updateInteractionHint();
  updateCamera();
  drawWorld();
  state.world.rafId = requestAnimationFrame(worldTick);
}

function centerCameraOnPlayer() {
  const camera = state.world.camera;
  const zoom = camera.zoom;
  const viewportW = el.worldCanvas.width / zoom;
  const viewportH = el.worldCanvas.height / zoom;
  camera.x = clamp(state.world.playerPos.x - viewportW / 2, 0, Math.max(0, state.world.width - viewportW));
  camera.y = clamp(state.world.playerPos.y - viewportH / 2, 0, Math.max(0, state.world.height - viewportH));
}

function updateCamera() {
  centerCameraOnPlayer();
}

function updatePlayerPosition(dt) {
  const keys = state.world.keys;
  let dx = 0;
  let dy = 0;

  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;

  if (dx !== 0 && dy !== 0) {
    const inv = 1 / Math.sqrt(2);
    dx *= inv;
    dy *= inv;
  }

  state.world.playerMoving = dx !== 0 || dy !== 0;
  if (Math.abs(dx) > Math.abs(dy)) {
    state.world.playerDirection = dx > 0 ? "right" : "left";
  } else if (Math.abs(dy) > 0) {
    state.world.playerDirection = dy > 0 ? "down" : "up";
  }

  const speed = state.world.speed * dt;
  const targetX = clamp(state.world.playerPos.x + dx * speed, 12, state.world.width - 12);
  const targetY = clamp(state.world.playerPos.y + dy * speed, 12, state.world.height - 12);

  if (isWalkable(targetX, state.world.playerPos.y, true)) {
    state.world.playerPos.x = targetX;
  }
  if (isWalkable(state.world.playerPos.x, targetY, true)) {
    state.world.playerPos.y = targetY;
  }

  if (state.world.playerMoving) {
    const stuckX = clamp(state.world.playerPos.x + dx * speed, 12, state.world.width - 12);
    const stuckY = clamp(state.world.playerPos.y + dy * speed, 12, state.world.height - 12);
    if (isWalkable(stuckX, stuckY, false)) {
      state.world.playerPos.x = stuckX;
      state.world.playerPos.y = stuckY;
    }
  }

  if (state.world.playerMoving) {
    state.world.walkCycle += dt * 0.15;
  }
}

function isWalkable(x, y, checkScenery = true) {
  if (!isOnLand(x, y)) return false;
  const radius = 10;

  for (const obstacle of state.world.obstacles) {
    if (
      x + radius > obstacle.x &&
      x - radius < obstacle.x + obstacle.w &&
      y + radius > obstacle.y &&
      y - radius < obstacle.y + obstacle.h
    ) {
      return false;
    }
  }

  if (checkScenery) {
    for (const tree of state.world.scenery.trees) {
      const d = distance(x, y, tree.x, tree.y);
      if (d < tree.size * 0.62) return false;
    }

    for (const bush of state.world.scenery.bushes) {
      const d = distance(x, y, bush.x, bush.y);
      if (d < bush.size * 0.56) return false;
    }

    for (const bed of state.world.scenery.flowerBeds) {
      if (
        x + radius > bed.x - bed.w / 2 &&
        x - radius < bed.x + bed.w / 2 &&
        y + radius > bed.y - bed.h / 2 &&
        y - radius < bed.y + bed.h / 2
      ) {
        return false;
      }
    }
  }

  return true;
}

function ensurePlayerOnClearTile() {
  if (isWalkable(state.world.playerPos.x, state.world.playerPos.y, true)) return;

  const { tileSize } = state.world;
  let fallback = null;
  let minDist = Infinity;

  for (const key of state.world.pathTiles) {
    const [txRaw, tyRaw] = key.split(",");
    const tx = Number(txRaw);
    const ty = Number(tyRaw);
    const px = tx * tileSize + tileSize / 2;
    const py = ty * tileSize + tileSize / 2;
    if (!isWalkable(px, py, false)) continue;

    const d = distance(px, py, state.world.playerPos.x, state.world.playerPos.y);
    if (d < minDist) {
      minDist = d;
      fallback = { x: px, y: py };
    }
  }

  if (fallback) {
    state.world.playerPos = fallback;
    return;
  }

  const nearest = findNearestLand(state.world.playerPos.x, state.world.playerPos.y);
  if (nearest) state.world.playerPos = nearest;
}

function isOnLand(x, y) {
  const { tileSize, cols, rows, tiles } = state.world;
  const tx = Math.floor(x / tileSize);
  const ty = Math.floor(y / tileSize);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
  return tiles[ty][tx] === 1;
}

function updateInteractionHint() {
  if (state.world.lockedAnimalId) {
    const locked = state.world.animals.find((item) => item.id === state.world.lockedAnimalId);
    if (locked) {
      state.world.activeInteraction = { type: "animal", id: locked.id };
      el.worldHint.textContent = `Interagindo com ${locked.name}. Pressione E para próximo flashcard ou Esc para fechar.`;
      return;
    }
    state.world.lockedAnimalId = null;
  }

  const player = state.world.playerPos;
  let nearestAnimal = null;
  let nearestAnimalDist = Infinity;

  for (const animal of state.world.animals) {
    const dist = distance(player.x, player.y, animal.x, animal.y);
    if (dist < nearestAnimalDist) {
      nearestAnimalDist = dist;
      nearestAnimal = animal;
    }
  }

  if (nearestAnimal && nearestAnimalDist <= 40) {
    state.world.activeInteraction = { type: "animal", id: nearestAnimal.id };
    el.worldHint.textContent = `Pressione E para interagir com ${nearestAnimal.name} e ver flashcards.`;
    return;
  }

  if (!state.world.lockedAnimalId) {
    hideFlashcard();
  }

  let nearestGate = null;
  let nearestGateDist = Infinity;

  for (const island of state.islands) {
    const dist = distance(player.x, player.y, island.gate.x, island.gate.y);
    if (dist < nearestGateDist) {
      nearestGateDist = dist;
      nearestGate = island;
    }
  }

  if (nearestGate && nearestGateDist <= 42) {
    state.world.activeInteraction = { type: "island", id: nearestGate.id };
    el.worldHint.textContent = `Você está em ${nearestGate.name}. Pressione E para iniciar a fase.`;
  } else {
    state.world.activeInteraction = null;
    el.worldHint.textContent = "Explore o mapa para encontrar as ilhas de conteúdo.";
  }
}

function interactWithGate() {
  if (!state.world.activeInteraction) return;
  if (state.world.activeInteraction.type === "island") {
    closeAnimalFlashcard();
    loadIsland(state.world.activeInteraction.id);
    return;
  }
  if (state.world.activeInteraction.type === "animal") {
    const animal = state.world.animals.find((item) => item.id === state.world.activeInteraction.id);
    if (animal) {
      state.world.lockedAnimalId = animal.id;
      showAnimalFlashcard(animal);
    }
  }
}

function drawWorld() {
  const ctx = el.worldCanvas.getContext("2d");
  const w = state.world.width;
  const h = state.world.height;
  const vw = el.worldCanvas.width;
  const vh = el.worldCanvas.height;
  const { tileSize, cols, rows, tiles } = state.world;
  const { camera } = state.world;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);

  const seaGradient = ctx.createLinearGradient(0, 0, 0, h);
  seaGradient.addColorStop(0, "#38bdf8");
  seaGradient.addColorStop(1, "#0369a1");
  ctx.fillStyle = seaGradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 97) % w;
    const y = (i * 59) % h;
    ctx.fillRect(x, y, 44, 3);
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (tiles[y][x] !== 1) continue;
      const px = x * tileSize;
      const py = y * tileSize;
      const onPath = state.world.pathTiles.has(tileKey(x, y));
      const tone = (x * 13 + y * 7) % 3;
      if (onPath) {
        ctx.fillStyle = tone === 0 ? "#d4b07a" : tone === 1 ? "#c29a62" : "#b38655";
      } else {
        ctx.fillStyle = tone === 0 ? "#9fd96a" : tone === 1 ? "#8bca58" : "#79b74b";
      }
      ctx.fillRect(px, py, tileSize, tileSize);
      ctx.strokeStyle = "rgba(15,23,42,0.06)";
      ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
    }
  }

  drawScenery(ctx);
  drawAnimals(ctx);

  state.world.obstacles.forEach((obstacle, index) => {
    if (obstacle.kind === "house") {
      drawHouse3D(obstacle, index + 1);
    } else {
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.ellipse(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, obstacle.w / 2, obstacle.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  for (const island of state.islands) {
    const isActive =
      state.world.activeInteraction &&
      state.world.activeInteraction.type === "island" &&
      state.world.activeInteraction.id === island.id;
    ctx.fillStyle = isActive ? "rgba(251,191,36,0.25)" : "rgba(226,232,240,0.18)";
    ctx.beginPath();
    ctx.arc(island.gate.x, island.gate.y, isActive ? 22 : 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isActive ? "#fbbf24" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(island.gate.x, island.gate.y, 10, 0, Math.PI * 2);
    ctx.fill();

    const text = island.name;
    ctx.font = "bold 12px Segoe UI";
    const tw = ctx.measureText(text).width;
    const lx = island.gate.x - tw / 2 - 6;
    const ly = island.gate.y - 30;
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.fillRect(lx, ly - 12, tw + 12, 16);
    ctx.strokeStyle = isActive ? "rgba(251,191,36,0.85)" : "rgba(148,163,184,0.8)";
    ctx.strokeRect(lx + 0.5, ly - 11.5, tw + 11, 15);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(text, island.gate.x - tw / 2, ly);
  }

  drawHeroSprite(ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawHeroSprite(ctx) {
  const player = state.world.playerPos;
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const direction = state.world.playerDirection;
  const moving = state.world.playerMoving;
  const swing = moving ? Math.sin(state.world.walkCycle * 8) : 0;
  const bounce = moving ? Math.abs(Math.sin(state.world.walkCycle * 8)) * 1.2 : 0;
  const bodyY = py - bounce;

  ctx.fillStyle = "rgba(15,23,42,0.28)";
  ctx.beginPath();
  ctx.ellipse(px, py + 13, 11, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const scale = 1.2;
  const armOffset = 4.6 * scale;
  const armSwing = swing * 1.4 * scale;
  const legSwing = swing * 1.9 * scale;

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.8 * scale;
  ctx.beginPath();
  ctx.moveTo(px - armOffset, bodyY - 1.5);
  ctx.lineTo(px - armOffset - armSwing, bodyY + 7 * scale);
  ctx.moveTo(px + armOffset, bodyY - 1.5);
  ctx.lineTo(px + armOffset + armSwing, bodyY + 7 * scale);
  ctx.stroke();

  ctx.lineCap = "round";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(px - armOffset, bodyY - 2);
  ctx.lineTo(px - armOffset - armSwing, bodyY + 6 * scale);
  ctx.moveTo(px + armOffset, bodyY - 2);
  ctx.lineTo(px + armOffset + armSwing, bodyY + 6 * scale);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(px - 7.2, bodyY - 9.6, 14.4, 18);

  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(px - 6, bodyY - 8.4, 12, 16.8);

  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(px - 1.2, bodyY - 8.4, 2.4, 16.8);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.strokeRect(px - 3.6, bodyY - 2.4, 7.2, 6);

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(px - 2.4, bodyY - 1.2, 4.8, 3.6);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(px - 3.2, bodyY + 8.4);
  ctx.lineTo(px - 3.2 - legSwing, bodyY + 14.4);
  ctx.moveTo(px + 3.2, bodyY + 8.4);
  ctx.lineTo(px + 3.2 + legSwing, bodyY + 14.4);
  ctx.stroke();

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(px - 3, bodyY + 8.4);
  ctx.lineTo(px - 3 - legSwing, bodyY + 14.4);
  ctx.moveTo(px + 3, bodyY + 8.4);
  ctx.lineTo(px + 3 + legSwing, bodyY + 14.4);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(px - 7.2, bodyY - 21.6, 14.4, 14.4);

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(px, bodyY - 13.2, 8.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(px, bodyY - 18, 7, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(px + 5.4, bodyY - 20.4, 2.6, 2.6);

  ctx.fillStyle = "#1e293b";
  if (direction === "left") {
    ctx.fillRect(px - 5.4, bodyY - 14.4, 2.4, 2.4);
  } else if (direction === "right") {
    ctx.fillRect(px + 3, bodyY - 14.4, 2.4, 2.4);
  } else {
    ctx.fillRect(px - 4.1, bodyY - 14.4, 2.4, 2.4);
    ctx.fillRect(px + 1.7, bodyY - 14.4, 2.4, 2.4);
  }

  ctx.fillStyle = "#fb7185";
  ctx.fillRect(px - 6.7, bodyY - 11.3, 1.7, 1.7);
  ctx.fillRect(px + 5, bodyY - 11.3, 1.7, 1.7);

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (moving) {
    ctx.arc(px, bodyY - 9.6, 2.4, 0.2, Math.PI - 0.2);
  } else {
    ctx.arc(px, bodyY - 9, 1.9, 0.1, Math.PI - 0.1);
  }
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(px - 2.8, bodyY + 14.4, 5.6, 1.6);
}

function drawHouse3D(obstacle, houseNumber = 1) {
  const ctx = el.worldCanvas.getContext("2d");
  const x = Math.round(obstacle.x);
  const y = Math.round(obstacle.y);
  const wHouse = obstacle.w;
  const hHouse = obstacle.h;
  const variant = ((Math.floor(x / 8) + Math.floor(y / 7)) % 3 + 3) % 3;

  const palettes = [
    { roof: "#9f1239", roofTop: "#be123c", wall: "#c08457", side: "#9a6b45", trim: "#e7d3b9" },
    { roof: "#1d4ed8", roofTop: "#2563eb", wall: "#94a3b8", side: "#64748b", trim: "#cbd5e1" },
    { roof: "#047857", roofTop: "#059669", wall: "#d97706", side: "#b45309", trim: "#e7d3b9" }
  ];
  const palette = palettes[variant];

  const depth = Math.max(4, Math.floor(Math.min(wHouse, hHouse) * 0.09));
  const roofHeight = Math.max(10, Math.floor(hHouse * 0.2));
  const frontX = x;
  const frontY = y + 5;
  const frontW = wHouse - depth;
  const frontH = hHouse - 7;
  const rightX = frontX + frontW;

  drawFenceAroundHouse(ctx, frontX, frontY, frontW + depth, frontH + depth, houseNumber);

  ctx.fillStyle = "rgba(15,23,42,0.14)";
  ctx.fillRect(frontX + 4, frontY + frontH + 2, frontW + depth + 2, 4);

  ctx.fillStyle = palette.wall;
  ctx.fillRect(frontX, frontY, frontW, frontH);

  ctx.fillStyle = palette.side;
  ctx.beginPath();
  ctx.moveTo(rightX, frontY);
  ctx.lineTo(rightX + depth, frontY + depth);
  ctx.lineTo(rightX + depth, frontY + frontH + depth);
  ctx.lineTo(rightX, frontY + frontH);
  ctx.closePath();
  ctx.fill();

  if (variant === 1) {
    ctx.fillStyle = palette.roof;
    ctx.fillRect(frontX - 1, frontY - roofHeight + 2, frontW + 2, roofHeight);
    ctx.fillStyle = palette.roofTop;
    ctx.fillRect(frontX, frontY - roofHeight + 5, frontW, 3);
    ctx.fillStyle = palette.side;
    ctx.fillRect(rightX, frontY - roofHeight + 2 + depth, depth, roofHeight - 1);
  } else {
    ctx.fillStyle = palette.roof;
    ctx.beginPath();
    ctx.moveTo(frontX - 3, frontY + 3);
    ctx.lineTo(frontX + frontW / 2, frontY - roofHeight);
    ctx.lineTo(rightX + depth + 3, frontY + depth + 2);
    ctx.lineTo(rightX + depth, frontY + depth + 4);
    ctx.lineTo(frontX, frontY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.roofTop;
    ctx.beginPath();
    ctx.moveTo(frontX + 4, frontY + 5);
    ctx.lineTo(frontX + frontW / 2, frontY - roofHeight + 7);
    ctx.lineTo(rightX + depth - 4, frontY + depth + 3);
    ctx.lineTo(rightX - 1, frontY + 6);
    ctx.closePath();
    ctx.fill();
  }

  if (variant !== 2) {
    const chimneyX = rightX - 7;
    const chimneyY = frontY - roofHeight + 6;
    ctx.fillStyle = "#475569";
    ctx.fillRect(chimneyX, chimneyY, 5, 10);
    ctx.fillStyle = "#334155";
    ctx.fillRect(chimneyX - 1, chimneyY - 2, 7, 3);
  }

  const doorW = Math.max(8, Math.floor(frontW * 0.16));
  const doorH = Math.max(12, Math.floor(frontH * 0.28));
  const doorX = frontX + Math.floor((frontW - doorW) / 2);
  const doorY = frontY + frontH - doorH;
  ctx.fillStyle = "#3f2305";
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.fillStyle = "#e2b36f";
  ctx.fillRect(doorX + doorW - 3, doorY + Math.floor(doorH / 2), 2, 2);

  const windowW = Math.max(8, Math.floor(frontW * 0.15));
  const windowH = Math.max(7, Math.floor(frontH * 0.14));
  const leftWinX = frontX + 6;
  const rightWinX = frontX + frontW - 6 - windowW;
  const winY = frontY + Math.floor(frontH * 0.35);
  drawWindow(leftWinX, winY, windowW, windowH, palette.trim);
  drawWindow(rightWinX, winY, windowW, windowH, palette.trim);

  ctx.strokeStyle = "rgba(15,23,42,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(frontX + 0.5, frontY + 0.5, frontW - 1, frontH - 1);
}

function drawWindow(x, y, w, h, trimColor = "#fef3c7") {
  const ctx = el.worldCanvas.getContext("2d");
  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(186,230,253,0.6)";
  ctx.fillRect(x + 1, y + 1, w - 2, Math.max(2, Math.floor(h * 0.35)));
  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = "rgba(226,232,240,0.65)";
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 1);
  ctx.lineTo(x + w / 2, y + h - 1);
  ctx.moveTo(x + 1, y + h / 2);
  ctx.lineTo(x + w - 1, y + h / 2);
  ctx.stroke();
}

function drawFenceAroundHouse(ctx, x, y, w, h, houseNumber) {
  const pad = 9;
  const fx = x - pad;
  const fy = y - pad;
  const fw = w + pad * 2;
  const fh = h + pad * 2;
  const gateW = 16;
  const gateCenter = fx + fw / 2;

  const postColor = "#8b5e34";
  const railColor = "#c69a6b";
  const shadowColor = "rgba(15,23,42,0.18)";

  ctx.fillStyle = shadowColor;
  ctx.fillRect(fx + 2, fy + fh + 1, fw, 3);

  drawFenceSide(ctx, fx, fy, fw, "top", gateCenter, gateW, postColor, railColor);
  drawFenceSide(ctx, fx, fy + fh, fw, "bottom", gateCenter, gateW, postColor, railColor);
  drawFenceVertical(ctx, fx, fy, fh, postColor, railColor);
  drawFenceVertical(ctx, fx + fw, fy, fh, postColor, railColor);

  const gateX = gateCenter - gateW / 2;
  ctx.strokeStyle = "#d8b489";
  ctx.lineWidth = 1;
  ctx.strokeRect(gateX + 0.5, fy + fh - 10.5, gateW - 1, 8);
  ctx.beginPath();
  ctx.moveTo(gateX + 2, fy + fh - 9);
  ctx.lineTo(gateX + gateW - 2, fy + fh - 3);
  ctx.stroke();

  const label = `Casa ${houseNumber}`;
  ctx.font = "10px Segoe UI";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(15,23,42,0.62)";
  ctx.fillRect(fx + fw / 2 - tw / 2 - 4, fy - 14, tw + 8, 12);
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(label, fx + fw / 2 - tw / 2, fy - 5);
}

function drawFenceSide(ctx, x, y, width, side, gateCenter, gateW, postColor, railColor) {
  const postStep = 8;
  const postH = 6;
  const dir = side === "top" ? 1 : -1;

  ctx.strokeStyle = railColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + dir * 1.5);
  ctx.lineTo(gateCenter - gateW / 2, y + dir * 1.5);
  ctx.moveTo(gateCenter + gateW / 2, y + dir * 1.5);
  ctx.lineTo(x + width, y + dir * 1.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y + dir * 4);
  ctx.lineTo(gateCenter - gateW / 2, y + dir * 4);
  ctx.moveTo(gateCenter + gateW / 2, y + dir * 4);
  ctx.lineTo(x + width, y + dir * 4);
  ctx.stroke();

  ctx.fillStyle = postColor;
  for (let px = x; px <= x + width; px += postStep) {
    if (Math.abs(px - gateCenter) < gateW / 2) continue;
    const py = side === "top" ? y : y - postH;
    ctx.fillRect(px - 1, py, 2, postH);
  }
}

function drawFenceVertical(ctx, x, y, height, postColor, railColor) {
  const postStep = 8;
  const postH = 2;

  ctx.strokeStyle = railColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 1.5, y);
  ctx.lineTo(x - 1.5, y + height);
  ctx.moveTo(x + 1.5, y);
  ctx.lineTo(x + 1.5, y + height);
  ctx.stroke();

  ctx.fillStyle = postColor;
  for (let py = y; py <= y + height; py += postStep) {
    ctx.fillRect(x - 2, py - postH / 2, 4, postH);
  }
}

function drawScenery(ctx) {
  for (const bed of state.world.scenery.flowerBeds) {
    const x = bed.x;
    const y = bed.y;
    ctx.fillStyle = "#7c5a36";
    ctx.fillRect(x - bed.w / 2, y - bed.h / 2, bed.w, bed.h);
    for (let i = 0; i < bed.flowers; i += 1) {
      const fx = x - bed.w / 2 + 3 + ((i * 7) % Math.max(4, bed.w - 6));
      const fy = y - bed.h / 2 + 3 + ((i * 5) % Math.max(4, bed.h - 6));
      const color = i % 3 === 0 ? "#f43f5e" : i % 3 === 1 ? "#facc15" : "#38bdf8";
      ctx.fillStyle = color;
      ctx.fillRect(fx, fy, 2, 2);
    }
  }

  for (const bush of state.world.scenery.bushes) {
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.arc(bush.x, bush.y, bush.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(34,197,94,0.55)";
    ctx.beginPath();
    ctx.arc(bush.x - bush.size * 0.2, bush.y - bush.size * 0.25, bush.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const tree of state.world.scenery.trees) {
    ctx.fillStyle = "rgba(15,23,42,0.2)";
    ctx.beginPath();
    ctx.ellipse(tree.x, tree.y + tree.size + 5, tree.size * 0.8, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(tree.x - 2, tree.y + tree.size * 0.35, 4, 9);
    ctx.fillStyle = "#15803d";
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,83,45,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(74,222,128,0.55)";
    ctx.beginPath();
    ctx.arc(tree.x - tree.size * 0.25, tree.y - tree.size * 0.3, tree.size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(187,247,208,0.35)";
    ctx.beginPath();
    ctx.arc(tree.x + tree.size * 0.2, tree.y - tree.size * 0.15, tree.size * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnimals(ctx) {
  for (const animal of state.world.animals) {
    const hover =
      state.world.activeInteraction &&
      state.world.activeInteraction.type === "animal" &&
      state.world.activeInteraction.id === animal.id;
    const bob = Math.sin((state.world.walkCycle + animal.phase) * 3) * 0.8;
    const x = animal.x;
    const y = animal.y + bob;

    ctx.fillStyle = "rgba(15,23,42,0.2)";
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (animal.type === "cow") {
      drawCowSprite(ctx, x, y);
    } else {
      drawSheepSprite(ctx, x, y);
    }

    if (hover) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawCowSprite(ctx, x, y) {
  const s = 1.22;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x - 8 * s, y - 7 * s, 16 * s, 11 * s);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x - 7 * s, y - 6 * s, 14 * s, 10 * s);

  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.arc(x - 3.5 * s, y - 3.5 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.arc(x + 3.5 * s, y - 1.5 * s, 2.3 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fda4af";
  ctx.fillRect(x - 4.5 * s, y + 0.5 * s, 9 * s, 4 * s);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x - 2.5 * s, y + 2 * s, 1.2 * s, 1.2 * s);
  ctx.fillRect(x + 1.3 * s, y + 2 * s, 1.2 * s, 1.2 * s);

  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(x - 6.8 * s, y - 7.2 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 4.8 * s, y - 7.2 * s, 2 * s, 2 * s);

  ctx.fillStyle = "#334155";
  ctx.fillRect(x - 6 * s, y + 4 * s, 2 * s, 5 * s);
  ctx.fillRect(x - 1 * s, y + 4 * s, 2 * s, 5 * s);
  ctx.fillRect(x + 4 * s, y + 4 * s, 2 * s, 5 * s);
}

function drawSheepSprite(ctx, x, y) {
  const s = 1.24;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(x, y - 1 * s, 7.8 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  for (let i = 0; i < 5; i += 1) {
    const ox = [-4, -1, 2, 5, 0][i];
    const oy = [-1, -3, -2, 0, 1][i];
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(x + 1.5 * s, y + 1.2 * s, 3.5 * s, 2.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x + 0.5 * s, y + 0.4 * s, 1.2 * s, 1.2 * s);

  ctx.fillStyle = "#334155";
  ctx.fillRect(x - 4 * s, y + 4 * s, 1.8 * s, 4.6 * s);
  ctx.fillRect(x + 2 * s, y + 4 * s, 1.8 * s, 4.6 * s);
}

function generateOrganicTileMap() {
  const { cols, rows } = state.world;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(0));

  const seeds = [
    { x: Math.floor(cols * 0.14), y: Math.floor(rows * 0.48), radius: 18 },
    { x: Math.floor(cols * 0.29), y: Math.floor(rows * 0.3), radius: 20 },
    { x: Math.floor(cols * 0.5), y: Math.floor(rows * 0.52), radius: 22 },
    { x: Math.floor(cols * 0.68), y: Math.floor(rows * 0.33), radius: 18 },
    { x: Math.floor(cols * 0.84), y: Math.floor(rows * 0.58), radius: 21 }
  ];

  for (const seed of seeds) {
    carveOrganicBlob(tiles, cols, rows, seed.x, seed.y, seed.radius);
  }

  for (let step = 0; step < 2; step += 1) {
    smoothTiles(tiles, cols, rows);
  }

  state.world.tiles = tiles;
}

function carveOrganicBlob(tiles, cols, rows, cx, cy, radius) {
  for (let y = Math.max(1, cy - radius - 2); y <= Math.min(rows - 2, cy + radius + 2); y += 1) {
    for (let x = Math.max(1, cx - radius - 2); x <= Math.min(cols - 2, cx + radius + 2); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const noise = Math.sin((x + 11) * 0.8) * 0.9 + Math.cos((y + 3) * 0.7) * 0.9 + Math.sin((x + y) * 0.35);
      const threshold = radius + noise * 1.8;
      if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
        tiles[y][x] = 1;
      }
    }
  }
}

function smoothTiles(tiles, cols, rows) {
  const clone = tiles.map((row) => [...row]);
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) {
      let neighbors = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          if (tiles[y + oy][x + ox] === 1) neighbors += 1;
        }
      }
      if (neighbors >= 5) clone[y][x] = 1;
      else if (neighbors <= 2) clone[y][x] = 0;
    }
  }
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      tiles[y][x] = clone[y][x];
    }
  }
}

function snapObstaclesToLand() {
  state.world.obstacles = state.world.obstacles.map((obstacle) => {
    const centerX = obstacle.x + obstacle.w / 2;
    const centerY = obstacle.y + obstacle.h / 2;
    const nearest = findNearestLand(centerX, centerY);
    if (!nearest) return obstacle;
    return {
      ...obstacle,
      x: nearest.x - obstacle.w / 2,
      y: nearest.y - obstacle.h / 2
    };
  });
}

function placeIslandGatesOnLand() {
  const preferred = [
    { x: state.world.width * 0.18, y: state.world.height * 0.62 },
    { x: state.world.width * 0.47, y: state.world.height * 0.4 },
    { x: state.world.width * 0.78, y: state.world.height * 0.66 }
  ];

  state.islands.forEach((island, idx) => {
    const anchor = preferred[idx] || { x: 200 + idx * 200, y: 260 };
    const point = findNearestLand(anchor.x, anchor.y);
    if (point) island.gate = point;
  });

  const start = findNearestLand(state.world.playerPos.x, state.world.playerPos.y);
  if (start) state.world.playerPos = { x: start.x, y: start.y };
}

function buildWorldScenery() {
  const { tileSize, cols, rows } = state.world;
  state.world.pathTiles = new Set();
  state.world.scenery = {
    trees: [],
    bushes: [],
    flowerBeds: []
  };
  state.world.pens = [];
  state.world.animals = [];

  const start = pixelToTile(state.world.playerPos.x, state.world.playerPos.y);
  const gateTiles = state.islands.map((island) => pixelToTile(island.gate.x, island.gate.y));

  let previous = start;
  for (const gateTile of gateTiles) {
    carvePath(previous, gateTile);
    previous = gateTile;
  }

  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) {
      if (!isLandTile(x, y)) continue;
      const key = tileKey(x, y);
      const centerX = x * tileSize + tileSize / 2;
      const centerY = y * tileSize + tileSize / 2;
      if (state.world.pathTiles.has(key)) continue;
      if (isNearStructure(centerX, centerY, 16)) continue;

      const r = seededNoise(x, y);
      if (r > 0.92) {
        state.world.scenery.trees.push({ x: centerX, y: centerY - 3, size: 6 + ((x + y) % 3) });
      } else if (r > 0.84) {
        state.world.scenery.bushes.push({ x: centerX, y: centerY, size: 4 + ((x * y) % 2) });
      } else if (r > 0.8) {
        state.world.scenery.flowerBeds.push({
          x: centerX,
          y: centerY,
          w: 10 + ((x + y) % 5),
          h: 8 + ((x * 3 + y) % 4),
          flowers: 5 + ((x + y) % 4)
        });
      }
    }
  }

  buildHousePens();
  spawnLearningAnimals();
}

function spawnLearningAnimals() {
  const animals = [];
  state.world.pens.forEach((pen, index) => {
    const cowSpot = randomPointInPen(pen, 0.35);
    const sheepSpot = randomPointInPen(pen, 0.65);

    if (cowSpot) {
      animals.push({
        id: `cow-${index}`,
        type: "cow",
        name: `Mimosa ${index + 1}`,
        x: cowSpot.x,
        y: cowSpot.y,
        vx: 0.18,
        vy: 0.1,
        phase: seededNoise(cowSpot.x, cowSpot.y) * 10,
        idleTime: 0,
        flashIndex: 0,
        islandId: pen.islandId,
        penId: pen.id
      });
    }

    if (sheepSpot) {
      animals.push({
        id: `sheep-${index}`,
        type: "sheep",
        name: `Nuvem ${index + 1}`,
        x: sheepSpot.x,
        y: sheepSpot.y,
        vx: -0.12,
        vy: 0.14,
        phase: seededNoise(sheepSpot.x, sheepSpot.y) * 10,
        idleTime: 0,
        flashIndex: 0,
        islandId: pen.islandId,
        penId: pen.id
      });
    }
  });

  state.world.animals = animals;
}

function buildHousePens() {
  const houseObstacles = state.world.obstacles.filter((item) => item.kind === "house");
  state.world.pens = houseObstacles.map((house, index) => {
    const x = Math.round(house.x);
    const y = Math.round(house.y);
    const wHouse = house.w;
    const hHouse = house.h;
    const depth = Math.max(4, Math.floor(Math.min(wHouse, hHouse) * 0.09));
    const frontX = x;
    const frontY = y + 5;
    const frontW = wHouse - depth;
    const frontH = hHouse - 7;

    const pad = 9;
    const fx = frontX - pad;
    const fy = frontY - pad;
    const fw = frontW + depth + pad * 2;
    const fh = frontH + depth + pad * 2;
    const gateW = 16;
    const gateCenter = fx + fw / 2;

    const houseCenterX = x + wHouse / 2;
    const houseCenterY = y + hHouse / 2;
    const islandId = findClosestIslandId(houseCenterX, houseCenterY);

    return {
      id: `pen-${index}`,
      islandId,
      x: fx,
      y: fy,
      w: fw,
      h: fh,
      gate: {
        x1: gateCenter - gateW / 2,
        x2: gateCenter + gateW / 2,
        y: fy + fh
      }
    };
  });
}

function randomPointInPen(pen, seedBias = 0.5) {
  const margin = 10;
  for (let i = 0; i < 20; i += 1) {
    const rx = pen.x + margin + (pen.w - margin * 2) * seededNoise((pen.x + i * 17) * seedBias, pen.y + seedBias * 13);
    const ry = pen.y + margin + (pen.h - margin * 2) * seededNoise((pen.y + i * 23) * seedBias, pen.x + seedBias * 17);
    if (isOnLand(rx, ry)) {
      return { x: rx, y: ry };
    }
  }

  const centerX = pen.x + pen.w / 2;
  const centerY = pen.y + pen.h / 2;
  return { x: centerX, y: centerY };
}

function findClosestIslandId(x, y) {
  let closestId = state.islands[0]?.id || "ilha-direito";
  let minDist = Infinity;
  state.islands.forEach((island) => {
    const dist = distance(x, y, island.gate.x, island.gate.y);
    if (dist < minDist) {
      minDist = dist;
      closestId = island.id;
    }
  });
  return closestId;
}

function buildFlashcardsForIsland(islandId) {
  if (islandId === "ilha-direito") {
    return [
      { q: "O que é controle de convencionalidade?", a: "Compatibilizar leis internas com tratados de direitos humanos." },
      { q: "Caso clássico da Corte IDH?", a: "Almonacid Arellano vs Chile." },
      { q: "Foco do estudo jurídico nesta ilha?", a: "Jurisprudência e aplicação prática de tratados." }
    ];
  }
  if (islandId === "ilha-logica") {
    return [
      { q: "Qual a forma do modus ponens?", a: "Se A->B e A, então B." },
      { q: "Negação de 'todos estudam'?", a: "Pelo menos uma pessoa não estuda." },
      { q: "Como melhorar velocidade no simulado?", a: "Treino de blocos curtos com revisão constante." }
    ];
  }
  return [
    { q: "Prioridade na redação oficial?", a: "Clareza e objetividade." },
    { q: "Coesão textual significa?", a: "Conexão linguística entre partes do texto." },
    { q: "Estratégia para memorizar português?", a: "Revisar exemplos e padrões recorrentes." }
  ];
}

function findLandAround(x, y, radius) {
  const base = findNearestLand(x, y);
  if (!base) return null;
  for (let i = 0; i < 20; i += 1) {
    const ang = (i / 20) * Math.PI * 2;
    const px = base.x + Math.cos(ang) * (radius * 0.35);
    const py = base.y + Math.sin(ang) * (radius * 0.35);
    if (isOnLand(px, py) && !isNearStructure(px, py, 10)) {
      return { x: px, y: py };
    }
  }
  return base;
}

function carvePath(fromTile, toTile) {
  if (!fromTile || !toTile) return;
  let x = fromTile.tx;
  let y = fromTile.ty;
  const targetX = toTile.tx;
  const targetY = toTile.ty;

  while (x !== targetX || y !== targetY) {
    addPathTile(x, y);
    if (x !== targetX) x += x < targetX ? 1 : -1;
    addPathTile(x, y);
    if (y !== targetY) y += y < targetY ? 1 : -1;
    addPathTile(x, y);
  }
  addPathTile(targetX, targetY);
}

function addPathTile(tx, ty) {
  const { cols, rows } = state.world;
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return;
  if (!isLandTile(tx, ty)) return;
  state.world.pathTiles.add(tileKey(tx, ty));

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (const [ox, oy] of neighbors) {
    const nx = tx + ox;
    const ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    if (!isLandTile(nx, ny)) continue;
    if (seededNoise(nx, ny) > 0.58) {
      state.world.pathTiles.add(tileKey(nx, ny));
    }
  }
}

function isLandTile(tx, ty) {
  const { cols, rows, tiles } = state.world;
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
  return tiles[ty][tx] === 1;
}

function pixelToTile(x, y) {
  const { tileSize } = state.world;
  return { tx: Math.floor(x / tileSize), ty: Math.floor(y / tileSize) };
}

function tileKey(tx, ty) {
  return `${tx},${ty}`;
}

function seededNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function isNearStructure(x, y, padding) {
  for (const obstacle of state.world.obstacles) {
    if (
      x > obstacle.x - padding &&
      x < obstacle.x + obstacle.w + padding &&
      y > obstacle.y - padding &&
      y < obstacle.y + obstacle.h + padding
    ) {
      return true;
    }
  }

  for (const island of state.islands) {
    if (distance(x, y, island.gate.x, island.gate.y) < 20 + padding) return true;
  }

  return false;
}

function findNearestLand(px, py) {
  const { cols, rows, tileSize, tiles } = state.world;
  let best = null;
  let bestDist = Infinity;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (tiles[y][x] !== 1) continue;
      const cx = x * tileSize + tileSize / 2;
      const cy = y * tileSize + tileSize / 2;
      const d = distance(px, py, cx, cy);
      if (d < bestDist) {
        bestDist = d;
        best = { x: cx, y: cy };
      }
    }
  }

  return best;
}

function loadIsland(islandId) {
  const island = state.islands.find((item) => item.id === islandId);
  if (!island) return;

  state.currentIsland = island;
  state.questionIndex = 0;
  state.selectedOption = null;
  state.currentChallenge = island.challenge || null;
  state.selectedChallengeOption = null;
  el.phaseTitle.textContent = island.name;
  el.contentBox.textContent = island.content;
  renderIslandChallenge(island);

  const filter = el.questionFilter.value;
  state.questionPool = island.questions.filter((q) => {
    if (filter === "all") return true;
    if (filter === "tf") return q.type === "tf";
    if (filter === "mcq") return q.type === "mcq";
    return true;
  });

  if (el.repeatMode.value === "different") {
    state.questionPool = shuffle([...state.questionPool]);
  }

  if (!state.questionPool.length) {
    el.questionCard.classList.add("hidden");
    el.feedback.textContent = "Sem questões para esse filtro.";
    return;
  }

  el.questionCard.classList.remove("hidden");
  presentQuestion();
}

function renderIslandChallenge(island) {
  const challenge = island.challenge;
  if (!challenge) {
    el.islandChallengeBox.classList.add("hidden");
    return;
  }

  el.islandChallengeBox.classList.remove("hidden");
  el.challengeTitle.textContent = `Desafio • ${island.name}`;
  el.challengeText.textContent = challenge.prompt;
  el.challengeFeedback.textContent = "";
  el.challengeOptions.innerHTML = "";

  challenge.options.forEach((option) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="challengeOpt" value="${option}"> ${option}`;
    label.querySelector("input").addEventListener("change", (event) => {
      state.selectedChallengeOption = event.target.value;
    });
    el.challengeOptions.appendChild(label);
  });

  if (state.solvedChallenges[island.id]) {
    el.challengeFeedback.innerHTML = '<span class="good">Desafio já concluído nesta sessão.</span>';
  }
}

function checkIslandChallenge() {
  if (!state.currentIsland || !state.currentChallenge) return;
  if (!state.selectedChallengeOption) {
    el.challengeFeedback.innerHTML = '<span class="bad">Selecione uma opção.</span>';
    return;
  }

  const correct = state.selectedChallengeOption === state.currentChallenge.answer;
  if (correct) {
    if (!state.solvedChallenges[state.currentIsland.id]) {
      state.player.xp += 12;
      state.player.coins += 4;
      state.solvedChallenges[state.currentIsland.id] = true;
      updateStats();
    }
    el.challengeFeedback.innerHTML = '<span class="good">Desafio concluído! +12 XP e +4 moedas.</span>';
  } else {
    el.challengeFeedback.innerHTML = '<span class="bad">Resposta incorreta. Tente novamente.</span>';
  }
}

function toggleMapFullscreen() {
  const container = document.querySelector(".world-wrap");
  if (!container) return;
  if (!document.fullscreenElement) {
    container.requestFullscreen?.();
    return;
  }
  document.exitFullscreen?.();
}

function showAnimalFlashcard(animal) {
  const deck = buildFlashcardsForAnimal(animal);
  const card = deck[animal.flashIndex % deck.length];
  animal.flashIndex += 1;
  const island = state.islands.find((item) => item.id === animal.islandId);
  const islandName = island ? island.name : "Ilha";
  el.flashcardBox.classList.remove("hidden");
  el.flashcardBox.innerHTML = `
    <h4>${animal.name} (${animal.type === "cow" ? "Vaquinha" : "Ovelha"})</h4>
    <small>Contexto: ${islandName}</small>
    <p><strong>Pergunta:</strong> ${card.q}</p>
    <p><strong>Resposta:</strong> ${card.a}</p>
    <div class="actions" style="margin-top:8px;">
      <button id="nextFlashcardBtn">Próximo flashcard</button>
      <button id="closeFlashcardBtn" class="ghost">Fechar</button>
    </div>
    <small>Pressione E para próximo flashcard ou Esc para fechar.</small>
  `;

  const nextBtn = document.getElementById("nextFlashcardBtn");
  const closeBtn = document.getElementById("closeFlashcardBtn");
  nextBtn?.addEventListener("click", () => {
    const current = state.world.animals.find((item) => item.id === animal.id);
    if (current) showAnimalFlashcard(current);
  });
  closeBtn?.addEventListener("click", closeAnimalFlashcard);
}

function buildFlashcardsForAnimal(animal) {
  if (animal.type === "cow") {
    return buildNewTopicDeck(animal.islandId);
  }
  return buildIslandNotesDeck(animal.islandId);
}

function buildNewTopicDeck(islandId) {
  if (islandId === "ilha-direito") {
    return [
      { q: "Novo assunto sugerido: responsabilidade internacional do Estado. O que estudar primeiro?", a: "Elementos do ato ilícito internacional e dever de reparação." },
      { q: "Novo assunto sugerido: bloco de convencionalidade.", a: "Relação entre tratados de direitos humanos e controle interno." },
      { q: "Novo assunto sugerido: precedentes da Corte IDH.", a: "Comparar fatos, fundamento e efeito prático em casos-chave." }
    ];
  }
  if (islandId === "ilha-logica") {
    return [
      { q: "Novo assunto sugerido: tabelas-verdade avançadas.", a: "Treinar equivalências e identificação de tautologias." },
      { q: "Novo assunto sugerido: lógica de predicados.", a: "Praticar negações com quantificadores universal/existencial." },
      { q: "Novo assunto sugerido: argumentos inválidos comuns.", a: "Mapear falácias e contraexemplos rápidos." }
    ];
  }
  return [
    { q: "Novo assunto sugerido: concordância verbal avançada.", a: "Revisar casos especiais e estruturas com sujeito oracional." },
    { q: "Novo assunto sugerido: coesão referencial.", a: "Identificar pronomes e retomadas para evitar ambiguidade." },
    { q: "Novo assunto sugerido: reescrita sem perda de sentido.", a: "Treinar paráfrase mantendo registro formal." }
  ];
}

function buildIslandNotesDeck(islandId) {
  const notes = state.notes
    .filter((item) => item.islandId === islandId)
    .sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt)
    .slice(0, 12);

  if (!notes.length) {
    return [{ q: "Sem anotações dessa ilha ainda.", a: "Abra a fase da ilha, registre notas e volte para revisar com a ovelha." }];
  }

  return notes.map((note, idx) => ({
    q: `Anotação ${idx + 1}: qual ponto-chave você registrou?`,
    a: note.text
  }));
}

function hideFlashcard() {
  el.flashcardBox.classList.add("hidden");
}

function closeAnimalFlashcard() {
  state.world.lockedAnimalId = null;
  hideFlashcard();
}

function updateAnimals(dt) {
  for (const animal of state.world.animals) {
    if (state.world.lockedAnimalId === animal.id) {
      animal.idleTime = 8;
      continue;
    }

    const nearPlayer = distance(animal.x, animal.y, state.world.playerPos.x, state.world.playerPos.y) < 44;
    if (nearPlayer) {
      animal.idleTime = 6;
      continue;
    }

    if (animal.idleTime > 0) {
      animal.idleTime -= dt;
      continue;
    }

    const pen = state.world.pens.find((item) => item.id === animal.penId);
    if (!pen) continue;

    const nextX = animal.x + animal.vx * dt;
    const nextY = animal.y + animal.vy * dt;

    const margin = 7;
    const minX = pen.x + margin;
    const maxX = pen.x + pen.w - margin;
    const minY = pen.y + margin;
    const maxY = pen.y + pen.h - margin;

    const insideX = nextX >= minX && nextX <= maxX;
    const insideY = nextY >= minY && nextY <= maxY;

    if (insideX && insideY && isOnLand(nextX, nextY)) {
      animal.x = nextX;
      animal.y = nextY;
    } else {
      animal.vx *= -1;
      animal.vy *= -1;
      animal.x = clamp(animal.x, minX, maxX);
      animal.y = clamp(animal.y, minY, maxY);
    }

    if (seededNoise(Math.floor(animal.x), Math.floor(animal.y)) > 0.985) {
      animal.vx = (seededNoise(animal.y, animal.x) - 0.5) * 0.9;
      animal.vy = (seededNoise(animal.x + 1, animal.y + 1) - 0.5) * 0.9;
      animal.idleTime = 18;
    }
  }
}

function presentQuestion() {
  const question = state.questionPool[state.questionIndex];
  state.currentQuestion = question;
  state.selectedOption = null;

  el.feedback.textContent = "";
  el.questionText.textContent = question.prompt;
  el.optionsBox.innerHTML = "";
  el.essayAnswer.classList.add("hidden");
  el.essayAnswer.value = "";

  if (question.type === "mcq") {
    question.options.forEach((opt) => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="opt" value="${opt}"> ${opt}`;
      label.querySelector("input").addEventListener("change", (event) => {
        state.selectedOption = event.target.value;
      });
      el.optionsBox.appendChild(label);
    });
  } else if (question.type === "tf") {
    ["certo", "errado"].forEach((opt) => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="opt" value="${opt}"> ${opt.toUpperCase()}`;
      label.querySelector("input").addEventListener("change", (event) => {
        state.selectedOption = event.target.value;
      });
      el.optionsBox.appendChild(label);
    });
  } else {
    el.essayAnswer.classList.remove("hidden");
  }
}

function answerQuestion() {
  if (!state.currentQuestion) return;

  const now = Date.now();
  if (state.race.running && now < state.race.cooldownUntil) {
    const wait = Math.ceil((state.race.cooldownUntil - now) / 1000);
    el.feedback.innerHTML = `<span class="bad">Espere ${wait}s antes da próxima resposta (anti-burla).</span>`;
    return;
  }

  let correct = false;
  if (state.currentQuestion.type === "essay") {
    const answer = el.essayAnswer.value.toLowerCase();
    const hit = state.currentQuestion.keywords.filter((k) => answer.includes(k)).length;
    correct = hit >= 2;
  } else {
    correct = (state.selectedOption || "") === state.currentQuestion.answer;
  }

  state.player.lastStudyAt = new Date().toISOString();

  if (correct) {
    grantRewards(state.currentQuestion);
    el.feedback.innerHTML = "<span class=\"good\">Acertou! +15 XP, +5 moedas, +1 bloco.</span>";
    if (state.race.running) advancePlayerInRace();
  } else {
    el.feedback.innerHTML = `<span class="bad">Errou. Dica: ${guideHint()}</span>`;
  }

  state.player.attempts.push(correct ? 1 : 0);
  drawChart();
  updateStats();

  if (state.race.running) {
    state.race.cooldownUntil = Date.now() + 5000;
    el.raceStatus.textContent = "Cooldown de 5s ativo para próxima questão.";
  }
}

function guideHint() {
  const mode = el.responseSize.value;
  const hints = {
    curto: "Leia o núcleo da pergunta e elimine alternativas absurdas.",
    medio: "Busque palavra-chave e vínculo com o conteúdo da ilha antes de responder.",
    completo: "Conecte conceito, exceção e exemplo prático. Em dúvida, revise a teoria e tente novamente.",
    complexo: "Mapeie premissas, identifique tese central e valide com jurisprudência ou regra técnica equivalente."
  };
  return paintKeywords(hints[mode] || hints.curto);
}

function paintKeywords(text) {
  return text
    .replaceAll("DEVE", '<span class="word-deve">DEVE</span>')
    .replaceAll("PODE", '<span class="word-pode">PODE</span>');
}

function grantRewards(question) {
  state.player.xp += 15;
  state.player.coins += 5;
  state.player.blocks += 1;
  state.player.learnedConcepts.push(question.concept);
  addBlockToPalace(question.concept);

  while (state.player.xp >= state.player.level * 100) {
    state.player.level += 1;
  }
}

function nextQuestion() {
  if (!state.currentIsland) return;
  state.questionIndex += 1;

  if (state.questionIndex >= state.questionPool.length) {
    if (el.repeatMode.value === "same") {
      state.questionIndex = 0;
    } else {
      state.questionPool = shuffle([...state.currentIsland.questions]);
      state.questionIndex = 0;
    }
  }
  presentQuestion();
}

function updateStats() {
  el.level.textContent = state.player.level;
  el.xp.textContent = state.player.xp;
  el.coins.textContent = state.player.coins;
  el.blocks.textContent = state.player.blocks;

  const allQuestions = state.islands.reduce((acc, island) => acc + island.questions.length, 0);
  const learned = new Set(state.player.learnedConcepts).size;
  const percent = Math.min(100, Math.round((learned / allQuestions) * 100));
  el.globalProgressBar.style.width = `${percent}%`;
  el.globalProgressText.textContent = `${percent}%`;
}

function drawChart() {
  const canvas = el.progressChart;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const data = state.player.attempts.slice(-30);
  if (!data.length) return;

  const gap = canvas.width / Math.max(1, data.length - 1);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = i * gap;
    const y = canvas.height - (v * (canvas.height - 10) + 5);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function saveForReview(type) {
  if (!state.currentIsland) return;

  const base = {
    id: `${Date.now()}-${Math.random()}`,
    island: state.currentIsland.name,
    type,
    text: type === "content" ? state.currentIsland.content : state.currentQuestion?.prompt,
    stage: 0,
    nextAt: Date.now() + 60 * 1000
  };

  if (!base.text) return;
  state.reviewQueue.push(base);
  renderReviewList();
}

function renderReviewList() {
  el.reviewList.innerHTML = "";
  const now = Date.now();
  state.reviewQueue.slice(-12).forEach((item) => {
    const li = document.createElement("li");
    const due = item.nextAt <= now ? "disponível" : `em ${Math.ceil((item.nextAt - now) / 1000)}s`;
    li.textContent = `[${item.type}] ${item.text.slice(0, 60)}... (${due})`;
    el.reviewList.appendChild(li);
  });
}

function runReviewSession() {
  const now = Date.now();
  const due = state.reviewQueue.filter((item) => item.nextAt <= now);
  if (!due.length) {
    el.reviewList.innerHTML = "<li>Nenhum item pronto para revisão agora.</li>";
    return;
  }

  due.forEach((item) => {
    item.stage += 1;
    const steps = [60, 180, 420, 900];
    item.nextAt = now + (steps[item.stage] || 1200) * 1000;
  });

  el.reviewList.innerHTML = due.map((item) => `<li>Revisado: ${item.text.slice(0, 70)}...</li>`).join("");
}

function startRace() {
  state.race.running = true;
  state.race.racers.forEach((racer) => {
    racer.progress = 0;
  });
  state.race.cooldownUntil = 0;
  if (state.race.timer) clearInterval(state.race.timer);

  state.race.timer = setInterval(() => {
    state.race.racers.slice(1).forEach((bot) => {
      bot.progress = Math.min(100, bot.progress + Math.random() * 8);
    });
    checkRaceEnd();
    renderRace();
  }, 1200);

  el.raceStatus.textContent = "Corrida iniciada! Responda para avançar.";
  renderRace();
}

function advancePlayerInRace() {
  const playerRacer = state.race.racers[0];
  playerRacer.progress = Math.min(100, playerRacer.progress + 14);
  checkRaceEnd();
  renderRace();
}

function checkRaceEnd() {
  const winner = state.race.racers.find((racer) => racer.progress >= 100);
  if (!winner) return;

  state.race.running = false;
  clearInterval(state.race.timer);
  el.raceStatus.textContent = `${winner.name} venceu a corrida!`;

  if (winner.name === "Você") {
    state.player.coins += 20;
    state.player.xp += 30;
    updateStats();
  }
}

function renderRace() {
  el.raceTrack.innerHTML = "";
  state.race.racers.forEach((racer) => {
    const row = document.createElement("div");
    row.className = "racer";
    row.innerHTML = `<small>${racer.name} - ${Math.floor(racer.progress)}%</small><div style="width:${racer.progress}%"></div>`;
    el.raceTrack.appendChild(row);
  });
}

function saveCompanion() {
  state.companion.style = el.petStyle.value;
  state.companion.mood = el.petMood.value;
  state.companion.goals = el.goalsInput.value
    .split("\n")
    .map((goal) => goal.trim())
    .filter(Boolean);
  companionNudge();
}

function companionNudge() {
  const mood = state.companion.mood;
  const goals = state.companion.goals;
  const randomGoal = goals[Math.floor(Math.random() * goals.length)] || "seu objetivo";

  const days = daysWithoutStudy();
  let msg;

  if (mood === "agressivo") {
    msg = days > 0
      ? `${days} dias sem estudar? Foco! Sem disciplina você não alcança ${randomGoal}.`
      : `Bora estudar agora para conquistar ${randomGoal}.`;
  } else if (mood === "zen") {
    msg = days > 0
      ? `Respira. Vamos retomar com calma e consistência rumo a ${randomGoal}.`
      : `Um passo por vez. Hoje já rende progresso para ${randomGoal}.`;
  } else {
    msg = days > 0
      ? `Senti sua falta nos estudos. Vamos voltar e chegar em ${randomGoal}.`
      : `Mandou bem! Continue que ${randomGoal} está mais perto.`;
  }

  el.companionSpeech.innerHTML = paintKeywords(`${msg} Você DEVE manter ritmo e PODE descansar com estratégia.`);
}

function daysWithoutStudy() {
  if (!state.player.lastStudyAt) return 0;
  const last = new Date(state.player.lastStudyAt).getTime();
  return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
}

function saveNote() {
  const text = el.noteText.value.trim();
  if (!text) return;

  const islandId = resolveCurrentIslandContextId();
  const islandName = state.islands.find((item) => item.id === islandId)?.name || "ilha atual";

  state.notes.push({
    text,
    priority: Number(el.notePriority.value) || 3,
    islandId,
    createdAt: Date.now()
  });

  el.noteText.value = "";
  el.recallOutput.textContent = `Nota salva para memorex (${islandName}).`;
}

function resolveCurrentIslandContextId() {
  if (state.currentIsland?.id) return state.currentIsland.id;

  let closestId = state.islands[0]?.id || "ilha-direito";
  let minDist = Infinity;
  state.islands.forEach((island) => {
    const dist = distance(state.world.playerPos.x, state.world.playerPos.y, island.gate.x, island.gate.y);
    if (dist < minDist) {
      minDist = dist;
      closestId = island.id;
    }
  });
  return closestId;
}

function petRecall() {
  if (!state.notes.length) {
    el.recallOutput.textContent = "Sem notas ainda.";
    return;
  }

  const ratio = Number(el.noteRatio.value);
  const byPriority = [...state.notes].sort((a, b) => b.priority - a.priority);
  const byOld = [...state.notes].sort((a, b) => a.createdAt - b.createdAt);

  const picks = [];
  for (let i = 0; i < ratio; i += 1) {
    if (byPriority[i]) picks.push(byPriority[i].text);
  }
  if (byOld[0]) picks.push(byOld[0].text);

  el.recallOutput.innerHTML = paintKeywords(`Memorex do ${state.companion.style}: ${picks.join(" | ")}`);
}

function addBlockToPalace(concept) {
  const block = document.createElement("button");
  block.className = "block";
  block.textContent = concept.split(" ").slice(0, 3).join(" ");
  block.title = concept;
  block.addEventListener("click", () => {
    alert(`Bloco de memória: ${concept}`);
  });
  el.memoryPalace.appendChild(block);
}

function buildSchedule() {
  const subjects = el.subjectsInput.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const examDate = el.examDate.value;
  if (!subjects.length || !examDate) return;

  const today = new Date();
  const end = new Date(examDate);
  const diffDays = Math.max(1, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
  const perDay = Math.max(1, Math.ceil(subjects.length / diffDays));

  el.scheduleList.innerHTML = "";
  let index = 0;
  for (let day = 0; day < Math.min(diffDays, 20) && index < subjects.length; day += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const li = document.createElement("li");
    const group = subjects.slice(index, index + perDay);
    index += perDay;
    li.textContent = `${date.toLocaleDateString("pt-BR")}: ${group.join(", ")}`;
    el.scheduleList.appendChild(li);
  }
}

function initNpc() {
  Object.keys(state.npcMemory).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    el.npcSelect.appendChild(option);
  });
}

function sendNpcMessage() {
  const npc = el.npcSelect.value;
  const text = el.npcInput.value.trim();
  if (!text) return;

  state.npcMemory[npc].push({ role: "player", text });
  const response = npcResponse(npc, state.npcMemory[npc]);
  state.npcMemory[npc].push({ role: "npc", text: response });

  appendChat(`Você: ${text}`);
  appendChat(`${npc}: ${response}`);
  el.npcInput.value = "";
}

function npcResponse(npc, memory) {
  const recalls = memory
    .filter((item) => item.role === "player")
    .slice(-2)
    .map((item) => item.text)
    .join(" | ");

  const base = {
    Mentor: "Conecte teoria com prática e avance por blocos curtos.",
    Guardião: "Treine velocidade: certo/errado e revisão constante.",
    Bibliotecária: "Organize tópicos por tema e revisite em ciclos."
  };

  return `${base[npc]} Lembro que você falou: ${recalls}`;
}

function appendChat(msg) {
  const div = document.createElement("div");
  div.className = "chat-msg";
  div.textContent = msg;
  el.chatLog.appendChild(div);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function distance(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

init();
