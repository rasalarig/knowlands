const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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

// --------------- Game State ---------------
const MAP_W = 3000;
const MAP_H = 3000;

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

const players = {};   // socketId -> { id, name, x, y, color, score, health }
const enemies = {};   // id -> { id, x, y, hp, maxHp, type, targetId, vx, vy }
const bullets = [];   // { id, ownerId, x, y, vx, vy, dist, maxDist, color }
let enemyIdCounter = 0;
const MAX_ENEMIES = 20;
const ENEMY_SPAWN_INTERVAL = 2000;

// Islands (pre-generated so all clients share the same map)
const islands = [
  { x: 400, y: 400, rx: 260, ry: 200 },
  { x: 1200, y: 300, rx: 200, ry: 170 },
  { x: 2400, y: 350, rx: 230, ry: 190 },
  { x: 700, y: 1100, rx: 310, ry: 250 },
  { x: 1500, y: 1000, rx: 350, ry: 280 },
  { x: 2300, y: 1100, rx: 200, ry: 180 },
  { x: 350, y: 2000, rx: 220, ry: 200 },
  { x: 1100, y: 2200, rx: 280, ry: 220 },
  { x: 2000, y: 2100, rx: 260, ry: 210 },
  { x: 2700, y: 2500, rx: 240, ry: 200 }
];

// Trees placed on islands
const trees = [];
islands.forEach(isl => {
  const count = 3 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.6;
    trees.push({
      x: isl.x + Math.cos(angle) * isl.rx * r,
      y: isl.y + Math.sin(angle) * isl.ry * r,
      size: 18 + Math.random() * 14
    });
  }
});

// Rocks placed on islands
const rocks = [];
islands.forEach(isl => {
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.5;
    rocks.push({
      x: isl.x + Math.cos(angle) * isl.rx * r,
      y: isl.y + Math.sin(angle) * isl.ry * r,
      size: 10 + Math.random() * 12
    });
  }
});

function isOnIsland(x, y) {
  for (const isl of islands) {
    const dx = x - isl.x;
    const dy = y - isl.y;
    if ((dx * dx) / (isl.rx * isl.rx) + (dy * dy) / (isl.ry * isl.ry) <= 1) return true;
  }
  return false;
}

function randomSpawnOnIsland() {
  const isl = islands[Math.floor(Math.random() * islands.length)];
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * 0.5;
  return {
    x: isl.x + Math.cos(angle) * isl.rx * r,
    y: isl.y + Math.sin(angle) * isl.ry * r
  };
}

function randomEnemySpawn() {
  // spawn on random island edges or water near islands
  const isl = islands[Math.floor(Math.random() * islands.length)];
  const angle = Math.random() * Math.PI * 2;
  const r = 0.9 + Math.random() * 0.4;
  return {
    x: isl.x + Math.cos(angle) * isl.rx * r,
    y: isl.y + Math.sin(angle) * isl.ry * r
  };
}

function spawnEnemy() {
  if (Object.keys(enemies).length >= MAX_ENEMIES) return;
  if (Object.keys(players).length === 0) return;

  const pos = randomEnemySpawn();
  const isBig = Math.random() < 0.3;
  const id = 'e' + (++enemyIdCounter);
  enemies[id] = {
    id,
    x: pos.x,
    y: pos.y,
    hp: isBig ? 5 : 3,
    maxHp: isBig ? 5 : 3,
    type: isBig ? 'big' : 'small',
    speed: isBig ? 1.0 : 1.8,
    size: isBig ? 22 : 14,
    flashUntil: 0
  };
}

function findNearestPlayer(ex, ey) {
  let best = null;
  let bestDist = Infinity;
  for (const sid in players) {
    const p = players[sid];
    if (p.health <= 0) continue;
    const d = Math.hypot(p.x - ex, p.y - ey);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

// --------------- Game Tick ---------------
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

  // Move enemies toward nearest player
  for (const eid in enemies) {
    const e = enemies[eid];
    const target = findNearestPlayer(e.x, e.y);
    if (!target) continue;

    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) continue;

    const speed = e.speed;
    e.x += (dx / dist) * speed;
    e.y += (dy / dist) * speed;

    // Clamp to map
    e.x = Math.max(0, Math.min(MAP_W, e.x));
    e.y = Math.max(0, Math.min(MAP_H, e.y));

    // Check collision with target player
    if (dist < e.size + 16) {
      // deal damage
      target.health -= 10;
      if (target.health < 0) target.health = 0;

      // Notify player of damage
      io.to(target.id).emit('damage', { health: target.health });

      if (target.health <= 0) {
        io.to(target.id).emit('dead');
      }

      // Remove enemy
      delete enemies[eid];

      // Broadcast kill feed if player died
      if (target.health <= 0) {
        io.emit('killfeed', { text: target.name + ' foi derrotado!' });
      }
    }
  }

  // Move bullets and check collision with enemies
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
        e.hp--;
        e.flashUntil = now + 100;
        if (e.hp <= 0) {
          // Enemy killed
          const killer = players[b.ownerId];
          if (killer) {
            killer.score += 10;
            io.to(b.ownerId).emit('scoreUpdate', { score: killer.score });
            io.emit('killfeed', { text: killer.name + ' eliminou um inimigo!' });
          }
          io.emit('enemyDeath', { id: eid, x: e.x, y: e.y });
          delete enemies[eid];
        }
        hit = true;
        break;
      }
    }
    if (hit) {
      bullets.splice(i, 1);
    }
  }
}

setInterval(gameTick, TICK_MS);

// Broadcast game state at lower frequency
setInterval(() => {
  const enemyArr = Object.values(enemies).map(e => ({
    id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, type: e.type, size: e.size,
    flash: e.flashUntil > Date.now()
  }));
  const playerArr = Object.values(players).map(p => ({
    id: p.id, name: p.name, x: p.x, y: p.y, color: p.color, score: p.score, health: p.health
  }));
  const bulletArr = bullets.map(b => ({
    id: b.id, x: b.x, y: b.y, color: b.color
  }));
  io.emit('state', { players: playerArr, enemies: enemyArr, bullets: bulletArr });
}, 1000 / 15); // 15 fps state updates

// --------------- Socket.io ---------------
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
      health: 100
    };

    // Send init data to the joining player
    socket.emit('init', {
      id: socket.id,
      player: players[socket.id],
      islands,
      trees,
      rocks,
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
  });

  socket.on('shoot', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    const dx = data.tx - p.x;
    const dy = data.ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const speed = 7;
    bullets.push({
      id: uuidv4(),
      ownerId: socket.id,
      x: p.x,
      y: p.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      dist: 0,
      maxDist: 800,
      color: p.color
    });
  });

  socket.on('respawn', () => {
    const p = players[socket.id];
    if (!p) return;
    const spawn = randomSpawnOnIsland();
    p.x = spawn.x;
    p.y = spawn.y;
    p.health = 100;
    p.score = Math.max(0, p.score - 10);
    socket.emit('respawned', { player: p });
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      io.emit('killfeed', { text: p.name + ' saiu do jogo.' });
    }
    delete players[socket.id];
    io.emit('playerCount', { count: Object.keys(players).length });
    console.log('Player disconnected:', socket.id);
  });
});

// --------------- Start ---------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Knowlands server running on port ' + PORT);
});
