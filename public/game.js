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

  // Duel DOM refs
  const elDuelPrompt = document.getElementById('duelPrompt');
  const elDuelPromptText = document.getElementById('duelPromptText');
  const elDuelRequestModal = document.getElementById('duelRequestModal');
  const elDuelChallengerName = document.getElementById('duelChallengerName');
  const elDuelAcceptBtn = document.getElementById('duelAcceptBtn');
  const elDuelDeclineBtn = document.getElementById('duelDeclineBtn');
  const elDuelResultModal = document.getElementById('duelResultModal');
  const elDuelResultContent = document.getElementById('duelResultContent');
  const touchDuelBtn = document.getElementById('touchDuelBtn');

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
  let chestDefs = [];
  let signDefs = [];
  let mapW = 4000;
  let mapH = 4000;

  // Achievements data
  let allAchievements = [];
  let unlockedAchievements = [];

  // Chest open state (client-side cooldown tracking)
  const chestOpenState = {}; // chestId -> { openedAt, cooldown }

  // Active sign tip popup
  let activeTipPopup = null; // { signId, tip, category, startTime, duration }

  // Active mini-lesson from totem
  let activeMiniLesson = null; // { text, category, startTime, duration }

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

  // Duel state
  let duelActive = false;
  let currentDuelId = null;
  let nearbyPlayerId = null;
  let pendingDuelId = null;

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

    // If notes panel is open, only allow N (close) and Escape (close); block all game input
    if (notesPanelOpen) {
      if (e.key.toLowerCase() === 'n' || e.key === 'Escape') {
        e.preventDefault();
        window.toggleNotes && window.toggleNotes();
      }
      return;
    }

    // If progress panel is open, only allow P (close) and Escape (close); block all game input
    if (progressPanelOpen) {
      if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        e.preventDefault();
        window.toggleProgress && window.toggleProgress();
      }
      return;
    }

    // If achievements panel is open, only allow G (close) and Escape (close); block all game input
    if (achievementsPanelOpen) {
      if (e.key.toLowerCase() === 'g' || e.key === 'Escape') {
        e.preventDefault();
        window.toggleAchievements && window.toggleAchievements();
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
    if (e.key === 'f' || e.key === 'F') {
      if (nearbyPlayerId && !quizActive && !duelActive) {
        socket.emit('duelChallenge', { targetId: nearbyPlayerId });
      }
    }
    if (e.key === 'Escape') {
      if (quizActive) return;
      if (chatOpen) closeChatInput();
      if (rankingOpen) { rankingOpen = false; elRankingPanel.style.display = 'none'; }
    }
    if (e.key.toLowerCase() === 'n' && !quizActive && !chatOpen) {
      e.preventDefault();
      window.toggleNotes && window.toggleNotes();
    }
    if (e.key.toLowerCase() === 'p' && !quizActive && !chatOpen) {
      e.preventDefault();
      window.toggleProgress && window.toggleProgress();
    }
    if (e.key.toLowerCase() === 'g' && !quizActive && !chatOpen) {
      e.preventDefault();
      window.toggleAchievements && window.toggleAchievements();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // ---- Quick-Action Button Handlers ----
  (function () {
    const btnNotes = document.getElementById('btnNotes');
    const btnProgress = document.getElementById('btnProgress');
    const btnAchievements = document.getElementById('btnAchievements');
    const touchNotesBtn = document.getElementById('touchNotesBtn');
    const touchProgressBtn = document.getElementById('touchProgressBtn');

    if (btnNotes) btnNotes.addEventListener('click', () => window.toggleNotes && window.toggleNotes());
    if (btnProgress) btnProgress.addEventListener('click', () => window.toggleProgress && window.toggleProgress());
    if (btnAchievements) btnAchievements.addEventListener('click', () => window.toggleAchievements && window.toggleAchievements());
    if (touchNotesBtn) touchNotesBtn.addEventListener('touchstart', (e) => { e.preventDefault(); window.toggleNotes && window.toggleNotes(); }, { passive: false });
    if (touchProgressBtn) touchProgressBtn.addEventListener('touchstart', (e) => { e.preventDefault(); window.toggleProgress && window.toggleProgress(); }, { passive: false });
  })();

  // ---- Controls Hint Auto-Hide ----
  (function () {
    const hint = document.getElementById('controlsHint');
    if (!hint) return;
    let hideTimer = null;
    function showHint() {
      hint.classList.remove('hint-hidden');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => hint.classList.add('hint-hidden'), 10000);
    }
    document.addEventListener('mousemove', showHint, { passive: true });
    // Initial hide after 10s
    hideTimer = setTimeout(() => hint.classList.add('hint-hidden'), 10000);
  })();

  // ---- Quiz button handlers ----
  document.querySelectorAll('.quiz-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!quizActive) return;
      const idx = parseInt(btn.dataset.index);
      // If in a duel, send duelAnswer instead
      if (duelActive && currentDuelId) {
        socket.emit('duelAnswer', { duelId: currentDuelId, answerIndex: idx });
        // Don't close modal yet - wait for duelResult
        return;
      }
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

  // ---- Interact (E key): priority totem > chest > sign ----
  function handleTotemInteract() {
    if (isDead || !localPlayer || quizActive) return;

    // 1. Check totems (80px range)
    let nearestTotem = null;
    let nearestTotemDist = 80;
    for (const t of totemDefs) {
      const d = Math.hypot(localPlayer.x - t.x, localPlayer.y - t.y);
      if (d < nearestTotemDist) { nearestTotemDist = d; nearestTotem = t; }
    }
    if (nearestTotem) {
      socket.emit('totemInteract', { totemId: nearestTotem.id });
      return;
    }

    // 2. Check chests (60px range)
    let nearestChest = null;
    let nearestChestDist = 60;
    for (const c of chestDefs) {
      const d = Math.hypot(localPlayer.x - c.x, localPlayer.y - c.y);
      if (d < nearestChestDist) { nearestChestDist = d; nearestChest = c; }
    }
    if (nearestChest) {
      socket.emit('chestInteract', { chestId: nearestChest.id });
      return;
    }

    // 3. Check signs (50px range)
    let nearestSign = null;
    let nearestSignDist = 50;
    for (const s of signDefs) {
      const d = Math.hypot(localPlayer.x - s.x, localPlayer.y - s.y);
      if (d < nearestSignDist) { nearestSignDist = d; nearestSign = s; }
    }
    if (nearestSign) {
      socket.emit('signInteract', { signId: nearestSign.id });
      return;
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

    // Label the quiz source
    if (data.isChest) {
      elQuizCategory.textContent = '\u{1F4E6} BAU - ' + catName + ' (2x)';
    } else if (data.totemId) {
      elQuizCategory.textContent = '\u{1F5FF} ' + catName;
    } else {
      elQuizCategory.textContent = catName;
    }

    // Show mini-lesson briefly if provided (before quiz modal opens)
    if (data.miniLesson) {
      activeMiniLesson = {
        text: data.miniLesson,
        category: data.category,
        startTime: gameTime,
        duration: 4.0
      };
    }

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
      if (data.isChest && data.bonus) {
        elFeedbackContent.innerHTML =
          '<span style="color:#ffd700;font-size:16px;font-weight:900;">' + data.bonus + ' BONUS!</span><br>' +
          '+' + data.xp + ' XP  +' + data.coins + ' Moedas';
      } else {
        elFeedbackContent.innerHTML = '+' + data.xp + ' XP  +' + data.coins + ' Moedas';
      }
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
    // Trigger badge glow animation
    if (elLevelBadge) {
      elLevelBadge.classList.remove('level-up-glow');
      void elLevelBadge.offsetWidth; // reflow
      elLevelBadge.classList.add('level-up-glow');
      elLevelBadge.addEventListener('animationend', () => elLevelBadge.classList.remove('level-up-glow'), { once: true });
    }
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
    chestDefs = data.chests || [];
    signDefs = data.infoSigns || [];
    mapW = data.mapW;
    mapH = data.mapH;
    isDead = false;
    playerDirection = 'down';
    if (data.allAchievements) allAchievements = data.allAchievements;
    if (data.unlockedAchievements) unlockedAchievements = data.unlockedAchievements;
    updateAchievementsBadge();
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

  socket.on('quizResult', (data) => {
    closeQuiz();
    showQuizFeedback(data);
    if (localPlayer) {
      localPlayer.health = data.health;
    }
  });

  socket.on('signTip', (data) => {
    activeTipPopup = {
      signId: data.signId,
      tip: data.tip,
      category: data.category,
      startTime: gameTime,
      duration: 5.0 // 5 seconds
    };
  });

  socket.on('chestCooldown', (data) => {
    addKillFeed('Bau em recarga: ' + data.remaining + 's restantes.');
  });

  // Track chest open state when quiz starts from chest
  socket.on('quizStart', (data) => {
    if (data.chestId) {
      chestOpenState[data.chestId] = {
        openedAt: Date.now(),
        cooldown: 60000
      };
    }
    openQuiz(data);
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

  // ---- Duel Socket Events ----
  socket.on('duelSent', (data) => {
    addKillFeed('Desafio enviado para ' + data.targetName + '!');
  });

  socket.on('duelRequest', (data) => {
    pendingDuelId = data.duelId;
    elDuelChallengerName.textContent = data.challengerName;
    elDuelRequestModal.style.display = 'flex';
  });

  socket.on('duelDeclined', (data) => {
    addKillFeed(data.targetName + ' recusou o duelo.');
  });

  socket.on('duelStart', (data) => {
    // Close request modal if open
    elDuelRequestModal.style.display = 'none';
    if (elDuelPrompt) elDuelPrompt.style.display = 'none';

    // Reuse the quiz modal for the duel question
    duelActive = true;
    currentDuelId = data.duelId;
    quizActive = true; // Prevent movement/shooting during duel

    const catName = categoryInfo[data.category] ? categoryInfo[data.category].name : data.category;
    elQuizCategory.textContent = '\u2694 DUELO - ' + catName;
    elQuizQuestion.textContent = data.question;
    elOptA.textContent = data.options[0];
    elOptB.textContent = data.options[1];
    elOptC.textContent = data.options[2];
    elOptD.textContent = data.options[3];

    // Reset timer circle
    elTimerCircle.style.strokeDashoffset = '0';
    elTimerCircle.style.stroke = '#ffd700';
    elTimerText.style.color = '#ffd700';
    elTimerText.textContent = data.timeLimit;

    elQuizModal.style.display = 'flex';

    // Start timer
    quizTimeLeft = data.timeLimit;
    const totalTime = data.timeLimit;
    const circumference = 113;
    clearInterval(quizTimerInterval);
    quizTimerInterval = setInterval(() => {
      quizTimeLeft--;
      elTimerText.textContent = Math.max(0, quizTimeLeft);
      const progress = 1 - (quizTimeLeft / totalTime);
      elTimerCircle.style.strokeDashoffset = (circumference * progress).toString();
      if (quizTimeLeft <= 5) {
        elTimerCircle.style.stroke = '#ff1744';
        elTimerText.style.color = '#ff1744';
      }
      if (quizTimeLeft <= 0) clearInterval(quizTimerInterval);
    }, 1000);
  });

  socket.on('duelResult', (data) => {
    duelActive = false;
    currentDuelId = null;
    quizActive = false;
    elQuizModal.style.display = 'none';
    elTimerText.style.color = '#00e5ff';
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;

    let html = '';
    if (data.draw) {
      html = '<div class="duel-result-content duel-result-draw">' +
        '<div style="font-size:32px;margin-bottom:8px;">&#9876;</div>' +
        '<div style="font-size:20px;font-weight:800;margin-bottom:6px;">EMPATE!</div>' +
        '<div style="font-size:14px;opacity:0.8;">Ambos erraram \u2022 -5 HP</div>' +
        '<div style="font-size:13px;opacity:0.6;margin-top:6px;">Resposta: ' + data.correctAnswer + '</div></div>';
    } else if (data.won) {
      html = '<div class="duel-result-content duel-result-win">' +
        '<div style="font-size:32px;margin-bottom:8px;">&#127942;</div>' +
        '<div style="font-size:20px;font-weight:800;margin-bottom:6px;">VITORIA!</div>' +
        '<div style="font-size:14px;">+' + data.xp + ' XP \u2022 +' + data.coins + ' moedas</div>' +
        '<div style="font-size:13px;opacity:0.7;margin-top:6px;">vs ' + data.opponentName + '</div></div>';
    } else {
      html = '<div class="duel-result-content duel-result-lose">' +
        '<div style="font-size:32px;margin-bottom:8px;">&#128128;</div>' +
        '<div style="font-size:20px;font-weight:800;margin-bottom:6px;">DERROTA!</div>' +
        '<div style="font-size:14px;">-' + data.damage + ' HP</div>' +
        '<div style="font-size:13px;opacity:0.7;margin-top:6px;">Resposta: ' + data.correctAnswer + '</div></div>';
    }

    elDuelResultModal.innerHTML = html;
    elDuelResultModal.style.display = 'block';
    setTimeout(() => { elDuelResultModal.style.display = 'none'; }, 3000);

    // Update local health
    if (localPlayer && data.health !== undefined) {
      localPlayer.health = data.health;
    }
  });

  // ---- Duel Accept/Decline Buttons ----
  elDuelAcceptBtn.addEventListener('click', () => {
    if (pendingDuelId) {
      socket.emit('duelAccept', { duelId: pendingDuelId });
      elDuelRequestModal.style.display = 'none';
    }
  });

  elDuelDeclineBtn.addEventListener('click', () => {
    if (pendingDuelId) {
      socket.emit('duelDecline', { duelId: pendingDuelId });
      elDuelRequestModal.style.display = 'none';
      pendingDuelId = null;
    }
  });

  // ---- Respawn ----
  respawnBtn.addEventListener('click', () => {
    socket.emit('respawn');
  });

  // ---- Join ----
  const userEmail = sessionStorage.getItem('email') || null;
  socket.emit('join', { name: username, characterId: characterId, email: userEmail });

  // ---- Persistence socket listeners ----
  socket.on('notesData', (data) => {
    // Store notes in memory for use by Notes feature
    if (data && data.notes) {
      window._userNotes = data.notes;
      // Update badge count
      updateNotesBadge();
      // If notes panel is open, refresh the current editor content
      if (notesPanelOpen) {
        loadNoteToEditor(currentNoteCategory);
      }
    }
  });

  socket.on('notesSaved', (data) => {
    // Confirmation that notes were saved
    if (data && data.ok && window._userNotes) {
      updateNotesBadge();
    }
  });

  socket.on('progressData', (data) => {
    // Store progress in memory for use by Progress feature
    if (data) {
      window._userProgress = data;
      // If the progress panel is open, refresh it with fresh data
      if (progressPanelOpen) {
        populateProgressDashboard();
      }
    }
  });

  // Helper to save a note via socket (can be called by Notes feature)
  window.saveNote = function (category, content) {
    socket.emit('saveNotes', { category, content });
    if (!window._userNotes) window._userNotes = {};
    window._userNotes[category] = content;
  };

  // Helper to request all notes
  window.loadNotes = function () {
    socket.emit('loadNotes');
  };

  // Helper to request progress data
  window.getProgress = function () {
    socket.emit('getProgress');
  };

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
    const prevCoins = elCoinCount.textContent;
    elCoinCount.textContent = localPlayer.coins;
    if (String(localPlayer.coins) !== prevCoins) {
      elCoinCount.classList.remove('coin-bounce');
      void elCoinCount.offsetWidth;
      elCoinCount.classList.add('coin-bounce');
      elCoinCount.addEventListener('animationend', () => elCoinCount.classList.remove('coin-bounce'), { once: true });
    }

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

    // Update island indicator with themed class
    const curIsland = getIslandAt(localPlayer.x, localPlayer.y);
    if (curIsland) {
      elIsland.textContent = curIsland.name;
      const accentColor = categoryInfo[curIsland.category]
        ? categoryInfo[curIsland.category].accent
        : '#ffd700';
      elIsland.style.color = accentColor;
      elIsland.className = 'island-indicator island-' + (curIsland.category || 'central');
    } else {
      elIsland.textContent = 'Oceano';
      elIsland.style.color = '#00bcd4';
      elIsland.className = 'island-indicator';
    }
  }

  // ================================================================
  //  QUICK ACTION PANEL STUBS
  // ================================================================

  function _createPanel(id, icon, title, body) {
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = id;
      panel.className = 'panel-overlay';
      panel.innerHTML =
        '<button class="panel-overlay-close" onclick="document.getElementById(\'' + id + '\').remove()">&#10005;</button>' +
        '<div class="panel-overlay-title"><span>' + icon + '</span> ' + title + '</div>' +
        '<div class="panel-overlay-body">' + body + '</div>';
      document.body.appendChild(panel);
    }
    return panel;
  }

  // ================================================================
  //  PROGRESS DASHBOARD
  // ================================================================
  let progressPanelOpen = false;

  const CAT_COLORS = {
    matematica: '#00e5ff',
    historia:   '#ffab40',
    ciencias:   '#69f0ae',
    linguas:    '#ea80fc',
    programacao:'#76ff03'
  };

  const CAT_NAMES = {
    matematica: 'Matematica',
    historia:   'Historia',
    ciencias:   'Ciencias',
    linguas:    'Linguas',
    programacao:'Programacao'
  };

  const CATEGORIES = ['matematica', 'historia', 'ciencias', 'linguas', 'programacao'];

  function relativeTime(ts) {
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return secs + 's atras';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return mins + 'min atras';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h atras';
    const days = Math.floor(hrs / 24);
    return days + 'd atras';
  }

  function drawRadarChart(catStats) {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 240, H = 240;
    const cx = W / 2, cy = H / 2;
    const R = 90;
    ctx.clearRect(0, 0, W, H);

    const allZero = CATEGORIES.every(function(c) { return catStats[c].pct === 0; });
    if (allZero) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Responda quizzes para', cx, cy - 10);
      ctx.fillText('ver seu progresso', cx, cy + 10);
      return;
    }

    const angleStep = (Math.PI * 2) / CATEGORIES.length;
    const startAngle = -Math.PI / 2; // Start at top

    // Helper: get x,y for a category axis at a given fraction
    function axisPoint(i, frac) {
      const angle = startAngle + i * angleStep;
      return {
        x: cx + Math.cos(angle) * R * frac,
        y: cy + Math.sin(angle) * R * frac
      };
    }

    // Draw concentric pentagon rings (33%, 66%, 100%)
    [0.33, 0.66, 1.0].forEach(function(frac) {
      ctx.beginPath();
      CATEGORIES.forEach(function(_, i) {
        const pt = axisPoint(i, frac);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw axis lines
    CATEGORIES.forEach(function(_, i) {
      const pt = axisPoint(i, 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw axis labels
    ctx.font = 'bold 10px Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    CATEGORIES.forEach(function(cat, i) {
      const pt = axisPoint(i, 1.22);
      ctx.fillStyle = CAT_COLORS[cat];
      ctx.textAlign = 'center';
      ctx.fillText(CAT_NAMES[cat], pt.x, pt.y);
    });

    // Draw data polygon
    ctx.beginPath();
    CATEGORIES.forEach(function(cat, i) {
      const frac = catStats[cat].pct / 100;
      const pt = axisPoint(i, frac);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw vertex dots
    CATEGORIES.forEach(function(cat, i) {
      const frac = catStats[cat].pct / 100;
      const pt = axisPoint(i, frac);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
    });
  }

  function renderSubjectBars(catStats) {
    const container = document.getElementById('subjectBars');
    if (!container) return;
    container.innerHTML = '';
    CATEGORIES.forEach(function(cat) {
      const s = catStats[cat];
      const color = CAT_COLORS[cat];
      const item = document.createElement('div');
      item.className = 'subject-bar-item';
      item.innerHTML =
        '<div class="subject-bar-header">' +
          '<span class="subject-name" style="color:' + color + '">' + CAT_NAMES[cat] + '</span>' +
          '<span class="subject-pct">' + s.pct + '% (' + s.correct + '/' + s.total + ')</span>' +
        '</div>' +
        '<div class="subject-bar-track">' +
          '<div class="subject-bar-fill" style="width:' + s.pct + '%; background:' + color + '"></div>' +
        '</div>';
      container.appendChild(item);
    });
  }

  function renderQuizHistory(history) {
    const container = document.getElementById('quizHistoryList');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) {
      container.innerHTML = '<div class="progress-empty-msg">Nenhum quiz respondido ainda</div>';
      return;
    }
    const recent = history.slice().reverse().slice(0, 20);
    const sourceIcons = { enemy: '\u2694', totem: '\uD83D\uDDFF', chest: '\uD83D\uDCE6', duel: '\uD83E\uDD3A' };
    recent.forEach(function(entry) {
      const item = document.createElement('div');
      item.className = 'history-item';
      const dotColor = entry.correct ? '#69f0ae' : '#ff5252';
      const icon = sourceIcons[entry.source] || '\u2753';
      item.innerHTML =
        '<span class="history-dot" style="background:' + dotColor + '"></span>' +
        '<span class="history-cat">' + (CAT_NAMES[entry.category] || entry.category) + '</span>' +
        '<span class="history-source">' + icon + '</span>' +
        '<span class="history-time">' + relativeTime(entry.timestamp) + '</span>';
      container.appendChild(item);
    });
  }

  function populateProgressDashboard() {
    const data = window._userProgress || {};
    const stats = data.stats || {};
    const quizHistory = data.quizHistory || [];

    // Update stat cards
    const totalCorrect = stats.totalCorrect || 0;
    const totalWrong = stats.totalWrong || 0;
    const total = totalCorrect + totalWrong;
    const accuracy = total > 0 ? Math.round(totalCorrect / total * 100) : 0;

    const elCorrect = document.getElementById('statTotalCorrect');
    const elWrong = document.getElementById('statTotalWrong');
    const elAccuracy = document.getElementById('statAccuracy');
    const elDuels = document.getElementById('statDuelsWon');
    if (elCorrect) elCorrect.textContent = totalCorrect;
    if (elWrong) elWrong.textContent = totalWrong;
    if (elAccuracy) elAccuracy.textContent = accuracy + '%';
    if (elDuels) elDuels.textContent = stats.totalDuelsWon || 0;

    // Per-category stats from quizHistory
    const catStats = {};
    CATEGORIES.forEach(function(cat) {
      const catQuizzes = quizHistory.filter(function(q) { return q.category === cat; });
      const correct = catQuizzes.filter(function(q) { return q.correct; }).length;
      catStats[cat] = {
        total: catQuizzes.length,
        correct: correct,
        pct: catQuizzes.length > 0 ? Math.round(correct / catQuizzes.length * 100) : 0
      };
    });

    drawRadarChart(catStats);
    renderSubjectBars(catStats);
    renderQuizHistory(quizHistory);
  }

  function initProgressPanel() {
    const panel = document.getElementById('progressPanel');
    if (!panel) return;

    const closeBtn = document.getElementById('progressCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        if (progressPanelOpen) window.toggleProgress();
      });
    }

    // Backdrop click closes panel
    panel.addEventListener('click', function(e) {
      if (e.target === panel && progressPanelOpen) window.toggleProgress();
    });
  }

  initProgressPanel();

  window.toggleProgress = function() {
    progressPanelOpen = !progressPanelOpen;
    const panel = document.getElementById('progressPanel');
    const btn = document.getElementById('btnProgress');
    if (progressPanelOpen) {
      window.getProgress(); // request fresh data
      if (panel) panel.style.display = 'flex';
      btn && btn.classList.add('active');
      setTimeout(populateProgressDashboard, 150);
    } else {
      if (panel) panel.style.display = 'none';
      btn && btn.classList.remove('active');
    }
  };

  // ================================================================
  //  NOTES PANEL
  // ================================================================
  let notesPanelOpen = false;
  let currentNoteCategory = 'matematica';
  let notesSaveTimeout = null;

  function updateNotesBadge() {
    const badge = document.getElementById('notesBadge');
    if (!badge) return;
    const notes = window._userNotes || {};
    const count = Object.values(notes).filter(function(v) { return v && v.trim().length > 0; }).length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function loadNoteToEditor(category) {
    const textarea = document.getElementById('notesTextarea');
    const charCount = document.getElementById('notesCharCount');
    if (!textarea) return;
    const notes = window._userNotes || {};
    textarea.value = notes[category] || '';
    if (charCount) charCount.textContent = textarea.value.length + '/2000';
  }

  function saveCurrentNote() {
    const textarea = document.getElementById('notesTextarea');
    if (!textarea) return;
    const content = textarea.value;
    window.saveNote(currentNoteCategory, content);
    updateNotesBadge();
  }

  function setNotesSaveStatus(state) {
    const el = document.getElementById('notesSaveStatus');
    if (!el) return;
    el.className = 'notes-save-status';
    if (state === 'saving') {
      el.textContent = 'Salvando...';
      el.classList.add('saving');
    } else if (state === 'saved') {
      el.textContent = 'Salvo!';
      el.classList.add('saved');
    } else {
      el.textContent = 'Salvo automaticamente';
    }
  }

  function initNotesPanel() {
    const panel = document.getElementById('notesPanel');
    if (!panel) return;

    // Close button
    const closeBtn = document.getElementById('notesCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        window.toggleNotes && window.toggleNotes();
      });
    }

    // Click backdrop to close
    panel.addEventListener('click', function(e) {
      if (e.target === panel) {
        window.toggleNotes && window.toggleNotes();
      }
    });

    // Tab switching
    const tabs = panel.querySelectorAll('.notes-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        // Save current note before switching
        saveCurrentNote();
        // Update active tab
        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        // Switch category
        currentNoteCategory = tab.getAttribute('data-cat');
        loadNoteToEditor(currentNoteCategory);
        setNotesSaveStatus('idle');
      });
    });

    // Textarea input: auto-save with debounce + char count
    const textarea = document.getElementById('notesTextarea');
    const charCount = document.getElementById('notesCharCount');
    if (textarea) {
      textarea.addEventListener('input', function() {
        if (charCount) charCount.textContent = textarea.value.length + '/2000';
        setNotesSaveStatus('saving');
        if (notesSaveTimeout) clearTimeout(notesSaveTimeout);
        notesSaveTimeout = setTimeout(function() {
          saveCurrentNote();
          setNotesSaveStatus('saved');
          setTimeout(function() { setNotesSaveStatus('idle'); }, 2000);
        }, 1500);
      });
    }

    // Format buttons
    const formatBtns = panel.querySelectorAll('.notes-format-btn');
    formatBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const format = btn.getAttribute('data-format');
        const ta = document.getElementById('notesTextarea');
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = ta.value.substring(start, end);
        let before, after, insert;
        if (format === 'bold') {
          insert = '**' + (selected || 'negrito') + '**';
          ta.value = ta.value.substring(0, start) + insert + ta.value.substring(end);
          ta.selectionStart = start + 2;
          ta.selectionEnd = start + 2 + (selected || 'negrito').length;
        } else if (format === 'italic') {
          insert = '*' + (selected || 'italico') + '*';
          ta.value = ta.value.substring(0, start) + insert + ta.value.substring(end);
          ta.selectionStart = start + 1;
          ta.selectionEnd = start + 1 + (selected || 'italico').length;
        } else if (format === 'list') {
          // Insert bullet at beginning of current line
          const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
          ta.value = ta.value.substring(0, lineStart) + '• ' + ta.value.substring(lineStart);
          ta.selectionStart = start + 2;
          ta.selectionEnd = end + 2;
        }
        if (charCount) charCount.textContent = ta.value.length + '/2000';
        ta.focus();
      });
    });

    // Save button
    const saveBtn = document.getElementById('notesSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        setNotesSaveStatus('saving');
        saveCurrentNote();
        setNotesSaveStatus('saved');
        setTimeout(function() { setNotesSaveStatus('idle'); }, 2000);
      });
    }
  }

  // Initialize notes panel once DOM is ready (called after socket setup)
  initNotesPanel();

  window.toggleNotes = function() {
    notesPanelOpen = !notesPanelOpen;
    const panel = document.getElementById('notesPanel');
    const btn = document.getElementById('btnNotes');
    if (notesPanelOpen) {
      // Load notes from server first
      window.loadNotes();
      // Show panel
      if (panel) panel.style.display = 'flex';
      btn && btn.classList.add('active');
      // Small delay to allow notesData to arrive, then populate
      setTimeout(function() {
        loadNoteToEditor(currentNoteCategory);
        // Reset to first tab visually
        const activeTabs = document.querySelectorAll('.notes-tab');
        activeTabs.forEach(function(t) {
          t.classList.toggle('active', t.getAttribute('data-cat') === currentNoteCategory);
        });
        setNotesSaveStatus('idle');
      }, 80);
    } else {
      // Save current note before closing
      saveCurrentNote();
      if (notesSaveTimeout) { clearTimeout(notesSaveTimeout); notesSaveTimeout = null; }
      if (panel) panel.style.display = 'none';
      btn && btn.classList.remove('active');
    }
  };

  // ================================================================
  //  ACHIEVEMENTS SYSTEM
  // ================================================================
  let achievementsPanelOpen = false;
  let _achievementPopupQueue = [];
  let _achievementPopupActive = false;

  function updateAchievementsBadge() {
    const badge = document.getElementById('achievementsBadge');
    const btn = document.getElementById('btnAchievements');
    if (!badge) return;
    const count = unlockedAchievements.length;
    const total = allAchievements.length || 22;
    if (count > 0) {
      badge.textContent = count + '/' + total;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
    if (btn && count > 0 && count >= total) {
      btn.classList.add('all-unlocked');
    } else if (btn) {
      btn.classList.remove('all-unlocked');
    }
  }

  function showAchievementPopup(ach) {
    _achievementPopupQueue.push(ach);
    if (!_achievementPopupActive) {
      _processAchievementPopupQueue();
    }
  }

  function _processAchievementPopupQueue() {
    if (_achievementPopupQueue.length === 0) {
      _achievementPopupActive = false;
      return;
    }
    _achievementPopupActive = true;
    const ach = _achievementPopupQueue.shift();

    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML =
      '<div class="achieve-icon">' + ach.icon + '</div>' +
      '<div class="achieve-info">' +
        '<div class="achieve-label">Conquista Desbloqueada!</div>' +
        '<div class="achieve-name">' + ach.name + '</div>' +
        '<div class="achieve-desc">' + ach.desc + '</div>' +
      '</div>';
    document.body.appendChild(popup);

    setTimeout(function() {
      popup.classList.add('hiding');
      popup.addEventListener('animationend', function() {
        if (popup.parentNode) popup.parentNode.removeChild(popup);
        setTimeout(_processAchievementPopupQueue, 200);
      }, { once: true });
    }, 4000);
  }

  socket.on('achievementUnlocked', function(ach) {
    if (!unlockedAchievements.includes(ach.id)) {
      unlockedAchievements.push(ach.id);
    }
    updateAchievementsBadge();
    showAchievementPopup(ach);
  });

  socket.on('achievementsData', function(data) {
    if (data.all) allAchievements = data.all;
    if (data.unlocked) unlockedAchievements = data.unlocked;
    updateAchievementsBadge();
    if (achievementsPanelOpen) {
      populateAchievementsGrid();
    }
  });

  function populateAchievementsGrid() {
    const grid = document.getElementById('achievementsGrid');
    const countEl = document.getElementById('achieveCount');
    if (!grid) return;
    grid.innerHTML = '';
    const total = allAchievements.length;
    const unlockedCount = unlockedAchievements.length;
    if (countEl) countEl.textContent = unlockedCount + '/' + total;

    allAchievements.forEach(function(ach) {
      const isUnlocked = unlockedAchievements.includes(ach.id);
      const card = document.createElement('div');
      card.className = 'achieve-card ' + (isUnlocked ? 'unlocked' : 'locked');
      card.innerHTML =
        '<div class="achieve-card-icon">' + ach.icon + '</div>' +
        '<div class="achieve-card-name">' + ach.name + '</div>' +
        '<div class="achieve-card-desc">' + ach.desc + '</div>';
      grid.appendChild(card);
    });
  }

  function initAchievementsPanel() {
    const panel = document.getElementById('achievementsPanel');
    if (!panel) return;

    const closeBtn = document.getElementById('achievementsCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        if (achievementsPanelOpen) window.toggleAchievements();
      });
    }

    panel.addEventListener('click', function(e) {
      if (e.target === panel && achievementsPanelOpen) window.toggleAchievements();
    });
  }

  initAchievementsPanel();

  window.toggleAchievements = function() {
    achievementsPanelOpen = !achievementsPanelOpen;
    const panel = document.getElementById('achievementsPanel');
    const btn = document.getElementById('btnAchievements');
    if (achievementsPanelOpen) {
      socket.emit('getAchievements');
      if (panel) panel.style.display = 'flex';
      btn && btn.classList.add('active');
      setTimeout(populateAchievementsGrid, 80);
    } else {
      if (panel) panel.style.display = 'none';
      btn && btn.classList.remove('active');
    }
  };

  function clientPointInPolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function getIslandAt(x, y) {
    for (const isl of islands) {
      if (isl.points) {
        const absPoints = isl.points.map(p => ({ x: isl.x + p.x, y: isl.y + p.y }));
        if (clientPointInPolygon(x, y, absPoints)) return isl;
      } else {
        const dx = x - isl.x;
        const dy = y - isl.y;
        if ((dx * dx) / (isl.rx * isl.rx) + (dy * dy) / (isl.ry * isl.ry) <= 1) return isl;
      }
    }
    return null;
  }

  function isOnIsland(x, y) {
    return getIslandAt(x, y) !== null;
  }

  function clientIsOnBridge(x, y) {
    for (const br of bridgeDefs) {
      const fromIsl = islands.find(i => i.id === br.from);
      const toIsl = islands.find(i => i.id === br.to);
      if (!fromIsl || !toIsl) continue;

      const bdx = toIsl.x - fromIsl.x;
      const bdy = toIsl.y - fromIsl.y;
      const len = Math.hypot(bdx, bdy);
      if (len === 0) continue;
      const nx = bdx / len;
      const ny = bdy / len;

      const px = x - fromIsl.x;
      const py = y - fromIsl.y;
      const proj = px * nx + py * ny;

      if (proj < 0 || proj > len) continue;

      const perpDist = Math.abs(px * (-ny) + py * nx);
      if (perpDist < 30) return true;
    }
    return false;
  }

  function clientIsOnLand(x, y) {
    return isOnIsland(x, y) || clientIsOnBridge(x, y);
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

      const speed = 3;

      const newX = Math.max(16, Math.min(mapW - 16, localPlayer.x + dx * speed));
      const newY = Math.max(16, Math.min(mapH - 16, localPlayer.y + dy * speed));

      if (clientIsOnLand(newX, newY)) {
        localPlayer.x = newX;
        localPlayer.y = newY;
      } else if (clientIsOnLand(newX, localPlayer.y)) {
        localPlayer.x = newX;
      } else if (clientIsOnLand(localPlayer.x, newY)) {
        localPlayer.y = newY;
      }
      // Otherwise don't move (blocked by water)

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

  // Stable seaweed patches (generated once, referenced by index)
  const seaweedPatches = (function () {
    const patches = [];
    const prng = (n) => ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
    for (let i = 0; i < 12; i++) {
      patches.push({
        wx: prng(i * 3 + 0) * 4000,
        wy: prng(i * 3 + 1) * 4000,
        strands: 3 + Math.floor(prng(i * 3 + 2) * 3), // 3-5
        heights: Array.from({ length: 5 }, (_, s) => 20 + prng(i * 7 + s) * 20),
        offsets: Array.from({ length: 5 }, (_, s) => prng(i * 11 + s) * Math.PI * 2),
        spacings: Array.from({ length: 5 }, (_, s) => (prng(i * 13 + s) - 0.5) * 16),
        greenVars: Array.from({ length: 5 }, (_, s) => prng(i * 17 + s))
      });
    }
    return patches;
  })();

  // Stable floating particles (generated once)
  const floatParticles = (function () {
    const parts = [];
    const prng = (n) => ((Math.sin(n * 53.7 + 99.1) * 74231.8) % 1 + 1) % 1;
    for (let i = 0; i < 30; i++) {
      parts.push({
        wx: prng(i * 4 + 0) * 4000,
        wy: prng(i * 4 + 1) * 4000,
        size: 1 + prng(i * 4 + 2) * 2,
        alpha: 0.05 + prng(i * 4 + 3) * 0.10,
        speed: 0.3 + prng(i * 5 + 0) * 0.5,
        wobble: prng(i * 5 + 1) * Math.PI * 2,
        glow: prng(i * 5 + 2) > 0.65
      });
    }
    return parts;
  })();

  function drawOcean() {
    waveTime += 0.015;

    // ---- Deep ocean gradient (3-stop) ----
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0,   '#040d1a');
    grd.addColorStop(0.5, '#081830');
    grd.addColorStop(1,   '#0e2a4a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ---- Subtle noise texture overlay ----
    const prngFast = (x, y) => ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1 + 1) % 1;
    ctx.save();
    for (let nx = 0; nx < canvas.width; nx += 6) {
      for (let ny = 0; ny < canvas.height; ny += 6) {
        if (prngFast(nx + Math.floor(cam.x / 6), ny + Math.floor(cam.y / 6)) > 0.985) {
          ctx.fillStyle = 'rgba(255,255,255,0.025)';
          ctx.fillRect(nx, ny, 1, 1);
        }
      }
    }
    ctx.restore();

    // ---- Multi-layer waves (bezier curves) ----
    const waveLayers = [
      { spacing: 80, amp: 8,  speed: 0.01,  color: 'rgba(15, 60, 130, 0.08)',  lw: 1.5 },
      { spacing: 50, amp: 5,  speed: 0.02,  color: 'rgba(20, 80, 160, 0.10)',  lw: 1.2 },
      { spacing: 30, amp: 3,  speed: 0.035, color: 'rgba(30, 100, 180, 0.06)', lw: 0.8 }
    ];
    for (const layer of waveLayers) {
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.lw;
      const rowStart = Math.floor(cam.y / layer.spacing) * layer.spacing;
      const rowEnd   = cam.y + canvas.height + layer.spacing;
      for (let row = rowStart; row < rowEnd; row += layer.spacing) {
        const screenY = row - cam.y;
        if (screenY < -layer.spacing || screenY > canvas.height + layer.spacing) continue;
        ctx.beginPath();
        const colStep = 40;
        const startCol = Math.floor(cam.x / colStep) * colStep - colStep;
        const endCol   = cam.x + canvas.width + colStep * 2;
        let first = true;
        for (let col = startCol; col <= endCol; col += colStep) {
          const worldX = col;
          const y0 = screenY + Math.sin(waveTime * layer.speed * 200 + worldX * 0.007 + row * 0.012) * layer.amp;
          const y1 = screenY + Math.sin(waveTime * layer.speed * 200 + (worldX + colStep * 0.5) * 0.007 + row * 0.012) * layer.amp;
          const sx = col - cam.x;
          const cpx = sx + colStep * 0.5;
          if (first) { ctx.moveTo(sx, y0); first = false; }
          else ctx.bezierCurveTo(sx - colStep * 0.25, y0, cpx - colStep * 0.25, y1, cpx, y1);
        }
        ctx.stroke();
      }
    }

    // ---- Enhanced caustics (25 circles with pulsing glow) ----
    for (let i = 0; i < 25; i++) {
      const cx = ((i * 337 + waveTime * 25) % (mapW + 400)) - 200 - cam.x;
      const cy = ((i * 541 + waveTime * 18) % (mapH + 400)) - 200 - cam.y;
      if (cx < -120 || cx > canvas.width + 120 || cy < -120 || cy > canvas.height + 120) continue;
      const r  = 30 + (i % 10) * 5 + Math.sin(waveTime * 1.3 + i * 0.7) * 10; // 30-80px
      const pulse = 0.5 + 0.5 * Math.sin(waveTime * 1.8 + i * 1.1);
      // alternate between blue and teal
      const isTeal = i % 3 === 0;
      const baseAlpha = isTeal ? 0.03 : 0.04;
      ctx.fillStyle = isTeal
        ? `rgba(0,150,160,${(baseAlpha + pulse * 0.015).toFixed(3)})`
        : `rgba(20,100,180,${(baseAlpha + pulse * 0.02).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Kelp / seaweed ----
    ctx.save();
    ctx.lineWidth = 2.5;
    for (const patch of seaweedPatches) {
      const sx = patch.wx - cam.x;
      const sy = patch.wy - cam.y;
      if (sx < -80 || sx > canvas.width + 80 || sy < -80 || sy > canvas.height + 80) continue;
      for (let s = 0; s < patch.strands; s++) {
        const h   = patch.heights[s];
        const ox  = patch.spacings[s];
        const ph  = patch.offsets[s];
        const gv  = patch.greenVars[s];
        const r   = Math.round(20 + gv * 20);
        const g   = Math.round(100 + gv * 40);
        const b   = Math.round(60);
        const a   = (0.08 + gv * 0.04).toFixed(2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        ctx.beginPath();
        ctx.moveTo(sx + ox, sy);
        // segmented waving kelp using quadratic curves
        const segs = 4;
        for (let seg = 1; seg <= segs; seg++) {
          const t = seg / segs;
          const sway = Math.sin(waveTime * 1.5 + ph + seg * 0.8) * 8 * t;
          const cpSway = Math.sin(waveTime * 1.5 + ph + (seg - 0.5) * 0.8) * 8 * (t - 0.5 / segs);
          ctx.quadraticCurveTo(
            sx + ox + cpSway, sy - h * (t - 0.5 / segs),
            sx + ox + sway,   sy - h * t
          );
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    // ---- Fish schools (triangular bodies) ----
    const fishGroups = [
      { offset: 0,  count: 4, speedMul: 40, colorA: [80, 180, 240, 0.20] },
      { offset: 7,  count: 3, speedMul: 35, colorA: [100, 200, 255, 0.18] },
      { offset: 13, count: 4, speedMul: 50, colorA: [120, 220, 255, 0.15] },
      { offset: 18, count: 3, speedMul: 45, colorA: [60,  160, 220, 0.20] },
      { offset: 23, count: 3, speedMul: 38, colorA: [90,  190, 250, 0.17] },
    ];
    ctx.save();
    for (const group of fishGroups) {
      for (let k = 0; k < group.count; k++) {
        const i = group.offset + k;
        // cluster offset so fish stay close together
        const clusterX = ((i * 431 + waveTime * group.speedMul) % mapW);
        const clusterY = ((i * 673 + Math.sin(waveTime * 0.8 + i) * 30) % mapH);
        const fx = clusterX + Math.sin(waveTime * 1.2 + k * 2.1) * 18 - cam.x;
        const fy = clusterY + Math.cos(waveTime * 1.0 + k * 1.7) * 14 - cam.y;
        if (fx < -20 || fx > canvas.width + 20 || fy < -20 || fy > canvas.height + 20) continue;

        const angle = Math.atan2(
          Math.cos(waveTime * 1.0 + k * 1.7) * 14,
          Math.sin(waveTime * 1.2 + k * 2.1) * 18
        ) + waveTime * 0.1 + i * 0.5;
        const wobble = Math.sin(waveTime * 3 + i) * 0.2;
        const [r, g, b, a] = group.colorA;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(angle + wobble);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        // body triangle
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -3);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        // tail fin
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(-8, -3);
        ctx.lineTo(-8, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    // ---- Floating particles (plankton / bubbles) ----
    ctx.save();
    const pTime = waveTime * 0.4; // slow drift
    for (let i = 0; i < floatParticles.length; i++) {
      const p = floatParticles[i];
      // drift upward by cycling wy modulo mapH
      const drift = (pTime * p.speed * 60) % mapH;
      const wx = p.wx + Math.sin(pTime * 0.7 + p.wobble) * 20;
      const wy = ((p.wy - drift + mapH) % mapH);
      const fx = wx - cam.x;
      const fy = wy - cam.y;
      if (fx < -10 || fx > canvas.width + 10 || fy < -10 || fy > canvas.height + 10) continue;
      if (p.glow) {
        ctx.shadowBlur  = 4;
        ctx.shadowColor = 'rgba(150,220,255,0.4)';
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = 'rgba(180,230,255,1)';
      ctx.beginPath();
      ctx.arc(fx, fy, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.glow) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ================================================================
  //  RENDERING - ATMOSPHERE (called after islands/chars, before HUD)
  // ================================================================

  // Stable fog patches (generated once)
  const fogPatches = (function () {
    const patches = [];
    const prng = (n) => ((Math.sin(n * 91.3 + 17.5) * 58234.1) % 1 + 1) % 1;
    for (let i = 0; i < 10; i++) {
      patches.push({
        wx:    prng(i * 3 + 0) * 4400 - 200,
        wy:    prng(i * 3 + 1) * 4400 - 200,
        r:     200 + prng(i * 3 + 2) * 200,       // 200-400
        speed: (prng(i * 5 + 0) - 0.5) * 0.4,     // drift X
        vy:    (prng(i * 5 + 1) - 0.5) * 0.25,    // drift Y
        phase: prng(i * 5 + 2) * Math.PI * 2
      });
    }
    return patches;
  })();

  function drawAtmosphere() {
    // ---- Soft vignette ----
    const vgR  = Math.max(canvas.width, canvas.height) * 0.75;
    const vgGrd = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, vgR * 0.1,
      canvas.width / 2, canvas.height / 2, vgR
    );
    vgGrd.addColorStop(0, 'rgba(0,0,0,0)');
    vgGrd.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vgGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ---- Fog / mist patches ----
    ctx.save();
    for (const fp of fogPatches) {
      const wx = fp.wx + Math.sin(waveTime * 0.12 + fp.phase) * 60 + fp.speed * waveTime * 10;
      const wy = fp.wy + Math.cos(waveTime * 0.09 + fp.phase) * 40 + fp.vy  * waveTime * 10;
      const sx = ((wx % (mapW + 800) + mapW + 800) % (mapW + 800)) - cam.x - 400;
      const sy = ((wy % (mapH + 800) + mapH + 800) % (mapH + 800)) - cam.y - 400;
      if (sx < -fp.r - 100 || sx > canvas.width + fp.r + 100) continue;
      if (sy < -fp.r - 100 || sy > canvas.height + fp.r + 100) continue;
      const fg = ctx.createRadialGradient(sx, sy, 0, sx, sy, fp.r);
      fg.addColorStop(0,   'rgba(150,200,255,0.035)');
      fg.addColorStop(0.6, 'rgba(150,200,255,0.015)');
      fg.addColorStop(1,   'rgba(150,200,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(sx, sy, fp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ---- Light rays from top-left ----
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const rayOriginX = -canvas.width * 0.15;
    const rayOriginY = -canvas.height * 0.10;
    const rays = [
      { angle: 0.52, width: 80,  baseAlpha: 0.015, phase: 0 },
      { angle: 0.62, width: 55,  baseAlpha: 0.012, phase: 1.3 },
      { angle: 0.72, width: 70,  baseAlpha: 0.010, phase: 2.6 },
      { angle: 0.45, width: 40,  baseAlpha: 0.008, phase: 3.9 }
    ];
    for (const ray of rays) {
      const oscillation = Math.sin(waveTime * 0.4 + ray.phase) * 0.04;
      const angle = ray.angle + oscillation;
      const rayLen = Math.hypot(canvas.width, canvas.height) * 1.5;
      ctx.save();
      ctx.translate(rayOriginX, rayOriginY);
      ctx.rotate(angle);
      const rg = ctx.createLinearGradient(0, 0, 0, rayLen);
      rg.addColorStop(0,   `rgba(100,180,255,${(ray.baseAlpha * 1.5).toFixed(4)})`);
      rg.addColorStop(0.4, `rgba(100,180,255,${ray.baseAlpha.toFixed(4)})`);
      rg.addColorStop(1,   'rgba(100,180,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(-ray.width / 2, 0, ray.width, rayLen);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
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

  // Helper: trace a smooth organic polygon path using quadratic curves
  function traceIslandPath(ctx, pts) {
    ctx.beginPath();
    const last = pts[pts.length - 1];
    ctx.moveTo((last.x + pts[0].x) / 2, (last.y + pts[0].y) / 2);
    for (let i = 0; i < pts.length; i++) {
      const next = pts[(i + 1) % pts.length];
      const midX = (pts[i].x + next.x) / 2;
      const midY = (pts[i].y + next.y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.closePath();
  }

  // Helper: scale polygon points outward from center for border rings
  function scalePoints(pts, cx, cy, offset) {
    return pts.map(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / dist) * offset, y: p.y + (dy / dist) * offset };
    });
  }

  // ---- Deterministic pseudo-random helper (no Math.random for stable seeding) ----
  function islPrng(seed) {
    const s = Math.sin(seed * 9301 + 49297) * 233280;
    return (s - Math.floor(s));
  }

  function drawIslands() {
    for (const isl of islands) {
      const sx = isl.x - cam.x;
      const sy = isl.y - cam.y;

      if (sx + isl.rx + 40 < 0 || sx - isl.rx - 40 > canvas.width) continue;
      if (sy + isl.ry + 40 < 0 || sy - isl.ry - 40 > canvas.height) continue;

      const colors = getIslandColors(isl);
      const islIdx = islands.indexOf(isl);

      ctx.save();

      if (isl.points) {
        // Convert relative points to screen coordinates
        const pts = isl.points.map(p => ({ x: sx + p.x, y: sy + p.y }));

        // Shallow water ring (expanded outline)
        const shallowPts = scalePoints(pts, sx, sy, 35);
        traceIslandPath(ctx, shallowPts);
        ctx.fillStyle = colors.shallow;
        ctx.fill();

        // Beach ring (slightly expanded)
        const beachPts = scalePoints(pts, sx, sy, 16);
        traceIslandPath(ctx, beachPts);
        ctx.fillStyle = colors.beach;
        ctx.fill();

        // Foam effect on beach edge (animated arcs)
        for (let f = 0; f < 20; f++) {
          const fa = (f / 20) * Math.PI * 2 + waveTime * 0.6;
          const fDist = islPrng(islIdx * 100 + f) * 8;
          const fpx = sx + Math.cos(fa) * (isl.rx + 14 + fDist);
          const fpy = sy + Math.sin(fa) * (isl.ry + 14 + fDist);
          const fAlpha = 0.15 + Math.sin(waveTime * 1.5 + f) * 0.08;
          ctx.strokeStyle = `rgba(255,255,255,${fAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(fpx, fpy, 3 + islPrng(islIdx * 200 + f) * 3, 0, Math.PI);
          ctx.stroke();
        }

        // Main ground
        traceIslandPath(ctx, pts);
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(isl.rx, isl.ry));
        grd.addColorStop(0, colors.grass);
        grd.addColorStop(0.8, colors.ground);
        grd.addColorStop(1, colors.ground);
        ctx.fillStyle = grd;
        ctx.fill();

        // Inner grass variation polygon (scaled 0.85x, slightly darker)
        const innerPts = scalePoints(pts, sx, sy, -(Math.max(isl.rx, isl.ry) * 0.15));
        traceIslandPath(ctx, innerPts);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fill();

      } else {
        // Fallback: ellipse rendering
        ctx.beginPath();
        ctx.ellipse(sx, sy, isl.rx + 35, isl.ry + 35, 0, 0, Math.PI * 2);
        ctx.fillStyle = colors.shallow;
        ctx.fill();

        // Foam on ellipse beach
        for (let f = 0; f < 20; f++) {
          const fa = (f / 20) * Math.PI * 2 + waveTime * 0.6;
          const fpx = sx + Math.cos(fa) * (isl.rx + 14);
          const fpy = sy + Math.sin(fa) * (isl.ry + 14);
          const fAlpha = 0.15 + Math.sin(waveTime * 1.5 + f) * 0.08;
          ctx.strokeStyle = `rgba(255,255,255,${fAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(fpx, fpy, 3 + islPrng(islIdx * 200 + f) * 3, 0, Math.PI);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.ellipse(sx, sy, isl.rx + 16, isl.ry + 16, 0, 0, Math.PI * 2);
        ctx.fillStyle = colors.beach;
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(sx, sy, isl.rx, isl.ry, 0, 0, Math.PI * 2);
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(isl.rx, isl.ry));
        grd.addColorStop(0, colors.grass);
        grd.addColorStop(0.8, colors.ground);
        grd.addColorStop(1, colors.ground);
        ctx.fillStyle = grd;
        ctx.fill();

        // Inner grass variation (ellipse)
        ctx.beginPath();
        ctx.ellipse(sx, sy, isl.rx * 0.85, isl.ry * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fill();
      }

      // --- Earth/dirt patches ---
      const numPatches = 5 + (islIdx % 4);
      for (let j = 0; j < numPatches; j++) {
        const pa = islPrng(islIdx * 31 + j) * Math.PI * 2;
        const pr = islPrng(islIdx * 47 + j) * 0.7;
        const ppx = sx + Math.cos(pa) * isl.rx * pr;
        const ppy = sy + Math.sin(pa) * isl.ry * pr;
        const pradius = 6 + islPrng(islIdx * 53 + j) * 10;
        ctx.fillStyle = 'rgba(100,80,50,0.15)';
        ctx.beginPath();
        ctx.ellipse(ppx, ppy, pradius, pradius * 0.65, pa, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Grass tufts (15 tiny V-shapes) ---
      for (let j = 0; j < 15; j++) {
        const ga = islPrng(islIdx * 13 + j) * Math.PI * 2;
        const gr = 0.15 + islPrng(islIdx * 19 + j) * 0.7;
        const gpx = sx + Math.cos(ga) * isl.rx * gr;
        const gpy = sy + Math.sin(ga) * isl.ry * gr;
        const gh = 5 + islPrng(islIdx * 23 + j) * 5;
        const gw = 3 + islPrng(islIdx * 29 + j) * 3;
        const greenVariant = [
          `rgba(60,${100 + Math.floor(islPrng(islIdx * 37 + j) * 60)},40,0.55)`,
          `rgba(40,${120 + Math.floor(islPrng(islIdx * 41 + j) * 50)},30,0.5)`,
          `rgba(80,${90 + Math.floor(islPrng(islIdx * 43 + j) * 70)},20,0.5)`
        ][j % 3];
        ctx.strokeStyle = greenVariant;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(gpx - gw, gpy);
        ctx.lineTo(gpx, gpy - gh);
        ctx.moveTo(gpx + gw, gpy);
        ctx.lineTo(gpx, gpy - gh);
        ctx.stroke();
      }

      // --- Small pebbles (10 tiny gray circles) ---
      for (let j = 0; j < 10; j++) {
        const pa2 = islPrng(islIdx * 61 + j) * Math.PI * 2;
        const pr2 = 0.1 + islPrng(islIdx * 67 + j) * 0.75;
        const ppx2 = sx + Math.cos(pa2) * isl.rx * pr2;
        const ppy2 = sy + Math.sin(pa2) * isl.ry * pr2;
        const pRad = 1.5 + islPrng(islIdx * 71 + j);
        const pgray = 140 + Math.floor(islPrng(islIdx * 73 + j) * 60);
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(ppx2 + 1, ppy2 + 1, pRad * 1.2, pRad * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${pgray},${pgray},${pgray},0.7)`;
        ctx.beginPath();
        ctx.arc(ppx2, ppy2, pRad, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Tiny flowers (8 colored dots with green stem) ---
      const flowerColors = ['#ff7eb3','#ffdb58','#ff6b6b','#c9f','#8bf','#f90'];
      for (let j = 0; j < 8; j++) {
        const fa2 = islPrng(islIdx * 79 + j) * Math.PI * 2;
        const fr2 = 0.15 + islPrng(islIdx * 83 + j) * 0.68;
        const fpx2 = sx + Math.cos(fa2) * isl.rx * fr2;
        const fpy2 = sy + Math.sin(fa2) * isl.ry * fr2;
        // stem
        ctx.strokeStyle = 'rgba(50,130,30,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fpx2, fpy2);
        ctx.lineTo(fpx2, fpy2 - 6);
        ctx.stroke();
        // bloom
        ctx.fillStyle = flowerColors[j % flowerColors.length];
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(fpx2, fpy2 - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // --- Tiny shells on beach (3-4 per island) ---
      const shellCount = 3 + (islIdx % 2);
      for (let j = 0; j < shellCount; j++) {
        const sa = islPrng(islIdx * 89 + j) * Math.PI * 2;
        const sr = 0.82 + islPrng(islIdx * 97 + j) * 0.12;
        const spx = sx + Math.cos(sa) * isl.rx * sr;
        const spy = sy + Math.sin(sa) * isl.ry * sr;
        const shellColor = j % 2 === 0 ? 'rgba(255,230,200,0.85)' : 'rgba(255,180,190,0.75)';
        ctx.strokeStyle = shellColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(spx, spy, 3, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(spx - 3, spy);
        ctx.lineTo(spx, spy + 2);
        ctx.lineTo(spx + 3, spy);
        ctx.stroke();
      }

      // --- Winding paths connecting totem positions to center ---
      const pathAngles = [0.8, 2.4];
      for (const pa of pathAngles) {
        const pdist = isl.rx * 0.65;
        const px1 = sx + Math.cos(pa) * pdist;
        const py1 = sy + Math.sin(pa) * pdist;
        const cpx = sx + Math.cos(pa + 0.5) * pdist * 0.4;
        const cpy = sy + Math.sin(pa + 0.5) * pdist * 0.4;
        ctx.strokeStyle = 'rgba(200,170,100,0.18)';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.quadraticCurveTo(cpx, cpy, sx, sy);
        ctx.stroke();
        // stone dots along path
        for (let d = 0; d <= 1; d += 0.25) {
          const dotX = (1-d)*(1-d)*px1 + 2*(1-d)*d*cpx + d*d*sx;
          const dotY = (1-d)*(1-d)*py1 + 2*(1-d)*d*cpy + d*d*sy;
          const side = (d * 7 % 2 > 1) ? 1 : -1;
          const perpA = pa + Math.PI / 2;
          ctx.fillStyle = 'rgba(160,140,100,0.3)';
          ctx.beginPath();
          ctx.arc(dotX + Math.cos(perpA) * 5 * side, dotY + Math.sin(perpA) * 5 * side, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Trees (after ground, before name) ---
      drawTrees(isl, sx, sy, islIdx, colors);

      // --- Lighting overlay: soft highlight upper-left ---
      if (isl.points) {
        const pts = isl.points.map(p => ({ x: sx + p.x, y: sy + p.y }));
        traceIslandPath(ctx, pts);
      } else {
        ctx.beginPath();
        ctx.ellipse(sx, sy, isl.rx, isl.ry, 0, 0, Math.PI * 2);
      }
      const hlGrd = ctx.createRadialGradient(
        sx - isl.rx * 0.4, sy - isl.ry * 0.4, 0,
        sx, sy, Math.max(isl.rx, isl.ry) * 1.1
      );
      hlGrd.addColorStop(0, 'rgba(255,255,255,0.06)');
      hlGrd.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      hlGrd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hlGrd;
      ctx.fill();

      // Shadow overlay lower-right
      if (isl.points) {
        const pts = isl.points.map(p => ({ x: sx + p.x, y: sy + p.y }));
        traceIslandPath(ctx, pts);
      } else {
        ctx.beginPath();
        ctx.ellipse(sx, sy, isl.rx, isl.ry, 0, 0, Math.PI * 2);
      }
      const shGrd = ctx.createRadialGradient(
        sx + isl.rx * 0.4, sy + isl.ry * 0.4, 0,
        sx, sy, Math.max(isl.rx, isl.ry) * 1.1
      );
      shGrd.addColorStop(0, 'rgba(0,0,0,0.08)');
      shGrd.addColorStop(0.5, 'rgba(0,0,0,0.03)');
      shGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shGrd;
      ctx.fill();

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

  // ---- Tree/vegetation system ----
  function drawTrees(isl, sx, sy, islIdx, colors) {
    const treeCount = 4 + (islIdx % 3);
    const cat = isl.category || 'central';

    for (let t = 0; t < treeCount; t++) {
      const seed = islIdx * 997 + t * 173;
      const ta = islPrng(seed) * Math.PI * 2;
      const tr = 0.35 + islPrng(seed + 1) * 0.45;
      const tx = sx + Math.cos(ta) * isl.rx * tr;
      const ty = sy + Math.sin(ta) * isl.ry * tr;
      const trunkH = 15 + islPrng(seed + 2) * 10;
      const trunkW = 3 + islPrng(seed + 3) * 3;
      const canopyR = 12 + islPrng(seed + 4) * 12;
      const sway = Math.sin(waveTime * 0.7 + t + islIdx) * 1.5;

      // Shadow ellipse under tree
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.ellipse(tx + 3, ty + 4, canopyR * 0.9, canopyR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(tx - trunkW / 2 + sway * 0.3, ty - trunkH, trunkW, trunkH);

      // Canopy — shape depends on island theme
      ctx.save();
      ctx.translate(tx + sway, ty - trunkH);

      switch (cat) {
        case 'matematica': {
          // Crystalline/geometric — triangular blue canopy
          ctx.fillStyle = 'rgba(30,90,160,0.75)';
          ctx.strokeStyle = 'rgba(0,229,255,0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -canopyR);
          ctx.lineTo(canopyR * 0.75, canopyR * 0.4);
          ctx.lineTo(-canopyR * 0.75, canopyR * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // inner triangle highlight
          ctx.fillStyle = 'rgba(0,229,255,0.12)';
          ctx.beginPath();
          ctx.moveTo(0, -canopyR * 0.5);
          ctx.lineTo(canopyR * 0.35, canopyR * 0.2);
          ctx.lineTo(-canopyR * 0.35, canopyR * 0.2);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'historia': {
          // Olive/ancient — round brown canopy
          const hue = 100 + Math.floor(islPrng(seed + 5) * 30);
          ctx.fillStyle = `rgba(60,${hue},20,0.75)`;
          ctx.strokeStyle = 'rgba(160,120,50,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, canopyR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // texture bumps
          for (let b = 0; b < 4; b++) {
            const ba = (b / 4) * Math.PI * 2;
            ctx.fillStyle = 'rgba(40,80,10,0.3)';
            ctx.beginPath();
            ctx.arc(Math.cos(ba) * canopyR * 0.5, Math.sin(ba) * canopyR * 0.5, canopyR * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'ciencias': {
          // Bioluminescent — round green with glowing tips
          ctx.fillStyle = 'rgba(20,100,40,0.75)';
          ctx.strokeStyle = 'rgba(105,240,174,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, canopyR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // glowing tips
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(105,240,174,0.8)';
          ctx.fillStyle = 'rgba(105,240,174,0.7)';
          for (let g = 0; g < 5; g++) {
            const ga = (g / 5) * Math.PI * 2 + waveTime * 0.4;
            ctx.beginPath();
            ctx.arc(Math.cos(ga) * canopyR * 0.8, Math.sin(ga) * canopyR * 0.8, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          break;
        }
        case 'linguas': {
          // Cherry blossom — fluffy pink/purple cloud
          const blossomColors = ['rgba(255,182,193,0.7)','rgba(200,130,220,0.7)','rgba(255,160,210,0.6)'];
          for (let b = 0; b < 5; b++) {
            const ba = (b / 5) * Math.PI * 2;
            const br2 = canopyR * 0.55;
            ctx.fillStyle = blossomColors[b % blossomColors.length];
            ctx.beginPath();
            ctx.arc(Math.cos(ba) * br2, Math.sin(ba) * br2, canopyR * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,220,230,0.5)';
          ctx.beginPath();
          ctx.arc(0, 0, canopyR * 0.45, 0, Math.PI * 2);
          ctx.fill();
          // tiny blossom dots
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          for (let d = 0; d < 6; d++) {
            const da = islPrng(seed + d + 10) * Math.PI * 2;
            const dr = islPrng(seed + d + 20) * canopyR * 0.8;
            ctx.beginPath();
            ctx.arc(Math.cos(da) * dr, Math.sin(da) * dr, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'programacao': {
          // Digital tree — angular neon green wireframe
          ctx.strokeStyle = 'rgba(118,255,3,0.7)';
          ctx.fillStyle = 'rgba(10,30,10,0.65)';
          ctx.lineWidth = 1.2;
          // Pixel-ish hexagonal shape
          ctx.beginPath();
          for (let h = 0; h < 6; h++) {
            const ha = (h / 6) * Math.PI * 2 - Math.PI / 6;
            const hx = Math.cos(ha) * canopyR;
            const hy = Math.sin(ha) * canopyR;
            if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // inner grid lines
          ctx.strokeStyle = 'rgba(118,255,3,0.2)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(-canopyR, 0); ctx.lineTo(canopyR, 0);
          ctx.moveTo(0, -canopyR); ctx.lineTo(0, canopyR);
          ctx.stroke();
          // glowing node dots
          ctx.fillStyle = 'rgba(118,255,3,0.8)';
          ctx.shadowBlur = 5;
          ctx.shadowColor = 'rgba(118,255,3,1)';
          for (let n = 0; n < 3; n++) {
            const na = (n / 3) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(na) * canopyR * 0.5, Math.sin(na) * canopyR * 0.5, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          break;
        }
        default: {
          // Central: golden oak — large majestic
          ctx.fillStyle = 'rgba(100,70,10,0.65)';
          ctx.strokeStyle = 'rgba(255,215,0,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, canopyR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // layered canopy
          ctx.fillStyle = 'rgba(120,90,10,0.5)';
          ctx.beginPath();
          ctx.arc(0, -canopyR * 0.2, canopyR * 0.75, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(180,140,20,0.35)';
          ctx.beginPath();
          ctx.arc(0, -canopyR * 0.4, canopyR * 0.5, 0, Math.PI * 2);
          ctx.fill();
          // golden shimmer
          ctx.fillStyle = 'rgba(255,215,0,0.15)';
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(255,215,0,0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, canopyR, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
      }
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
    // Crystal geometric structures with glow
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.8;
      const px = sx + Math.cos(angle) * isl.rx * 0.6;
      const py = sy + Math.sin(angle) * isl.ry * 0.6;
      const s = 12 + i * 4;

      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = colors.accent;
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
      ctx.restore();
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

    // Floating blackboard with chalk equations
    const bbx = sx - 28;
    const bby = sy - isl.ry * 0.35;
    ctx.fillStyle = 'rgba(20,40,30,0.82)';
    ctx.strokeStyle = 'rgba(100,160,100,0.5)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bbx, bby, 56, 36);
    ctx.strokeRect(bbx, bby, 56, 36);
    const equations = ['E=mc²', '∑π', 'f(x)'];
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(240,240,220,0.75)';
    ctx.textAlign = 'left';
    for (let e = 0; e < 3; e++) {
      ctx.fillText(equations[e], bbx + 5, bby + 11 + e * 10);
    }
    ctx.textAlign = 'center';

    // Glowing number particles floating up from crystals
    ctx.font = 'bold 8px monospace';
    for (let i = 0; i < 3; i++) {
      const angle2 = (i / 3) * Math.PI * 2 + 0.8;
      const cpx = sx + Math.cos(angle2) * isl.rx * 0.6;
      const cpy = sy + Math.sin(angle2) * isl.ry * 0.6;
      const digit = String(Math.floor(((waveTime * 0.5 + i * 3.7) % 10)));
      const rise = ((waveTime * 25 + i * 40) % 50);
      const alpha = 0.6 - rise / 50 * 0.5;
      ctx.fillStyle = `rgba(0,229,255,${alpha})`;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,229,255,0.8)';
      ctx.fillText(digit, cpx, cpy - rise);
      ctx.shadowBlur = 0;
    }

    // Geometric floor pattern: concentric hexagons
    ctx.strokeStyle = `rgba(0,229,255,0.06)`;
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring++) {
      const hr = ring * 18;
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const ha = (h / 6) * Math.PI * 2 - Math.PI / 6;
        const hpx = sx + Math.cos(ha) * hr;
        const hpy = sy + 20 + Math.sin(ha) * hr;
        if (h === 0) ctx.moveTo(hpx, hpy); else ctx.lineTo(hpx, hpy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  function drawHistoryDecorations(sx, sy, isl, colors) {
    // Ancient columns with capital scroll detail
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      const px = sx + Math.cos(angle) * isl.rx * 0.55;
      const py = sy + Math.sin(angle) * isl.ry * 0.55;

      // Column body with fluting lines
      ctx.fillStyle = '#bcaaa4';
      ctx.fillRect(px - 5, py - 25, 10, 30);
      ctx.strokeStyle = 'rgba(100,80,70,0.3)';
      ctx.lineWidth = 0.6;
      for (let fl = 0; fl < 3; fl++) {
        ctx.beginPath();
        ctx.moveTo(px - 5 + fl * 3 + 1, py - 24);
        ctx.lineTo(px - 5 + fl * 3 + 1, py + 4);
        ctx.stroke();
      }

      // Capital with scroll
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(px - 8, py - 28, 16, 4);
      // scroll volutes
      ctx.strokeStyle = 'rgba(150,120,100,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px - 6, py - 27, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px + 6, py - 27, 2.5, 0, Math.PI * 2);
      ctx.stroke();

      // Base
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(px - 7, py + 3, 14, 4);

      // Torch flame on first 2 columns
      if (i < 2) {
        const flickerA = Math.sin(waveTime * 8 + i * 2.5) * 0.3 + 0.7;
        const flickerB = Math.sin(waveTime * 11 + i * 1.7) * 2;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255,150,0,0.8)';
        ctx.fillStyle = `rgba(255,${100 + Math.floor(flickerA * 60)},0,${flickerA})`;
        ctx.beginPath();
        ctx.moveTo(px + flickerB, py - 38);
        ctx.lineTo(px + 4, py - 28);
        ctx.lineTo(px - 4, py - 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,220,80,0.7)';
        ctx.beginPath();
        ctx.moveTo(px + flickerB * 0.5, py - 35);
        ctx.lineTo(px + 2, py - 28);
        ctx.lineTo(px - 2, py - 28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Ruins / broken wall
    ctx.fillStyle = 'rgba(141, 110, 99, 0.4)';
    ctx.fillRect(sx - 30, sy + isl.ry * 0.2, 60, 8);
    ctx.fillRect(sx - 25, sy + isl.ry * 0.2 - 12, 8, 12);
    ctx.fillRect(sx + 15, sy + isl.ry * 0.2 - 16, 8, 16);

    // Campfire with animated glow
    const cfx = sx;
    const cfy = sy + isl.ry * 0.3;
    const fireFlicker = Math.sin(waveTime * 9) * 0.25 + 0.75;
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255,120,0,0.6)';
    // logs
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(cfx - 8, cfy, 16, 4);
    ctx.fillRect(cfx - 6, cfy - 2, 12, 3);
    // flames
    ctx.fillStyle = `rgba(255,80,0,${fireFlicker * 0.8})`;
    ctx.beginPath();
    ctx.moveTo(cfx + Math.sin(waveTime * 7) * 2, cfy - 14);
    ctx.lineTo(cfx + 7, cfy);
    ctx.lineTo(cfx - 7, cfy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,180,0,${fireFlicker * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(cfx + Math.sin(waveTime * 6) * 1.5, cfy - 9);
    ctx.lineTo(cfx + 4, cfy);
    ctx.lineTo(cfx - 4, cfy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Pottery/amphora shapes
    for (let i = 0; i < 2; i++) {
      const vx = sx + (i === 0 ? -isl.rx * 0.3 : isl.rx * 0.4);
      const vy = sy + isl.ry * 0.1;
      ctx.strokeStyle = 'rgba(180,130,80,0.6)';
      ctx.fillStyle = 'rgba(141,110,99,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(vx, vy - 18);
      ctx.lineTo(vx + 5, vy - 14);
      ctx.lineTo(vx + 8, vy);
      ctx.lineTo(vx + 4, vy + 10);
      ctx.lineTo(vx, vy + 12);
      ctx.lineTo(vx - 4, vy + 10);
      ctx.lineTo(vx - 8, vy);
      ctx.lineTo(vx - 5, vy - 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // handles
      ctx.beginPath();
      ctx.arc(vx + 9, vy - 4, 4, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(vx - 9, vy - 4, 4, Math.PI * 0.6, Math.PI * 1.4);
      ctx.stroke();
    }

    // Ancient map on ground
    const mx = sx - 18;
    const my = sy - isl.ry * 0.35;
    ctx.fillStyle = 'rgba(210,180,120,0.45)';
    ctx.strokeStyle = 'rgba(140,100,50,0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, 36, 26);
    ctx.strokeRect(mx, my, 36, 26);
    // dotted lines on map
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(100,60,20,0.45)';
    ctx.beginPath();
    ctx.moveTo(mx + 4, my + 6);
    ctx.lineTo(mx + 30, my + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx + 4, my + 20);
    ctx.lineTo(mx + 22, my + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    // X mark
    ctx.fillStyle = 'rgba(180,60,40,0.6)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', mx + 28, my + 10);
  }

  function drawScienceDecorations(sx, sy, isl, colors) {
    const atomY = sy + 20;
    // Atom symbol
    ctx.strokeStyle = 'rgba(105, 240, 174, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.ellipse(sx, atomY, 35, 12, angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Nucleus
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(105,240,174,0.9)';
    ctx.fillStyle = 'rgba(105, 240, 174, 0.5)';
    ctx.beginPath();
    ctx.arc(sx, atomY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Animated electron dots on orbit ellipses (3 dots, one per ellipse)
    ctx.fillStyle = 'rgba(105,240,174,0.85)';
    for (let i = 0; i < 3; i++) {
      const orbAngle = (i / 3) * Math.PI;
      const ePhase = waveTime * 1.8 + i * (Math.PI * 2 / 3);
      const cosE = Math.cos(ePhase);
      const sinE = Math.sin(ePhase);
      // rotate electron position by orbit angle
      const ex = sx + cosE * 35 * Math.cos(orbAngle) - sinE * 12 * Math.sin(orbAngle);
      const ey = atomY + cosE * 35 * Math.sin(orbAngle) + sinE * 12 * Math.cos(orbAngle);
      ctx.save();
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'rgba(105,240,174,1)';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Lab flasks (test tubes) with animated bubbles
    for (let i = 0; i < 3; i++) {
      const offsets = [-isl.rx * 0.42, 0, isl.rx * 0.42];
      const fx = sx + offsets[i];
      const fy = sy - isl.ry * 0.2;
      const liquids = [
        'rgba(76,175,80,0.45)', 'rgba(33,150,243,0.45)', 'rgba(255,80,120,0.45)'
      ];
      ctx.fillStyle = 'rgba(200,230,201,0.2)';
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy - 14);
      ctx.lineTo(fx + 4, fy - 14);
      ctx.lineTo(fx + 8, fy + 2);
      ctx.lineTo(fx - 8, fy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(105,240,174,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Liquid fill
      ctx.fillStyle = liquids[i];
      ctx.fillRect(fx - 6, fy - 4, 12, 6);
      // Neck
      ctx.fillStyle = 'rgba(200,230,201,0.15)';
      ctx.fillRect(fx - 2, fy - 22, 4, 8);
      ctx.strokeStyle = 'rgba(105,240,174,0.4)';
      ctx.strokeRect(fx - 2, fy - 22, 4, 8);
      // Animated bubbles rising
      for (let b = 0; b < 2; b++) {
        const bubY = fy - 4 - ((waveTime * 20 + b * 15 + i * 25) % 16);
        const bubAlpha = 0.5 - (((waveTime * 20 + b * 15 + i * 25) % 16) / 16) * 0.35;
        ctx.fillStyle = `rgba(180,255,200,${bubAlpha})`;
        ctx.beginPath();
        ctx.arc(fx + (b === 0 ? -2 : 2), bubY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // DNA helix (two intertwined sine waves)
    const helixX = sx - isl.rx * 0.55;
    ctx.lineWidth = 1.5;
    for (let strand = 0; strand < 2; strand++) {
      ctx.beginPath();
      ctx.strokeStyle = strand === 0 ? 'rgba(105,240,174,0.5)' : 'rgba(33,150,243,0.5)';
      for (let h = 0; h <= 30; h++) {
        const hy = sy - 30 + h * 2;
        const hx = helixX + Math.sin((h / 30) * Math.PI * 4 + strand * Math.PI + waveTime * 0.5) * 10;
        if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.stroke();
    }
    // helix rungs
    ctx.strokeStyle = 'rgba(150,230,200,0.25)';
    ctx.lineWidth = 1;
    for (let h = 0; h <= 30; h += 5) {
      const hy = sy - 30 + h * 2;
      const hx0 = helixX + Math.sin((h / 30) * Math.PI * 4 + waveTime * 0.5) * 10;
      const hx1 = helixX + Math.sin((h / 30) * Math.PI * 4 + Math.PI + waveTime * 0.5) * 10;
      ctx.beginPath();
      ctx.moveTo(hx0, hy);
      ctx.lineTo(hx1, hy);
      ctx.stroke();
    }

    // Microscope shape (simple geometric)
    const micX = sx + isl.rx * 0.45;
    const micY = sy - isl.ry * 0.15;
    ctx.strokeStyle = 'rgba(105,240,174,0.45)';
    ctx.fillStyle = 'rgba(30,80,50,0.5)';
    ctx.lineWidth = 1.2;
    // base
    ctx.fillRect(micX - 10, micY + 10, 20, 5);
    ctx.strokeRect(micX - 10, micY + 10, 20, 5);
    // arm
    ctx.beginPath();
    ctx.moveTo(micX, micY + 10);
    ctx.lineTo(micX, micY - 10);
    ctx.lineTo(micX + 6, micY - 10);
    ctx.stroke();
    // eyepiece
    ctx.fillStyle = 'rgba(105,240,174,0.4)';
    ctx.fillRect(micX + 4, micY - 14, 8, 10);
    ctx.strokeRect(micX + 4, micY - 14, 8, 10);
    // objective lens
    ctx.beginPath();
    ctx.arc(micX, micY - 2, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawLanguageDecorations(sx, sy, isl, colors) {
    // Speech bubbles with diverse languages
    const greetings = ['Hola!', '你好', 'Ciao!', 'Olá!', 'مرحبا', 'Hello!'];
    for (let i = 0; i < 4; i++) {
      const angle2 = (i / 4) * Math.PI * 2;
      const bx = sx + Math.cos(angle2 + waveTime * 0.08) * isl.rx * 0.38;
      const by = sy + Math.sin(angle2 + waveTime * 0.08) * isl.ry * 0.38;
      const bobble = Math.sin(waveTime * 1.2 + i) * 3;

      ctx.fillStyle = 'rgba(234,128,252,0.18)';
      ctx.strokeStyle = 'rgba(234,128,252,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(bx, by + bobble, 22, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // tail
      ctx.beginPath();
      ctx.moveTo(bx + (i % 2 === 0 ? 4 : -4), by + bobble + 14);
      ctx.lineTo(bx + (i % 2 === 0 ? 10 : -10), by + bobble + 22);
      ctx.lineTo(bx + (i % 2 === 0 ? -2 : 2), by + bobble + 15);
      ctx.fillStyle = 'rgba(234,128,252,0.18)';
      ctx.fill();

      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(240,180,255,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(greetings[i], bx, by + bobble + 4);
    }

    // Open book on ground
    const bookX = sx;
    const bookY = sy + isl.ry * 0.3;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = 'rgba(200,150,230,0.5)';
    ctx.lineWidth = 1;
    // left page
    ctx.fillRect(bookX - 22, bookY - 8, 20, 16);
    ctx.strokeRect(bookX - 22, bookY - 8, 20, 16);
    // right page
    ctx.fillRect(bookX + 2, bookY - 8, 20, 16);
    ctx.strokeRect(bookX + 2, bookY - 8, 20, 16);
    // spine
    ctx.fillStyle = 'rgba(150,100,180,0.4)';
    ctx.fillRect(bookX - 2, bookY - 9, 4, 18);
    // tiny text lines on pages
    ctx.fillStyle = 'rgba(200,150,220,0.45)';
    for (let l = 0; l < 3; l++) {
      ctx.fillRect(bookX - 20, bookY - 5 + l * 5, 14, 1.5);
      ctx.fillRect(bookX + 6, bookY - 5 + l * 5, 14, 1.5);
    }

    // Floating alphabet letters from different scripts
    const floatLetters = ['A', 'α', 'あ', 'Б', '字', 'ش'];
    ctx.font = '11px sans-serif';
    for (let i = 0; i < 5; i++) {
      const la = (i / 5) * Math.PI * 2 + waveTime * 0.25;
      const lr = isl.rx * 0.55;
      const lx = sx + Math.cos(la) * lr;
      const ly = sy + Math.sin(la) * lr;
      const lAlpha = 0.4 + Math.sin(waveTime * 1.5 + i) * 0.15;
      ctx.fillStyle = `rgba(234,128,252,${lAlpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(floatLetters[i], lx, ly);
    }

    // Quill pen
    const qx = sx - isl.rx * 0.5;
    const qy = sy - isl.ry * 0.15;
    ctx.strokeStyle = 'rgba(220,200,255,0.6)';
    ctx.lineWidth = 1.5;
    // shaft
    ctx.beginPath();
    ctx.moveTo(qx - 10, qy + 16);
    ctx.lineTo(qx + 10, qy - 12);
    ctx.stroke();
    // feather barbs
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(220,200,255,0.35)';
    for (let f = 0; f < 5; f++) {
      const fd = f * 4;
      const fpx = qx - 10 + fd * 1.2;
      const fpy = qy + 16 - fd * 1.7;
      ctx.beginPath();
      ctx.moveTo(fpx, fpy);
      ctx.lineTo(fpx + 6, fpy - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fpx, fpy);
      ctx.lineTo(fpx - 5, fpy - 6);
      ctx.stroke();
    }
    // nib
    ctx.fillStyle = 'rgba(200,180,240,0.7)';
    ctx.beginPath();
    ctx.moveTo(qx + 10, qy - 12);
    ctx.lineTo(qx + 14, qy - 16);
    ctx.lineTo(qx + 8, qy - 14);
    ctx.closePath();
    ctx.fill();

    // Books
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 1.5;
      const bx = sx + Math.cos(angle) * isl.rx * 0.5;
      const by = sy + Math.sin(angle) * isl.ry * 0.5;
      ctx.fillStyle = ['rgba(171,71,188,0.4)','rgba(126,87,194,0.4)','rgba(206,147,216,0.4)'][i];
      ctx.fillRect(bx - 6, by - 4, 12, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(bx - 1, by - 3, 1, 6);
    }
  }

  function drawProgrammingDecorations(sx, sy, isl, colors) {
    // Terminal screens with animated cursor blink
    const codeLines = [
      ['rgba(118,255,3,0.5)', 20], ['rgba(118,255,3,0.4)', 14], ['rgba(118,255,3,0.55)', 18]
    ];
    for (let i = 0; i < 2; i++) {
      const tx = sx + (i === 0 ? -isl.rx * 0.35 : isl.rx * 0.35);
      const ty = sy - isl.ry * 0.15;

      ctx.fillStyle = 'rgba(10,15,10,0.82)';
      ctx.strokeStyle = 'rgba(118,255,3,0.5)';
      ctx.lineWidth = 1;
      ctx.fillRect(tx - 18, ty - 14, 36, 28);
      ctx.strokeRect(tx - 18, ty - 14, 36, 28);

      // Code lines (stable widths based on position, not Math.random)
      ctx.fillStyle = 'rgba(118,255,3,0.5)';
      for (let l = 0; l < 3; l++) {
        const w = codeLines[l][1] - i * 3;
        ctx.fillRect(tx - 14, ty - 10 + l * 7, w, 2);
      }
      // Cursor blink (toggle with waveTime)
      const cursorOn = Math.floor(waveTime * 2 + i) % 2 === 0;
      if (cursorOn) {
        ctx.fillStyle = 'rgba(118,255,3,0.85)';
        ctx.fillRect(tx - 14 + codeLines[2][1] - i * 3 + 2, ty - 10 + 2 * 7, 2, 7);
      }
      // title bar dot
      ctx.fillStyle = 'rgba(118,255,3,0.3)';
      ctx.beginPath();
      ctx.arc(tx - 13, ty - 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Binary rain effect (use waveTime for stable positions instead of Math.random)
    ctx.font = '9px monospace';
    const binDigits = ['1','0','1','0','1','1','0','1'];
    for (let i = 0; i < 8; i++) {
      const bx = sx + ((i - 4) * 20);
      const by = sy + isl.ry * 0.2 + Math.sin(waveTime * 2 + i) * 15;
      const bAlpha = 0.1 + Math.sin(waveTime * 3 + i * 0.7) * 0.08;
      ctx.fillStyle = `rgba(118,255,3,${bAlpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(binDigits[i], bx, by);
    }

    // Circuit patterns
    ctx.strokeStyle = 'rgba(118,255,3,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 40, sy + isl.ry * 0.4);
    ctx.lineTo(sx, sy + isl.ry * 0.4);
    ctx.lineTo(sx, sy + isl.ry * 0.3);
    ctx.lineTo(sx + 40, sy + isl.ry * 0.3);
    ctx.stroke();
    // circuit nodes
    ctx.fillStyle = 'rgba(118,255,3,0.3)';
    [[sx - 40, sy + isl.ry * 0.4],[sx, sy + isl.ry * 0.4],[sx, sy + isl.ry * 0.3],[sx + 40, sy + isl.ry * 0.3]].forEach(([nx,ny]) => {
      ctx.beginPath(); ctx.arc(nx, ny, 2.5, 0, Math.PI * 2); ctx.fill();
    });

    // Floating code brackets
    const brackets = ['{','}','<','>','[]'];
    ctx.font = 'bold 12px monospace';
    for (let i = 0; i < 5; i++) {
      const ba = (i / 5) * Math.PI * 2 + waveTime * 0.4;
      const br = isl.rx * 0.52;
      const bpx = sx + Math.cos(ba) * br;
      const bpy = sy + Math.sin(ba) * br;
      const bAlpha = 0.3 + Math.sin(waveTime * 1.5 + i) * 0.1;
      ctx.fillStyle = `rgba(118,255,3,${bAlpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(brackets[i], bpx, bpy);
    }

    // Server rack
    const srx = sx + isl.rx * 0.45;
    const sry = sy - isl.ry * 0.35;
    ctx.fillStyle = 'rgba(20,30,20,0.8)';
    ctx.strokeStyle = 'rgba(80,100,80,0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(srx - 10, sry, 20, 40);
    ctx.strokeRect(srx - 10, sry, 20, 40);
    // rack units with blinking LEDs
    for (let u = 0; u < 4; u++) {
      ctx.fillStyle = 'rgba(30,50,30,0.6)';
      ctx.fillRect(srx - 8, sry + 2 + u * 9, 16, 7);
      // LED dots
      const ledOn = Math.floor(waveTime * 3 + u * 1.3) % 3 !== 0;
      ctx.fillStyle = ledOn ? `rgba(0,255,80,0.9)` : `rgba(0,100,40,0.5)`;
      ctx.beginPath();
      ctx.arc(srx + 5, sry + 5.5 + u * 9, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pixel art: small colored grid (like a sprite)
    const pax = sx - isl.rx * 0.5;
    const pay = sy + isl.ry * 0.1;
    const pixGrid = [
      [0,1,1,0],[1,1,1,1],[0,1,1,0],[1,0,0,1]
    ];
    const pixColors = ['rgba(118,255,3,0.7)','rgba(0,200,100,0.7)','rgba(50,255,100,0.5)','rgba(80,180,40,0.6)'];
    const pSize = 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (pixGrid[row][col]) {
          ctx.fillStyle = pixColors[(row + col) % pixColors.length];
          ctx.fillRect(pax + col * pSize - 8, pay + row * pSize - 8, pSize - 0.5, pSize - 0.5);
        }
      }
    }

    // Robotic arm
    const rax = sx - isl.rx * 0.5;
    const ray = sy - isl.ry * 0.4;
    ctx.strokeStyle = 'rgba(100,200,100,0.5)';
    ctx.fillStyle = 'rgba(30,80,30,0.5)';
    ctx.lineWidth = 2;
    const armAngle1 = Math.sin(waveTime * 0.8) * 0.3;
    const armAngle2 = Math.sin(waveTime * 1.1 + 1) * 0.4;
    // base
    ctx.fillRect(rax - 5, ray + 15, 10, 6);
    // segment 1
    const arm1ex = rax + Math.cos(-Math.PI / 2 + armAngle1) * 16;
    const arm1ey = ray + 15 + Math.sin(-Math.PI / 2 + armAngle1) * 16;
    ctx.beginPath();
    ctx.moveTo(rax, ray + 15);
    ctx.lineTo(arm1ex, arm1ey);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(arm1ex, arm1ey, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // segment 2
    const arm2ex = arm1ex + Math.cos(-Math.PI / 2 + armAngle1 + armAngle2) * 12;
    const arm2ey = arm1ey + Math.sin(-Math.PI / 2 + armAngle1 + armAngle2) * 12;
    ctx.beginPath();
    ctx.moveTo(arm1ex, arm1ey);
    ctx.lineTo(arm2ex, arm2ey);
    ctx.stroke();
    ctx.fillStyle = 'rgba(118,255,3,0.6)';
    ctx.beginPath(); ctx.arc(arm2ex, arm2ey, 2, 0, Math.PI * 2); ctx.fill();
  }

  function drawCentralDecorations(sx, sy, isl, colors) {
    // Grand library structure
    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
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

    // Windows on library
    ctx.fillStyle = 'rgba(255,240,120,0.3)';
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 0.8;
    ctx.fillRect(sx - 34, sy - 15, 10, 14);
    ctx.strokeRect(sx - 34, sy - 15, 10, 14);
    ctx.fillRect(sx + 24, sy - 15, 10, 14);
    ctx.strokeRect(sx + 24, sy - 15, 10, 14);
    // cross dividers
    ctx.beginPath();
    ctx.moveTo(sx - 29, sy - 15); ctx.lineTo(sx - 29, sy - 1);
    ctx.moveTo(sx - 34, sy - 9); ctx.lineTo(sx - 24, sy - 9);
    ctx.moveTo(sx + 29, sy - 15); ctx.lineTo(sx + 29, sy - 1);
    ctx.moveTo(sx + 24, sy - 9); ctx.lineTo(sx + 34, sy - 9);
    ctx.stroke();

    // Door
    ctx.fillStyle = 'rgba(180,130,20,0.45)';
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(sx - 6, sy - 3, 12, 13);
    ctx.strokeRect(sx - 6, sy - 3, 12, 13);
    // door handle
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.beginPath();
    ctx.arc(sx + 3, sy + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Bookshelf texture on building facade
    ctx.strokeStyle = 'rgba(255,215,0,0.12)';
    ctx.lineWidth = 0.7;
    for (let b = 0; b < 5; b++) {
      ctx.beginPath();
      ctx.moveTo(sx - 38, sy - 5 + b * 3);
      ctx.lineTo(sx - 8, sy - 5 + b * 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 8, sy - 5 + b * 3);
      ctx.lineTo(sx + 38, sy - 5 + b * 3);
      ctx.stroke();
    }

    // Columns
    for (let i = 0; i < 4; i++) {
      const cx = sx - 30 + i * 20;
      ctx.fillStyle = 'rgba(255,215,0,0.2)';
      ctx.fillRect(cx - 3, sy - 18, 6, 28);
    }

    // Star on top (glowing)
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,215,0,0.8)';
    drawStar(sx, sy - 40, 8, 5, 'rgba(255,215,0,0.7)');
    ctx.restore();

    // Fountain (circular basin with animated water droplets)
    const fx = sx + isl.rx * 0.45;
    const fy = sy + isl.ry * 0.25;
    ctx.strokeStyle = 'rgba(100,180,255,0.5)';
    ctx.fillStyle = 'rgba(30,100,200,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // water ripple rings
    ctx.strokeStyle = 'rgba(100,200,255,0.2)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 12 + Math.sin(waveTime * 2) * 2, 7 + Math.sin(waveTime * 2) * 1, 0, 0, Math.PI * 2);
    ctx.stroke();
    // water jet / droplets
    for (let d = 0; d < 4; d++) {
      const da = (d / 4) * Math.PI * 2 + waveTime * 0.8;
      const dropPhase = ((waveTime * 1.5 + d * 0.8) % 1);
      const dh = dropPhase * 12;
      const dalpha = 0.6 - dropPhase * 0.4;
      ctx.fillStyle = `rgba(150,220,255,${dalpha})`;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(da) * 5, fy - dh - 3 + Math.sin(da) * 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // center spout
    ctx.strokeStyle = 'rgba(150,220,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - 8 + Math.sin(waveTime * 3) * 2);
    ctx.stroke();

    // Banner flags / pennants on a string
    const flagColors = ['#00bcd4','#ffab40','#69f0ae','#ea80fc','#76ff03'];
    const flagY = sy - isl.ry * 0.6;
    const flagSpan = isl.rx * 0.9;
    ctx.strokeStyle = 'rgba(200,180,100,0.4)';
    ctx.lineWidth = 0.8;
    // string (catenary)
    ctx.beginPath();
    ctx.moveTo(sx - flagSpan, flagY);
    ctx.quadraticCurveTo(sx, flagY + 10, sx + flagSpan, flagY);
    ctx.stroke();
    for (let f = 0; f < 5; f++) {
      const t2 = f / 4;
      // quadratic bezier point
      const fpx = (1-t2)*(1-t2)*(sx - flagSpan) + 2*(1-t2)*t2*sx + t2*t2*(sx + flagSpan);
      const fpy = (1-t2)*(1-t2)*flagY + 2*(1-t2)*t2*(flagY+10) + t2*t2*flagY;
      const flutter = Math.sin(waveTime * 2.5 + f) * 1.5;
      ctx.fillStyle = flagColors[f];
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(fpx, fpy);
      ctx.lineTo(fpx + 7 + flutter, fpy + 5);
      ctx.lineTo(fpx, fpy + 10);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Glowing orbs (one per subject color) floating around star
    const orbColors = ['#00e5ff','#ffab40','#69f0ae','#ea80fc','#76ff03'];
    for (let o = 0; o < 5; o++) {
      const oa = (o / 5) * Math.PI * 2 + waveTime * 0.5;
      const or2 = 30 + Math.sin(waveTime * 1.2 + o) * 4;
      const opx = sx + Math.cos(oa) * or2;
      const opy = sy - 40 + Math.sin(oa) * 15;
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = orbColors[o];
      ctx.fillStyle = orbColors[o];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(opx, opy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Garden: small flower beds around library
    const gardenPts = [
      [sx - 45, sy + 12], [sx + 45, sy + 12], [sx - 45, sy - 5], [sx + 45, sy - 5]
    ];
    const gardenFlowers = ['#ff7eb3','#ffdb58','#ff6b6b','#c9f'];
    for (let g = 0; g < gardenPts.length; g++) {
      const [gx, gy] = gardenPts[g];
      ctx.fillStyle = 'rgba(20,80,20,0.4)';
      ctx.beginPath();
      ctx.ellipse(gx, gy, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gardenFlowers[g];
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(gx, gy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(50,130,30,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy - 6);
      ctx.stroke();
    }
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
      const toIsl   = islands.find(i => i.id === br.to);
      if (!fromIsl || !toIsl) continue;

      const x1 = fromIsl.x - cam.x;
      const y1 = fromIsl.y - cam.y;
      const x2 = toIsl.x   - cam.x;
      const y2 = toIsl.y   - cam.y;

      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (maxX < -100 || minX > canvas.width + 100 || maxY < -100 || minY > canvas.height + 100) continue;

      const dx   = x2 - x1;
      const dy   = y2 - y1;
      const len  = Math.hypot(dx, dy);
      const nx   = dx / len;
      const ny   = dy / len;
      const perpX = -ny;
      const perpY =  nx;
      const bw   = 22; // bridge half-width

      // ---- Shadow ellipse under bridge ----
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle   = '#000';
      ctx.translate((x1 + x2) / 2, (y1 + y2) / 2 + 5);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.ellipse(0, 0, len / 2, bw * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();

      // ---- Wood planks with slight rotation variation ----
      const step  = 12;
      const prngB = (n) => ((Math.sin(n * 83.3 + 41.7) * 43758.5) % 1 + 1) % 1;
      for (let d = 0; d < len; d += step) {
        const px    = x1 + nx * d;
        const py    = y1 + ny * d;
        const wobble = (prngB(d * 0.31 + br.from * 1.7) - 0.5) * 0.06; // slight rotation
        const plankColor = (Math.floor(d / step) % 2 === 0) ? '#6d4c41' : '#5d4037';

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(dy, dx) + wobble);
        ctx.fillStyle   = plankColor;
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth   = 0.5;
        ctx.fillRect(-step * 0.5, -bw, step, bw * 2);
        ctx.strokeRect(-step * 0.5, -bw, step, bw * 2);

        // Nail dots at plank ends
        ctx.fillStyle = '#3e2723';
        ctx.beginPath(); ctx.arc(-step * 0.4,  bw - 4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-step * 0.4, -bw + 4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( step * 0.4,  bw - 4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( step * 0.4, -bw + 4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ---- Rope railings with catenary sag ----
      const ropeSegs = 20;
      const sagAmount = len * 0.04; // catenary sag proportional to length

      for (const side of [1, -1]) {
        // Start and end of this rail line
        const rx1 = x1 + perpX * bw * side;
        const ry1 = y1 + perpY * bw * side;
        const rx2 = x2 + perpX * bw * side;
        const ry2 = y2 + perpY * bw * side;

        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        for (let seg = 0; seg <= ropeSegs; seg++) {
          const t   = seg / ropeSegs;
          const sag = Math.sin(t * Math.PI) * sagAmount; // catenary approximation
          const rx  = rx1 + (rx2 - rx1) * t + ny * sag * side;
          const ry  = ry1 + (ry2 - ry1) * t - nx * sag * side;
          if (seg === 0) ctx.moveTo(rx, ry);
          else           ctx.lineTo(rx, ry);
        }
        ctx.stroke();

        // Second thinner rope below first for layered look
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        for (let seg = 0; seg <= ropeSegs; seg++) {
          const t   = seg / ropeSegs;
          const sag = Math.sin(t * Math.PI) * (sagAmount * 1.2) + 3;
          const rx  = rx1 + (rx2 - rx1) * t + ny * sag * side;
          const ry  = ry1 + (ry2 - ry1) * t - nx * sag * side;
          if (seg === 0) ctx.moveTo(rx, ry);
          else           ctx.lineTo(rx, ry);
        }
        ctx.stroke();
      }

      ctx.restore();
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
  //  RENDERING - TREASURE CHESTS
  // ================================================================
  function drawChests() {
    if (!chestDefs || !chestDefs.length) return;
    const now = Date.now();
    for (const c of chestDefs) {
      const sx = c.x - cam.x;
      const sy = c.y - cam.y;
      if (sx < -50 || sx > canvas.width + 50 || sy < -60 || sy > canvas.height + 50) continue;

      // Determine open state (cooldown active = opened)
      const openState = chestOpenState[c.id];
      const isOpen = openState && (now - openState.openedAt < openState.cooldown);

      const catColor = categoryInfo[c.category] ? categoryInfo[c.category].accent : '#ffd700';
      const shimmer = 0.5 + 0.5 * Math.sin(gameTime * 3 + c.x * 0.03);

      ctx.save();

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 10, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isOpen) {
        // Opened chest: lid tilted
        // Body
        ctx.fillStyle = '#6b3a1f';
        ctx.strokeStyle = '#3d1f08';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(sx - 13, sy - 4, 26, 14);
        ctx.fill();
        ctx.stroke();

        // Gold metal band on body
        ctx.strokeStyle = '#c8a030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 13, sy + 3); ctx.lineTo(sx + 13, sy + 3);
        ctx.stroke();

        // Lid tilted open (rotated)
        ctx.save();
        ctx.translate(sx - 13, sy - 4);
        ctx.rotate(-Math.PI * 0.55);
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#3d1f08';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(0, -7, 26, 7);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#c8a030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -3); ctx.lineTo(26, -3);
        ctx.stroke();
        ctx.restore();

        // Golden sparkle particles around opened chest
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + gameTime * 2;
          const r = 12 + Math.sin(gameTime * 4 + i * 1.3) * 5;
          const px = sx + Math.cos(angle) * r;
          const py = sy - 8 + Math.sin(angle) * r * 0.5;
          const a = 0.4 + 0.4 * Math.sin(gameTime * 5 + i);
          ctx.fillStyle = `rgba(255,215,0,${a})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Glow
        ctx.shadowBlur = 14;
        ctx.shadowColor = 'rgba(255,200,0,0.5)';
        ctx.fillStyle = 'rgba(255,200,0,0.07)';
        ctx.beginPath();
        ctx.arc(sx, sy - 2, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

      } else {
        // Closed chest: available
        // Body
        ctx.fillStyle = '#8B4513';
        ctx.strokeStyle = '#4a1f05';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(sx - 13, sy - 4, 26, 14);
        ctx.fill();
        ctx.stroke();

        // Lid
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.rect(sx - 13, sy - 11, 26, 8);
        ctx.fill();
        ctx.stroke();

        // Lid curve (top half rounded)
        ctx.fillStyle = '#7a5230';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 11, 13, 4, 0, Math.PI, 0);
        ctx.fill();

        // Metal bands
        ctx.strokeStyle = '#c8a030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 13, sy - 4); ctx.lineTo(sx + 13, sy - 4); // horizontal band at seam
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx - 13, sy + 3); ctx.lineTo(sx + 13, sy + 3); // lower band
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy - 11); ctx.lineTo(sx, sy + 10); // vertical band
        ctx.stroke();

        // Gold lock (circle)
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#a07010';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Lock keyhole
        ctx.fillStyle = '#a07010';
        ctx.beginPath();
        ctx.arc(sx, sy - 5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(sx - 0.8, sy - 4.5, 1.6, 3);
        ctx.fill();

        // Subtle shimmer when available
        ctx.fillStyle = `rgba(255,215,0,${shimmer * 0.08})`;
        ctx.beginPath();
        ctx.rect(sx - 13, sy - 11, 26, 21);
        ctx.fill();

        // 2x label floating above
        const floatY = sy - 22 + Math.sin(gameTime * 2.5 + c.x * 0.01) * 3;
        ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,215,0,${0.7 + shimmer * 0.3})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(255,180,0,0.8)';
        ctx.fillText('2x', sx, floatY);
        ctx.shadowBlur = 0;
      }

      // E prompt when nearby
      if (localPlayer) {
        const dist = Math.hypot(localPlayer.x - c.x, localPlayer.y - c.y);
        if (dist < 60) {
          ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowBlur = 0;
          if (isOpen) {
            ctx.fillStyle = 'rgba(180,180,180,0.6)';
            ctx.fillText('[E] Recarregando...', sx, sy - 26);
          } else {
            ctx.fillStyle = 'rgba(255,215,0,0.9)';
            ctx.fillText('[E] Abrir Bau (+2x)', sx, sy - 26);
          }
        }
      }

      ctx.restore();
    }
  }

  // ================================================================
  //  RENDERING - INFO SIGNS
  // ================================================================
  function drawSigns() {
    if (!signDefs || !signDefs.length) return;
    for (const s of signDefs) {
      const sx = s.x - cam.x;
      const sy = s.y - cam.y;
      if (sx < -40 || sx > canvas.width + 40 || sy < -50 || sy > canvas.height + 40) continue;

      const catColor = categoryInfo[s.category] ? categoryInfo[s.category].accent : '#ffd700';
      const nearPlayer = localPlayer && Math.hypot(localPlayer.x - s.x, localPlayer.y - s.y) < 50;

      ctx.save();

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 10, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wooden post
      ctx.fillStyle = '#6b3a1f';
      ctx.strokeStyle = '#3d1f08';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(sx - 2, sy - 10, 4, 20);
      ctx.fill();
      ctx.stroke();

      // Sign board (rounded rectangle)
      const bw = 24, bh = 16;
      const bx = sx - bw / 2, by = sy - 28;
      if (nearPlayer) {
        // Glow when nearby
        ctx.shadowBlur = 12;
        ctx.shadowColor = catColor;
      }
      ctx.fillStyle = '#4a2c0a';
      ctx.strokeStyle = nearPlayer ? catColor : '#7a5230';
      ctx.lineWidth = nearPlayer ? 1.8 : 1.2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, bw, bh, 3);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // "i" symbol centered on board
      ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = nearPlayer ? catColor : 'rgba(255,255,255,0.7)';
      ctx.fillText('i', sx, by + bh - 3);

      // E prompt when nearby
      if (nearPlayer) {
        ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('[E] Ler Dica', sx, by - 6);
      }

      ctx.restore();
    }
  }

  // ================================================================
  //  RENDERING - TIP POPUP & MINI LESSON OVERLAY
  // ================================================================
  function drawTipPopup() {
    if (!activeTipPopup) return;
    const elapsed = gameTime - activeTipPopup.startTime;
    if (elapsed > activeTipPopup.duration) {
      activeTipPopup = null;
      return;
    }

    // Find the sign position
    const sign = signDefs.find(s => s.id === activeTipPopup.signId);
    let px = canvas.width / 2;
    let py = canvas.height / 3;
    if (sign) {
      px = sign.x - cam.x;
      py = sign.y - cam.y - 50;
    }

    // Fade in / fade out
    const fadeInEnd = 0.3;
    const fadeOutStart = activeTipPopup.duration - 0.5;
    let alpha = 1;
    if (elapsed < fadeInEnd) {
      alpha = elapsed / fadeInEnd;
    } else if (elapsed > fadeOutStart) {
      alpha = 1 - (elapsed - fadeOutStart) / 0.5;
    }
    alpha = Math.max(0, Math.min(1, alpha));

    const catColor = categoryInfo[activeTipPopup.category]
      ? categoryInfo[activeTipPopup.category].accent
      : '#ffd700';

    const maxW = 260;
    const pad = 10;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Measure text wrapping
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    const words = activeTipPopup.tip.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW - pad * 2) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    const lineH = 18;
    const boxH = lines.length * lineH + pad * 2 + 20; // extra for title
    const boxW = maxW;

    // Clamp popup to screen
    let bx = Math.min(Math.max(px - boxW / 2, 10), canvas.width - boxW - 10);
    let by = Math.min(Math.max(py - boxH, 10), canvas.height - boxH - 10);

    // Glassmorphism-style background
    const grad = ctx.createLinearGradient(bx, by, bx, by + boxH);
    grad.addColorStop(0, 'rgba(20,10,40,0.88)');
    grad.addColorStop(1, 'rgba(10,5,25,0.92)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = catColor;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 16;
    ctx.shadowColor = catColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);
    }
    ctx.shadowBlur = 0;

    // Title
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = catColor;
    const catName = categoryInfo[activeTipPopup.category]
      ? categoryInfo[activeTipPopup.category].name
      : activeTipPopup.category;
    ctx.fillText(catName.toUpperCase(), bx + pad, by + pad + 12);

    // Tip text
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,240,180,0.95)';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + pad, by + pad + 28 + i * lineH);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMiniLessonOverlay() {
    if (!activeMiniLesson) return;
    const elapsed = gameTime - activeMiniLesson.startTime;
    if (elapsed > activeMiniLesson.duration) {
      activeMiniLesson = null;
      return;
    }

    const fadeInEnd = 0.25;
    const fadeOutStart = activeMiniLesson.duration - 0.6;
    let alpha = 1;
    if (elapsed < fadeInEnd) {
      alpha = elapsed / fadeInEnd;
    } else if (elapsed > fadeOutStart) {
      alpha = 1 - (elapsed - fadeOutStart) / 0.6;
    }
    alpha = Math.max(0, Math.min(1, alpha));

    const catColor = categoryInfo[activeMiniLesson.category]
      ? categoryInfo[activeMiniLesson.category].accent
      : '#ffd700';

    ctx.save();
    ctx.globalAlpha = alpha;

    const maxW = 320;
    const pad = 12;
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    const words = activeMiniLesson.text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW - pad * 2) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    const lineH = 20;
    const boxH = lines.length * lineH + pad * 2 + 28;
    const boxW = maxW;
    const bx = (canvas.width - boxW) / 2;
    const by = canvas.height * 0.15;

    // Background
    const grad = ctx.createLinearGradient(bx, by, bx, by + boxH);
    grad.addColorStop(0, 'rgba(15,8,35,0.92)');
    grad.addColorStop(1, 'rgba(8,4,20,0.95)');
    ctx.fillStyle = grad;
    ctx.strokeStyle = catColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = catColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);
    }
    ctx.shadowBlur = 0;

    // Header
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = catColor;
    ctx.fillText('\u{1F4DA} SABIA QUE...', bx + boxW / 2, by + pad + 13);

    // Lesson text
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,230,255,0.95)';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + boxW / 2, by + pad + 30 + i * lineH);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ================================================================
  //  RENDERING - PLAYER CHARACTER
  // ================================================================
  function drawCharacter(x, y, color, name, health, isSelf, level, direction, isMoving, charType) {
    const sx = x - cam.x;
    const sy = y - cam.y;

    // Expanded frustum bounds for larger characters
    if (sx < -100 || sx > canvas.width + 100 || sy < -120 || sy > canvas.height + 100) return;

    const cid = charType || 'luna';
    const cdef = charDefs[cid] || charDefs.luna;
    const S = 2.4; // scale factor

    direction = direction || 'down';
    const bob = isMoving ? Math.sin(walkCycle * (isSelf ? 1 : 0.8)) * 3 : Math.sin(gameTime * 2) * 1.5;
    const legOffset = isMoving ? Math.sin(walkCycle * (isSelf ? 1 : 0.8) * 2) * 4 : 0;
    const armSwing = isMoving ? Math.sin(walkCycle * (isSelf ? 1 : 0.8) * 2) * 3 : Math.sin(gameTime * 1.5) * 1;

    // Shadow (drawn at world scale, not character scale)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 18, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow under character (also at world scale)
    if (isSelf) {
      ctx.fillStyle = cdef.glowColor;
      ctx.beginPath();
      ctx.arc(sx, sy + 10, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Begin scaled character drawing ----
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.scale(S, S);

    // Cape/cloak back (Luna, Blaze, Coral) — drawn before body so it appears behind
    if (cid === 'luna' || cid === 'blaze' || cid === 'coral') {
      const capeSwayBot = Math.sin(gameTime * 2.5) * 2;
      const capeSwayMid = Math.sin(gameTime * 2) * 1;
      const capeDark = cid === 'luna' ? '#3a1a60' : cid === 'blaze' ? '#8b0000' : '#004f4f';
      ctx.fillStyle = capeDark;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.lineTo(-9, 8 + capeSwayMid);
      ctx.lineTo(-7 + capeSwayBot, 14);
      ctx.lineTo(0 + capeSwayBot * 0.5, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Legs
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-5 + legOffset, 8, 4, 8);
    ctx.fillRect(1 - legOffset, 8, 4, 8);

    // Boots (rounded with sole detail)
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-6 + legOffset, 14, 7, 4, 1);
    } else {
      ctx.rect(-6 + legOffset, 14, 7, 4);
    }
    ctx.fill();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-1 - legOffset, 14, 7, 4, 1);
    } else {
      ctx.rect(-1 - legOffset, 14, 7, 4);
    }
    ctx.fill();
    // Boot sole detail
    ctx.fillStyle = '#1a0d0a';
    ctx.fillRect(-6 + legOffset, 17, 7, 1);
    ctx.fillRect(-1 - legOffset, 17, 7, 1);

    // Robe body (character color)
    ctx.fillStyle = cdef.robeColor;
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(-8, 10);
    ctx.lineTo(8, 10);
    ctx.lineTo(10, -2);
    ctx.closePath();
    ctx.fill();

    // Belt
    const beltDark = cdef.robeColor.replace('#', '');
    ctx.fillStyle = cdef.robeColor;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(-8, 4, 16, 3);
    ctx.globalAlpha = 1;
    // Belt buckle (tiny square in accent color)
    ctx.fillStyle = cdef.hatAccent || '#ffd700';
    ctx.fillRect(-1.5, 4.5, 3, 2);

    // Body highlight
    ctx.fillStyle = cdef.robeHighlight;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-4, 8);
    ctx.lineTo(2, 8);
    ctx.lineTo(4, -1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Arms
    const armColor = cdef.robeColor;
    ctx.fillStyle = armColor;
    // Left arm
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-10, -1);
    ctx.lineTo(-13, 4 + armSwing);
    ctx.lineTo(-11, 4 + armSwing);
    ctx.lineTo(-8, -1);
    ctx.closePath();
    ctx.fill();
    // Right arm (swings opposite)
    ctx.beginPath();
    ctx.moveTo(8, -1);
    ctx.lineTo(11, 4 - armSwing);
    ctx.lineTo(13, 4 - armSwing);
    ctx.lineTo(10, -1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();

    // Character-specific hat
    drawCharHat(ctx, 0, 0, cid, cdef);

    // Eyes based on direction
    const eyeOffX = direction === 'left' ? -2 : direction === 'right' ? 2 : 0;
    const eyeOffY = direction === 'up' ? -2 : direction === 'down' ? 1 : 0;

    // Eyebrows
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 0.8;
    const browTilt = direction === 'left' ? 0.8 : direction === 'right' ? -0.8 : 0;
    ctx.beginPath();
    ctx.moveTo(-5.5, -16 + browTilt * 0.5);
    ctx.lineTo(-2, -17 - browTilt * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -17 + browTilt * 0.5);
    ctx.lineTo(5.5, -16 - browTilt * 0.5);
    ctx.stroke();

    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.5, -11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5, -11, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(-3.5 + eyeOffX * 0.8, -11 + eyeOffY * 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5 + eyeOffX * 0.8, -11 + eyeOffY * 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Blush spots
    ctx.fillStyle = 'rgba(255,150,150,0.2)';
    ctx.beginPath();
    ctx.arc(-6, -9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Blaze special: glowing eyes overlay
    if (cid === 'blaze') {
      ctx.fillStyle = '#ff4400';
      ctx.globalAlpha = 0.4 + Math.sin(gameTime * 4) * 0.2;
      ctx.beginPath();
      ctx.arc(-3.5, -11, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3.5, -11, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Mouth (smile — wider when moving)
    if (direction !== 'up') {
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 0.8;
      const smileRadius = isMoving ? 4 : 3;
      ctx.beginPath();
      ctx.arc(0, -6, smileRadius, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }

    // ---- End scaled character drawing ----
    ctx.restore();

    // Character-specific special effects (drawn at world scale for particle independence)
    drawCharSpecial(ctx, sx, sy + bob, cid, cdef, x, isSelf);

    // Floating book orbiting character (world scale, larger)
    const bookAngle = gameTime * 1.5 + (isSelf ? 0 : x * 0.01);
    const bookOrbitR = 32;
    const bookX = sx + Math.cos(bookAngle) * bookOrbitR;
    const bookY = sy + bob - 5 + Math.sin(bookAngle * 2) * 5;
    // Book glow
    ctx.fillStyle = 'rgba(255,215,0,0.18)';
    ctx.beginPath();
    ctx.arc(bookX, bookY, 9, 0, Math.PI * 2);
    ctx.fill();
    // Book cover
    ctx.fillStyle = '#ffd700';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(bookX - 6, bookY - 5, 12, 10);
    // Book pages (two rectangles side by side)
    ctx.fillStyle = '#fff';
    ctx.fillRect(bookX - 5, bookY - 4, 4.5, 8);
    ctx.fillRect(bookX + 0.5, bookY - 4, 4.5, 8);
    // Spine
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(bookX - 0.5, bookY - 5, 1, 10);
    ctx.globalAlpha = 1;

    // Name tag + level (readable, not scaled)
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(name + ' Lv.' + (level || 1), sx + 1, sy + bob - 59);
    ctx.fillStyle = isSelf ? '#ffd700' : '#fff';
    ctx.fillText(name + ' Lv.' + (level || 1), sx, sy + bob - 60);

    // Show recent achievement badges below name tag (only for self player)
    if (isSelf && unlockedAchievements.length > 0) {
      const recentIds = unlockedAchievements.slice(-3);
      const iconCount = recentIds.length;
      const spacing = 16;
      const startX = sx - ((iconCount - 1) * spacing) / 2;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let bi = 0; bi < iconCount; bi++) {
        const achDef = allAchievements.find(function(a) { return a.id === recentIds[bi]; });
        if (achDef) {
          ctx.fillText(achDef.icon, startX + bi * spacing, sy + bob - 44);
        }
      }
      ctx.textBaseline = 'alphabetic';
    }

    // Health bar above character (if damaged)
    if (health < 100) {
      const barW = 48;
      const barH = 4;
      const bx = sx - barW / 2;
      const by = sy + bob - 66;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bx, by, barW, barH);
      const pct = Math.max(0, health) / 100;
      ctx.fillStyle = pct > 0.5 ? '#76ff03' : pct > 0.25 ? '#ff6d00' : '#ff1744';
      ctx.fillRect(bx, by, barW * pct, barH);
    }
  }

  // ---- Character-specific hat drawing ----
  // NOTE: called inside ctx.save()/scale() so coordinates are relative to (0,0) at character center
  function drawCharHat(ctx, sx, drawY, cid, cdef) {
    // sx and drawY are 0 in the scaled context — kept as params for API compat
    switch (cid) {
      case 'luna': {
        // Tall pointy wizard hat
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.moveTo(-11, -16);
        ctx.lineTo(2, -34);
        ctx.lineTo(11, -16);
        ctx.closePath();
        ctx.fill();
        // Hat brim
        ctx.beginPath();
        ctx.ellipse(0, -16, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hat band with tiny moon symbol
        ctx.fillStyle = cdef.hatAccent;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-9, -19, 18, 2);
        ctx.globalAlpha = 1;
        // Moon symbol on band
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(-1, -18, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.arc(0.5, -18.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Galaxy dots inside hat
        ctx.fillStyle = '#c0c0ff';
        const dotPositions = [[-3, -24], [4, -21], [-1, -29], [6, -26], [-5, -27]];
        for (const [dx, dy] of dotPositions) {
          ctx.globalAlpha = 0.5 + Math.sin(gameTime * 3 + dx) * 0.3;
          ctx.beginPath();
          ctx.arc(dx, dy, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Stars on hat
        ctx.fillStyle = cdef.hatAccent;
        drawStar(-1, -26, 2.5, 5, cdef.hatAccent);
        drawStar(5, -21, 1.5, 5, cdef.hatAccent);
        // Trailing star from tip
        const starTrailT = gameTime * 2;
        ctx.fillStyle = '#fffacd';
        ctx.globalAlpha = 0.5 + Math.sin(starTrailT) * 0.3;
        ctx.beginPath();
        ctx.arc(2 + Math.sin(starTrailT) * 3, -34 - Math.abs(Math.sin(starTrailT)) * 4, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      case 'blaze': {
        // Knight helmet
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.arc(0, -13, 11, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Cheek guards
        ctx.fillStyle = cdef.hatColor;
        ctx.fillRect(-12, -15, 4, 6);
        ctx.fillRect(8, -15, 4, 6);
        // Visor slit
        ctx.fillStyle = '#111';
        ctx.fillRect(-9, -14, 18, 2);
        // Visor reflection highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(-8, -14, 7, 1);
        // Flame crest (5 flames)
        for (let fi = 0; fi < 5; fi++) {
          const fx = (fi - 2) * 4;
          const fh = 5 + Math.sin(gameTime * 4 + fi) * 3;
          ctx.fillStyle = fi === 2 ? cdef.hatAccent : fi % 2 === 0 ? '#ff4400' : '#ff8800';
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(fx - 2, -20);
          ctx.lineTo(fx, -20 - fh);
          ctx.lineTo(fx + 2, -20);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'coral': {
        // Captain hat brim
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        ctx.ellipse(0, -16, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Brim shadow detail
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, -15.5, 12, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Hat body
        ctx.fillStyle = cdef.hatColor;
        ctx.fillRect(-9, -22, 18, 7);
        ctx.beginPath();
        ctx.ellipse(0, -22, 9, 2.5, 0, Math.PI, 0);
        ctx.fill();
        // Rope detail on hat
        ctx.strokeStyle = cdef.hatAccent;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(-9, -18);
        ctx.lineTo(9, -18);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Anchor emblem (cross + arc shape)
        ctx.strokeStyle = cdef.hatAccent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -21);
        ctx.lineTo(0, -17);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-2, -20);
        ctx.lineTo(2, -20);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -17.5, 1.8, 0, Math.PI);
        ctx.stroke();
        break;
      }

      case 'pixel': {
        // VR headset body
        ctx.fillStyle = cdef.hatColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-11, -19, 22, 8, 3);
        } else {
          ctx.rect(-11, -19, 22, 8);
        }
        ctx.fill();
        // Side panels
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-14, -18, 3, 6);
        ctx.fillRect(11, -18, 3, 6);
        // Antenna on top
        ctx.strokeStyle = cdef.hatAccent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(3, -19);
        ctx.lineTo(3, -24);
        ctx.stroke();
        // Glowing antenna tip
        ctx.fillStyle = cdef.hatAccent;
        ctx.globalAlpha = 0.6 + Math.sin(gameTime * 5) * 0.4;
        ctx.beginPath();
        ctx.arc(3, -24, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Visor glow
        const visorAlpha = 0.5 + Math.sin(gameTime * 3) * 0.3;
        ctx.fillStyle = 'rgba(57,255,20,' + visorAlpha + ')';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-9, -18, 18, 5, 2);
        } else {
          ctx.rect(-9, -18, 18, 5);
        }
        ctx.fill();
        // Scrolling data pixels on visor
        const scroll = Math.floor(gameTime * 4) % 6;
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        for (let pi = 0; pi < 3; pi++) {
          const px = -7 + ((pi * 4 + scroll) % 16);
          ctx.fillRect(px, -16.5, 2, 1.5);
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'flora': {
        // Crown of leaves (8 leaves with gentle wave)
        const leafCount = 8;
        for (let lfi = 0; lfi < leafCount; lfi++) {
          const la = (lfi / leafCount) * Math.PI;
          const lr = 12;
          const waveOffset = Math.sin(gameTime * 2 + lfi * 0.8) * 0.8;
          const lx = Math.cos(la - Math.PI) * lr;
          const ly = -17 + Math.sin(la - Math.PI) * lr * 0.35 + waveOffset;
          ctx.fillStyle = lfi % 3 === 0 ? '#4caf50' : lfi % 3 === 1 ? '#66bb6a' : '#81c784';
          ctx.beginPath();
          ctx.ellipse(lx, ly, 4, 2.5, la * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Berries between leaves
        for (let bi = 0; bi < 4; bi++) {
          const ba = (bi / 4) * Math.PI + Math.PI / 8;
          const br = 10;
          const bx = Math.cos(ba - Math.PI) * br;
          const by = -17 + Math.sin(ba - Math.PI) * br * 0.35;
          ctx.fillStyle = bi % 2 === 0 ? '#ff3d3d' : '#ff8c00';
          ctx.beginPath();
          ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Flowers on alternate leaves
        for (let lfi = 0; lfi < leafCount; lfi += 2) {
          const la = (lfi / leafCount) * Math.PI;
          const lr = 12;
          const lx = Math.cos(la - Math.PI) * lr;
          const ly = -19 + Math.sin(la - Math.PI) * lr * 0.35;
          ctx.fillStyle = lfi === 0 ? '#ff6b9d' : lfi === 2 ? '#ffd700' : lfi === 4 ? '#ff9800' : '#ce93d8';
          ctx.beginPath();
          ctx.arc(lx, ly, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      default: {
        // Default wizard hat (fallback)
        ctx.fillStyle = cdef.hatColor || '#5c2d91';
        ctx.beginPath();
        ctx.moveTo(-11, -16);
        ctx.lineTo(2, -34);
        ctx.lineTo(11, -16);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -16, 13, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        drawStar(1, -26, 3, 5, '#ffd700');
        break;
      }
    }
  }

  // ---- Character-specific special effects ----
  // Called at world scale (no ctx.scale in effect), sx/drawY are screen coords
  function drawCharSpecial(ctx, sx, drawY, cid, cdef, worldX, isSelf) {
    switch (cid) {
      case 'luna': {
        // Crescent moon floating nearby
        const moonAngle = gameTime * 1.2;
        const moonX = sx + Math.cos(moonAngle) * 36;
        const moonY = drawY - 20 + Math.sin(moonAngle * 0.7) * 6;
        ctx.fillStyle = '#fffacd';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cdef.robeColor;
        ctx.beginPath();
        ctx.arc(moonX + 2.5, moonY - 1.2, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // 3-4 trailing stars when moving
        for (let si = 0; si < 4; si++) {
          const trailT = gameTime - si * 0.18;
          const trailX = sx + Math.cos(trailT * 1.2) * 36 + si * -4;
          const trailY = drawY - 20 + Math.sin(trailT * 0.7) * 6;
          const alpha = Math.max(0, 0.5 - si * 0.12);
          ctx.fillStyle = '#fffacd';
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(trailX, trailY, 1.5 - si * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'blaze': {
        // Fire particles at feet
        for (let fi = 0; fi < 4; fi++) {
          const ffx = sx - 10 + fi * 7;
          const ffh = 6 + Math.sin(gameTime * 5 + fi * 2) * 4;
          ctx.fillStyle = fi % 2 === 0 ? 'rgba(255,100,0,0.45)' : 'rgba(255,200,0,0.4)';
          ctx.beginPath();
          ctx.moveTo(ffx - 3, drawY + 18);
          ctx.lineTo(ffx, drawY + 18 - ffh);
          ctx.lineTo(ffx + 3, drawY + 18);
          ctx.closePath();
          ctx.fill();
        }
        // Smoke wisps rising
        for (let sm = 0; sm < 3; sm++) {
          const smAge = ((gameTime * 0.8 + sm * 0.4) % 1);
          const smX = sx - 8 + sm * 8 + Math.sin(gameTime + sm) * 3;
          const smY = drawY + 15 - smAge * 28;
          ctx.fillStyle = 'rgba(180,180,180,' + (0.15 * (1 - smAge)) + ')';
          ctx.beginPath();
          ctx.arc(smX, smY, 2 + smAge * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'coral': {
        // Water bubbles
        for (let bi = 0; bi < 4; bi++) {
          const bx = sx - 18 + bi * 12;
          const by = drawY + Math.sin(gameTime * 2.5 + bi * 2) * 10;
          ctx.strokeStyle = 'rgba(0,206,209,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, 3 + Math.sin(gameTime + bi) * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Splash droplets at feet when moving
        for (let sp = 0; sp < 5; sp++) {
          const spT = (gameTime * 2 + sp * 0.4) % 1;
          const spX = sx - 12 + sp * 6 + Math.sin(sp * 2.3) * 4;
          const spY = drawY + 18 - spT * 12;
          const spAlpha = 0.4 * (1 - spT);
          ctx.fillStyle = 'rgba(0,206,209,' + spAlpha + ')';
          ctx.beginPath();
          ctx.arc(spX, spY, 1.5 * (1 - spT * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'pixel': {
        // Holographic data rings orbiting
        for (let ri = 0; ri < 3; ri++) {
          const rAngle = gameTime * (1 + ri * 0.4) + ri * Math.PI * 0.6;
          ctx.save();
          ctx.translate(sx, drawY - 5);
          ctx.rotate(rAngle);
          ctx.strokeStyle = 'rgba(57,255,20,' + (0.25 + ri * 0.08) + ')';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(0, 0, 22 + ri * 6, 6 + ri * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // Binary digits
        ctx.font = '9px monospace';
        ctx.fillStyle = cdef.hatAccent;
        for (let di = 0; di < 3; di++) {
          const dx = sx - 20 + di * 20;
          const ddy = drawY - 5 + Math.sin(gameTime * 2 + di * 2) * 14;
          ctx.globalAlpha = 0.3 + Math.sin(gameTime * 3 + di) * 0.15;
          ctx.fillText(Math.sin(gameTime + di) > 0 ? '1' : '0', dx, ddy);
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'flora': {
        // Floating leaves
        for (let fli = 0; fli < 3; fli++) {
          const flx = sx - 22 + fli * 22;
          const fly = drawY + Math.sin(gameTime * 1.8 + fli * 3) * 14;
          ctx.save();
          ctx.translate(flx, fly);
          ctx.rotate(gameTime * 1.5 + fli);
          ctx.fillStyle = fli === 0 ? '#4caf50' : fli === 1 ? '#8bc34a' : '#66bb6a';
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // Pollen/spore particles drifting (tiny yellow dots)
        for (let pi = 0; pi < 5; pi++) {
          const pAge = ((gameTime * 0.5 + pi * 0.3) % 1);
          const px = sx - 14 + pi * 7 + Math.sin(gameTime * 0.8 + pi) * 5;
          const py = drawY + 15 - pAge * 30;
          ctx.fillStyle = 'rgba(255,235,59,' + (0.5 * (1 - pAge)) + ')';
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
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
  // Minimap island accent colors by category
  const minimapIslandColors = {
    matematica:  '#00e5ff',
    historia:    '#ffab40',
    ciencias:    '#69f0ae',
    linguas:     '#ea80fc',
    programacao: '#76ff03',
    central:     '#ffd700'
  };

  function drawMinimap() {
    // Use smaller size on small screens
    const isMobileScreen = canvas.width < 600;
    const mmW = isMobileScreen ? 140 : 180;
    const mmH = isMobileScreen ? 140 : 180;
    const margin = 20;
    const mx = canvas.width - mmW - margin;
    const my = canvas.height - mmH - margin;
    const scale = mmW / mapW; // 180/4000 = 0.045

    ctx.save();

    // Clip to rounded rect
    ctx.beginPath();
    ctx.roundRect(mx, my, mmW, mmH, 12);
    ctx.clip();

    // Background
    ctx.fillStyle = 'rgba(5, 10, 25, 0.85)';
    ctx.fillRect(mx, my, mmW, mmH);

    // ----- Bridges -----
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (const br of bridgeDefs) {
      const fromIsl = islands.find(i => i.id === br.from);
      const toIsl   = islands.find(i => i.id === br.to);
      if (!fromIsl || !toIsl) continue;
      ctx.beginPath();
      ctx.moveTo(mx + fromIsl.x * scale, my + fromIsl.y * scale);
      ctx.lineTo(mx + toIsl.x  * scale, my + toIsl.y  * scale);
      ctx.stroke();
    }

    // ----- Islands -----
    for (const isl of islands) {
      const ix = mx + isl.x * scale;
      const iy = my + isl.y * scale;
      const cat = isl.category || 'central';
      const color = minimapIslandColors[cat] || '#ffd700';

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      const r = Math.max(3, Math.min(isl.rx, isl.ry) * scale * 1.2);
      ctx.arc(ix, iy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Bright center dot
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(ix, iy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ----- Treasure chests -----
    if (chestDefs && chestDefs.length) {
      ctx.fillStyle = '#ffd700';
      for (const ch of chestDefs) {
        const cx2 = mx + ch.x * scale;
        const cy2 = my + ch.y * scale;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(cx2, cy2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ----- Enemies -----
    ctx.fillStyle = '#ff1744';
    for (const e of enemies) {
      const ex = mx + e.x * scale;
      const ey = my + e.y * scale;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ----- Remote players -----
    for (const id in remotePlayers) {
      const rp = remotePlayers[id];
      const px = mx + rp.x * scale;
      const py = my + rp.y * scale;
      ctx.fillStyle = rp.color || '#fff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ----- Camera viewport -----
    if (localPlayer) {
      const vx = mx + cam.x * scale;
      const vy = my + cam.y * scale;
      const vw = canvas.width * scale;
      const vh = canvas.height * scale;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(vx, vy, vw, vh);
    }

    // ----- Local player -----
    if (localPlayer) {
      const px = mx + localPlayer.x * scale;
      const py = my + localPlayer.y * scale;

      // Glow
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pulsing outer ring
      const pulse = 0.5 + 0.5 * Math.sin(gameTime * 3);
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + pulse * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 4.5 + pulse * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // ----- Border (drawn outside clip) -----
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, mmW, mmH, 12);
    ctx.stroke();
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

    // Check nearby players for duel
    nearbyPlayerId = null;
    if (!quizActive && !duelActive && !isDead && localPlayer) {
      for (const rp of allPlayersData) {
        if (rp.id === myId) continue;
        const dist = Math.hypot(rp.x - localPlayer.x, rp.y - localPlayer.y);
        if (dist < 120) {
          nearbyPlayerId = rp.id;
          break;
        }
      }
    }

    if (nearbyPlayerId && !quizActive && !duelActive) {
      if (elDuelPrompt) elDuelPrompt.style.display = 'block';
      if (elDuelPromptText) {
        const nearPlayer = allPlayersData.find(p => p.id === nearbyPlayerId);
        elDuelPromptText.textContent = 'Pressione F para desafiar ' + (nearPlayer ? nearPlayer.name : 'Jogador');
      }
      if (touchDuelBtn) touchDuelBtn.style.display = 'flex';
    } else {
      if (elDuelPrompt) elDuelPrompt.style.display = 'none';
      if (touchDuelBtn) touchDuelBtn.style.display = 'none';
    }

    // Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawOcean();
    drawBridges();
    drawIslands();
    drawPalmTrees();
    drawTotems();
    drawChests();
    drawSigns();
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

    // Atmosphere overlay (vignette, fog, light rays) — drawn after world/chars, before HUD
    drawAtmosphere();

    // Interactive element overlays
    drawTipPopup();
    drawMiniLessonOverlay();

    drawMinimap();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  // ---- Mobile Touch Controls ----
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const mobileControls = document.getElementById('mobileControls');
  const touchFireBtn = document.getElementById('touchFireBtn');

  if (isMobile && mobileControls) {
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => {
      const dir = btn.dataset.dir;

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[dir === 'up' ? 'w' : dir === 'down' ? 's' : dir === 'left' ? 'a' : 'd'] = true;
      }, { passive: false });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[dir === 'up' ? 'w' : dir === 'down' ? 's' : dir === 'left' ? 'a' : 'd'] = false;
      }, { passive: false });

      btn.addEventListener('touchcancel', (e) => {
        keys[dir === 'up' ? 'w' : dir === 'down' ? 's' : dir === 'left' ? 'a' : 'd'] = false;
      });
    });

    if (touchFireBtn) {
      touchFireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleShoot();
      }, { passive: false });
    }

    if (touchDuelBtn) {
      touchDuelBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (nearbyPlayerId && !quizActive && !duelActive) {
          socket.emit('duelChallenge', { targetId: nearbyPlayerId });
        }
      }, { passive: false });
    }
  }

  // ---- Exit Button ----
  const exitBtn = document.getElementById('exitGameBtn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      if (confirm('Sair do jogo?')) {
        sessionStorage.clear();
        window.location.href = '/';
      }
    });
  }

})();
