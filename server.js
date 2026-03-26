const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --------------- In-memory user store ---------------
const users = new Map();

// --------------- REST API ---------------
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios.' });
    }
    if (users.has(email)) {
      return res.status(409).json({ error: 'Email ja cadastrado.' });
    }
    const hash = await bcrypt.hash(password, 10);
    users.set(email, { name, email, hash });
    return res.json({ ok: true, user: { name, email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
    }
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }
    const match = await bcrypt.compare(password, user.hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciais invalidas.' });
    }
    return res.json({ ok: true, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// --------------- Google OAuth2 ---------------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Token nao fornecido.' });
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    const email = payload.email;
    const name = payload.name || payload.email.split('@')[0];
    const picture = payload.picture || '';

    if (!users.has(email)) {
      users.set(email, { name, email, hash: null, googleUser: true, picture });
    }

    const user = users.get(email);
    return res.json({ ok: true, user: { name: user.name, email: user.email, picture: user.picture || '' } });
  } catch (err) {
    console.error('Google auth error:', err.message);
    return res.status(401).json({ error: 'Token do Google invalido.' });
  }
});

app.get('/api/auth/google-client-id', (req, res) => {
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

// ===============================================================
//  QUIZ QUESTION BANK
// ===============================================================
const questions = {
  matematica: [
    { q: "Quanto e 7 x 8?", options: ["54", "56", "58", "64"], answer: 1 },
    { q: "Raiz quadrada de 144?", options: ["10", "11", "12", "14"], answer: 2 },
    { q: "Quanto e 15% de 200?", options: ["25", "30", "35", "40"], answer: 1 },
    { q: "Qual e o valor de pi aproximado?", options: ["3.14", "2.71", "1.61", "3.41"], answer: 0 },
    { q: "2 ao cubo e igual a?", options: ["6", "8", "9", "12"], answer: 1 },
    { q: "Quanto e 144 / 12?", options: ["10", "11", "12", "13"], answer: 2 },
    { q: "Qual e o MMC de 4 e 6?", options: ["12", "24", "6", "8"], answer: 0 },
    { q: "Quanto e 3! (fatorial)?", options: ["3", "6", "9", "12"], answer: 1 },
    { q: "Area de um quadrado de lado 5?", options: ["20", "25", "30", "10"], answer: 1 },
    { q: "Soma dos angulos de um triangulo?", options: ["90 graus", "180 graus", "270 graus", "360 graus"], answer: 1 }
  ],
  historia: [
    { q: "Em que ano o Brasil foi descoberto?", options: ["1498", "1500", "1502", "1510"], answer: 1 },
    { q: "Quem proclamou a independencia do Brasil?", options: ["Tiradentes", "D. Pedro I", "D. Pedro II", "Getulio"], answer: 1 },
    { q: "Revolucao Francesa comecou em?", options: ["1776", "1789", "1799", "1804"], answer: 1 },
    { q: "Primeira Guerra Mundial comecou em?", options: ["1912", "1914", "1916", "1918"], answer: 1 },
    { q: "Quem pintou a Mona Lisa?", options: ["Michelangelo", "Da Vinci", "Rafael", "Donatello"], answer: 1 },
    { q: "Egito Antigo ficava em qual continente?", options: ["Asia", "Europa", "Africa", "America"], answer: 2 },
    { q: "Quem foi o primeiro presidente do Brasil?", options: ["Getulio", "Deodoro", "Prudente", "Floriano"], answer: 1 },
    { q: "A escravidao acabou no Brasil em?", options: ["1822", "1850", "1888", "1900"], answer: 2 },
    { q: "Imperio Romano caiu em que seculo?", options: ["III", "IV", "V", "VI"], answer: 2 },
    { q: "Guerra Fria foi entre?", options: ["EUA e China", "EUA e URSS", "EUA e Japao", "EUA e UK"], answer: 1 }
  ],
  ciencias: [
    { q: "Qual e a formula da agua?", options: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },
    { q: "Velocidade da luz (km/s)?", options: ["150.000", "200.000", "300.000", "400.000"], answer: 2 },
    { q: "Quantos ossos tem o corpo humano?", options: ["106", "156", "206", "256"], answer: 2 },
    { q: "Qual planeta e o maior do sistema solar?", options: ["Saturno", "Jupiter", "Netuno", "Urano"], answer: 1 },
    { q: "DNA significa?", options: ["Acido desoxirribonucleico", "Acido dinucleico", "Acido dioxirribo", "Adenina nucleica"], answer: 0 },
    { q: "Qual e o elemento mais abundante no universo?", options: ["Oxigenio", "Carbono", "Hidrogenio", "Helio"], answer: 2 },
    { q: "Fotossintese produz?", options: ["CO2", "Oxigenio", "Nitrogenio", "Metano"], answer: 1 },
    { q: "Unidade de forca no SI?", options: ["Watt", "Joule", "Newton", "Pascal"], answer: 2 },
    { q: "Quantos cromossomos tem um humano?", options: ["23", "44", "46", "48"], answer: 2 },
    { q: "Qual orgao produz insulina?", options: ["Figado", "Pancreas", "Rim", "Coracao"], answer: 1 }
  ],
  linguas: [
    { q: "'Hello' em japones?", options: ["Annyeong", "Konnichiwa", "Ni hao", "Sawadee"], answer: 1 },
    { q: "Qual idioma tem mais falantes nativos?", options: ["Ingles", "Espanhol", "Mandarim", "Hindi"], answer: 2 },
    { q: "'Obrigado' em frances?", options: ["Grazie", "Merci", "Danke", "Gracias"], answer: 1 },
    { q: "Quantas letras tem o alfabeto ingles?", options: ["24", "25", "26", "27"], answer: 2 },
    { q: "'Amor' em italiano?", options: ["Amore", "Amour", "Liebe", "Love"], answer: 0 },
    { q: "Qual lingua usa o alfabeto cirilico?", options: ["Grego", "Russo", "Arabe", "Japones"], answer: 1 },
    { q: "'Goodbye' em espanhol?", options: ["Au revoir", "Adios", "Tschuss", "Arrivederci"], answer: 1 },
    { q: "Plural de 'child' em ingles?", options: ["Childs", "Childrens", "Children", "Childes"], answer: 2 },
    { q: "O esperanto foi criado por?", options: ["Chomsky", "Zamenhof", "Tolkien", "Saussure"], answer: 1 },
    { q: "'Bom dia' em alemao?", options: ["Bonjour", "Guten Morgen", "Buenos dias", "Buongiorno"], answer: 1 }
  ],
  programacao: [
    { q: "O que HTML significa?", options: ["HyperText Markup Language", "High Tech ML", "HyperTransfer ML", "Home Tool ML"], answer: 0 },
    { q: "Qual NAO e linguagem de programacao?", options: ["Python", "Java", "HTML", "C++"], answer: 2 },
    { q: "console.log() e de qual linguagem?", options: ["Python", "Java", "JavaScript", "C#"], answer: 2 },
    { q: "O que CSS controla?", options: ["Logica", "Estilo visual", "Banco de dados", "Servidor"], answer: 1 },
    { q: "Git e usado para?", options: ["Design", "Versionamento", "Compilacao", "Teste"], answer: 1 },
    { q: "Qual e o operador de igualdade estrita em JS?", options: ["==", "===", "!=", ">="], answer: 1 },
    { q: "Python e tipagem?", options: ["Estatica", "Dinamica", "Nenhuma", "Fixa"], answer: 1 },
    { q: "SQL e usado para?", options: ["Estilo", "Banco de dados", "Animacao", "Rede"], answer: 1 },
    { q: "O que e um array?", options: ["Uma funcao", "Uma lista ordenada", "Um estilo", "Um servidor"], answer: 1 },
    { q: "Localhost geralmente usa porta?", options: ["80", "443", "3000", "8080"], answer: 2 }
  ]
};

// ===============================================================
//  GAME CONSTANTS
// ===============================================================
const MAP_W = 4000;
const MAP_H = 4000;

const PLAYER_COLORS = [
  '#00e5ff', '#76ff03', '#ffea00', '#ff6d00',
  '#e040fb', '#ff1744', '#00e676', '#2979ff',
  '#f50057', '#00bfa5', '#ffd600', '#d500f9'
];
let colorIndex = 0;
function nextColor() {
  const c = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  colorIndex++;
  return c;
}

// ===============================================================
//  ISLAND DEFINITIONS
// ===============================================================
const islands = [
  { id: 'matematica', name: 'Ilha da Matematica', x: 700, y: 700, rx: 380, ry: 320, category: 'matematica', theme: 'blue' },
  { id: 'historia', name: 'Ilha da Historia', x: 3300, y: 700, rx: 380, ry: 320, category: 'historia', theme: 'brown' },
  { id: 'ciencias', name: 'Ilha das Ciencias', x: 2000, y: 1600, rx: 400, ry: 340, category: 'ciencias', theme: 'green' },
  { id: 'linguas', name: 'Ilha das Linguas', x: 700, y: 3300, rx: 380, ry: 320, category: 'linguas', theme: 'purple' },
  { id: 'programacao', name: 'Ilha da Programacao', x: 3300, y: 3300, rx: 380, ry: 320, category: 'programacao', theme: 'neon' },
  { id: 'central', name: 'Ilha Central', x: 2000, y: 2800, rx: 450, ry: 380, category: null, theme: 'gold' }
];

// Bridges connecting islands
const bridges = [
  { from: 'matematica', to: 'ciencias' },
  { from: 'historia', to: 'ciencias' },
  { from: 'ciencias', to: 'central' },
  { from: 'linguas', to: 'central' },
  { from: 'programacao', to: 'central' },
  { from: 'matematica', to: 'linguas' },
  { from: 'historia', to: 'programacao' }
];

// Quiz totems per island
const totems = [];
islands.forEach(isl => {
  if (!isl.category) {
    // Central island has one totem of each category
    const cats = ['matematica', 'historia', 'ciencias', 'linguas', 'programacao'];
    cats.forEach((cat, i) => {
      const angle = (i / cats.length) * Math.PI * 2;
      totems.push({
        id: 'totem_' + isl.id + '_' + i,
        x: isl.x + Math.cos(angle) * isl.rx * 0.5,
        y: isl.y + Math.sin(angle) * isl.ry * 0.5,
        category: cat,
        island: isl.id
      });
    });
  } else {
    // 3 totems per themed island
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.3;
      totems.push({
        id: 'totem_' + isl.id + '_' + i,
        x: isl.x + Math.cos(angle) * isl.rx * 0.45,
        y: isl.y + Math.sin(angle) * isl.ry * 0.45,
        category: isl.category,
        island: isl.id
      });
    }
  }
});

// ===============================================================
//  GAME STATE
// ===============================================================
const players = {};   // socketId -> player data
const enemies = {};   // id -> enemy data
const bullets = [];   // { id, ownerId, x, y, vx, vy, dist, maxDist, color }
const activeQuizzes = {}; // socketId -> { enemyId, questionIndex, category, timestamp, totemId }

let enemyIdCounter = 0;
const MAX_ENEMIES = 30;
const ENEMY_SPAWN_INTERVAL = 3000;
const QUIZ_TIME_LIMIT = 10000; // 10 seconds

function getIslandAt(x, y) {
  for (const isl of islands) {
    const dx = x - isl.x;
    const dy = y - isl.y;
    if ((dx * dx) / (isl.rx * isl.rx) + (dy * dy) / (isl.ry * isl.ry) <= 1) return isl;
  }
  return null;
}

function isOnIsland(x, y) {
  return getIslandAt(x, y) !== null;
}

function isOnBridge(x, y) {
  for (const br of bridges) {
    const fromIsl = islands.find(i => i.id === br.from);
    const toIsl = islands.find(i => i.id === br.to);
    if (!fromIsl || !toIsl) continue;

    const dx = toIsl.x - fromIsl.x;
    const dy = toIsl.y - fromIsl.y;
    const len = Math.hypot(dx, dy);
    const nx = dx / len;
    const ny = dy / len;

    // Project point onto bridge line
    const px = x - fromIsl.x;
    const py = y - fromIsl.y;
    const proj = px * nx + py * ny;

    if (proj < 0 || proj > len) continue;

    // Distance from bridge line
    const perpDist = Math.abs(px * (-ny) + py * nx);
    if (perpDist < 30) return true; // bridge width
  }
  return false;
}

function isOnLand(x, y) {
  return isOnIsland(x, y) || isOnBridge(x, y);
}

function randomSpawnOnIsland() {
  const isl = islands[Math.floor(Math.random() * islands.length)];
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * 0.4;
  return {
    x: isl.x + Math.cos(angle) * isl.rx * r,
    y: isl.y + Math.sin(angle) * isl.ry * r
  };
}

function getRandomQuestion(category) {
  const pool = questions[category];
  if (!pool || pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return { index: idx, ...pool[idx] };
}

function getCategoryForEnemy(enemy) {
  const isl = islands.find(i => i.id === enemy.island);
  if (isl && isl.category) return isl.category;
  // If on central island pick random
  const cats = Object.keys(questions);
  return cats[Math.floor(Math.random() * cats.length)];
}

// ===============================================================
//  ENEMY SPAWNING
// ===============================================================
function spawnEnemy() {
  if (Object.keys(enemies).length >= MAX_ENEMIES) return;
  if (Object.keys(players).length === 0) return;

  // Pick a themed island (not central)
  const themedIslands = islands.filter(i => i.category !== null);
  const isl = themedIslands[Math.floor(Math.random() * themedIslands.length)];

  const isBoss = Math.random() < 0.15;
  const angle = Math.random() * Math.PI * 2;
  const r = 0.3 + Math.random() * 0.5;

  const id = 'e' + (++enemyIdCounter);
  enemies[id] = {
    id,
    x: isl.x + Math.cos(angle) * isl.rx * r,
    y: isl.y + Math.sin(angle) * isl.ry * r,
    hp: isBoss ? 6 : 3,
    maxHp: isBoss ? 6 : 3,
    type: isBoss ? 'boss' : 'normal',
    speed: isBoss ? 0.8 : 1.4,
    size: isBoss ? 28 : 16,
    island: isl.id,
    patrolAngle: Math.random() * Math.PI * 2,
    patrolCenterX: isl.x + Math.cos(angle) * isl.rx * r * 0.5,
    patrolCenterY: isl.y + Math.sin(angle) * isl.ry * r * 0.5,
    patrolRadius: 40 + Math.random() * 60,
    chasing: false,
    flashUntil: 0
  };
}

function findNearestPlayer(ex, ey, range) {
  let best = null;
  let bestDist = range || Infinity;
  for (const sid in players) {
    const p = players[sid];
    if (p.health <= 0) continue;
    const d = Math.hypot(p.x - ex, p.y - ey);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

// ===============================================================
//  GAME TICK
// ===============================================================
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;
let lastSpawn = Date.now();

function gameTick() {
  const now = Date.now();

  // Spawn enemies
  if (now - lastSpawn > ENEMY_SPAWN_INTERVAL) {
    spawnEnemy();
    lastSpawn = now;
  }

  // Move enemies
  for (const eid in enemies) {
    const e = enemies[eid];
    const nearPlayer = findNearestPlayer(e.x, e.y, 200);

    if (nearPlayer) {
      // Chase mode
      e.chasing = true;
      const dx = nearPlayer.x - e.x;
      const dy = nearPlayer.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        e.x += (dx / dist) * e.speed;
        e.y += (dy / dist) * e.speed;
      }

      // Collision with player - deal damage
      if (dist < e.size + 16) {
        nearPlayer.health -= 10;
        if (nearPlayer.health < 0) nearPlayer.health = 0;
        io.to(nearPlayer.id).emit('damage', { health: nearPlayer.health });

        if (nearPlayer.health <= 0) {
          io.to(nearPlayer.id).emit('dead');
          io.emit('killfeed', { text: nearPlayer.name + ' foi derrotado!' });
        }

        // Push enemy back
        if (dist > 0) {
          e.x -= (dx / dist) * 30;
          e.y -= (dy / dist) * 30;
        }
      }
    } else {
      // Patrol mode - circle around patrol center
      e.chasing = false;
      e.patrolAngle += 0.01;
      const targetX = e.patrolCenterX + Math.cos(e.patrolAngle) * e.patrolRadius;
      const targetY = e.patrolCenterY + Math.sin(e.patrolAngle) * e.patrolRadius;
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        e.x += (dx / dist) * e.speed * 0.5;
        e.y += (dy / dist) * e.speed * 0.5;
      }
    }

    // Clamp to map
    e.x = Math.max(20, Math.min(MAP_W - 20, e.x));
    e.y = Math.max(20, Math.min(MAP_H - 20, e.y));
  }

  // Move bullets and check collision
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.dist += Math.hypot(b.vx, b.vy);

    if (b.dist > b.maxDist || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
      bullets.splice(i, 1);
      continue;
    }

    // Check against enemies
    let hit = false;
    for (const eid in enemies) {
      const e = enemies[eid];
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < e.size + 6) {
        // Instead of direct damage, trigger quiz for the shooter
        const shooter = players[b.ownerId];
        if (shooter && !activeQuizzes[b.ownerId]) {
          const category = getCategoryForEnemy(e);
          const question = getRandomQuestion(category);
          if (question) {
            activeQuizzes[b.ownerId] = {
              enemyId: eid,
              questionIndex: question.index,
              category: category,
              correctAnswer: question.answer,
              timestamp: now
            };
            io.to(b.ownerId).emit('quizStart', {
              enemyId: eid,
              question: question.q,
              options: question.options,
              timeLimit: QUIZ_TIME_LIMIT / 1000,
              category: category
            });
          }
        }
        e.flashUntil = now + 150;
        hit = true;
        break;
      }
    }
    if (hit) {
      bullets.splice(i, 1);
    }
  }

  // Check quiz timeouts
  for (const sid in activeQuizzes) {
    const quiz = activeQuizzes[sid];
    if (now - quiz.timestamp > QUIZ_TIME_LIMIT) {
      // Timeout = wrong answer
      const player = players[sid];
      if (player) {
        player.health -= 15;
        if (player.health < 0) player.health = 0;
        const correctIdx = quiz.correctAnswer;
        const category = quiz.category;
        const pool = questions[category];
        const correctText = pool && pool[quiz.questionIndex] ? pool[quiz.questionIndex].options[correctIdx] : '';
        io.to(sid).emit('quizResult', {
          correct: false,
          xp: 0,
          coins: 0,
          damage: 15,
          correctAnswer: correctText,
          health: player.health
        });
        if (player.health <= 0) {
          io.to(sid).emit('dead');
          io.emit('killfeed', { text: player.name + ' foi derrotado!' });
        }
      }
      delete activeQuizzes[sid];
    }
  }
}

setInterval(gameTick, TICK_MS);

// Broadcast game state
setInterval(() => {
  const enemyArr = Object.values(enemies).map(e => ({
    id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
    type: e.type, size: e.size, island: e.island,
    chasing: e.chasing, flash: e.flashUntil > Date.now()
  }));
  const playerArr = Object.values(players).map(p => ({
    id: p.id, name: p.name, x: p.x, y: p.y, color: p.color,
    score: p.score, health: p.health, xp: p.xp, level: p.level,
    coins: p.coins, direction: p.direction, isMoving: p.isMoving
  }));
  const bulletArr = bullets.map(b => ({
    id: b.id, x: b.x, y: b.y, color: b.color
  }));
  io.emit('state', { players: playerArr, enemies: enemyArr, bullets: bulletArr });
}, 1000 / 15);

// ===============================================================
//  SOCKET.IO
// ===============================================================
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', (data) => {
    const spawn = randomSpawnOnIsland();
    const color = nextColor();
    players[socket.id] = {
      id: socket.id,
      name: data.name || 'Jogador',
      x: spawn.x,
      y: spawn.y,
      color,
      score: 0,
      health: 100,
      xp: 0,
      level: 1,
      coins: 0,
      direction: 'down',
      isMoving: false
    };

    socket.emit('init', {
      id: socket.id,
      player: players[socket.id],
      islands,
      bridges,
      totems,
      mapW: MAP_W,
      mapH: MAP_H
    });

    io.emit('playerCount', { count: Object.keys(players).length });
    io.emit('killfeed', { text: players[socket.id].name + ' entrou no jogo!' });
  });

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    p.x = Math.max(0, Math.min(MAP_W, data.x));
    p.y = Math.max(0, Math.min(MAP_H, data.y));
    p.direction = data.direction || p.direction;
    p.isMoving = data.isMoving || false;
  });

  socket.on('shoot', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    if (activeQuizzes[socket.id]) return; // Can't shoot during quiz

    // Direction-based shooting
    let vx = 0, vy = 0;
    const speed = 6;
    switch (data.direction) {
      case 'up': vy = -speed; break;
      case 'down': vy = speed; break;
      case 'left': vx = -speed; break;
      case 'right': vx = speed; break;
      default: vy = speed; break;
    }

    bullets.push({
      id: uuidv4(),
      ownerId: socket.id,
      x: p.x,
      y: p.y,
      vx,
      vy,
      dist: 0,
      maxDist: 600,
      color: p.color
    });
  });

  socket.on('quizAnswer', (data) => {
    const quiz = activeQuizzes[socket.id];
    if (!quiz) return;
    const p = players[socket.id];
    if (!p) { delete activeQuizzes[socket.id]; return; }

    const correct = data.answerIndex === quiz.correctAnswer;
    const category = quiz.category;
    const pool = questions[category];
    const correctText = pool && pool[quiz.questionIndex] ? pool[quiz.questionIndex].options[quiz.correctAnswer] : '';

    if (correct) {
      // Damage the enemy
      const enemy = enemies[quiz.enemyId];
      if (enemy) {
        enemy.hp--;
        if (enemy.hp <= 0) {
          const xpGain = enemy.type === 'boss' ? 30 : 15;
          const coinGain = enemy.type === 'boss' ? 15 : 5;
          p.xp += xpGain;
          p.coins += coinGain;
          p.score += xpGain;
          const newLevel = Math.floor(p.xp / 100) + 1;
          if (newLevel > p.level) {
            p.level = newLevel;
            p.health = 100; // Full heal on level up
            io.emit('levelUp', { level: p.level, name: p.name });
            io.emit('killfeed', { text: p.name + ' subiu para nivel ' + p.level + '!' });
          }
          io.emit('enemyDeath', { id: quiz.enemyId, x: enemy.x, y: enemy.y, island: enemy.island });
          delete enemies[quiz.enemyId];
          io.to(socket.id).emit('quizResult', {
            correct: true, xp: xpGain, coins: coinGain, damage: 0,
            correctAnswer: correctText, health: p.health, killed: true
          });
        } else {
          p.xp += 15;
          p.coins += 5;
          p.score += 15;
          const newLevel = Math.floor(p.xp / 100) + 1;
          if (newLevel > p.level) {
            p.level = newLevel;
            p.health = 100;
            io.emit('levelUp', { level: p.level, name: p.name });
            io.emit('killfeed', { text: p.name + ' subiu para nivel ' + p.level + '!' });
          }
          io.to(socket.id).emit('quizResult', {
            correct: true, xp: 15, coins: 5, damage: 0,
            correctAnswer: correctText, health: p.health, killed: false
          });
        }
      } else {
        // Enemy already dead
        p.xp += 15;
        p.coins += 5;
        p.score += 15;
        const newLevel = Math.floor(p.xp / 100) + 1;
        if (newLevel > p.level) {
          p.level = newLevel;
          p.health = 100;
          io.emit('levelUp', { level: p.level, name: p.name });
        }
        io.to(socket.id).emit('quizResult', {
          correct: true, xp: 15, coins: 5, damage: 0,
          correctAnswer: correctText, health: p.health, killed: false
        });
      }
    } else {
      // Wrong answer
      p.health -= 15;
      if (p.health < 0) p.health = 0;
      io.to(socket.id).emit('quizResult', {
        correct: false, xp: 0, coins: 0, damage: 15,
        correctAnswer: correctText, health: p.health, killed: false
      });
      if (p.health <= 0) {
        io.to(socket.id).emit('dead');
        io.emit('killfeed', { text: p.name + ' foi derrotado!' });
      }
    }

    delete activeQuizzes[socket.id];
  });

  socket.on('totemInteract', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    if (activeQuizzes[socket.id]) return;

    const totem = totems.find(t => t.id === data.totemId);
    if (!totem) return;

    // Check distance
    const dist = Math.hypot(p.x - totem.x, p.y - totem.y);
    if (dist > 80) return;

    const question = getRandomQuestion(totem.category);
    if (!question) return;

    activeQuizzes[socket.id] = {
      enemyId: null,
      totemId: totem.id,
      questionIndex: question.index,
      category: totem.category,
      correctAnswer: question.answer,
      timestamp: Date.now()
    };

    io.to(socket.id).emit('quizStart', {
      enemyId: null,
      totemId: totem.id,
      question: question.q,
      options: question.options,
      timeLimit: QUIZ_TIME_LIMIT / 1000,
      category: totem.category
    });
  });

  socket.on('chat', (data) => {
    const p = players[socket.id];
    if (!p) return;
    const text = (data.text || '').substring(0, 100);
    if (!text) return;
    io.emit('chat', { name: p.name, text, color: p.color });
  });

  socket.on('emote', (data) => {
    const p = players[socket.id];
    if (!p) return;
    io.emit('emote', { playerId: socket.id, type: data.type });
  });

  socket.on('respawn', () => {
    const p = players[socket.id];
    if (!p) return;
    const spawn = randomSpawnOnIsland();
    p.x = spawn.x;
    p.y = spawn.y;
    p.health = 100;
    // Lose some XP on death
    p.xp = Math.max(0, p.xp - 20);
    p.level = Math.floor(p.xp / 100) + 1;
    delete activeQuizzes[socket.id];
    socket.emit('respawned', { player: p });
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      io.emit('killfeed', { text: p.name + ' saiu do jogo.' });
    }
    delete players[socket.id];
    delete activeQuizzes[socket.id];
    io.emit('playerCount', { count: Object.keys(players).length });
    console.log('Player disconnected:', socket.id);
  });
});

// --------------- Start ---------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Knowlands server running on port ' + PORT);
});
