/* ============================================================
   Knowlands - Ilhas do Conhecimento
   Educational RPG Game Engine (Canvas 2D)
   ============================================================ */

(function () {
  'use strict';

  // ---- Auth check ----
  const username = sessionStorage.getItem('username');
  if (!username) {
    window.location.href = '/';
    return;
  }
  const characterId = sessionStorage.getItem('characterId') || 'luna';

  // ---- Character definitions ----
  const charDefs = {
    luna: {
      robeColor: '#5c2d91', robeHighlight: '#7b3fc4',
      hatColor: '#4a1d80', hatAccent: '#c0c0c0',
      glowColor: 'rgba(135,206,250,0.15)', special: 'moon',
      particleColor: '#add8e6'
    },
    blaze: {
      robeColor: '#cc3300', robeHighlight: '#ff5722',
      hatColor: '#8b0000', hatAccent: '#ffd700',
      glowColor: 'rgba(255,120,0,0.15)', special: 'fire',
      particleColor: '#ff6600'
    },
    coral: {
      robeColor: '#008080', robeHighlight: '#20b2aa',
      hatColor: '#005f5f', hatAccent: '#40e0d0',
      glowColor: 'rgba(0,200,200,0.15)', special: 'water',
      particleColor: '#00ced1'
    },
    pixel: {
      robeColor: '#1a1a1a', robeHighlight: '#333333',
      hatColor: '#0d0d0d', hatAccent: '#39ff14',
      glowColor: 'rgba(57,255,20,0.15)', special: 'digital',
      particleColor: '#39ff14'
    },
    flora: {
      robeColor: '#2e7d32', robeHighlight: '#4caf50',
      hatColor: '#1b5e20', hatAccent: '#ffd700',
      glowColor: 'rgba(76,175,80,0.15)', special: 'nature',
      particleColor: '#66bb6a'
    }
  };

  // ---- DOM refs ----
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const elName = document.getElementById('playerName');
  const elLevelBadge = document.getElementById('levelBadge');
  const elCoinCount = document.getElementById('coinCount');
  const elHealthFill = document.getElementById('healthBarFill');
  const elHealthText = document.getElementById('healthText');
  const elXpFill = document.getElementById('xpBarFill');
  const elXpText = document.getElementById('xpText');
  const elIsland = document.getElementById('islandIndicator');
  const elCount = document.getElementById('playerCount');
  const elKillFeed = document.getElementById('killFeed');
  const elGameOver = document.getElementById('gameOverOverlay');
  const elGameOverScore = document.getElementById('gameOverScore');
  const respawnBtn = document.getElementById('respawnBtn');
  const elQuizModal = document.getElementById('quizModal');
  const elQuizCategory = document.getElementById('quizCategory');
  const elQuizQuestion = document.getElementById('quizQuestion');
  const elTimerCircle = document.getElementById('timerCircle');
  const elTimerText = document.getElementById('timerText');
  const elOptA = document.getElementById('optA');
  const elOptB = document.getElementById('optB');
  const elOptC = document.getElementById('optC');
  const elOptD = document.getElementById('optD');
  const elQuizFeedback = document.getElementById('quizFeedback');
  const elFeedbackContent = document.getElementById('feedbackContent');
  const elLevelUpOverlay = document.getElementById('levelUpOverlay');
  const elLevelUpNumber = document.getElementById('levelUpNumber');
  const elRankingPanel = document.getElementById('rankingPanel');
  const elRankingList = document.getElementById('rankingList');
  const elChatMessages = document.getElementById('chatMessages');
  const elChatInput = document.getElementById('chatInput');

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
  let bridgeDefs = [];
  let totemDefs = [];
  let mapW = 4000;
  let mapH = 4000;

  let remotePlayers = {};
  let enemies = [];
  let serverBullets = [];
  let localBullets = [];
  let particles = [];
  let allPlayersData = [];

  // Camera
  let cam = { x: 0, y: 0 };

  // Input
  const keys = {};
  let isDead = false;
  let lastShot = 0;
  const SHOOT_COOLDOWN = 300;

  // Direction the player faces
  let playerDirection = 'down';
  let playerIsMoving = false;

  // Animation timers
  let waveTime = 0;
  let walkCycle = 0;
  let gameTime = 0;

  // Quiz state
  let quizActive = false;
  let quizTimerInterval = null;
  let quizTimeLeft = 10;
  let quizEnemyId = null;

  // Ranking panel
  let rankingOpen = false;

  // Chat
  let chatOpen = false;

  // Category display names and colors
  const categoryInfo = {
    matematica: { name: 'Matematica', color: '#00bcd4', groundColor: '#1a3a5c', accent: '#00e5ff' },
    historia: { name: 'Historia', color: '#8d6e63', groundColor: '#3e2723', accent: '#ffab40' },
    ciencias: { name: 'Ciencias', color: '#4caf50', groundColor: '#1b3a1b', accent: '#69f0ae' },
    linguas: { name: 'Linguas', color: '#ab47bc', groundColor: '#2a1a3a', accent: '#ea80fc' },
    programacao: { name: 'Programacao', color: '#66bb6a', groundColor: '#0a1a0a', accent: '#76ff03' }
  };

  // ================================================================
  //  INPUT HANDLERS
  // ================================================================
  window.addEventListener('keydown', (e) => {
    if (chatOpen && e.key !== 'Escape') {
      if (e.key === 'Enter') {
        const text = elChatInput.value.trim();
        if (text) {
          socket.emit('chat', { text });
          elChatInput.value = '';
        }
        closeChatInput();
        e.preventDefault();
        return;
      }
      return;
    }

    keys[e.key.toLowerCase()] = true;

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      handleShoot();
    }
    if (e.key.toLowerCase() === 'e') {
      handleTotemInteract();
    }
    if (e.key.toLowerCase() === 't' && !quizActive && !isDead) {
      e.preventDefault();
      openChatInput();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      toggleRanking();
    }
    if (e.key === 'Escape') {
      if (quizActive) return;
      if (chatOpen) closeChatInput();
      if (rankingOpen) { rankingOpen = false; elRankingPanel.style.display = 'none'; }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // ---- Quiz button handlers ----
  document.querySelectorAll('.quiz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!quizActive) return;
      const idx = parseInt(btn.dataset.index);
      socket.emit('quizAnswer', { answerIndex: idx, enemyId: quizEnemyId });
      closeQuiz();
    });
  });

  // ---- Chat ----
  function openChatInput() {
    chatOpen = true;
    elChatInput.style.display = 'block';
    elChatInput.focus();
  }

  function closeChatInput() {
    chatOpen = false;
    elChatInput.style.display = 'none';
    elChatInput.blur();
  }

  // ---- Ranking ----
  function toggleRanking() {
    rankingOpen = !rankingOpen;
    elRankingPanel.style.display = rankingOpen ? 'block' : 'none';
    if (rankingOpen) updateRanking();
  }

  function updateRanking() {
    if (!rankingOpen) return;
    const sorted = [...allPlayersData].sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.xp - a.xp;
    });
    elRankingList.innerHTML = '';
    sorted.forEach((p, i) => {
      const posClass = i < 3 ? ' ranking-pos-' + (i + 1) : '';
      const item = document.createElement('div');
      item.className = 'ranking-item';
      item.innerHTML =
        '<div class="ranking-pos' + posClass + '">' + (i + 1) + '</div>' +
        '<span class="ranking-name" style="color:' + p.color + '">' + p.name + '</span>' +
        '<span class="ranking-level">Lv.' + p.level + '</span>' +
        '<span class="ranking-xp">' + p.xp + ' XP</span>';
      elRankingList.appendChild(item);
    });
  }

  // ---- Shooting ----
  function handleShoot() {
    if (isDead || !localPlayer || quizActive) return;
    const now = Date.now();
    if (now - lastShot < SHOOT_COOLDOWN) return;
    lastShot = now;

    socket.emit('shoot', { direction: playerDirection });

    // Local bullet prediction
    let vx = 0, vy = 0;
    const speed = 6;
    switch (playerDirection) {
      case 'up': vy = -speed; break;
      case 'down': vy = speed; break;
      case 'left': vx = -speed; break;
      case 'right': vx = speed; break;
    }

    localBullets.push({
      x: localPlayer.x,
      y: localPlayer.y,
      vx, vy,
      dist: 0,
      maxDist: 600,
      color: localPlayer.color,
      born: gameTime
    });
  }

  // ---- Totem Interact ----
  function handleTotemInteract() {
    if (isDead || !localPlayer || quizActive) return;
    // Find nearest totem within range
    let nearest = null;
    let nearestDist = 80;
    for (const t of totemDefs) {
      const d = Math.hypot(localPlayer.x - t.x, localPlayer.y - t.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }
    if (nearest) {
      socket.emit('totemInteract', { totemId: nearest.id });
    }
  }

  // ================================================================
  //  QUIZ SYSTEM
  // ================================================================
  function openQuiz(data) {
    quizActive = true;
    quizEnemyId = data.enemyId;
    quizTimeLeft = data.timeLimit;

    const catName = categoryInfo[data.category] ? categoryInfo[data.category].name : data.category;
    elQuizCategory.textContent = catName;
    elQuizQuestion.textContent = data.question;
    elOptA.textContent = data.options[0];
    elOptB.textContent = data.options[1];
    elOptC.textContent = data.options[2];
    elOptD.textContent = data.options[3];

    // Reset timer circle
    elTimerCircle.style.strokeDashoffset = '0';
    elTimerCircle.style.stroke = '#00e5ff';
    elTimerText.textContent = quizTimeLeft;

    elQuizModal.style.display = 'flex';

    // Start countdown
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    const totalTime = quizTimeLeft;
    const circumference = 113; // 2 * PI * 18
    quizTimerInterval = setInterval(() => {
      quizTimeLeft--;
      if (quizTimeLeft < 0) quizTimeLeft = 0;
      elTimerText.textContent = quizTimeLeft;

      const progress = 1 - (quizTimeLeft / totalTime);
      elTimerCircle.style.strokeDashoffset = (circumference * progress).toString();

      if (quizTimeLeft <= 3) {
        elTimerCircle.style.stroke = '#ff1744';
        elTimerText.style.color = '#ff1744';
      }

      if (quizTimeLeft <= 0) {
        clearInterval(quizTimerInterval);
      }
    }, 1000);
  }

  function closeQuiz() {
    quizActive = false;
    elQuizModal.style.display = 'none';
    elTimerText.style.color = '#00e5ff';
    if (quizTimerInterval) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
    }
  }

  function showQuizFeedback(data) {
    elQuizFeedback.style.display = 'block';
    if (data.correct) {
      elFeedbackContent.className = 'feedback-content feedback-correct';
      elFeedbackContent.innerHTML = '+' + data.xp + ' XP  +' + data.coins + ' Moedas';
    } else {
      elFeedbackContent.className = 'feedback-content feedback-wrong';
      elFeedbackContent.innerHTML = '-' + data.damage + ' HP<br><span style="font-size:14px;font-weight:400;">Resposta: ' + data.correctAnswer + '</span>';
    }
    setTimeout(() => {
      elQuizFeedback.style.display = 'none';
    }, 2000);
  }

  function showLevelUp(level) {
    elLevelUpNumber.textContent = level;
    elLevelUpOverlay.style.display = 'flex';
    setTimeout(() => {
      elLevelUpOverlay.style.display = 'none';
    }, 2500);
  }

  // ================================================================
  //  SOCKET EVENTS
  // ================================================================
  socket.on('init', (data) => {
    myId = data.id;
    localPlayer = data.player;
    islands = data.islands;
    bridgeDefs = data.bridges;
    totemDefs = data.totems;
    mapW = data.mapW;
    mapH = data.mapH;
    isDead = false;
    playerDirection = 'down';
    updateHUD();
  });

  socket.on('state', (data) => {
    allPlayersData = data.players;

    const newRemote = {};
    data.players.forEach((p) => {
      if (p.id === myId) {
        if (localPlayer) {
          localPlayer.health = p.health;
          localPlayer.score = p.score;
          localPlayer.xp = p.xp;
          localPlayer.level = p.level;
          localPlayer.coins = p.coins;
        }
        return;
      }
      const existing = remotePlayers[p.id];
      if (existing) {
        existing.tx = p.x;
        existing.ty = p.y;
        existing.name = p.name;
        existing.color = p.color;
        existing.characterId = p.characterId || 'luna';
        existing.score = p.score;
        existing.health = p.health;
        existing.level = p.level;
        existing.direction = p.direction || 'down';
        existing.isMoving = p.isMoving || false;
        newRemote[p.id] = existing;
      } else {
        newRemote[p.id] = {
          x: p.x, y: p.y, tx: p.x, ty: p.y,
          name: p.name, color: p.color, score: p.score,
          characterId: p.characterId || 'luna',
          health: p.health, level: p.level,
          direction: p.direction || 'down',
          isMoving: p.isMoving || false
        };
      }
    });
    remotePlayers = newRemote;
    enemies = data.enemies;
    serverBullets = data.bullets;

    if (rankingOpen) updateRanking();
  });

  socket.on('damage', (data) => {
    if (localPlayer) localPlayer.health = data.health;
  });

  socket.on('dead', () => {
    isDead = true;
    closeQuiz();
    elGameOver.style.display = 'flex';
    elGameOverScore.textContent = 'XP: ' + (localPlayer ? localPlayer.xp : 0) + ' | Nivel: ' + (localPlayer ? localPlayer.level : 1);
  });

  socket.on('respawned', (data) => {
    localPlayer = data.player;
    isDead = false;
    elGameOver.style.display = 'none';
    updateHUD();
  });

  socket.on('playerCount', (data) => {
    elCount.textContent = 'Online: ' + data.count;
  });

  socket.on('killfeed', (data) => {
    addKillFeed(data.text);
  });

  socket.on('quizStart', (data) => {
    openQuiz(data);
  });

  socket.on('quizResult', (data) => {
    closeQuiz();
    showQuizFeedback(data);
    if (localPlayer) {
      localPlayer.health = data.health;
    }
  });

  socket.on('levelUp', (data) => {
    showLevelUp(data.level);
    addKillFeed(data.name + ' subiu para nivel ' + data.level + '!');
  });

  socket.on('chat', (data) => {
    addChatMessage(data.name, data.text, data.color);
  });

  socket.on('enemyDeath', (data) => {
    const isl = islands.find(i => i.id === data.island);
    const cat = isl ? isl.category : null;
    spawnDeathParticles(data.x, data.y, cat);
  });

  // ---- Respawn ----
  respawnBtn.addEventListener('click', () => {
    socket.emit('respawn');
  });

  // ---- Join ----
  socket.emit('join', { name: username, characterId: characterId });

  // ================================================================
  //  HELPER FUNCTIONS
  // ================================================================
  function addKillFeed(text) {
    const div = document.createElement('div');
    div.className = 'kill-feed-item';
    div.textContent = text;
    elKillFeed.prepend(div);
    while (elKillFeed.children.length > 6) {
      elKillFeed.removeChild(elKillFeed.lastChild);
    }
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 6000);
  }

  function addChatMessage(name, text, color) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = '<span class="chat-msg-name" style="color:' + color + '">' + name + ':</span> ' + text;
    elChatMessages.appendChild(div);
    // Keep only last 5
    while (elChatMessages.children.length > 5) {
      elChatMessages.removeChild(elChatMessages.firstChild);
    }
    // Auto-remove after 15s
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 15000);
  }

  function spawnDeathParticles(wx, wy, category) {
    const colors = category && categoryInfo[category]
      ? [categoryInfo[category].color, categoryInfo[category].accent, '#fff']
      : ['#ff1744', '#ff6d00', '#ffd600'];

    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 / 16) * i + Math.random() * 0.4;
      const speed = 1.5 + Math.random() * 3;
      particles.push({
        x: wx, y: wy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40 + Math.random() * 25,
        maxLife: 65,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        type: 'circle'
      });
    }
  }

  function updateHUD() {
    if (!localPlayer) return;
    elLevelBadge.textContent = localPlayer.level;
    elCoinCount.textContent = localPlayer.coins;

    const hp = Math.max(0, localPlayer.health);
    elHealthFill.style.width = hp + '%';
    elHealthText.textContent = hp;

    if (hp > 60) {
      elHealthFill.style.background = 'linear-gradient(90deg, #ff5252, #ff1744)';
    } else if (hp > 30) {
      elHealthFill.style.background = 'linear-gradient(90deg, #ff6d00, #ff9100)';
    } else {
      elHealthFill.style.background = 'linear-gradient(90deg, #d50000, #ff1744)';
    }

    const xpInLevel = localPlayer.xp % 100;
    elXpFill.style.width = xpInLevel + '%';
    elXpText.textContent = xpInLevel + '/100';

    // Update island indicator
    const curIsland = getIslandAt(localPlayer.x, localPlayer.y);
    if (curIsland) {
      elIsland.textContent = curIsland.name;
      if (categoryInfo[curIsland.category]) {
        elIsland.style.color = categoryInfo[curIsland.category].accent;
      } else {
        elIsland.style.color = '#ffd700';
      }
    } else {
      elIsland.textContent = 'Oceano';
      elIsland.style.color = '#00bcd4';
    }
  }

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

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ================================================================
  //  MOVEMENT
  // ================================================================
  let sendTimer = 0;
  const SEND_INTERVAL = 1000 / 15;

  function updateLocalPlayer(dt) {
    if (!localPlayer || isDead || quizActive) return;

    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    playerIsMoving = (dx !== 0 || dy !== 0);

    if (playerIsMoving) {
      // Update facing direction
      if (Math.abs(dx) > Math.abs(dy)) {
        playerDirection = dx > 0 ? 'right' : 'left';
      } else {
        playerDirection = dy > 0 ? 'down' : 'up';
      }

      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      const onLand = isOnIsland(localPlayer.x, localPlayer.y);
      const speed = onLand ? 3 : 1.5;

      localPlayer.x += dx * speed;
      localPlayer.y += dy * speed;

      localPlayer.x = Math.max(16, Math.min(mapW - 16, localPlayer.x));
      localPlayer.y = Math.max(16, Math.min(mapH - 16, localPlayer.y));

      walkCycle += 0.15;
    }

    sendTimer += dt;
    if (sendTimer >= SEND_INTERVAL) {
      sendTimer = 0;
      socket.emit('move', {
        x: localPlayer.x,
        y: localPlayer.y,
        direction: playerDirection,
        isMoving: playerIsMoving
      });
    }
  }

  function updateRemotePlayers() {
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      rp.x = lerp(rp.x, rp.tx, 0.15);
      rp.y = lerp(rp.y, rp.ty, 0.15);
    }
  }

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

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function updateCamera() {
    if (!localPlayer) return;
    const targetX = localPlayer.x - canvas.width / 2;
    const targetY = localPlayer.y - canvas.height / 2;
    cam.x = lerp(cam.x, targetX, 0.1);
    cam.y = lerp(cam.y, targetY, 0.1);
  }

  // ================================================================
  //  RENDERING - OCEAN
  // ================================================================
  function drawOcean() {
    waveTime += 0.015;

    // Deep ocean
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, '#061224');
    grd.addColorStop(1, '#0a1e3d');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Wave lines
    ctx.strokeStyle = 'rgba(20, 80, 160, 0.12)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < mapH; row += 50) {
      const screenY = row - cam.y;
      if (screenY < -50 || screenY > canvas.height + 50) continue;
      ctx.beginPath();
      for (let col = -20; col <= canvas.width + 40; col += 16) {
        const worldX = col + cam.x;
        const y = screenY + Math.sin(waveTime * 2 + worldX * 0.007 + row * 0.012) * 5;
        if (col === -20) ctx.moveTo(col, y);
        else ctx.lineTo(col, y);
      }
      ctx.stroke();
    }

    // Caustic light circles
    ctx.fillStyle = 'rgba(30, 120, 200, 0.035)';
    for (let i = 0; i < 15; i++) {
      const cx = ((i * 337 + waveTime * 25) % (mapW + 400)) - 200 - cam.x;
      const cy = ((i * 541 + waveTime * 18) % (mapH + 400)) - 200 - cam.y;
      ctx.beginPath();
      ctx.arc(cx, cy, 50 + Math.sin(waveTime + i * 0.7) * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Small fish (animated dots)
    ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
    for (let i = 0; i < 10; i++) {
      const fx = ((i * 431 + waveTime * 40) % mapW) - cam.x;
      const fy = ((i * 673 + Math.sin(waveTime + i) * 30) % mapH) - cam.y;
      if (fx > -10 && fx < canvas.width + 10 && fy > -10 && fy < canvas.height + 10) {
        ctx.beginPath();
        ctx.ellipse(fx, fy, 4, 2, waveTime + i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ================================================================
  //  RENDERING - ISLANDS
  // ================================================================
  function getIslandColors(island) {
    switch (island.category) {
      case 'matematica':
        return { ground: '#1a3a5c', grass: '#1e5a8a', accent: '#00e5ff', beach: '#b8d4e3', shallow: 'rgba(0,180,240,0.2)' };
      case 'historia':
        return { ground: '#3e2723', grass: '#5d4037', accent: '#ffab40', beach: '#d7ccc8', shallow: 'rgba(180,140,80,0.15)' };
      case 'ciencias':
        return { ground: '#1b5e20', grass: '#2e7d32', accent: '#69f0ae', beach: '#c8e6c9', shallow: 'rgba(0,200,120,0.15)' };
      case 'linguas':
        return { ground: '#4a148c', grass: '#6a1b9a', accent: '#ea80fc', beach: '#e1bee7', shallow: 'rgba(180,80,240,0.15)' };
      case 'programacao':
        return { ground: '#0d1a0d', grass: '#1a331a', accent: '#76ff03', beach: '#a5d6a7', shallow: 'rgba(0,255,0,0.1)' };
      default: // central
        return { ground: '#4a3800', grass: '#6d5100', accent: '#ffd700', beach: '#fff8e1', shallow: 'rgba(255,215,0,0.12)' };
    }
  }

  function drawIslands() {
    for (const isl of islands) {
      const sx = isl.x - cam.x;
      const sy = isl.y - cam.y;

      if (sx + isl.rx + 40 < 0 || sx - isl.rx - 40 > canvas.width) continue;
      if (sy + isl.ry + 40 < 0 || sy - isl.ry - 40 > canvas.height) continue;

      const colors = getIslandColors(isl);

      ctx.save();

      // Shallow water ring
      ctx.beginPath();
      ctx.ellipse(sx, sy, isl.rx + 35, isl.ry + 35, 0, 0, Math.PI * 2);
      ctx.fillStyle = colors.shallow;
      ctx.fill();

      // Beach ring
      ctx.beginPath();
      ctx.ellipse(sx, sy, isl.rx + 16, isl.ry + 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = colors.beach;
      ctx.fill();

      // Main ground
      ctx.beginPath();
      ctx.ellipse(sx, sy, isl.rx, isl.ry, 0, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(isl.rx, isl.ry));
      grd.addColorStop(0, colors.grass);
      grd.addColorStop(0.8, colors.ground);
      grd.addColorStop(1, colors.ground);
      ctx.fillStyle = grd;
      ctx.fill();

      // Terrain texture dots
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let j = 0; j < 30; j++) {
        const a = (j / 30) * Math.PI * 2;
        const r = 0.2 + ((j * 17) % 7) / 10 * 0.5;
        const px = sx + Math.cos(a + j * 0.5) * isl.rx * r;
        const py = sy + Math.sin(a + j * 0.5) * isl.ry * r;
        ctx.beginPath();
        ctx.arc(px, py, 2 + (j % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // Island name signpost
      ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(isl.name, sx + 1, sy - isl.ry + 31);
      ctx.fillStyle = colors.accent;
      ctx.fillText(isl.name, sx, sy - isl.ry + 30);

      // Draw themed decorations
      drawIslandDecorations(isl, sx, sy, colors);

      ctx.restore();
    }
  }

  function drawIslandDecorations(isl, sx, sy, colors) {
    switch (isl.category) {
      case 'matematica':
        drawMathDecorations(sx, sy, isl, colors);
        break;
      case 'historia':
        drawHistoryDecorations(sx, sy, isl, colors);
        break;
      case 'ciencias':
        drawScienceDecorations(sx, sy, isl, colors);
        break;
      case 'linguas':
        drawLanguageDecorations(sx, sy, isl, colors);
        break;
      case 'programacao':
        drawProgrammingDecorations(sx, sy, isl, colors);
        break;
      default:
        drawCentralDecorations(sx, sy, isl, colors);
        break;
    }
  }

  function drawMathDecorations(sx, sy, isl, colors) {
    // Crystal geometric structures
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.8;
      const px = sx + Math.cos(angle) * isl.rx * 0.6;
      const py = sy + Math.sin(angle) * isl.ry * 0.6;
      const s = 12 + i * 4;

      // Diamond crystal
      ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py - s);
      ctx.lineTo(px + s * 0.6, py);
      ctx.lineTo(px, py + s * 0.5);
      ctx.lineTo(px - s * 0.6, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Floating math symbols
    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
    const symbols = ['+', '-', 'x', '=', '%'];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const px = sx + Math.cos(angle + waveTime * 0.3) * isl.rx * 0.35;
      const py = sy + Math.sin(angle + waveTime * 0.3) * isl.ry * 0.35;
      ctx.fillText(symbols[i], px, py);
    }
  }

  function drawHistoryDecorations(sx, sy, isl, colors) {
    // Ancient columns
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      const px = sx + Math.cos(angle) * isl.rx * 0.55;
      const py = sy + Math.sin(angle) * isl.ry * 0.55;

      // Column
      ctx.fillStyle = '#bcaaa4';
      ctx.fillRect(px - 5, py - 25, 10, 30);
      // Capital
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(px - 8, py - 28, 16, 5);
      // Base
      ctx.fillRect(px - 7, py + 3, 14, 4);
    }

    // Ruins / broken wall
    ctx.fillStyle = 'rgba(141, 110, 99, 0.4)';
    ctx.fillRect(sx - 30, sy + isl.ry * 0.2, 60, 8);
    ctx.fillRect(sx - 25, sy + isl.ry * 0.2 - 12, 8, 12);
    ctx.fillRect(sx + 15, sy + isl.ry * 0.2 - 16, 8, 16);
  }

  function drawScienceDecorations(sx, sy, isl, colors) {
    // Atom symbol
    ctx.strokeStyle = 'rgba(105, 240, 174, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 20, 35, 12, angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Nucleus
    ctx.fillStyle = 'rgba(105, 240, 174, 0.5)';
    ctx.beginPath();
    ctx.arc(sx, sy + 20, 5, 0, Math.PI * 2);
    ctx.fill();

    // Lab flasks
    for (let i = 0; i < 2; i++) {
      const fx = sx + (i === 0 ? -isl.rx * 0.4 : isl.rx * 0.4);
      const fy = sy - isl.ry * 0.2;
      ctx.fillStyle = 'rgba(200, 230, 201, 0.3)';
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy - 12);
      ctx.lineTo(fx + 4, fy - 12);
      ctx.lineTo(fx + 8, fy);
      ctx.lineTo(fx - 8, fy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(105, 240, 174, 0.5)';
      ctx.stroke();
      // Liquid
      ctx.fillStyle = i === 0 ? 'rgba(76, 175, 80, 0.4)' : 'rgba(33, 150, 243, 0.4)';
      ctx.fillRect(fx - 6, fy - 4, 12, 4);
    }
  }

  function drawLanguageDecorations(sx, sy, isl, colors) {
    // Speech bubbles
    for (let i = 0; i < 2; i++) {
      const bx = sx + (i === 0 ? -isl.rx * 0.35 : isl.rx * 0.35);
      const by = sy + (i === 0 ? -isl.ry * 0.3 : isl.ry * 0.15);

      ctx.fillStyle = 'rgba(234, 128, 252, 0.2)';
      ctx.strokeStyle = 'rgba(234, 128, 252, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(bx, by, 20, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Text inside
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(234, 128, 252, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'Hola!' : 'Hello!', bx, by + 4);
    }

    // Books
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 1.5;
      const bx = sx + Math.cos(angle) * isl.rx * 0.5;
      const by = sy + Math.sin(angle) * isl.ry * 0.5;
      ctx.fillStyle = ['rgba(171,71,188,0.4)', 'rgba(126,87,194,0.4)', 'rgba(206,147,216,0.4)'][i];
      ctx.fillRect(bx - 6, by - 4, 12, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(bx - 1, by - 3, 1, 6);
    }
  }

  function drawProgrammingDecorations(sx, sy, isl, colors) {
    // Terminal screens
    for (let i = 0; i < 2; i++) {
      const tx = sx + (i === 0 ? -isl.rx * 0.35 : isl.rx * 0.35);
      const ty = sy - isl.ry * 0.15;

      // Screen frame
      ctx.fillStyle = 'rgba(30, 30, 30, 0.7)';
      ctx.strokeStyle = 'rgba(118, 255, 3, 0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(tx - 16, ty - 12, 32, 24);
      ctx.strokeRect(tx - 16, ty - 12, 32, 24);

      // Code lines
      ctx.fillStyle = 'rgba(118, 255, 3, 0.5)';
      for (let l = 0; l < 3; l++) {
        const w = 8 + Math.random() * 16;
        ctx.fillRect(tx - 12, ty - 8 + l * 6, w, 2);
      }
    }

    // Binary rain effect
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(118, 255, 3, 0.15)';
    for (let i = 0; i < 8; i++) {
      const bx = sx + ((i - 4) * 20);
      const by = sy + isl.ry * 0.2 + Math.sin(waveTime * 2 + i) * 15;
      ctx.fillText(Math.random() > 0.5 ? '1' : '0', bx, by);
    }

    // Circuit patterns
    ctx.strokeStyle = 'rgba(118, 255, 3, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 40, sy + isl.ry * 0.4);
    ctx.lineTo(sx, sy + isl.ry * 0.4);
    ctx.lineTo(sx, sy + isl.ry * 0.3);
    ctx.lineTo(sx + 40, sy + isl.ry * 0.3);
    ctx.stroke();
  }

  function drawCentralDecorations(sx, sy, isl, colors) {
    // Grand library structure
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1.5;

    // Main building
    ctx.beginPath();
    ctx.moveTo(sx - 40, sy + 10);
    ctx.lineTo(sx - 40, sy - 20);
    ctx.lineTo(sx, sy - 35);
    ctx.lineTo(sx + 40, sy - 20);
    ctx.lineTo(sx + 40, sy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Columns
    for (let i = 0; i < 4; i++) {
      const cx = sx - 30 + i * 20;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.fillRect(cx - 3, sy - 18, 6, 28);
    }

    // Star on top
    drawStar(sx, sy - 40, 8, 5, 'rgba(255, 215, 0, 0.6)');
  }

  function drawStar(cx, cy, radius, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.4;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  //  RENDERING - BRIDGES
  // ================================================================
  function drawBridges() {
    if (!bridgeDefs) return;
    for (const br of bridgeDefs) {
      const fromIsl = islands.find(i => i.id === br.from);
      const toIsl = islands.find(i => i.id === br.to);
      if (!fromIsl || !toIsl) continue;

      const x1 = fromIsl.x - cam.x;
      const y1 = fromIsl.y - cam.y;
      const x2 = toIsl.x - cam.x;
      const y2 = toIsl.y - cam.y;

      // Check if any part is on screen
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (maxX < -100 || minX > canvas.width + 100 || maxY < -100 || minY > canvas.height + 100) continue;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const nx = dx / len;
      const ny = dy / len;

      // Bridge wood planks
      const perpX = -ny;
      const perpY = nx;
      const bridgeWidth = 22;

      ctx.fillStyle = '#6d4c41';
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 1;

      // Draw planks along bridge
      const step = 12;
      for (let d = 0; d < len; d += step) {
        const px = x1 + nx * d;
        const py = y1 + ny * d;

        ctx.fillStyle = d % (step * 2) < step ? '#6d4c41' : '#5d4037';
        ctx.beginPath();
        ctx.moveTo(px + perpX * bridgeWidth, py + perpY * bridgeWidth);
        ctx.lineTo(px - perpX * bridgeWidth, py - perpY * bridgeWidth);
        ctx.lineTo(px - perpX * bridgeWidth + nx * step, py - perpY * bridgeWidth + ny * step);
        ctx.lineTo(px + perpX * bridgeWidth + nx * step, py + perpY * bridgeWidth + ny * step);
        ctx.closePath();
        ctx.fill();
      }

      // Rails
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1 + perpX * bridgeWidth, y1 + perpY * bridgeWidth);
      ctx.lineTo(x2 + perpX * bridgeWidth, y2 + perpY * bridgeWidth);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1 - perpX * bridgeWidth, y1 - perpY * bridgeWidth);
      ctx.lineTo(x2 - perpX * bridgeWidth, y2 - perpY * bridgeWidth);
      ctx.stroke();
    }
  }

  // ================================================================
  //  RENDERING - TOTEMS
  // ================================================================
  function drawTotems() {
    if (!totemDefs) return;
    for (const t of totemDefs) {
      const sx = t.x - cam.x;
      const sy = t.y - cam.y;
      if (sx < -40 || sx > canvas.width + 40 || sy < -60 || sy > canvas.height + 40) continue;

      const catColor = categoryInfo[t.category] ? categoryInfo[t.category].accent : '#ffd700';

      // Glow
      const glowSize = 18 + Math.sin(gameTime * 3 + t.x * 0.01) * 4;
      ctx.fillStyle = catColor.replace(')', ', 0.12)').replace('rgb', 'rgba');
      if (catColor.startsWith('#')) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
      }
      ctx.beginPath();
      ctx.arc(sx, sy - 8, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Crystal base
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crystal body
      ctx.fillStyle = catColor;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 22);
      ctx.lineTo(sx + 8, sy - 4);
      ctx.lineTo(sx + 4, sy + 2);
      ctx.lineTo(sx - 4, sy + 2);
      ctx.lineTo(sx - 8, sy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Sparkle
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.5 + Math.sin(gameTime * 4 + t.y * 0.01) * 0.3;
      ctx.beginPath();
      ctx.arc(sx - 2, sy - 14, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // E hint when player is near
      if (localPlayer) {
        const dist = Math.hypot(localPlayer.x - t.x, localPlayer.y - t.y);
        if (dist < 80) {
          ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText('[E] Interagir', sx, sy - 30);
        }
      }
    }
  }

  // ================================================================
  //  RENDERING - PLAYER CHARACTER
  // ================================================================
  function drawCharacter(x, y, color, name, health, isSelf, level, direction, isMoving, charType) {
    const sx = x - cam.x;
    const sy = y - cam.y;

    if (sx < -60 || sx > canvas.width + 60 || sy < -80 || sy > canvas.height + 60) return;

    const cid = charType || 'luna';
    const cdef = charDefs[cid] || charDefs.luna;

    direction = direction || 'down';
    const bob = isMoving ? Math.sin(walkCycle * (isSelf ? 1 : 0.8)) * 3 : Math.sin(gameTime * 2) * 1.5;
    const legOffset = isMoving ? Math.sin(walkCycle * (isSelf ? 1 : 0.8) * 2) * 4 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 18, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow under character
    if (isSelf) {
      ctx.fillStyle = cdef.glowColor;
      ctx.beginPath();
      ctx.arc(sx, sy + 10, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawY = sy + bob;

    // Legs
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(sx - 5 + legOffset, drawY + 8, 4, 8);
    ctx.fillRect(sx + 1 - legOffset, drawY + 8, 4, 8);

    // Feet
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(sx - 6 + legOffset, drawY + 14, 6, 3);
    ctx.fillRect(sx + 0 - legOffset, drawY + 14, 6, 3);

    // Robe body (character color)
    ctx.fillStyle = cdef.robeColor;
    ctx.beginPath();
    ctx.moveTo(sx - 10, drawY - 2);
    ctx.lineTo(sx - 8, drawY + 10);
    ctx.lineTo(sx + 8, drawY + 10);
    ctx.lineTo(sx + 10, drawY - 2);
    ctx.closePath();
    ctx.fill();

    // Body highlight
    ctx.fillStyle = cdef.robeHighlight;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(sx - 6, drawY - 1);
    ctx.lineTo(sx - 4, drawY + 8);
    ctx.lineTo(sx + 2, drawY + 8);
    ctx.lineTo(sx + 4, drawY - 1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath();
    ctx.arc(sx, drawY - 10, 10, 0, Math.PI * 2);
    ctx.fill();

    // Character-specific hat
    drawCharHat(ctx, sx, drawY, cid, cdef);

    // Eyes based on direction
    const eyeOffX = direction === 'left' ? -2 : direction === 'right' ? 2 : 0;
    const eyeOffY = direction === 'up' ? -2 : direction === 'down' ? 1 : 0;

    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - 3.5, drawY - 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 3.5, drawY - 11, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(sx - 3.5 + eyeOffX * 0.8, drawY - 11 + eyeOffY * 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 3.5 + eyeOffX * 0.8, drawY - 11 + eyeOffY * 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Blaze special: glowing eyes overlay
    if (cid === 'blaze') {
      ctx.fillStyle = '#ff4400';
      ctx.globalAlpha = 0.4 + Math.sin(gameTime * 4) * 0.2;
      ctx.beginPath();
      ctx.arc(sx - 3.5, drawY - 11, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 3.5, drawY - 11, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Mouth (small smile)
    if (direction !== 'up') {
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, drawY - 6, 3, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }

    // Character-specific special effects
    drawCharSpecial(ctx, sx, drawY, cid, cdef, x, isSelf);

    // Floating book orbiting character
    const bookAngle = gameTime * 1.5 + (isSelf ? 0 : x * 0.01);
    const bookX = sx + Math.cos(bookAngle) * 18;
    const bookY = drawY - 5 + Math.sin(bookAngle * 2) * 3;
    ctx.fillStyle = '#ffd700';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(bookX - 4, bookY - 3, 8, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bookX - 0.5, bookY - 2, 1, 4);
    ctx.globalAlpha = 1;

    // Name tag + level
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(name + ' Lv.' + (level || 1), sx + 1, drawY - 38);
    ctx.fillStyle = isSelf ? '#ffd700' : '#fff';
    ctx.fillText(name + ' Lv.' + (level || 1), sx, drawY - 39);

    // Health bar above character (if damaged)
    if (health < 100) {
      const barW = 30;
      const barH = 4;
      const bx = sx - barW / 2;
      const by = drawY - 44;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bx, by, barW, barH);
      const pct = Math.max(0, health) / 100;
      ctx.fillStyle = pct > 0.5 ? '#76ff03' : pct > 0.25 ? '#ff6d00' : '#ff1744';
      ctx.fillRect(bx, by, barW * pct, barH);
    }
  }

  // ---- Character-specific hat drawing ----
  function drawCharHat(ctx, sx, drawY, cid, cdef) {
    switch (cid) {
      case 'luna':
        // Tall pointy wizard hat with stars
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.moveTo(sx - 11, drawY - 16);
        ctx.lineTo(sx + 2, drawY - 34);
        ctx.lineTo(sx + 11, drawY - 16);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sx, drawY - 16, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Stars
        ctx.fillStyle = cdef.hatAccent;
        drawStar(sx - 1, drawY - 26, 2.5, 5, cdef.hatAccent);
        drawStar(sx + 5, drawY - 21, 1.5, 5, cdef.hatAccent);
        break;

      case 'blaze':
        // Knight helmet
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.arc(sx, drawY - 13, 11, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Visor slit
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - 9, drawY - 14, 18, 2);
        // Flame crest
        for (let fi = 0; fi < 3; fi++) {
          const fx = sx + (fi - 1) * 4;
          const fh = 5 + Math.sin(gameTime * 4 + fi) * 3;
          ctx.fillStyle = fi === 1 ? cdef.hatAccent : '#ff6600';
          ctx.beginPath();
          ctx.moveTo(fx - 2, drawY - 20);
          ctx.lineTo(fx, drawY - 20 - fh);
          ctx.lineTo(fx + 2, drawY - 20);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'coral':
        // Captain hat
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.ellipse(sx, drawY - 16, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(sx - 9, drawY - 22, 18, 7);
        ctx.beginPath();
        ctx.ellipse(sx, drawY - 22, 9, 2.5, 0, Math.PI, 0);
        ctx.fill();
        // Anchor emblem
        ctx.fillStyle = cdef.hatAccent;
        ctx.beginPath();
        ctx.arc(sx, drawY - 19, 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'pixel':
        // VR headset
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(sx - 11, drawY - 19, 22, 8, 3);
        } else {
          ctx.rect(sx - 11, drawY - 19, 22, 8);
        }
        ctx.fill();
        // Visor glow
        const visorAlpha = 0.5 + Math.sin(gameTime * 3) * 0.3;
        ctx.fillStyle = 'rgba(57,255,20,' + visorAlpha + ')';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(sx - 9, drawY - 18, 18, 5, 2);
        } else {
          ctx.rect(sx - 9, drawY - 18, 18, 5);
        }
        ctx.fill();
        break;

      case 'flora':
        // Crown of leaves
        for (let lfi = 0; lfi < 5; lfi++) {
          const la = (lfi / 5) * Math.PI;
          const lr = 12;
          const lx = sx + Math.cos(la - Math.PI) * lr;
          const ly = drawY - 17 + Math.sin(la - Math.PI) * lr * 0.35;
          ctx.fillStyle = lfi % 2 === 0 ? '#4caf50' : '#81c784';
          ctx.beginPath();
          ctx.ellipse(lx, ly, 4, 2.5, la * 0.5, 0, Math.PI * 2);
          ctx.fill();
          if (lfi % 2 === 0) {
            ctx.fillStyle = lfi === 0 ? '#ff6b9d' : lfi === 2 ? '#ffd700' : '#ff9800';
            ctx.beginPath();
            ctx.arc(lx, ly - 1.5, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      default:
        // Default wizard hat (fallback)
        ctx.fillStyle = cdef.hatColor || color;
        ctx.beginPath();
        ctx.moveTo(sx - 11, drawY - 16);
        ctx.lineTo(sx + 2, drawY - 34);
        ctx.lineTo(sx + 11, drawY - 16);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sx, drawY - 16, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        drawStar(sx + 1, drawY - 26, 3, 5, '#ffd700');
        break;
    }
  }

  // ---- Character-specific special effects ----
  function drawCharSpecial(ctx, sx, drawY, cid, cdef, worldX, isSelf) {
    switch (cid) {
      case 'luna':
        // Crescent moon floating nearby
        const moonAngle = gameTime * 1.2;
        const moonX = sx + Math.cos(moonAngle) * 20;
        const moonY = drawY - 18 + Math.sin(moonAngle * 0.7) * 4;
        ctx.fillStyle = '#fffacd';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cdef.robeColor;
        ctx.beginPath();
        ctx.arc(moonX + 1.5, moonY - 0.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;

      case 'blaze':
        // Fire particles at feet
        for (let fi = 0; fi < 3; fi++) {
          const ffx = sx - 5 + fi * 5;
          const ffh = 3 + Math.sin(gameTime * 5 + fi * 2) * 2;
          ctx.fillStyle = fi === 1 ? 'rgba(255,200,0,0.4)' : 'rgba(255,100,0,0.35)';
          ctx.beginPath();
          ctx.moveTo(ffx - 2, drawY + 16);
          ctx.lineTo(ffx, drawY + 16 - ffh);
          ctx.lineTo(ffx + 2, drawY + 16);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'coral':
        // Water bubbles
        for (let bi = 0; bi < 3; bi++) {
          const bx = sx - 12 + bi * 12;
          const by = drawY + Math.sin(gameTime * 2.5 + bi * 2) * 10;
          ctx.strokeStyle = 'rgba(0,206,209,0.35)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(bx, by, 2 + Math.sin(gameTime + bi) * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case 'pixel':
        // Binary digits
        ctx.font = '8px monospace';
        ctx.fillStyle = cdef.hatAccent;
        for (let di = 0; di < 3; di++) {
          const dx = sx - 14 + di * 14;
          const ddy = drawY - 5 + Math.sin(gameTime * 2 + di * 2) * 12;
          ctx.globalAlpha = 0.25 + Math.sin(gameTime * 3 + di) * 0.15;
          ctx.fillText(Math.sin(gameTime + di) > 0 ? '1' : '0', dx, ddy);
        }
        ctx.globalAlpha = 1;
        break;

      case 'flora':
        // Floating leaves
        for (let fli = 0; fli < 2; fli++) {
          const flx = sx - 16 + fli * 32;
          const fly = drawY + Math.sin(gameTime * 1.8 + fli * 3) * 12;
          ctx.save();
          ctx.translate(flx, fly);
          ctx.rotate(gameTime * 1.5 + fli);
          ctx.fillStyle = fli === 0 ? '#4caf50' : '#8bc34a';
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.ellipse(0, 0, 3.5, 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        break;
    }
  }

  // ================================================================
  //  RENDERING - ENEMIES
  // ================================================================
  function drawEnemies() {
    for (const e of enemies) {
      const sx = e.x - cam.x;
      const sy = e.y - cam.y;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) continue;

      const s = e.size;
      const isBoss = e.type === 'boss';
      const floatY = Math.sin(gameTime * 3 + e.x * 0.02) * 3;

      const drawY = sy + floatY;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + s * 0.7, s * 0.6, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Choose appearance by island
      drawEnemyByTheme(sx, drawY, s, e, isBoss);

      // HP bar
      const barW = s * 2.2;
      const barH = 4;
      const bx = sx - barW / 2;
      const by = drawY - s - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, barW, barH);
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = pct > 0.5 ? '#76ff03' : pct > 0.25 ? '#ff6d00' : '#ff1744';
      ctx.fillRect(bx, by, barW * pct, barH);

      // Boss crown
      if (isBoss) {
        ctx.fillStyle = '#ffd700';
        const crownY = drawY - s - 6;
        ctx.beginPath();
        ctx.moveTo(sx - 8, crownY);
        ctx.lineTo(sx - 6, crownY - 7);
        ctx.lineTo(sx - 3, crownY - 3);
        ctx.lineTo(sx, crownY - 9);
        ctx.lineTo(sx + 3, crownY - 3);
        ctx.lineTo(sx + 6, crownY - 7);
        ctx.lineTo(sx + 8, crownY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawEnemyByTheme(sx, sy, s, e, isBoss) {
    const flash = e.flash;

    switch (e.island) {
      case 'matematica': {
        // Dark floating numbers
        const bodyColor = flash ? '#ffffff' : (isBoss ? '#1a237e' : '#283593');
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Symbol on face
        ctx.font = (isBoss ? '16' : '12') + 'px monospace';
        ctx.fillStyle = '#00e5ff';
        ctx.textAlign = 'center';
        ctx.fillText('?', sx, sy + 4);
        break;
      }
      case 'historia': {
        // Shadow ghosts
        const bodyColor = flash ? '#ffffff' : (isBoss ? '#37474f' : '#546e7a');
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(sx, sy - s * 0.2, s, 0, Math.PI);
        // Wavy bottom
        for (let i = 0; i <= 6; i++) {
          const wx = sx - s + (i / 6) * s * 2;
          const wy = sy + s * 0.3 + Math.sin(gameTime * 4 + i) * 3;
          ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.fill();

        // Ghost eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx - s * 0.3, sy - s * 0.3, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + s * 0.3, sy - s * 0.3, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(sx - s * 0.25, sy - s * 0.3, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + s * 0.35, sy - s * 0.3, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ciencias': {
        // Corrupted molecule blob
        const bodyColor = flash ? '#ffffff' : (isBoss ? '#1b5e20' : '#558b2f');
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        // Blobby shape
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const r = s * (0.8 + Math.sin(gameTime * 3 + i * 1.3) * 0.2);
          const px = sx + Math.cos(a) * r;
          const py = sy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Toxic glow
        ctx.strokeStyle = 'rgba(105, 240, 174, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(sx - s * 0.25, sy - s * 0.1, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + s * 0.25, sy - s * 0.1, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'linguas': {
        // Garbled letter creature
        const bodyColor = flash ? '#ffffff' : (isBoss ? '#880e4f' : '#ad1457');
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(234, 128, 252, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Garbled letters on body
        ctx.font = (s * 0.6) + 'px monospace';
        ctx.fillStyle = 'rgba(234, 128, 252, 0.7)';
        ctx.textAlign = 'center';
        const chars = ['@', '#', '&', '!', '~'];
        ctx.fillText(chars[Math.floor(gameTime) % chars.length], sx, sy + s * 0.2);
        break;
      }
      case 'programacao': {
        // Glitch bug - pixelated
        const bodyColor = flash ? '#ffffff' : (isBoss ? '#b71c1c' : '#d32f2f');
        const pixelSize = isBoss ? 6 : 4;
        ctx.fillStyle = bodyColor;
        // Draw as pixel blocks
        for (let px = -s; px < s; px += pixelSize) {
          for (let py = -s; py < s; py += pixelSize) {
            if (px * px + py * py < s * s) {
              // Glitch effect: randomly skip some pixels
              if (Math.sin(px * 7 + py * 13 + gameTime) > -0.3) {
                ctx.fillRect(sx + px, sy + py, pixelSize - 1, pixelSize - 1);
              }
            }
          }
        }

        // Glitch eye
        ctx.fillStyle = '#76ff03';
        ctx.fillRect(sx - s * 0.3 - 2, sy - s * 0.2 - 2, 4, 4);
        ctx.fillRect(sx + s * 0.3 - 2, sy - s * 0.2 - 2, 4, 4);
        break;
      }
      default: {
        // Generic enemy
        const bodyColor = flash ? '#ffffff' : '#d32f2f';
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx - s * 0.3, sy - s * 0.15, s * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + s * 0.3, sy - s * 0.15, s * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(sx - s * 0.25, sy - s * 0.15, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + s * 0.35, sy - s * 0.15, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ================================================================
  //  RENDERING - BULLETS
  // ================================================================
  function drawBullets() {
    // Server bullets
    for (const b of serverBullets) {
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (sx < -10 || sx > canvas.width + 10 || sy < -10 || sy > canvas.height + 10) continue;

      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Local predicted bullets (knowledge orbs)
    for (const b of localBullets) {
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;
      if (sx < -10 || sx > canvas.width + 10 || sy < -10 || sy > canvas.height + 10) continue;

      // Glow
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;

      // Outer glow
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Small book/star shape
      ctx.fillStyle = b.color;
      drawStar(sx, sy, 5, 4, b.color);

      ctx.shadowBlur = 0;
    }
  }

  // ================================================================
  //  RENDERING - PARTICLES
  // ================================================================
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

  // ================================================================
  //  RENDERING - MINIMAP
  // ================================================================
  function drawMinimap() {
    const mmW = 180;
    const mmH = 180;
    const mx = canvas.width - mmW - 16;
    const my = canvas.height - mmH - 40;

    // Background
    ctx.fillStyle = 'rgba(5, 10, 25, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, mmW, mmH, 10);
    ctx.fill();
    ctx.stroke();

    // Islands as colored shapes
    for (const isl of islands) {
      const ix = mx + (isl.x / mapW) * mmW;
      const iy = my + (isl.y / mapH) * mmH;
      const irx = (isl.rx / mapW) * mmW;
      const iry = (isl.ry / mapH) * mmH;

      const cat = isl.category;
      const color = categoryInfo[cat] ? categoryInfo[cat].color : '#ffd700';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.ellipse(ix, iy, Math.max(irx, 3), Math.max(iry, 3), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Enemies as red dots
    ctx.fillStyle = 'rgba(255, 23, 68, 0.5)';
    for (const e of enemies) {
      const ex = mx + (e.x / mapW) * mmW;
      const ey = my + (e.y / mapH) * mmH;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Remote players
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      const px = mx + (rp.x / mapW) * mmW;
      const py = my + (rp.y / mapH) * mmH;
      ctx.fillStyle = rp.color;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Local player (yellow, larger)
    if (localPlayer) {
      const px = mx + (localPlayer.x / mapW) * mmW;
      const py = my + (localPlayer.y / mapH) * mmH;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Pulsing ring
      const ringSize = 5 + Math.sin(gameTime * 3) * 2;
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, ringSize, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ================================================================
  //  PALM TREES (decorative, placed on islands)
  // ================================================================
  function drawPalmTrees() {
    // Generate stable tree positions from island data
    for (const isl of islands) {
      const seed = isl.x * 100 + isl.y;
      const count = 4;
      for (let i = 0; i < count; i++) {
        const a = ((seed + i * 137) % 628) / 100;
        const r = 0.55 + ((seed + i * 53) % 30) / 100;
        const tx = isl.x + Math.cos(a) * isl.rx * r;
        const ty = isl.y + Math.sin(a) * isl.ry * r;

        const sx = tx - cam.x;
        const sy = ty - cam.y;

        if (sx < -50 || sx > canvas.width + 50 || sy < -70 || sy > canvas.height + 50) continue;

        const treeSize = 22 + ((seed + i * 31) % 12);

        // Trunk shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(sx + 3, sy + 2, treeSize * 0.15, treeSize * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.strokeStyle = '#6d4c41';
        ctx.lineWidth = treeSize * 0.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + treeSize * 0.1, sy - treeSize * 0.5, sx + treeSize * 0.05, sy - treeSize);
        ctx.stroke();

        // Leaves
        const topX = sx + treeSize * 0.05;
        const topY = sy - treeSize;
        for (let f = 0; f < 5; f++) {
          const fa = (f / 5) * Math.PI * 2 + Math.sin(waveTime * 0.5 + tx * 0.01) * 0.05;
          const lx = topX + Math.cos(fa) * treeSize * 0.6;
          const ly = topY + Math.sin(fa) * treeSize * 0.4;

          ctx.strokeStyle = f % 2 === 0 ? '#2e7d32' : '#388e3c';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(
            topX + Math.cos(fa) * treeSize * 0.35,
            topY + Math.sin(fa) * treeSize * 0.15 - treeSize * 0.12,
            lx, ly
          );
          ctx.stroke();

          ctx.fillStyle = f % 2 === 0 ? 'rgba(46,125,50,0.5)' : 'rgba(56,142,60,0.5)';
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(
            topX + Math.cos(fa) * treeSize * 0.3,
            topY + Math.sin(fa) * treeSize * 0.12 - treeSize * 0.15,
            lx, ly
          );
          ctx.quadraticCurveTo(
            topX + Math.cos(fa) * treeSize * 0.4,
            topY + Math.sin(fa) * treeSize * 0.2 + treeSize * 0.04,
            topX, topY
          );
          ctx.fill();
        }

        // Coconuts
        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.arc(topX - 2, topY + 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(topX + 3, topY + 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ================================================================
  //  GAME LOOP
  // ================================================================
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = now - lastTime;
    lastTime = now;
    gameTime = now / 1000;

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
    drawBridges();
    drawIslands();
    drawPalmTrees();
    drawTotems();
    drawEnemies();
    drawBullets();
    drawParticles();

    // Draw remote players
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      drawCharacter(rp.x, rp.y, rp.color, rp.name, rp.health, false, rp.level, rp.direction, rp.isMoving, rp.characterId);
    }

    // Draw local player
    if (localPlayer && !isDead) {
      drawCharacter(
        localPlayer.x, localPlayer.y, localPlayer.color,
        localPlayer.name, localPlayer.health, true,
        localPlayer.level, playerDirection, playerIsMoving, characterId
      );
    }

    drawMinimap();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

})();
