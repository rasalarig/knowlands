/* ============================================================
   Knowlands - Game Engine (Canvas 2D)
   ============================================================ */

(function () {
  'use strict';

  // ---- Auth check ----
  const username = sessionStorage.getItem('username');
  if (!username) {
    window.location.href = '/';
    return;
  }

  // ---- DOM refs ----
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const elName = document.getElementById('playerName');
  const elScore = document.getElementById('playerScore');
  const elCount = document.getElementById('playerCount');
  const elKillFeed = document.getElementById('killFeed');
  const elHealthFill = document.getElementById('healthBarFill');
  const elHealthText = document.getElementById('healthText');
  const elGameOver = document.getElementById('gameOverOverlay');
  const elGameOverScore = document.getElementById('gameOverScore');
  const respawnBtn = document.getElementById('respawnBtn');

  elName.textContent = username;

  // ---- Canvas resize ----
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- Socket ----
  const socket = io();

  // ---- Game data ----
  let myId = null;
  let localPlayer = null;
  let islands = [];
  let trees = [];
  let rocks = [];
  let mapW = 3000;
  let mapH = 3000;

  let remotePlayers = {};   // id -> { x, y, tx, ty, name, color, score, health }
  let enemies = [];          // from server
  let serverBullets = [];    // from server
  let localBullets = [];     // client-side predicted bullets for rendering
  let particles = [];        // death particles

  // Camera
  let cam = { x: 0, y: 0 };

  // Input
  const keys = {};
  let mouseX = 0, mouseY = 0;
  let isDead = false;
  let lastShot = 0;
  const SHOOT_COOLDOWN = 200;

  // Wave animation
  let waveTime = 0;

  // ---- Input handlers ----
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

  canvas.addEventListener('mousedown', (e) => {
    if (isDead || !localPlayer) return;
    const now = Date.now();
    if (now - lastShot < SHOOT_COOLDOWN) return;
    lastShot = now;

    // Target in world coords
    const wx = mouseX + cam.x;
    const wy = mouseY + cam.y;

    socket.emit('shoot', { tx: wx, ty: wy });

    // Local bullet prediction
    const dx = wx - localPlayer.x;
    const dy = wy - localPlayer.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const speed = 7;
    localBullets.push({
      x: localPlayer.x,
      y: localPlayer.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      dist: 0,
      maxDist: 800,
      color: localPlayer.color
    });
  });

  // ---- Socket events ----
  socket.on('init', (data) => {
    myId = data.id;
    localPlayer = data.player;
    islands = data.islands;
    trees = data.trees;
    rocks = data.rocks;
    mapW = data.mapW;
    mapH = data.mapH;
    isDead = false;
    updateHUD();
  });

  socket.on('state', (data) => {
    // Update remote players
    const newRemote = {};
    data.players.forEach((p) => {
      if (p.id === myId) {
        // Update local health/score from server
        if (localPlayer) {
          localPlayer.health = p.health;
          localPlayer.score = p.score;
        }
        return;
      }
      const existing = remotePlayers[p.id];
      if (existing) {
        existing.tx = p.x;
        existing.ty = p.y;
        existing.name = p.name;
        existing.color = p.color;
        existing.score = p.score;
        existing.health = p.health;
        newRemote[p.id] = existing;
      } else {
        newRemote[p.id] = {
          x: p.x, y: p.y, tx: p.x, ty: p.y,
          name: p.name, color: p.color, score: p.score, health: p.health
        };
      }
    });
    remotePlayers = newRemote;

    // Enemies
    enemies = data.enemies;

    // Server bullets
    serverBullets = data.bullets;
  });

  socket.on('damage', (data) => {
    if (localPlayer) localPlayer.health = data.health;
  });

  socket.on('dead', () => {
    isDead = true;
    elGameOver.style.display = 'flex';
    elGameOverScore.textContent = 'Pontuacao: ' + (localPlayer ? localPlayer.score : 0);
  });

  socket.on('respawned', (data) => {
    localPlayer = data.player;
    isDead = false;
    elGameOver.style.display = 'none';
    updateHUD();
  });

  socket.on('scoreUpdate', (data) => {
    if (localPlayer) localPlayer.score = data.score;
  });

  socket.on('playerCount', (data) => {
    elCount.textContent = 'Online: ' + data.count;
  });

  socket.on('killfeed', (data) => {
    addKillFeed(data.text);
  });

  socket.on('enemyDeath', (data) => {
    // Particle explosion
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 2.5;
      particles.push({
        x: data.x, y: data.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color: Math.random() > 0.5 ? '#ff1744' : '#ff6d00',
        size: 3 + Math.random() * 3
      });
    }
  });

  // ---- Respawn ----
  respawnBtn.addEventListener('click', () => {
    socket.emit('respawn');
  });

  // ---- Join ----
  socket.emit('join', { name: username });

  // ---- Kill Feed ----
  function addKillFeed(text) {
    const div = document.createElement('div');
    div.className = 'kill-feed-item';
    div.textContent = text;
    elKillFeed.prepend(div);
    // Limit items
    while (elKillFeed.children.length > 8) {
      elKillFeed.removeChild(elKillFeed.lastChild);
    }
    // Fade out after 6s
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 6000);
  }

  // ---- HUD update ----
  function updateHUD() {
    if (!localPlayer) return;
    elScore.textContent = 'Pontos: ' + localPlayer.score;

    const hp = Math.max(0, localPlayer.health);
    elHealthFill.style.width = hp + '%';
    elHealthText.textContent = hp + ' / 100';

    // Color gradient
    if (hp > 60) {
      elHealthFill.style.background = 'linear-gradient(90deg, #00e676, #76ff03)';
    } else if (hp > 30) {
      elHealthFill.style.background = 'linear-gradient(90deg, #ffea00, #ff6d00)';
    } else {
      elHealthFill.style.background = 'linear-gradient(90deg, #ff1744, #d50000)';
    }
  }

  // ---- Utility ----
  function isOnIsland(x, y) {
    for (const isl of islands) {
      const dx = x - isl.x;
      const dy = y - isl.y;
      if ((dx * dx) / (isl.rx * isl.rx) + (dy * dy) / (isl.ry * isl.ry) <= 1) return true;
    }
    return false;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- Movement ----
  let sendTimer = 0;
  const SEND_INTERVAL = 1000 / 15;

  function updateLocalPlayer(dt) {
    if (!localPlayer || isDead) return;

    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      // Slower in water
      const onLand = isOnIsland(localPlayer.x, localPlayer.y);
      const speed = onLand ? 3 : 1.8;

      localPlayer.x += dx * speed;
      localPlayer.y += dy * speed;

      // Clamp
      localPlayer.x = Math.max(0, Math.min(mapW, localPlayer.x));
      localPlayer.y = Math.max(0, Math.min(mapH, localPlayer.y));
    }

    // Send position throttled
    sendTimer += dt;
    if (sendTimer >= SEND_INTERVAL) {
      sendTimer = 0;
      socket.emit('move', { x: localPlayer.x, y: localPlayer.y });
    }
  }

  // ---- Interpolate remote players ----
  function updateRemotePlayers() {
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      rp.x = lerp(rp.x, rp.tx, 0.15);
      rp.y = lerp(rp.y, rp.ty, 0.15);
    }
  }

  // ---- Update local bullets ----
  function updateLocalBullets() {
    for (let i = localBullets.length - 1; i >= 0; i--) {
      const b = localBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.dist += Math.hypot(b.vx, b.vy);
      if (b.dist > b.maxDist) {
        localBullets.splice(i, 1);
      }
    }
  }

  // ---- Update particles ----
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  // ---- Camera ----
  function updateCamera() {
    if (!localPlayer) return;
    const targetX = localPlayer.x - canvas.width / 2;
    const targetY = localPlayer.y - canvas.height / 2;
    cam.x = lerp(cam.x, targetX, 0.1);
    cam.y = lerp(cam.y, targetY, 0.1);
  }

  // ================================================================
  //  RENDERING
  // ================================================================

  // ---- Draw ocean ----
  function drawOcean() {
    waveTime += 0.02;

    // Deep ocean gradient
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#0a1628');
    grd.addColorStop(1, '#0d2137');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated wave lines
    ctx.strokeStyle = 'rgba(30, 100, 180, 0.15)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < mapH; row += 60) {
      const screenY = row - cam.y;
      if (screenY < -60 || screenY > canvas.height + 60) continue;
      ctx.beginPath();
      for (let col = -20; col <= canvas.width + 40; col += 20) {
        const worldX = col + cam.x;
        const y = screenY + Math.sin(waveTime + worldX * 0.008 + row * 0.01) * 6;
        if (col === -20) ctx.moveTo(col, y);
        else ctx.lineTo(col, y);
      }
      ctx.stroke();
    }

    // Light caustics
    ctx.fillStyle = 'rgba(40, 140, 220, 0.04)';
    for (let i = 0; i < 12; i++) {
      const cx = ((i * 337 + waveTime * 30) % (mapW + 400)) - 200 - cam.x;
      const cy = ((i * 541 + waveTime * 20) % (mapH + 400)) - 200 - cam.y;
      ctx.beginPath();
      ctx.arc(cx, cy, 60 + Math.sin(waveTime + i) * 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Draw islands ----
  function drawIslands() {
    for (const isl of islands) {
      const sx = isl.x - cam.x;
      const sy = isl.y - cam.y;

      // Skip if off screen
      if (sx + isl.rx < -50 || sx - isl.rx > canvas.width + 50) continue;
      if (sy + isl.ry < -50 || sy - isl.ry > canvas.height + 50) continue;

      // Beach ring (sand)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sx, sy, isl.rx + 18, isl.ry + 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f5deb3';
      ctx.fill();

      // Shallow water ring
      ctx.beginPath();
      ctx.ellipse(sx, sy, isl.rx + 30, isl.ry + 30, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 180, 220, 0.18)';
      ctx.fill();

      // Green grass interior
      ctx.beginPath();
      ctx.ellipse(sx, sy, isl.rx, isl.ry, 0, 0, Math.PI * 2);
      const grassGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(isl.rx, isl.ry));
      grassGrad.addColorStop(0, '#4caf50');
      grassGrad.addColorStop(0.7, '#388e3c');
      grassGrad.addColorStop(1, '#2e7d32');
      ctx.fillStyle = grassGrad;
      ctx.fill();

      // Texture dots
      ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
      for (let j = 0; j < 20; j++) {
        const a = (j / 20) * Math.PI * 2;
        const r = 0.3 + (j * 17 % 7) / 10 * 0.5;
        const px = sx + Math.cos(a) * isl.rx * r;
        const py = sy + Math.sin(a) * isl.ry * r;
        ctx.beginPath();
        ctx.arc(px, py, 3 + (j % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ---- Draw rocks ----
  function drawRocks() {
    for (const rock of rocks) {
      const sx = rock.x - cam.x;
      const sy = rock.y - cam.y;
      if (sx < -40 || sx > canvas.width + 40 || sy < -40 || sy > canvas.height + 40) continue;

      const s = rock.size;
      ctx.fillStyle = '#78909c';
      ctx.beginPath();
      ctx.moveTo(sx - s, sy + s * 0.4);
      ctx.lineTo(sx - s * 0.4, sy - s * 0.7);
      ctx.lineTo(sx + s * 0.5, sy - s * 0.5);
      ctx.lineTo(sx + s, sy + s * 0.3);
      ctx.closePath();
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(sx - s * 0.3, sy - s * 0.5);
      ctx.lineTo(sx + s * 0.2, sy - s * 0.4);
      ctx.lineTo(sx, sy - s * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- Draw palm trees ----
  function drawTrees() {
    for (const tree of trees) {
      const sx = tree.x - cam.x;
      const sy = tree.y - cam.y;
      if (sx < -60 || sx > canvas.width + 60 || sy < -80 || sy > canvas.height + 40) continue;

      const s = tree.size;

      // Trunk shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(sx + 4, sy + 2, s * 0.18, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = s * 0.18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + s * 0.12, sy - s * 0.5, sx + s * 0.06, sy - s);
      ctx.stroke();

      // Leaves (fronds)
      const topX = sx + s * 0.06;
      const topY = sy - s;
      for (let f = 0; f < 6; f++) {
        const angle = (f / 6) * Math.PI * 2 + Math.sin(waveTime * 0.5 + tree.x) * 0.05;
        const lx = topX + Math.cos(angle) * s * 0.7;
        const ly = topY + Math.sin(angle) * s * 0.45;

        ctx.strokeStyle = f % 2 === 0 ? '#2e7d32' : '#388e3c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(
          topX + Math.cos(angle) * s * 0.4,
          topY + Math.sin(angle) * s * 0.2 - s * 0.15,
          lx, ly
        );
        ctx.stroke();

        // Leaf fill
        ctx.fillStyle = f % 2 === 0 ? 'rgba(46,125,50,0.6)' : 'rgba(56,142,60,0.6)';
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(
          topX + Math.cos(angle) * s * 0.35,
          topY + Math.sin(angle) * s * 0.15 - s * 0.2,
          lx, ly
        );
        ctx.quadraticCurveTo(
          topX + Math.cos(angle) * s * 0.45,
          topY + Math.sin(angle) * s * 0.25 + s * 0.05,
          topX, topY
        );
        ctx.fill();
      }

      // Coconuts
      ctx.fillStyle = '#5d4037';
      for (let c = 0; c < 2; c++) {
        ctx.beginPath();
        ctx.arc(topX - 3 + c * 6, topY + 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- Draw character ----
  function drawCharacter(x, y, color, name, health, isSelf) {
    const sx = x - cam.x;
    const sy = y - cam.y;

    // Skip if off screen
    if (sx < -50 || sx > canvas.width + 50 || sy < -70 || sy > canvas.height + 50) return;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 14, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(sx - 8, sy - 4, 16, 18, 4);
    ctx.fill();

    // Body outline
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy - 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - 3.5, sy - 13, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 3.5, sy - 13, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(sx - 2.5, sy - 13, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 4.5, sy - 13, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (smile)
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy - 9, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Legs
    ctx.fillStyle = color;
    ctx.fillRect(sx - 6, sy + 14, 5, 6);
    ctx.fillRect(sx + 1, sy + 14, 5, 6);

    // Feet
    ctx.fillStyle = '#333';
    ctx.fillRect(sx - 7, sy + 19, 6, 3);
    ctx.fillRect(sx + 1, sy + 19, 6, 3);

    // Name tag
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(name, sx + 1, sy - 27);
    ctx.fillStyle = isSelf ? '#ffea00' : '#fff';
    ctx.fillText(name, sx, sy - 28);

    // Health bar above character
    if (health < 100) {
      const barW = 30;
      const barH = 4;
      const bx = sx - barW / 2;
      const by = sy - 36;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bx, by, barW, barH);
      const pct = Math.max(0, health) / 100;
      ctx.fillStyle = pct > 0.5 ? '#76ff03' : pct > 0.25 ? '#ff6d00' : '#ff1744';
      ctx.fillRect(bx, by, barW * pct, barH);
    }
  }

  // ---- Draw enemies ----
  function drawEnemies() {
    for (const e of enemies) {
      const sx = e.x - cam.x;
      const sy = e.y - cam.y;
      if (sx < -40 || sx > canvas.width + 40 || sy < -40 || sy > canvas.height + 40) continue;

      const s = e.size;
      const isBig = e.type === 'big';

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + s * 0.6, s * 0.7, s * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body color
      const bodyColor = e.flash ? '#ffffff' : (isBig ? '#b71c1c' : '#d32f2f');

      // Body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(sx, sy, s, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Spikes/horns
      if (isBig) {
        ctx.fillStyle = '#880e4f';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a - 0.2) * s, sy + Math.sin(a - 0.2) * s);
          ctx.lineTo(sx + Math.cos(a) * (s + 8), sy + Math.sin(a) * (s + 8));
          ctx.lineTo(sx + Math.cos(a + 0.2) * s, sy + Math.sin(a + 0.2) * s);
          ctx.fill();
        }
      }

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx - s * 0.35, sy - s * 0.15, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + s * 0.35, sy - s * 0.15, s * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(sx - s * 0.28, sy - s * 0.15, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + s * 0.42, sy - s * 0.15, s * 0.14, 0, Math.PI * 2);
      ctx.fill();

      // Angry mouth
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - s * 0.3, sy + s * 0.35);
      ctx.lineTo(sx - s * 0.1, sy + s * 0.2);
      ctx.lineTo(sx + s * 0.1, sy + s * 0.35);
      ctx.lineTo(sx + s * 0.3, sy + s * 0.2);
      ctx.stroke();

      // HP bar
      const barW = s * 2;
      const barH = 3;
      const bx = sx - barW / 2;
      const by = sy - s - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bx, by, barW, barH);
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = pct > 0.5 ? '#76ff03' : '#ff6d00';
      ctx.fillRect(bx, by, barW * pct, barH);
    }
  }

  // ---- Draw bullets ----
  function drawBullets() {
    // Server bullets
    for (const b of serverBullets) {
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (sx < -10 || sx > canvas.width + 10 || sy < -10 || sy > canvas.height + 10) continue;

      // Glow
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Local predicted bullets (slightly transparent to distinguish)
    for (const b of localBullets) {
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (sx < -10 || sx > canvas.width + 10 || sy < -10 || sy > canvas.height + 10) continue;

      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // ---- Draw particles ----
  function drawParticles() {
    for (const p of particles) {
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Draw minimap ----
  function drawMinimap() {
    const mmW = 140;
    const mmH = 140;
    const mx = canvas.width - mmW - 16;
    const my = canvas.height - mmH - 16;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, mmW, mmH, 8);
    ctx.fill();
    ctx.stroke();

    // Islands
    ctx.fillStyle = 'rgba(76,175,80,0.5)';
    for (const isl of islands) {
      const ix = mx + (isl.x / mapW) * mmW;
      const iy = my + (isl.y / mapH) * mmH;
      const irx = (isl.rx / mapW) * mmW;
      const iry = (isl.ry / mapH) * mmH;
      ctx.beginPath();
      ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Local player
    if (localPlayer) {
      const px = mx + (localPlayer.x / mapW) * mmW;
      const py = my + (localPlayer.y / mapH) * mmH;
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Remote players
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      const px = mx + (rp.x / mapW) * mmW;
      const py = my + (rp.y / mapH) * mmH;
      ctx.fillStyle = rp.color;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies
    ctx.fillStyle = 'rgba(255,23,68,0.6)';
    for (const e of enemies) {
      const ex = mx + (e.x / mapW) * mmW;
      const ey = my + (e.y / mapH) * mmH;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ================================================================
  //  GAME LOOP
  // ================================================================
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = now - lastTime;
    lastTime = now;

    // Update
    updateLocalPlayer(dt);
    updateRemotePlayers();
    updateLocalBullets();
    updateParticles();
    updateCamera();
    updateHUD();

    // Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawOcean();
    drawIslands();
    drawRocks();
    drawTrees();
    drawEnemies();
    drawBullets();
    drawParticles();

    // Draw remote players
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      drawCharacter(rp.x, rp.y, rp.color, rp.name, rp.health, false);
    }

    // Draw local player
    if (localPlayer && !isDead) {
      drawCharacter(localPlayer.x, localPlayer.y, localPlayer.color, localPlayer.name, localPlayer.health, true);
    }

    drawMinimap();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

})();
