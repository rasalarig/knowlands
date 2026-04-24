/* ============================================================
   Knowlands - Character Selection Screen
   ============================================================ */
(function () {
  'use strict';

  // Auth guard
  var username = sessionStorage.getItem('username');
  if (!username) {
    window.location.href = '/';
    return;
  }

  // If character already chosen, go straight to archipelago selection
  var existingChar = sessionStorage.getItem('characterId');
  if (existingChar) {
    window.location.href = '/archipelago.html';
    return;
  }

  // ================================================================
  //  CHARACTER DEFINITIONS
  // ================================================================
  var characters = {
    luna: {
      name: 'Luna',
      desc: 'A sabia mistica das estrelas',
      robeColor: '#5c2d91',
      robeHighlight: '#7b3fc4',
      hatColor: '#4a1d80',
      hatAccent: '#c0c0c0',
      skinColor: '#fce4d6',
      glowColor: 'rgba(135,206,250,0.3)',
      special: 'moon',
      particleColor: '#add8e6'
    },
    blaze: {
      name: 'Blaze',
      desc: 'O guerreiro destemido do saber',
      robeColor: '#cc3300',
      robeHighlight: '#ff5722',
      hatColor: '#8b0000',
      hatAccent: '#ffd700',
      skinColor: '#fce4d6',
      glowColor: 'rgba(255,120,0,0.3)',
      special: 'fire',
      particleColor: '#ff6600'
    },
    coral: {
      name: 'Coral',
      desc: 'A exploradora dos mares do conhecimento',
      robeColor: '#008080',
      robeHighlight: '#20b2aa',
      hatColor: '#005f5f',
      hatAccent: '#40e0d0',
      skinColor: '#fce4d6',
      glowColor: 'rgba(0,200,200,0.25)',
      special: 'water',
      particleColor: '#00ced1'
    },
    pixel: {
      name: 'Pixel',
      desc: 'O genio digital da era moderna',
      robeColor: '#1a1a1a',
      robeHighlight: '#333333',
      hatColor: '#0d0d0d',
      hatAccent: '#39ff14',
      skinColor: '#fce4d6',
      glowColor: 'rgba(57,255,20,0.25)',
      special: 'digital',
      particleColor: '#39ff14'
    },
    flora: {
      name: 'Flora',
      desc: 'A guardia da sabedoria natural',
      robeColor: '#2e7d32',
      robeHighlight: '#4caf50',
      hatColor: '#1b5e20',
      hatAccent: '#ffd700',
      skinColor: '#fce4d6',
      glowColor: 'rgba(76,175,80,0.25)',
      special: 'nature',
      particleColor: '#66bb6a'
    }
  };

  // ================================================================
  //  PARTICLE SYSTEM
  // ================================================================
  var particleSets = {};
  var animFrame = 0;

  function initParticles(charId) {
    var arr = [];
    for (var i = 0; i < 8; i++) {
      arr.push({
        x: Math.random() * 120,
        y: Math.random() * 160,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.8 - 0.2,
        life: Math.random() * 100,
        maxLife: 100 + Math.random() * 60,
        size: 1 + Math.random() * 2
      });
    }
    particleSets[charId] = arr;
  }

  function updateParticles(charId) {
    var arr = particleSets[charId];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      if (p.life > p.maxLife) {
        p.x = 40 + Math.random() * 40;
        p.y = 100 + Math.random() * 50;
        p.life = 0;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = -Math.random() * 0.8 - 0.2;
      }
    }
  }

  function drawParticles(ctx, charId, color) {
    var arr = particleSets[charId];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      var alpha = 1 - (p.life / p.maxLife);
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ================================================================
  //  CHARACTER DRAWING
  // ================================================================
  function drawCharacterPreview(canvas, charId, frame) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var ch = characters[charId];
    if (!ch) return;

    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var baseY = h * 0.65;
    var bob = Math.sin(frame * 0.04) * 3;
    var breathe = Math.sin(frame * 0.03) * 1.5;
    var dy = baseY + bob;
    var scale = 2.0; // scale for character selection preview

    // Glow under character
    ctx.fillStyle = ch.glowColor;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + scale * 9, scale * 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + scale * 7, scale * 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    var s = scale;

    // Legs
    var legOffset = Math.sin(frame * 0.06) * 3;
    var armSwing = Math.sin(frame * 0.06) * 3;
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(cx - 5 * s / 2 + legOffset, dy + 8 * s / 2, 4 * s / 2, 10 * s / 2);
    ctx.fillRect(cx + 1 * s / 2 - legOffset, dy + 8 * s / 2, 4 * s / 2, 10 * s / 2);

    // Boots with sole
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(cx - 6 * s / 2 + legOffset, dy + 16 * s / 2, 7 * s / 2, 4 * s / 2);
    ctx.fillRect(cx + 0 * s / 2 - legOffset, dy + 16 * s / 2, 7 * s / 2, 4 * s / 2);
    ctx.fillStyle = '#1a0d0a';
    ctx.fillRect(cx - 6 * s / 2 + legOffset, dy + 19 * s / 2, 7 * s / 2, 1);
    ctx.fillRect(cx + 0 * s / 2 - legOffset, dy + 19 * s / 2, 7 * s / 2, 1);

    // Robe body
    ctx.fillStyle = ch.robeColor;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s / 2, dy - 2 * s / 2 + breathe);
    ctx.lineTo(cx - 10 * s / 2, dy + 12 * s / 2);
    ctx.lineTo(cx + 10 * s / 2, dy + 12 * s / 2);
    ctx.lineTo(cx + 12 * s / 2, dy - 2 * s / 2 + breathe);
    ctx.closePath();
    ctx.fill();

    // Belt
    ctx.fillStyle = ch.robeColor;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(cx - 10 * s / 2, dy + 4 * s / 2, 20 * s / 2, 3 * s / 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ch.hatAccent || '#ffd700';
    ctx.fillRect(cx - 2 * s / 2, dy + 4.5 * s / 2, 4 * s / 2, 2 * s / 2);

    // Body highlight
    ctx.fillStyle = ch.robeHighlight;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - 6 * s / 2, dy - 1 * s / 2 + breathe);
    ctx.lineTo(cx - 4 * s / 2, dy + 10 * s / 2);
    ctx.lineTo(cx + 3 * s / 2, dy + 10 * s / 2);
    ctx.lineTo(cx + 5 * s / 2, dy - 1 * s / 2 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Arms
    ctx.fillStyle = ch.robeColor;
    ctx.globalAlpha = 0.9;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s / 2, dy - 1 * s / 2);
    ctx.lineTo(cx - 16 * s / 2, dy + 5 * s / 2 + armSwing);
    ctx.lineTo(cx - 14 * s / 2, dy + 5 * s / 2 + armSwing);
    ctx.lineTo(cx - 10 * s / 2, dy - 1 * s / 2);
    ctx.closePath();
    ctx.fill();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(cx + 10 * s / 2, dy - 1 * s / 2);
    ctx.lineTo(cx + 13 * s / 2, dy + 5 * s / 2 - armSwing);
    ctx.lineTo(cx + 16 * s / 2, dy + 5 * s / 2 - armSwing);
    ctx.lineTo(cx + 12 * s / 2, dy - 1 * s / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = ch.skinColor;
    ctx.beginPath();
    ctx.arc(cx, dy - 12 * s / 2, 12 * s / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw character-specific hat
    drawHat(ctx, cx, dy, s, ch, charId, frame);

    // Eyebrows
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 6.5 * s / 2, dy - 15.5 * s / 2);
    ctx.lineTo(cx - 2.5 * s / 2, dy - 17 * s / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 2.5 * s / 2, dy - 17 * s / 2);
    ctx.lineTo(cx + 6.5 * s / 2, dy - 15.5 * s / 2);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 4 * s / 2, dy - 13 * s / 2, 3.5 * s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4 * s / 2, dy - 13 * s / 2, 3.5 * s / 2, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx - 4 * s / 2, dy - 13 * s / 2, 1.8 * s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4 * s / 2, dy - 13 * s / 2, 1.8 * s / 2, 0, Math.PI * 2);
    ctx.fill();

    // Pupil highlights
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 3.2 * s / 2, dy - 14 * s / 2, 0.7 * s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4.8 * s / 2, dy - 14 * s / 2, 0.7 * s / 2, 0, Math.PI * 2);
    ctx.fill();

    // Blush spots
    ctx.fillStyle = 'rgba(255,150,150,0.2)';
    ctx.beginPath();
    ctx.arc(cx - 7 * s / 2, dy - 11 * s / 2, 3 * s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 7 * s / 2, dy - 11 * s / 2, 3 * s / 2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (small smile)
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, dy - 8 * s / 2, 3 * s / 2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Draw character-specific special effects
    drawSpecial(ctx, cx, dy, s, ch, charId, frame);

    // Particle effects
    updateParticles(charId);
    drawParticles(ctx, charId, ch.particleColor);
  }

  function drawHat(ctx, cx, dy, s, ch, charId, frame) {
    switch (charId) {
      case 'luna':
        // Tall pointy wizard hat with stars
        ctx.fillStyle = ch.hatColor;
        ctx.beginPath();
        ctx.moveTo(cx - 13 * s / 2, dy - 18 * s / 2);
        ctx.lineTo(cx + 2 * s / 2, dy - 40 * s / 2);
        ctx.lineTo(cx + 13 * s / 2, dy - 18 * s / 2);
        ctx.closePath();
        ctx.fill();
        // Hat brim
        ctx.fillStyle = ch.hatColor;
        ctx.beginPath();
        ctx.ellipse(cx, dy - 18 * s / 2, 15 * s / 2, 3.5 * s / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Stars on hat
        ctx.fillStyle = ch.hatAccent;
        drawStarShape(ctx, cx - 2 * s / 2, dy - 30 * s / 2, 3, 5);
        drawStarShape(ctx, cx + 5 * s / 2, dy - 24 * s / 2, 2, 5);
        break;

      case 'blaze':
        // Knight helmet with flame crest
        ctx.fillStyle = ch.hatColor;
        ctx.beginPath();
        ctx.arc(cx, dy - 14 * s / 2, 13 * s / 2, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Visor
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - 10 * s / 2, dy - 15 * s / 2, 20 * s / 2, 3 * s / 2);
        // Flame crest
        for (var fi = 0; fi < 5; fi++) {
          var fx = cx + (fi - 2) * 3 * s / 2;
          var fh = (6 + Math.sin(frame * 0.08 + fi) * 4) * s / 2;
          ctx.fillStyle = fi % 2 === 0 ? '#ff6600' : ch.hatAccent;
          ctx.beginPath();
          ctx.moveTo(fx - 2 * s / 2, dy - 20 * s / 2);
          ctx.lineTo(fx, dy - 20 * s / 2 - fh);
          ctx.lineTo(fx + 2 * s / 2, dy - 20 * s / 2);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'coral':
        // Captain's hat
        ctx.fillStyle = ch.hatColor;
        ctx.beginPath();
        ctx.ellipse(cx, dy - 18 * s / 2, 14 * s / 2, 4 * s / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ch.hatColor;
        ctx.fillRect(cx - 10 * s / 2, dy - 25 * s / 2, 20 * s / 2, 8 * s / 2);
        // Hat top curve
        ctx.beginPath();
        ctx.ellipse(cx, dy - 25 * s / 2, 10 * s / 2, 3 * s / 2, 0, Math.PI, 0);
        ctx.fill();
        // Anchor emblem
        ctx.fillStyle = ch.hatAccent;
        ctx.beginPath();
        ctx.arc(cx, dy - 22 * s / 2, 2.5 * s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 0.5 * s / 2, dy - 24 * s / 2, 1 * s / 2, 5 * s / 2);
        break;

      case 'pixel':
        // VR headset/visor
        ctx.fillStyle = ch.hatColor;
        ctx.beginPath();
        ctx.roundRect(cx - 12 * s / 2, dy - 20 * s / 2, 24 * s / 2, 10 * s / 2, 4 * s / 2);
        ctx.fill();
        // Visor lens
        var visorGlow = 0.5 + Math.sin(frame * 0.06) * 0.3;
        ctx.fillStyle = 'rgba(57,255,20,' + visorGlow + ')';
        ctx.beginPath();
        ctx.roundRect(cx - 10 * s / 2, dy - 19 * s / 2, 20 * s / 2, 7 * s / 2, 3 * s / 2);
        ctx.fill();
        // LED dots
        ctx.fillStyle = ch.hatAccent;
        for (var li = 0; li < 4; li++) {
          var on = Math.sin(frame * 0.1 + li * 1.5) > 0;
          if (on) {
            ctx.beginPath();
            ctx.arc(cx - 6 * s / 2 + li * 4 * s / 2, dy - 16 * s / 2, 1 * s / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'flora':
        // Crown of leaves and flowers
        var leafCount = 7;
        for (var lfi = 0; lfi < leafCount; lfi++) {
          var la = (lfi / leafCount) * Math.PI + 0.1;
          var lr = 13 * s / 2;
          var lx = cx + Math.cos(la - Math.PI) * lr;
          var ly = dy - 18 * s / 2 + Math.sin(la - Math.PI) * lr * 0.4;
          var leafSize = (3 + Math.sin(frame * 0.04 + lfi)) * s / 2;
          // Leaf
          ctx.fillStyle = lfi % 3 === 0 ? '#4caf50' : lfi % 3 === 1 ? '#66bb6a' : '#81c784';
          ctx.beginPath();
          ctx.ellipse(lx, ly - 2, leafSize, leafSize * 0.5, la * 0.5, 0, Math.PI * 2);
          ctx.fill();
          // Flower on some leaves
          if (lfi % 2 === 0) {
            ctx.fillStyle = lfi === 0 ? '#ff6b9d' : lfi === 2 ? '#ffd700' : '#ff9800';
            ctx.beginPath();
            ctx.arc(lx, ly - 3, 2 * s / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
    }
  }

  function drawSpecial(ctx, cx, dy, s, ch, charId, frame) {
    switch (charId) {
      case 'luna':
        // Crescent moon floating nearby
        var moonX = cx + 22 * s / 2 + Math.sin(frame * 0.025) * 4;
        var moonY = dy - 20 * s / 2 + Math.cos(frame * 0.03) * 3;
        ctx.fillStyle = '#fffacd';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 5 * s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#070b1a';
        ctx.beginPath();
        ctx.arc(moonX + 2 * s / 2, moonY - 1 * s / 2, 4 * s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Sparkle
        var sparkAlpha = 0.4 + Math.sin(frame * 0.1) * 0.4;
        ctx.globalAlpha = sparkAlpha;
        drawStarShape(ctx, cx - 18 * s / 2, dy - 8 * s / 2, 2, 4);
        ctx.globalAlpha = 1;
        break;

      case 'blaze':
        // Fire at feet
        for (var ffi = 0; ffi < 4; ffi++) {
          var ffx = cx - 8 * s / 2 + ffi * 5 * s / 2;
          var ffh = (4 + Math.sin(frame * 0.12 + ffi * 2) * 3) * s / 2;
          ctx.fillStyle = ffi % 2 === 0 ? 'rgba(255,100,0,0.5)' : 'rgba(255,200,0,0.4)';
          ctx.beginPath();
          ctx.moveTo(ffx - 2 * s / 2, dy + 16 * s / 2);
          ctx.lineTo(ffx, dy + 16 * s / 2 - ffh);
          ctx.lineTo(ffx + 2 * s / 2, dy + 16 * s / 2);
          ctx.closePath();
          ctx.fill();
        }
        // Glowing eyes
        ctx.fillStyle = '#ff4400';
        ctx.globalAlpha = 0.6 + Math.sin(frame * 0.08) * 0.3;
        ctx.beginPath();
        ctx.arc(cx - 4 * s / 2, dy - 13 * s / 2, 2 * s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 4 * s / 2, dy - 13 * s / 2, 2 * s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;

      case 'coral':
        // Water bubbles
        for (var bi = 0; bi < 5; bi++) {
          var bx = cx - 16 * s / 2 + bi * 8 * s / 2;
          var by = dy + Math.sin(frame * 0.05 + bi * 1.5) * 15 * s / 2;
          var bSize = (1.5 + Math.sin(frame * 0.03 + bi) * 0.5) * s / 2;
          ctx.strokeStyle = 'rgba(0,206,209,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, bSize, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,206,209,0.15)';
          ctx.fill();
        }
        break;

      case 'pixel':
        // Binary numbers floating around
        ctx.font = (8 * s / 2) + 'px monospace';
        ctx.fillStyle = ch.hatAccent;
        for (var di = 0; di < 4; di++) {
          var dx = cx - 20 * s / 2 + di * 12 * s / 2;
          var ddy = dy - 10 * s / 2 + Math.sin(frame * 0.04 + di * 2) * 20 * s / 2;
          var digit = Math.sin(frame * 0.02 + di) > 0 ? '1' : '0';
          ctx.globalAlpha = 0.3 + Math.sin(frame * 0.06 + di) * 0.2;
          ctx.fillText(digit, dx, ddy);
        }
        ctx.globalAlpha = 1;
        break;

      case 'flora':
        // Floating leaves
        for (var fli = 0; fli < 4; fli++) {
          var flx = cx - 18 * s / 2 + fli * 12 * s / 2;
          var fly = dy + Math.sin(frame * 0.035 + fli * 1.8) * 18 * s / 2;
          var flRot = frame * 0.03 + fli;
          ctx.save();
          ctx.translate(flx, fly);
          ctx.rotate(flRot);
          ctx.fillStyle = fli % 2 === 0 ? '#4caf50' : '#8bc34a';
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 4 * s / 2, 2 * s / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // Small flowers growing at base
        for (var sfi = 0; sfi < 3; sfi++) {
          var sfx = cx - 12 * s / 2 + sfi * 12 * s / 2;
          var sfGrow = Math.max(0, Math.sin(frame * 0.02 + sfi * 2));
          ctx.fillStyle = '#66bb6a';
          ctx.fillRect(sfx - 0.5, dy + 14 * s / 2, 1, -4 * sfGrow * s / 2);
          if (sfGrow > 0.5) {
            ctx.fillStyle = sfi === 0 ? '#ffeb3b' : sfi === 1 ? '#ff6b9d' : '#ce93d8';
            ctx.beginPath();
            ctx.arc(sfx, dy + 14 * s / 2 - 4 * sfGrow * s / 2, 2 * s / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
    }
  }

  function drawStarShape(ctx, cx, cy, radius, points) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 === 0 ? radius : radius * 0.4;
      var a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  //  SELECTION LOGIC
  // ================================================================
  var selectedChar = null;
  var cards = document.querySelectorAll('.char-card');
  var playBtn = document.getElementById('playBtn');

  cards.forEach(function (card) {
    var charId = card.getAttribute('data-char');
    initParticles(charId);

    card.addEventListener('click', function () {
      cards.forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      selectedChar = charId;
      playBtn.disabled = false;
    });
  });

  playBtn.addEventListener('click', function () {
    if (!selectedChar) return;
    sessionStorage.setItem('characterId', selectedChar);
    window.location.href = '/archipelago.html';
  });

  // ================================================================
  //  ANIMATION LOOP
  // ================================================================
  function animate() {
    animFrame++;
    cards.forEach(function (card) {
      var charId = card.getAttribute('data-char');
      var canvas = card.querySelector('.char-preview');
      if (canvas) {
        drawCharacterPreview(canvas, charId, animFrame);
      }
    });
    requestAnimationFrame(animate);
  }

  animate();

})();
