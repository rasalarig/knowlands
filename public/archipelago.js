(function () {
  'use strict';

  // Auth guard
  var username = sessionStorage.getItem('username');
  var email = sessionStorage.getItem('email');
  if (!username || !email) { window.location.href = '/'; return; }
  var characterId = sessionStorage.getItem('characterId');
  if (!characterId) { window.location.href = '/select.html'; return; }

  var uploadedFiles = [];
  var maxFiles = 5;
  var maxSizeMB = 100;

  // Elements
  var modeSelection = document.getElementById('modeSelection');
  var classicCard = document.getElementById('classicCard');
  var customCard = document.getElementById('customCard');
  var uploadSection = document.getElementById('uploadSection');
  var backToModes = document.getElementById('backToModes');
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var fileList = document.getElementById('fileList');
  var generateBtn = document.getElementById('generateBtn');
  var loadingState = document.getElementById('loadingState');
  var loadingText = document.getElementById('loadingText');
  var loadingBar = document.getElementById('loadingBar');
  var previewSection = document.getElementById('previewSection');
  var previewGrid = document.getElementById('previewGrid');
  var playCustomBtn = document.getElementById('playCustomBtn');
  var previousArchs = document.getElementById('previousArchs');
  var archList = document.getElementById('archList');

  // Classic mode
  classicCard.querySelector('.mode-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    sessionStorage.setItem('archipelagoId', 'classic');
    window.location.href = '/game.html';
  });
  classicCard.addEventListener('click', function () {
    sessionStorage.setItem('archipelagoId', 'classic');
    window.location.href = '/game.html';
  });

  // Custom mode
  customCard.querySelector('.mode-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    showUploadUI();
  });
  customCard.addEventListener('click', function () {
    showUploadUI();
  });

  // Back button
  backToModes.addEventListener('click', function () {
    uploadSection.style.display = 'none';
    modeSelection.style.display = 'grid';
    previousArchs.style.display = archList.children.length > 0 ? 'block' : 'none';
  });

  function showUploadUI() {
    modeSelection.style.display = 'none';
    previousArchs.style.display = 'none';
    uploadSection.style.display = 'block';
  }

  // Drag & Drop
  dropZone.addEventListener('click', function () { fileInput.click(); });
  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function () {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', function () {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });

  function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
      if (uploadedFiles.length >= maxFiles) {
        alert('Maximo de ' + maxFiles + ' arquivos.');
        break;
      }
      var f = files[i];
      if (f.type !== 'application/pdf') {
        alert(f.name + ' nao e um PDF.');
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        alert(f.name + ' excede ' + maxSizeMB + 'MB.');
        continue;
      }
      uploadedFiles.push({ file: f, customName: '' });
    }
    renderFileList();
  }

  function renderFileList() {
    fileList.innerHTML = '';
    uploadedFiles.forEach(function (item, idx) {
      var div = document.createElement('div');
      div.className = 'file-item';
      var sizeMB = (item.file.size / 1024 / 1024).toFixed(1);
      div.innerHTML =
        '<span class="file-item-icon">\uD83D\uDCC4</span>' +
        '<div class="file-item-info">' +
          '<div class="file-item-name">' + item.file.name + '</div>' +
          '<div class="file-item-size">' + sizeMB + ' MB</div>' +
        '</div>' +
        '<input class="file-item-input" type="text" placeholder="Nome da ilha (opcional)" value="' + (item.customName || '') + '" data-idx="' + idx + '" />' +
        '<button class="file-item-remove" data-idx="' + idx + '">&times;</button>';
      fileList.appendChild(div);
    });

    // Wire events
    fileList.querySelectorAll('.file-item-input').forEach(function (input) {
      input.addEventListener('input', function () {
        uploadedFiles[parseInt(this.dataset.idx)].customName = this.value;
      });
    });
    fileList.querySelectorAll('.file-item-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        uploadedFiles.splice(parseInt(this.dataset.idx), 1);
        renderFileList();
      });
    });

    generateBtn.style.display = uploadedFiles.length > 0 ? 'flex' : 'none';
  }

  // Generate
  generateBtn.addEventListener('click', function () {
    if (uploadedFiles.length === 0) return;
    generateBtn.disabled = true;
    generateBtn.style.display = 'none';
    loadingState.style.display = 'block';
    loadingText.textContent = 'Enviando arquivos...';
    loadingBar.style.width = '10%';

    var formData = new FormData();
    formData.append('email', email);
    var names = [];
    uploadedFiles.forEach(function (item) {
      formData.append('files', item.file);
      names.push(item.customName || '');
    });
    formData.append('islandNames', JSON.stringify(names));

    // Simulate progress during long API call
    var progressTimer = setInterval(function () {
      var current = parseFloat(loadingBar.style.width) || 10;
      if (current < 85) {
        loadingBar.style.width = (current + 2) + '%';
      }
      if (current > 20 && current < 40) {
        loadingText.textContent = 'Extraindo texto dos PDFs...';
      } else if (current > 40 && current < 70) {
        loadingText.textContent = 'Gerando perguntas com IA...';
      } else if (current > 70) {
        loadingText.textContent = 'Finalizando ilhas...';
      }
    }, 800);

    fetch('/api/archipelago/create', { method: 'POST', body: formData })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        clearInterval(progressTimer);
        loadingBar.style.width = '100%';

        if (data.error) {
          alert('Erro: ' + data.error);
          loadingState.style.display = 'none';
          generateBtn.style.display = 'flex';
          generateBtn.disabled = false;
          return;
        }

        loadingText.textContent = 'Pronto!';
        setTimeout(function () {
          loadingState.style.display = 'none';
          showPreview(data.archipelago);
        }, 600);
      })
      .catch(function (err) {
        clearInterval(progressTimer);
        alert('Erro ao gerar ilhas: ' + err.message);
        loadingState.style.display = 'none';
        generateBtn.style.display = 'flex';
        generateBtn.disabled = false;
      });
  });

  function showPreview(arch) {
    previewSection.style.display = 'block';
    previewGrid.innerHTML = '';

    var themeIcons = {
      blue: '\uD83D\uDD37', brown: '\uD83D\uDFE4', green: '\uD83D\uDFE2',
      purple: '\uD83D\uDFE3', neon: '\uD83D\uDC9A', gold: '\u2B50'
    };

    arch.islands.forEach(function (island) {
      var card = document.createElement('div');
      card.className = 'preview-card';
      var qCount = 0;
      if (island.questions) {
        for (var lvl in island.questions) {
          qCount += island.questions[lvl].length;
        }
      }
      card.innerHTML =
        '<div class="preview-card-icon">' + (themeIcons[island.theme] || '\uD83C\uDFDD\uFE0F') + '</div>' +
        '<div class="preview-card-name">' + island.name + '</div>' +
        '<div class="preview-card-info">' + qCount + ' perguntas &bull; 3 niveis</div>';
      previewGrid.appendChild(card);
    });

    // Store archipelago ID for game
    window._pendingArchId = arch.id;
  }

  playCustomBtn.addEventListener('click', function () {
    if (window._pendingArchId) {
      sessionStorage.setItem('archipelagoId', window._pendingArchId);
      window.location.href = '/game.html';
    }
  });

  // Load existing archipelagos
  function loadExisting() {
    fetch('/api/archipelago/list?email=' + encodeURIComponent(email))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.archipelagos && data.archipelagos.length > 0) {
          previousArchs.style.display = 'block';
          archList.innerHTML = '';
          data.archipelagos.forEach(function (arch) {
            var div = document.createElement('div');
            div.className = 'arch-item';
            var islandCount = arch.islands ? arch.islands.length : 0;
            var dateStr = arch.createdAt ? new Date(arch.createdAt).toLocaleDateString('pt-BR') : '';
            div.innerHTML =
              '<span class="arch-item-icon">\uD83D\uDDFA\uFE0F</span>' +
              '<div class="arch-item-info">' +
                '<div class="arch-item-name">' + (arch.name || 'Meu Arquipelago') + '</div>' +
                '<div class="arch-item-meta">' + islandCount + ' ilhas &bull; Criado em ' + dateStr + '</div>' +
              '</div>' +
              '<button class="arch-item-play">Jogar</button>';
            div.querySelector('.arch-item-play').addEventListener('click', function (e) {
              e.stopPropagation();
              sessionStorage.setItem('archipelagoId', arch.id);
              window.location.href = '/game.html';
            });
            archList.appendChild(div);
          });
        }
      })
      .catch(function () { /* ignore */ });
  }

  loadExisting();
})();
