require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PDF Upload configuration
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Apenas arquivos PDF sao aceitos.'));
  }
});

// OpenAI client
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// --------------- Persistence ---------------
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory store (backed by file)
let persistedUsers = {};

function loadData() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      persistedUsers = JSON.parse(raw);
      console.log('Loaded', Object.keys(persistedUsers).length, 'user(s) from disk.');
    }
  } catch (err) {
    console.error('Failed to load users.json (starting fresh):', err.message);
    persistedUsers = {};
  }
}

let _saveTimer = null;
function saveData() {
  if (_saveTimer) return; // already scheduled
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(persistedUsers, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save users.json:', err.message);
    }
  }, 2000); // debounce: write at most every 2 seconds
}

function defaultUserRecord(email, name, extraFields) {
  return Object.assign({
    email,
    name,
    hash: null,
    googleUser: false,
    picture: '',
    profile: { xp: 0, level: 1, coins: 0 },
    quizHistory: [],
    notes: {
      matematica: '',
      historia: '',
      ciencias: '',
      linguas: '',
      programacao: ''
    },
    achievements: [],
    stats: {
      totalCorrect: 0,
      totalWrong: 0,
      totalDuelsWon: 0,
      totalDuelsLost: 0,
      islandsVisited: []
    },
    archipelagos: [],
    progression: {
      matematica: 1,
      historia: 1,
      ciencias: 1,
      linguas: 1,
      programacao: 1
    }
  }, extraFields || {});
}

function getUserData(email) {
  return persistedUsers[email] || null;
}

function updateUserData(email, updates) {
  if (!persistedUsers[email]) return;
  Object.assign(persistedUsers[email], updates);
  saveData();
}

function savePlayerProgress(player) {
  if (!player || !player.email) return;
  const archId = player.archipelagoId;
  if (archId && archId !== 'classic') {
    const userData = getUserData(player.email);
    if (!userData) return;
    const arch = (userData.archipelagos || []).find(a => a.id === archId);
    if (arch) {
      arch.profile = { xp: player.xp, level: player.level, coins: player.coins };
      updateUserData(player.email, { archipelagos: userData.archipelagos });
    }
  } else {
    const rec = persistedUsers[player.email];
    if (!rec) return;
    rec.profile = { xp: player.xp, level: player.level, coins: player.coins };
    saveData();
  }
}

function recordQuizResult(player, category, correct, level, source) {
  if (!player || !player.email) return;
  const archId = player.archipelagoId;
  const entry = { category, correct, timestamp: Date.now(), level: level || 1, source: source || 'enemy' };

  if (archId && archId !== 'classic') {
    const userData = getUserData(player.email);
    if (!userData) return;
    const arch = (userData.archipelagos || []).find(a => a.id === archId);
    if (arch) {
      if (!arch.quizHistory) arch.quizHistory = [];
      arch.quizHistory.push(entry);
      if (arch.quizHistory.length > 200) arch.quizHistory = arch.quizHistory.slice(-200);
      if (!arch.stats) arch.stats = { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] };
      if (correct) arch.stats.totalCorrect = (arch.stats.totalCorrect || 0) + 1;
      else arch.stats.totalWrong = (arch.stats.totalWrong || 0) + 1;
      arch.profile = { xp: player.xp, level: player.level, coins: player.coins };
      updateUserData(player.email, { archipelagos: userData.archipelagos });
    }
  } else {
    const rec = persistedUsers[player.email];
    if (!rec) return;
    if (!rec.quizHistory) rec.quizHistory = [];
    rec.quizHistory.push(entry);
    if (rec.quizHistory.length > 200) rec.quizHistory = rec.quizHistory.slice(-200);
    if (!rec.stats) rec.stats = { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] };
    if (correct) rec.stats.totalCorrect = (rec.stats.totalCorrect || 0) + 1;
    else rec.stats.totalWrong = (rec.stats.totalWrong || 0) + 1;
    rec.profile = { xp: player.xp, level: player.level, coins: player.coins };
    saveData();
  }
}

function recordDuelResult(player, won) {
  if (!player || !player.email) return;
  const archId = player.archipelagoId;

  if (archId && archId !== 'classic') {
    const userData = getUserData(player.email);
    if (!userData) return;
    const arch = (userData.archipelagos || []).find(a => a.id === archId);
    if (arch) {
      if (!arch.stats) arch.stats = { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] };
      if (won) arch.stats.totalDuelsWon = (arch.stats.totalDuelsWon || 0) + 1;
      else arch.stats.totalDuelsLost = (arch.stats.totalDuelsLost || 0) + 1;
      arch.profile = { xp: player.xp, level: player.level, coins: player.coins };
      updateUserData(player.email, { archipelagos: userData.archipelagos });
    }
  } else {
    const rec = persistedUsers[player.email];
    if (!rec) return;
    if (!rec.stats) rec.stats = { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] };
    if (won) rec.stats.totalDuelsWon = (rec.stats.totalDuelsWon || 0) + 1;
    else rec.stats.totalDuelsLost = (rec.stats.totalDuelsLost || 0) + 1;
    rec.profile = { xp: player.xp, level: player.level, coins: player.coins };
    saveData();
  }
}

// Load persisted data on startup
loadData();

// --------------- In-memory user store (auth) ---------------
const users = new Map();

// Pre-populate in-memory users map from persisted data
for (const [email, rec] of Object.entries(persistedUsers)) {
  users.set(email, { name: rec.name, email, hash: rec.hash, googleUser: !!rec.googleUser, picture: rec.picture || '' });
}

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
    // Persist new user
    persistedUsers[email] = defaultUserRecord(email, name, { hash });
    saveData();
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
    // Ensure persisted record exists (migration for old users)
    if (!persistedUsers[email]) {
      persistedUsers[email] = defaultUserRecord(email, user.name, { hash: user.hash });
      saveData();
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
      // Persist new Google user
      persistedUsers[email] = defaultUserRecord(email, name, { hash: null, googleUser: true, picture });
      saveData();
    } else if (!persistedUsers[email]) {
      // Migration: existing in-memory user not yet persisted
      const existing = users.get(email);
      persistedUsers[email] = defaultUserRecord(email, existing.name, {
        hash: null, googleUser: true, picture: existing.picture || picture
      });
      saveData();
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

// --------------- User Data REST API ---------------
app.get('/api/user/notes/:email', (req, res) => {
  const rec = getUserData(req.params.email);
  if (!rec) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  return res.json({ notes: rec.notes || {} });
});

app.post('/api/user/notes', (req, res) => {
  const { email, category, content } = req.body;
  if (!email || !category) return res.status(400).json({ error: 'email e category sao obrigatorios.' });
  const rec = getUserData(email);
  if (!rec) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  if (!rec.notes) rec.notes = {};
  rec.notes[category] = content || '';
  saveData();
  return res.json({ ok: true });
});

app.get('/api/user/progress/:email', (req, res) => {
  const rec = getUserData(req.params.email);
  if (!rec) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  return res.json({
    profile: rec.profile || { xp: 0, level: 1, coins: 0 },
    quizHistory: rec.quizHistory || [],
    stats: rec.stats || {}
  });
});

// ===============================================================
//  ARCHIPELAGO REST API
// ===============================================================
app.post('/api/archipelago/create', (req, res, next) => {
  upload.array('files', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'Erro no upload: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Email e pelo menos um PDF sao obrigatorios.' });
    }

    if (!openaiClient) {
      // Clean up files
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
      return res.status(500).json({ error: 'API de IA nao configurada. Adicione OPENAI_API_KEY ao .env' });
    }

    const userData = getUserData(email);
    if (!userData) {
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
      return res.status(404).json({ error: 'Usuario nao encontrado.' });
    }

    // Rate limit: max 10 archipelagos per user
    if ((userData.archipelagos || []).length >= 10) {
      req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
      return res.status(429).json({ error: 'Limite de 10 arquipelagos atingido.' });
    }

    const islandNames = req.body.islandNames ? JSON.parse(req.body.islandNames) : [];

    // Extract text from each PDF using multiple strategies
    const pdfTexts = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const pdfName = islandNames[i] || file.originalname.replace('.pdf', '');
      try {
        const dataBuffer = fs.readFileSync(file.path);
        let text = '';

        // Strategy 1: pdf-parse
        try {
          const pdfData = await pdfParse(dataBuffer);
          text = pdfData.text || '';
        } catch (e) { /* continue to fallback */ }

        // Strategy 2: pdfjs-dist (pure JS, handles more PDFs)
        if (text.trim().length < 50) {
          try {
            const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(dataBuffer) });
            const pdfDoc = await loadingTask.promise;
            const pages = Math.min(pdfDoc.numPages, 30); // max 30 pages
            let extracted = '';
            for (let p = 1; p <= pages; p++) {
              const page = await pdfDoc.getPage(p);
              const content = await page.getTextContent();
              extracted += content.items.map(item => item.str).join(' ') + '\n';
            }
            if (extracted.trim().length > text.trim().length) {
              text = extracted;
            }
          } catch (e) { /* continue */ }
        }

        // Truncate to ~15000 chars per PDF
        if (text.length > 15000) text = text.substring(0, 15000);

        if (text.trim().length >= 50) {
          pdfTexts.push({ name: pdfName, text: text, mode: 'text' });
        } else {
          // Strategy 3: use filename as topic and let AI generate content about it
          pdfTexts.push({ name: pdfName, text: null, mode: 'topic' });
        }
      } catch (err) {
        pdfTexts.push({ name: pdfName, text: null, mode: 'topic' });
      }
    }

    // Clean up uploaded files
    req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });

    // All PDFs are usable (either text extracted or topic-based)
    const usablePdfs = pdfTexts;

    // Build AI prompt
    const themes = ['blue', 'green', 'purple', 'brown', 'neon'];

    const systemPrompt = `Voce e um professor especialista em criar material didatico de alta qualidade para um jogo educativo brasileiro chamado Knowlands.

Sua tarefa e analisar profundamente o conteudo dos documentos fornecidos, identificar os topicos-chave, conceitos fundamentais, definicoes, formulas, datas, nomes e relacoes importantes, e transformar tudo isso em perguntas de quiz que realmente testem o conhecimento do estudante sobre O CONTEUDO ESPECIFICO do documento.

REGRAS CRITICAS:
- As perguntas DEVEM ser especificas ao conteudo do documento, citando dados, nomes, definicoes e fatos EXATOS que aparecem no texto
- NUNCA faca perguntas genericas ou que possam ser respondidas sem ler o material
- Cada pergunta deve ter 4 opcoes plausíveis, onde as erradas sejam distratores realistas
- As perguntas devem cobrir DIFERENTES topicos/secoes do documento, nao repetir o mesmo assunto
- As mini-licoes devem explicar conceitos-chave DO DOCUMENTO de forma clara e didatica

Responda APENAS com JSON valido, sem explicacao, sem markdown, sem blocos de codigo.`;

    let documentsPrompt = '';
    usablePdfs.forEach((pdf, i) => {
      if (pdf.mode === 'text') {
        documentsPrompt += `\n\n=== DOCUMENTO ${i + 1}: "${pdf.name}" ===\n${pdf.text}\n=== FIM DOCUMENTO ${i + 1} ===\n`;
      } else if (pdf.mode === 'topic') {
        documentsPrompt += `\n\n=== DOCUMENTO ${i + 1}: "${pdf.name}" ===\nNao foi possivel extrair o texto. Gere conteudo educativo APROFUNDADO sobre o tema "${pdf.name}", cobrindo os principais topicos, conceitos, formulas e fatos importantes dessa area.\n=== FIM DOCUMENTO ${i + 1} ===\n`;
      }
    });

    const instructionText = `Analise profundamente os documentos abaixo e gere conteudo educativo DETALHADO em formato JSON.

Para CADA documento, faca:
1. PRIMEIRO: identifique os 5-8 topicos/conceitos principais do documento
2. DEPOIS: crie perguntas que cubram TODOS esses topicos, distribuindo entre os 3 niveis

Para CADA documento, gere:
- "name": nome curto e tematico (max 25 chars). Use o nome sugerido se houver.
- "theme": um de ${themes.map(t => '"' + t + '"').join(', ')} (diferente por ilha)
- "questions": objeto com 3 niveis, cada um com EXATAMENTE 5 perguntas:
  - "1" (BASICO): Perguntas sobre DEFINICOES e FATOS diretos do texto. O estudante precisa lembrar informacoes especificas.
    Exemplos: "Segundo o texto, qual e a definicao de X?", "Qual valor/data/nome o documento menciona para Y?"
  - "2" (INTERMEDIARIO): Perguntas de COMPREENSAO e APLICACAO. O estudante precisa entender relacoes entre conceitos.
    Exemplos: "Por que X causa Y segundo o documento?", "Qual e a diferenca entre A e B conforme explicado?"
  - "3" (AVANCADO): Perguntas de ANALISE e SINTESE. O estudante precisa conectar ideias e fazer inferencias.
    Exemplos: "Com base no conteudo, o que aconteceria se X fosse alterado?", "Qual conclusao pode ser tirada da relacao entre A e B?"

  Formato: { "q": "pergunta especifica?", "options": ["opcao correta", "distrator plausivel 1", "distrator plausivel 2", "distrator plausivel 3"], "answer": 0 }
  IMPORTANTE: Varie a posicao da resposta correta (answer: 0, 1, 2 ou 3) entre as perguntas!

- "studyTips": array com 5 dicas de estudo PRATICAS e ESPECIFICAS ao conteudo:
  Exemplos: "Dica: Faca um mapa mental conectando os conceitos de X, Y e Z mencionados no capitulo 2"
  NAO use dicas genericas como "estude mais" ou "preste atencao"

- "miniLessons": array com 5 paragrafos educativos (3-4 frases cada) que EXPLIQUEM conceitos-chave do documento de forma clara, como um professor explicaria para um aluno. Cada mini-licao deve cobrir um topico DIFERENTE.

FORMATO EXATO DE RESPOSTA:
{ "islands": [ { "name": "...", "theme": "...", "questions": { "1": [...], "2": [...], "3": [...] }, "studyTips": [...], "miniLessons": [...] } ] }

${documentsPrompt}`;

    const aiResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 8192,
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instructionText }
      ]
    });

    // Parse AI response
    let aiText = aiResponse.choices[0].message.content;
    // Try to extract JSON from response
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Erro ao processar resposta da IA.' });
    }

    let generated;
    try {
      generated = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return res.status(500).json({ error: 'Resposta da IA nao e JSON valido.' });
    }

    if (!generated.islands || !Array.isArray(generated.islands)) {
      return res.status(500).json({ error: 'Formato de resposta da IA invalido.' });
    }

    // Build archipelago
    const archId = 'arch_' + uuidv4().substring(0, 8);
    const archipelago = {
      id: archId,
      name: 'Arquipelago de ' + userData.name,
      createdAt: Date.now(),
      islands: generated.islands.map((isl, idx) => ({
        id: 'custom_' + idx + '_' + archId,
        name: isl.name || ('Ilha ' + (idx + 1)),
        theme: isl.theme || themes[idx % themes.length],
        category: 'custom_' + idx + '_' + archId,
        questions: isl.questions || { "1": [], "2": [], "3": [] },
        studyTips: isl.studyTips || [],
        miniLessons: isl.miniLessons || []
      })),
      // Per-archipelago isolated data
      profile: { xp: 0, level: 1, coins: 0 },
      quizHistory: [],
      stats: { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] },
      notes: {},
      achievements: [],
      progression: {}
    };

    // Initialize per-archipelago notes and progression per island
    archipelago.islands.forEach(isl => {
      archipelago.notes[isl.category] = '';
      archipelago.progression[isl.category] = 1;
    });

    // Save to user data
    if (!userData.archipelagos) userData.archipelagos = [];
    userData.archipelagos.push(archipelago);
    updateUserData(email, { archipelagos: userData.archipelagos });

    res.json({ ok: true, archipelago });

  } catch (err) {
    console.error('Archipelago creation error:', err);
    // Clean up files on error
    if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
    const errMsg = err.message || String(err);
    res.status(500).json({ error: 'Erro ao criar arquipelago: ' + errMsg });
  }
});

app.get('/api/archipelago/list', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email obrigatorio.' });
  const userData = getUserData(email);
  if (!userData) return res.json({ archipelagos: [] });
  res.json({ archipelagos: (userData.archipelagos || []).map(a => ({
    id: a.id, name: a.name, createdAt: a.createdAt,
    islands: (a.islands || []).map(i => ({ id: i.id, name: i.name, theme: i.theme }))
  }))});
});

app.get('/api/archipelago/:id', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email obrigatorio.' });
  const userData = getUserData(email);
  if (!userData) return res.status(404).json({ error: 'Usuario nao encontrado.' });
  const arch = (userData.archipelagos || []).find(a => a.id === req.params.id);
  if (!arch) return res.status(404).json({ error: 'Arquipelago nao encontrado.' });
  res.json({ archipelago: arch });
});

// ===============================================================
//  QUIZ QUESTION BANK (leveled: 1=Basic, 2=Intermediate, 3=Advanced)
// ===============================================================
const questions = {
  matematica: {
    1: [ // Nivel Basico
      { q: "Quanto e 2 + 3?", options: ["4", "5", "6", "7"], answer: 1 },
      { q: "Quanto e 5 x 2?", options: ["8", "10", "12", "15"], answer: 1 },
      { q: "Quanto e 10 - 4?", options: ["4", "5", "6", "7"], answer: 2 },
      { q: "Quanto e 8 / 2?", options: ["2", "3", "4", "5"], answer: 2 },
      { q: "Qual numero vem depois do 9?", options: ["8", "10", "11", "12"], answer: 1 },
    ],
    2: [ // Nivel Intermediario
      { q: "Quanto e 7 x 8?", options: ["54", "56", "58", "64"], answer: 1 },
      { q: "Raiz quadrada de 144?", options: ["10", "11", "12", "14"], answer: 2 },
      { q: "Quanto e 15% de 200?", options: ["25", "30", "35", "40"], answer: 1 },
      { q: "Quanto e 144 / 12?", options: ["10", "11", "12", "13"], answer: 2 },
      { q: "Quanto e 3! (fatorial)?", options: ["3", "6", "9", "12"], answer: 1 },
    ],
    3: [ // Nivel Avancado
      { q: "Qual e o valor de pi aproximado?", options: ["3.14", "2.71", "1.61", "3.41"], answer: 0 },
      { q: "2 ao cubo e igual a?", options: ["6", "8", "9", "12"], answer: 1 },
      { q: "Qual e o MMC de 4 e 6?", options: ["12", "24", "6", "8"], answer: 0 },
      { q: "Area de um quadrado de lado 5?", options: ["20", "25", "30", "10"], answer: 1 },
      { q: "Soma dos angulos de um triangulo?", options: ["90 graus", "180 graus", "270 graus", "360 graus"], answer: 1 },
    ]
  },
  historia: {
    1: [
      { q: "Em que ano o Brasil foi descoberto?", options: ["1498", "1500", "1502", "1510"], answer: 1 },
      { q: "Quem pintou a Mona Lisa?", options: ["Michelangelo", "Da Vinci", "Rafael", "Donatello"], answer: 1 },
      { q: "Egito Antigo ficava em qual continente?", options: ["Asia", "Europa", "Africa", "America"], answer: 2 },
      { q: "Quem proclamou a independencia do Brasil?", options: ["Tiradentes", "D. Pedro I", "D. Pedro II", "Getulio"], answer: 1 },
      { q: "A escravidao acabou no Brasil em?", options: ["1822", "1850", "1888", "1900"], answer: 2 },
    ],
    2: [
      { q: "Revolucao Francesa comecou em?", options: ["1776", "1789", "1799", "1804"], answer: 1 },
      { q: "Primeira Guerra Mundial comecou em?", options: ["1912", "1914", "1916", "1918"], answer: 1 },
      { q: "Quem foi o primeiro presidente do Brasil?", options: ["Getulio", "Deodoro", "Prudente", "Floriano"], answer: 1 },
      { q: "Imperio Romano caiu em que seculo?", options: ["III", "IV", "V", "VI"], answer: 2 },
      { q: "Guerra Fria foi entre?", options: ["EUA e China", "EUA e URSS", "EUA e Japao", "EUA e UK"], answer: 1 },
    ],
    3: [
      { q: "Tratado de Tordesilhas foi em?", options: ["1492", "1494", "1500", "1502"], answer: 1 },
      { q: "Quem liderou a Revolucao Russa?", options: ["Stalin", "Lenin", "Marx", "Trotsky"], answer: 1 },
      { q: "Muro de Berlim caiu em?", options: ["1985", "1987", "1989", "1991"], answer: 2 },
      { q: "Revolucao Industrial comecou em qual pais?", options: ["Franca", "Alemanha", "Inglaterra", "EUA"], answer: 2 },
      { q: "Qual civilizacao inventou a escrita?", options: ["Egipcia", "Grega", "Sumerios", "Romana"], answer: 2 },
    ]
  },
  ciencias: {
    1: [
      { q: "Qual e a formula da agua?", options: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },
      { q: "Qual planeta e o maior do sistema solar?", options: ["Saturno", "Jupiter", "Netuno", "Urano"], answer: 1 },
      { q: "Fotossintese produz?", options: ["CO2", "Oxigenio", "Nitrogenio", "Metano"], answer: 1 },
      { q: "Quantos ossos tem o corpo humano?", options: ["106", "156", "206", "256"], answer: 2 },
      { q: "Qual orgao produz insulina?", options: ["Figado", "Pancreas", "Rim", "Coracao"], answer: 1 },
    ],
    2: [
      { q: "Velocidade da luz (km/s)?", options: ["150.000", "200.000", "300.000", "400.000"], answer: 2 },
      { q: "DNA significa?", options: ["Acido desoxirribonucleico", "Acido dinucleico", "Acido dioxirribo", "Adenina nucleica"], answer: 0 },
      { q: "Qual e o elemento mais abundante no universo?", options: ["Oxigenio", "Carbono", "Hidrogenio", "Helio"], answer: 2 },
      { q: "Unidade de forca no SI?", options: ["Watt", "Joule", "Newton", "Pascal"], answer: 2 },
      { q: "Quantos cromossomos tem um humano?", options: ["23", "44", "46", "48"], answer: 2 },
    ],
    3: [
      { q: "Qual particula tem carga negativa?", options: ["Proton", "Neutron", "Electron", "Foton"], answer: 2 },
      { q: "Lei da gravidade e de?", options: ["Einstein", "Newton", "Galileu", "Kepler"], answer: 1 },
      { q: "Qual e o gas nobre mais leve?", options: ["Neonio", "Helio", "Argonio", "Xenonio"], answer: 1 },
      { q: "Mitocondria e responsavel por?", options: ["Digestao", "Energia", "Protecao", "Reproducao"], answer: 1 },
      { q: "Tabela periodica foi criada por?", options: ["Bohr", "Lavoisier", "Mendeleev", "Dalton"], answer: 2 },
    ]
  },
  linguas: {
    1: [
      { q: "'Hello' em japones?", options: ["Annyeong", "Konnichiwa", "Ni hao", "Sawadee"], answer: 1 },
      { q: "'Obrigado' em frances?", options: ["Grazie", "Merci", "Danke", "Gracias"], answer: 1 },
      { q: "'Amor' em italiano?", options: ["Amore", "Amour", "Liebe", "Love"], answer: 0 },
      { q: "'Bom dia' em alemao?", options: ["Bonjour", "Guten Morgen", "Buenos dias", "Buongiorno"], answer: 1 },
      { q: "'Goodbye' em espanhol?", options: ["Au revoir", "Adios", "Tschuss", "Arrivederci"], answer: 1 },
    ],
    2: [
      { q: "Qual idioma tem mais falantes nativos?", options: ["Ingles", "Espanhol", "Mandarim", "Hindi"], answer: 2 },
      { q: "Quantas letras tem o alfabeto ingles?", options: ["24", "25", "26", "27"], answer: 2 },
      { q: "Qual lingua usa o alfabeto cirilico?", options: ["Grego", "Russo", "Arabe", "Japones"], answer: 1 },
      { q: "Plural de 'child' em ingles?", options: ["Childs", "Childrens", "Children", "Childes"], answer: 2 },
      { q: "O esperanto foi criado por?", options: ["Chomsky", "Zamenhof", "Tolkien", "Saussure"], answer: 1 },
    ],
    3: [
      { q: "Quantos tons tem o mandarim?", options: ["2", "3", "4", "5"], answer: 2 },
      { q: "Qual familia linguistica do portugues?", options: ["Germanica", "Romanica", "Eslava", "Celtica"], answer: 1 },
      { q: "Hiragana e Katakana sao de qual lingua?", options: ["Chines", "Coreano", "Japones", "Tailandes"], answer: 2 },
      { q: "Lingua mais falada na Africa?", options: ["Arabe", "Suaili", "Frances", "Ingles"], answer: 0 },
      { q: "Qual lingua tem mais palavras?", options: ["Chines", "Ingles", "Arabe", "Espanhol"], answer: 1 },
    ]
  },
  programacao: {
    1: [
      { q: "O que HTML significa?", options: ["HyperText Markup Language", "High Tech ML", "HyperTransfer ML", "Home Tool ML"], answer: 0 },
      { q: "Qual NAO e linguagem de programacao?", options: ["Python", "Java", "HTML", "C++"], answer: 2 },
      { q: "O que CSS controla?", options: ["Logica", "Estilo visual", "Banco de dados", "Servidor"], answer: 1 },
      { q: "Git e usado para?", options: ["Design", "Versionamento", "Compilacao", "Teste"], answer: 1 },
      { q: "O que e um array?", options: ["Uma funcao", "Uma lista ordenada", "Um estilo", "Um servidor"], answer: 1 },
    ],
    2: [
      { q: "console.log() e de qual linguagem?", options: ["Python", "Java", "JavaScript", "C#"], answer: 2 },
      { q: "Qual e o operador de igualdade estrita em JS?", options: ["==", "===", "!=", ">="], answer: 1 },
      { q: "Python e tipagem?", options: ["Estatica", "Dinamica", "Nenhuma", "Fixa"], answer: 1 },
      { q: "SQL e usado para?", options: ["Estilo", "Banco de dados", "Animacao", "Rede"], answer: 1 },
      { q: "Localhost geralmente usa porta?", options: ["80", "443", "3000", "8080"], answer: 2 },
    ],
    3: [
      { q: "O que e recursao?", options: ["Loop infinito", "Funcao que chama a si mesma", "Tipo de variavel", "Metodo de ordenacao"], answer: 1 },
      { q: "Big O de busca binaria?", options: ["O(n)", "O(log n)", "O(n2)", "O(1)"], answer: 1 },
      { q: "REST usa qual protocolo?", options: ["FTP", "SSH", "HTTP", "SMTP"], answer: 2 },
      { q: "O que e uma API?", options: ["Um banco de dados", "Uma interface de programacao", "Um compilador", "Um sistema operacional"], answer: 1 },
      { q: "Docker usa qual conceito?", options: ["Maquinas virtuais", "Containers", "Threads", "Sockets"], answer: 1 },
    ]
  }
};

// ===============================================================
//  ACHIEVEMENTS
// ===============================================================
const ACHIEVEMENTS = [
  // First Steps
  { id: 'first_correct', name: 'Primeiro Acerto', desc: 'Acertou sua primeira pergunta', icon: '⭐', category: 'geral' },
  { id: 'first_duel_win', name: 'Duelista', desc: 'Venceu seu primeiro duelo', icon: '⚔️', category: 'geral' },

  // Subject Mastery
  { id: 'math_5', name: 'Aprendiz de Matematica', desc: 'Acertou 5 perguntas de Matematica', icon: '🔢', category: 'matematica' },
  { id: 'math_20', name: 'Mestre da Matematica', desc: 'Acertou 20 perguntas de Matematica', icon: '🧮', category: 'matematica' },
  { id: 'hist_5', name: 'Aprendiz de Historia', desc: 'Acertou 5 perguntas de Historia', icon: '📜', category: 'historia' },
  { id: 'hist_20', name: 'Mestre da Historia', desc: 'Acertou 20 perguntas de Historia', icon: '🏛️', category: 'historia' },
  { id: 'sci_5', name: 'Aprendiz de Ciencias', desc: 'Acertou 5 perguntas de Ciencias', icon: '🔬', category: 'ciencias' },
  { id: 'sci_20', name: 'Mestre das Ciencias', desc: 'Acertou 20 perguntas de Ciencias', icon: '🧬', category: 'ciencias' },
  { id: 'lang_5', name: 'Aprendiz de Linguas', desc: 'Acertou 5 perguntas de Linguas', icon: '💬', category: 'linguas' },
  { id: 'lang_20', name: 'Mestre das Linguas', desc: 'Acertou 20 perguntas de Linguas', icon: '🌍', category: 'linguas' },
  { id: 'prog_5', name: 'Aprendiz de Programacao', desc: 'Acertou 5 perguntas de Programacao', icon: '💻', category: 'programacao' },
  { id: 'prog_20', name: 'Mestre da Programacao', desc: 'Acertou 20 perguntas de Programacao', icon: '🤖', category: 'programacao' },

  // Milestones
  { id: 'correct_10', name: 'Estudante Dedicado', desc: 'Acertou 10 perguntas no total', icon: '📚', category: 'geral' },
  { id: 'correct_50', name: 'Sabio', desc: 'Acertou 50 perguntas no total', icon: '🎓', category: 'geral' },
  { id: 'correct_100', name: 'Iluminado', desc: 'Acertou 100 perguntas no total', icon: '💡', category: 'geral' },
  { id: 'level_5', name: 'Aventureiro', desc: 'Alcancou nivel 5', icon: '🗺️', category: 'geral' },
  { id: 'level_10', name: 'Veterano', desc: 'Alcancou nivel 10', icon: '👑', category: 'geral' },
  { id: 'duels_5', name: 'Campeao', desc: 'Venceu 5 duelos', icon: '🏅', category: 'geral' },
  { id: 'duels_10', name: 'Imbativel', desc: 'Venceu 10 duelos', icon: '🏆', category: 'geral' },
  { id: 'chest_opener', name: 'Cacador de Tesouros', desc: 'Abriu 10 baus de tesouro', icon: '📦', category: 'geral' },
  { id: 'explorer', name: 'Explorador', desc: 'Visitou todas as 6 ilhas', icon: '🧭', category: 'geral' },
  { id: 'noter', name: 'Anotador', desc: 'Escreveu notas em todas as materias', icon: '✏️', category: 'geral' },
];

function buildCustomAchievements(arch) {
  const list = [
    { id: 'first_correct', name: 'Primeiro Acerto', desc: 'Acertou sua primeira pergunta', icon: '⭐', category: 'geral' },
    { id: 'first_duel_win', name: 'Duelista', desc: 'Venceu seu primeiro duelo', icon: '⚔️', category: 'geral' },
    { id: 'correct_10', name: 'Estudante Dedicado', desc: 'Acertou 10 perguntas no total', icon: '📚', category: 'geral' },
    { id: 'correct_50', name: 'Sabio', desc: 'Acertou 50 perguntas no total', icon: '🎓', category: 'geral' },
    { id: 'level_5', name: 'Aventureiro', desc: 'Alcancou nivel 5', icon: '🗺️', category: 'geral' },
    { id: 'level_10', name: 'Veterano', desc: 'Alcancou nivel 10', icon: '👑', category: 'geral' },
    { id: 'duels_5', name: 'Campeao', desc: 'Venceu 5 duelos', icon: '🏅', category: 'geral' },
  ];
  if (arch && arch.islands) {
    arch.islands.forEach((isl, idx) => {
      list.push({
        id: 'island_' + idx + '_5',
        name: 'Estudante de ' + isl.name,
        desc: 'Acertou 5 perguntas em ' + isl.name,
        icon: '📖',
        category: isl.category
      });
      list.push({
        id: 'island_' + idx + '_master',
        name: 'Mestre de ' + isl.name,
        desc: 'Completou todos os niveis em ' + isl.name,
        icon: '🏆',
        category: isl.category
      });
    });
    list.push({
      id: 'all_mastered',
      name: 'Mestre Total',
      desc: 'Completou todos os niveis em todas as ilhas!',
      icon: '👑',
      category: 'geral'
    });
    list.push({
      id: 'noter',
      name: 'Anotador',
      desc: 'Escreveu notas em todas as materias',
      icon: '✏️',
      category: 'geral'
    });
  }
  return list;
}

function checkAchievements(email, socketId) {
  const p = players[socketId];
  const userData = getUserData(email);
  if (!userData) return;

  const archId = (p && p.archipelagoId) ? p.archipelagoId : 'classic';
  let history, stats, notes, currentAchievements, prog;

  if (archId !== 'classic') {
    const arch = (userData.archipelagos || []).find(a => a.id === archId);
    if (!arch) return;
    history = arch.quizHistory || [];
    stats = arch.stats || {};
    notes = arch.notes || {};
    currentAchievements = arch.achievements || [];
    prog = arch.progression || {};
  } else {
    history = userData.quizHistory || [];
    stats = userData.stats || {};
    notes = userData.notes || {};
    currentAchievements = userData.achievements || [];
    prog = userData.progression || {};
  }

  const newAchievements = [];

  // Universal achievement checks
  const checks = {
    'first_correct': () => (stats.totalCorrect || 0) >= 1,
    'first_duel_win': () => (stats.totalDuelsWon || 0) >= 1,
    'correct_10': () => (stats.totalCorrect || 0) >= 10,
    'correct_50': () => (stats.totalCorrect || 0) >= 50,
    'duels_5': () => (stats.totalDuelsWon || 0) >= 5,
    'level_5': () => (p && p.level >= 5) || false,
    'level_10': () => (p && p.level >= 10) || false,
  };

  if (archId !== 'classic') {
    // Dynamic per-island achievements for custom archipelago
    const arch = (userData.archipelagos || []).find(a => a.id === archId);
    if (arch && arch.islands) {
      arch.islands.forEach((isl, idx) => {
        const cat = isl.category;
        checks['island_' + idx + '_5'] = () => history.filter(q => q.category === cat && q.correct).length >= 5;
        checks['island_' + idx + '_master'] = () => (prog[cat] || 1) >= 3;
      });
      checks['all_mastered'] = () => arch.islands.every(isl => (prog[isl.category] || 1) >= 3);
      checks['noter'] = () => arch.islands.every(isl => notes[isl.category] && notes[isl.category].trim().length > 0);
    }
  } else {
    // Classic-mode achievements
    function correctInCat(cat) { return history.filter(q => q.category === cat && q.correct).length; }
    checks['math_5'] = () => correctInCat('matematica') >= 5;
    checks['math_20'] = () => correctInCat('matematica') >= 20;
    checks['hist_5'] = () => correctInCat('historia') >= 5;
    checks['hist_20'] = () => correctInCat('historia') >= 20;
    checks['sci_5'] = () => correctInCat('ciencias') >= 5;
    checks['sci_20'] = () => correctInCat('ciencias') >= 20;
    checks['lang_5'] = () => correctInCat('linguas') >= 5;
    checks['lang_20'] = () => correctInCat('linguas') >= 20;
    checks['prog_5'] = () => correctInCat('programacao') >= 5;
    checks['prog_20'] = () => correctInCat('programacao') >= 20;
    checks['correct_100'] = () => (stats.totalCorrect || 0) >= 100;
    checks['duels_10'] = () => (stats.totalDuelsWon || 0) >= 10;
    checks['chest_opener'] = () => history.filter(q => q.source === 'chest' && q.correct).length >= 10;
    checks['explorer'] = () => (stats.islandsVisited || []).length >= 6;
    checks['noter'] = () => Object.values(notes).filter(n => n && n.trim().length > 0).length >= 5;
  }

  for (const [id, check] of Object.entries(checks)) {
    if (!currentAchievements.includes(id) && check()) {
      currentAchievements.push(id);
      newAchievements.push(id);
    }
  }

  if (newAchievements.length > 0) {
    if (archId !== 'classic') {
      const arch = (userData.archipelagos || []).find(a => a.id === archId);
      if (arch) {
        arch.achievements = currentAchievements;
        updateUserData(email, { archipelagos: userData.archipelagos });
      }
    } else {
      updateUserData(email, { achievements: currentAchievements });
    }

    newAchievements.forEach(achId => {
      let ach = ACHIEVEMENTS.find(a => a.id === achId);
      if (!ach && archId !== 'classic') {
        // Build dynamic achievement label for custom archipelago
        const archData = (userData.archipelagos || []).find(a => a.id === archId);
        if (achId === 'all_mastered') {
          ach = { id: achId, name: 'Mestre Total', desc: 'Completou todos os niveis em todas as ilhas!', icon: '👑', category: 'geral' };
        } else if (achId === 'noter') {
          ach = { id: achId, name: 'Anotador', desc: 'Escreveu notas em todas as materias', icon: '✏️', category: 'geral' };
        } else if (achId.startsWith('island_') && achId.endsWith('_5')) {
          const idx = parseInt(achId.split('_')[1]);
          const islName = archData && archData.islands[idx] ? archData.islands[idx].name : 'Ilha ' + (idx + 1);
          ach = { id: achId, name: 'Estudante de ' + islName, desc: 'Acertou 5 perguntas em ' + islName, icon: '📚', category: 'ilha' };
        } else if (achId.startsWith('island_') && achId.endsWith('_master')) {
          const idx = parseInt(achId.split('_')[1]);
          const islName = archData && archData.islands[idx] ? archData.islands[idx].name : 'Ilha ' + (idx + 1);
          ach = { id: achId, name: 'Mestre de ' + islName, desc: 'Completou todos os niveis em ' + islName, icon: '🏆', category: 'ilha' };
        }
      }
      if (ach) {
        io.to(socketId).emit('achievementUnlocked', ach);
      }
    });
  }
}

// ===============================================================
//  GAME CONSTANTS
// ===============================================================
const MAP_W = 6000;
const MAP_H = 6000;

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
  { id: 'matematica', name: 'Ilha da Matematica', x: 3000, y: 1200, rx: 608, ry: 512, category: 'matematica', theme: 'blue',
    points: [
      {x: -560, y: -80}, {x: -496, y: -304}, {x: -320, y: -448}, {x: -96, y: -496},
      {x: 128, y: -464}, {x: 320, y: -416}, {x: 496, y: -320}, {x: 576, y: -128},
      {x: 592, y: 80}, {x: 544, y: 256}, {x: 448, y: 384}, {x: 256, y: 480},
      {x: 48, y: 448}, {x: -160, y: 496}, {x: -352, y: 416}, {x: -528, y: 272},
      {x: -592, y: 96}
    ]
  },
  { id: 'historia', name: 'Ilha da Historia', x: 4712, y: 2444, rx: 608, ry: 512, category: 'historia', theme: 'brown',
    points: [
      {x: -544, y: -160}, {x: -448, y: -384}, {x: -224, y: -480}, {x: 32, y: -448},
      {x: 240, y: -496}, {x: 448, y: -400}, {x: 576, y: -208}, {x: 592, y: 32},
      {x: 528, y: 224}, {x: 400, y: 400}, {x: 192, y: 464}, {x: -48, y: 496},
      {x: -288, y: 432}, {x: -480, y: 288}, {x: -592, y: 80}, {x: -576, y: -48}
    ]
  },
  { id: 'ciencias', name: 'Ilha das Ciencias', x: 1288, y: 2444, rx: 640, ry: 544, category: 'ciencias', theme: 'green',
    points: [
      {x: -608, y: -48}, {x: -544, y: -288}, {x: -384, y: -464}, {x: -144, y: -528},
      {x: 96, y: -496}, {x: 288, y: -544}, {x: 480, y: -432}, {x: 608, y: -224},
      {x: 624, y: 16}, {x: 576, y: 240}, {x: 416, y: 432}, {x: 208, y: 512},
      {x: -32, y: 544}, {x: -256, y: 480}, {x: -464, y: 352}, {x: -608, y: 176},
      {x: -640, y: -16}
    ]
  },
  { id: 'linguas', name: 'Ilha das Linguas', x: 1942, y: 4456, rx: 608, ry: 512, category: 'linguas', theme: 'purple',
    points: [
      {x: -496, y: -224}, {x: -352, y: -432}, {x: -112, y: -496}, {x: 144, y: -480},
      {x: 368, y: -384}, {x: 544, y: -224}, {x: 592, y: 0}, {x: 560, y: 208},
      {x: 448, y: 368}, {x: 272, y: 448}, {x: 64, y: 512}, {x: -192, y: 464},
      {x: -400, y: 352}, {x: -560, y: 160}, {x: -592, y: -48}
    ]
  },
  { id: 'programacao', name: 'Ilha da Programacao', x: 4058, y: 4456, rx: 608, ry: 512, category: 'programacao', theme: 'neon',
    points: [
      {x: -576, y: -128}, {x: -480, y: -336}, {x: -272, y: -464}, {x: -32, y: -512},
      {x: 208, y: -448}, {x: 416, y: -480}, {x: 560, y: -304}, {x: 608, y: -80},
      {x: 576, y: 128}, {x: 480, y: 304}, {x: 288, y: 432}, {x: 64, y: 496},
      {x: -176, y: 464}, {x: -384, y: 368}, {x: -544, y: 192}, {x: -608, y: -16}
    ]
  },
  { id: 'central', name: 'Ilha Central', x: 3000, y: 3000, rx: 720, ry: 608, category: null, theme: 'gold',
    points: [
      {x: -688, y: -96}, {x: -624, y: -320}, {x: -448, y: -512}, {x: -208, y: -592},
      {x: 48, y: -576}, {x: 272, y: -544}, {x: 496, y: -448}, {x: 672, y: -256},
      {x: 704, y: -32}, {x: 688, y: 192}, {x: 592, y: 400}, {x: 400, y: 544},
      {x: 160, y: 592}, {x: -80, y: 608}, {x: -320, y: 544}, {x: -528, y: 400},
      {x: -672, y: 208}, {x: -720, y: 0}
    ]
  }
];

// Bridges connecting islands - star/pentagon pattern
const bridges = [
  // Pentagon outer ring
  { from: 'matematica', to: 'historia' },
  { from: 'historia', to: 'programacao' },
  { from: 'programacao', to: 'linguas' },
  { from: 'linguas', to: 'ciencias' },
  { from: 'ciencias', to: 'matematica' },
  // Star spokes to center
  { from: 'matematica', to: 'central' },
  { from: 'historia', to: 'central' },
  { from: 'programacao', to: 'central' },
  { from: 'linguas', to: 'central' },
  { from: 'ciencias', to: 'central' }
];

// Quiz totems per island (zone-based placement)
const totems = [];
islands.forEach(isl => {
  if (!isl.category) {
    // Central island: 5 totems, one per category
    const cats = ['matematica', 'historia', 'ciencias', 'linguas', 'programacao'];
    cats.forEach((cat, i) => {
      const angle = (i / cats.length) * Math.PI * 2;
      totems.push({
        id: 'totem_' + isl.id + '_' + i,
        x: isl.x + Math.cos(angle) * isl.rx * 0.5,
        y: isl.y + Math.sin(angle) * isl.ry * 0.5,
        category: cat,
        island: isl.id,
        zone: 1
      });
    });
  } else {
    // Zone 1 - outer ring (basic)
    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI * 2 + 0.3;
      totems.push({
        id: 'totem_' + isl.id + '_z1_' + i,
        x: isl.x + Math.cos(angle) * isl.rx * 0.7,
        y: isl.y + Math.sin(angle) * isl.ry * 0.7,
        category: isl.category,
        island: isl.id,
        zone: 1
      });
    }
    // Zone 2 - middle ring (intermediate)
    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI * 2 + 1.2;
      totems.push({
        id: 'totem_' + isl.id + '_z2_' + i,
        x: isl.x + Math.cos(angle) * isl.rx * 0.45,
        y: isl.y + Math.sin(angle) * isl.ry * 0.45,
        category: isl.category,
        island: isl.id,
        zone: 2
      });
    }
    // Zone 3 - center (advanced)
    totems.push({
      id: 'totem_' + isl.id + '_z3_0',
      x: isl.x,
      y: isl.y,
      category: isl.category,
      island: isl.id,
      zone: 3
    });
  }
});

// ===============================================================
//  TREASURE CHESTS (zone-based: 1 per zone)
// ===============================================================
const chests = [];
islands.forEach(isl => {
  if (!isl.category) return; // skip central island
  // Zone 1 chest (outer)
  const z1Angle = 0.9;
  chests.push({
    id: 'chest_' + isl.id + '_z1',
    x: isl.x + Math.cos(z1Angle) * isl.rx * 0.65,
    y: isl.y + Math.sin(z1Angle) * isl.ry * 0.65,
    category: isl.category,
    island: isl.id,
    zone: 1,
    openedBy: {},
    respawnTime: 60000
  });
  // Zone 2 chest (middle)
  const z2Angle = 2.5;
  chests.push({
    id: 'chest_' + isl.id + '_z2',
    x: isl.x + Math.cos(z2Angle) * isl.rx * 0.4,
    y: isl.y + Math.sin(z2Angle) * isl.ry * 0.4,
    category: isl.category,
    island: isl.id,
    zone: 2,
    openedBy: {},
    respawnTime: 60000
  });
  // Zone 3 chest (inner, near center)
  const z3Angle = 4.1;
  chests.push({
    id: 'chest_' + isl.id + '_z3',
    x: isl.x + Math.cos(z3Angle) * isl.rx * 0.15,
    y: isl.y + Math.sin(z3Angle) * isl.ry * 0.15,
    category: isl.category,
    island: isl.id,
    zone: 3,
    openedBy: {},
    respawnTime: 60000
  });
});

// ===============================================================
//  INFO SIGNS
// ===============================================================
const studyTips = {
  matematica: [
    "Dica: Pratique tabuada todos os dias por 5 minutos!",
    "Dica: Desenhe figuras geometricas para entender melhor!",
    "Dica: Use a calculadora para conferir, nao para resolver!"
  ],
  historia: [
    "Dica: Crie uma linha do tempo para memorizar datas!",
    "Dica: Associe eventos historicos a historias e personagens!",
    "Dica: Assista documentarios para fixar o conteudo!"
  ],
  ciencias: [
    "Dica: Faca experimentos simples em casa para aprender!",
    "Dica: Conecte a ciencia ao seu dia a dia!",
    "Dica: Desenhe diagramas para entender processos!"
  ],
  linguas: [
    "Dica: Ouca musicas em outros idiomas com a letra!",
    "Dica: Pratique 10 palavras novas por dia!",
    "Dica: Assista filmes com legendas no idioma original!"
  ],
  programacao: [
    "Dica: Escreva codigo todos os dias, mesmo que pouco!",
    "Dica: Leia codigo de outros programadores para aprender!",
    "Dica: Divida problemas grandes em pedacos menores!"
  ]
};

const infoSigns = [];
islands.forEach(isl => {
  if (!isl.category) return;
  // Zone 1 sign (outer)
  const s1Angle = 2.0;
  infoSigns.push({
    id: 'sign_' + isl.id + '_z1',
    x: isl.x + Math.cos(s1Angle) * isl.rx * 0.65,
    y: isl.y + Math.sin(s1Angle) * isl.ry * 0.65,
    category: isl.category,
    island: isl.id,
    zone: 1,
    tipIndex: 0
  });
  // Zone 2 sign (middle)
  const s2Angle = 3.6;
  infoSigns.push({
    id: 'sign_' + isl.id + '_z2',
    x: isl.x + Math.cos(s2Angle) * isl.rx * 0.38,
    y: isl.y + Math.sin(s2Angle) * isl.ry * 0.38,
    category: isl.category,
    island: isl.id,
    zone: 2,
    tipIndex: 1
  });
});

// ===============================================================
//  TELEPORT PORTALS (on central island, linking to subject islands)
// ===============================================================
const portals = [];
const portalCategories = ['matematica', 'historia', 'ciencias', 'linguas', 'programacao'];
portalCategories.forEach((cat, i) => {
  const angle = (i / portalCategories.length) * Math.PI * 2 - Math.PI / 2;
  const targetIsland = islands.find(isl => isl.id === cat);
  portals.push({
    id: 'portal_' + cat,
    x: islands.find(isl => isl.id === 'central').x + Math.cos(angle) * 250,
    y: islands.find(isl => isl.id === 'central').y + Math.sin(angle) * 250,
    category: cat,
    targetX: targetIsland.x,
    targetY: targetIsland.y,
    label: targetIsland.name
  });
});

// ===============================================================
//  MINI LESSONS (for totem interactions)
// ===============================================================
const miniLessons = {
  matematica: [
    "A soma dos angulos internos de qualquer triangulo e sempre 180 graus.",
    "O numero Pi (pi ~= 3.14159) e a razao entre a circunferencia e o diametro de um circulo.",
    "Numeros primos so sao divisiveis por 1 e por eles mesmos."
  ],
  historia: [
    "A Revolucao Francesa de 1789 introduziu os principios de Liberdade, Igualdade e Fraternidade.",
    "O Imperio Romano durou mais de 1.000 anos e influenciou direito, lingua e cultura ocidental.",
    "A Revolucao Industrial transformou a producao manual em mecanizada no seculo XVIII."
  ],
  ciencias: [
    "A fotossintese converte luz solar, agua e CO2 em glicose e oxigenio.",
    "A Lei da Gravitacao Universal de Newton descreve a forca de atracao entre corpos massivos.",
    "O DNA carrega a informacao genetica em uma dupla helice de nucleotideos."
  ],
  linguas: [
    "O Mandarim e o idioma com mais falantes nativos do mundo, com mais de 1 bilhao.",
    "O latim e considerado lingua-mae das linguas romanicas: portugues, espanhol, frances, italiano.",
    "A linguagem corporal e responsavel por mais de 55% da comunicacao humana."
  ],
  programacao: [
    "Algoritmos sao sequencias de instrucoes logicas para resolver um problema.",
    "O conceito de 'bug' em programacao vem literalmente de um inseto encontrado num computador em 1947.",
    "A internet foi criada pelo CERN em 1989 por Tim Berners-Lee como a World Wide Web."
  ]
};

// ===============================================================
//  GAME STATE
// ===============================================================
const players = {};   // socketId -> player data
const enemies = {};   // id -> enemy data
const bullets = [];   // { id, ownerId, x, y, vx, vy, dist, maxDist, color }
const activeQuizzes = {}; // socketId -> { enemyId, questionIndex, category, timestamp, totemId, chestId }

const activeDuels = {}; // duelId -> { challengerId, targetId, question, category, startTime, answers: {} }
const pendingDuels = {}; // targetSocketId -> { challengerId, challengerName, duelId, timestamp }
let duelIdCounter = 0;
const DUEL_TIME_LIMIT = 30000; // 30 seconds

let enemyIdCounter = 0;
const MAX_ENEMIES = 12;
const ENEMY_SPAWN_INTERVAL = 8000;
const QUIZ_TIME_LIMIT = 60000; // 60 seconds – safety net; quiz closes when player answers

function pointInPolygon(px, py, polygon) {
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
      if (pointInPolygon(x, y, absPoints)) return isl;
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
    if (perpDist < 40) return true; // bridge width
  }
  return false;
}

function isOnLand(x, y) {
  return isOnIsland(x, y) || isOnBridge(x, y);
}

function randomSpawnOnIsland() {
  const isl = islands[Math.floor(Math.random() * islands.length)];
  if (isl.points) {
    // Use rejection sampling within bounding box of polygon
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = isl.x + (Math.random() - 0.5) * isl.rx * 1.6;
      const y = isl.y + (Math.random() - 0.5) * isl.ry * 1.6;
      const absPoints = isl.points.map(p => ({ x: isl.x + p.x, y: isl.y + p.y }));
      if (pointInPolygon(x, y, absPoints)) return { x, y };
    }
  }
  // Fallback to ellipse
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * 0.4;
  return {
    x: isl.x + Math.cos(angle) * isl.rx * r,
    y: isl.y + Math.sin(angle) * isl.ry * r
  };
}

function getRandomQuestion(category, level, player) {
  level = level || 1;
  let pool = null;

  // Get the question pool (custom archipelago takes priority)
  if (player && player.customArch) {
    const customIsland = player.customArch.islands.find(i => i.category === category);
    if (customIsland && customIsland.questions && customIsland.questions[level]) {
      pool = customIsland.questions[level];
    }
  }
  if (!pool) {
    const catPool = questions[category];
    if (!catPool) return null;
    pool = catPool[level];
    if (!pool || pool.length === 0) return null;
  }

  // Filter out recently asked questions to avoid repeats
  let filteredPool = pool;
  if (player && player.recentQuestions) {
    const available = pool.filter((q, idx) => {
      const key = category + '_' + level + '_' + idx;
      return !player.recentQuestions.has(key);
    });
    // If all questions have been asked, reset history and use full pool
    if (available.length === 0) {
      player.recentQuestions.clear();
    } else {
      filteredPool = available;
    }
  }

  const idx = Math.floor(Math.random() * filteredPool.length);
  const question = filteredPool[idx];

  // Find the original index in the full pool for consistent tracking
  let originalIdx = pool.indexOf(question);
  if (originalIdx === -1) originalIdx = idx;

  // Track this question so it won't repeat soon
  if (player && player.recentQuestions) {
    const key = category + '_' + level + '_' + originalIdx;
    player.recentQuestions.add(key);
  }

  return { index: originalIdx, level: level, ...question };
}

function checkProgression(email, category, archId) {
  const userData = getUserData(email);
  if (!userData || !category) return;

  let prog, history;
  if (archId && archId !== 'classic') {
    const arch = (userData.archipelagos || []).find(a => a.id === archId);
    if (!arch) return;
    prog = arch.progression || {};
    history = arch.quizHistory || [];
  } else {
    if (!userData.progression) {
      userData.progression = { matematica: 1, historia: 1, ciencias: 1, linguas: 1, programacao: 1 };
    }
    prog = userData.progression;
    history = userData.quizHistory || [];
  }

  const currentLevel = prog[category] || 1;
  if (currentLevel >= 3) return null; // already maxed

  // Count correct answers at current level for this category
  const correctAtLevel = history.filter(
    q => q.category === category && q.correct && q.level === currentLevel
  ).length;

  if (correctAtLevel >= 3) {
    prog[category] = currentLevel + 1;
    if (archId && archId !== 'classic') {
      const arch = (userData.archipelagos || []).find(a => a.id === archId);
      if (arch) {
        arch.progression = prog;
        updateUserData(email, { archipelagos: userData.archipelagos });
      }
    } else {
      updateUserData(email, { progression: prog });
    }
    return currentLevel + 1; // return new level
  }
  return null;
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

  const isBoss = Math.random() < 0.08;

  // Spawn at a valid position within the polygon
  let spawnX, spawnY;
  if (isl.points) {
    const absPoints = isl.points.map(p => ({ x: isl.x + p.x, y: isl.y + p.y }));
    for (let attempt = 0; attempt < 50; attempt++) {
      const tx = isl.x + (Math.random() - 0.5) * isl.rx * 1.4;
      const ty = isl.y + (Math.random() - 0.5) * isl.ry * 1.4;
      if (pointInPolygon(tx, ty, absPoints)) { spawnX = tx; spawnY = ty; break; }
    }
    if (spawnX === undefined) { spawnX = isl.x; spawnY = isl.y; }
  } else {
    const angle = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.5;
    spawnX = isl.x + Math.cos(angle) * isl.rx * r;
    spawnY = isl.y + Math.sin(angle) * isl.ry * r;
  }

  const id = 'e' + (++enemyIdCounter);
  enemies[id] = {
    id,
    x: spawnX,
    y: spawnY,
    hp: isBoss ? 6 : 3,
    maxHp: isBoss ? 6 : 3,
    type: isBoss ? 'boss' : 'normal',
    speed: isBoss ? 0.5 : 0.7,
    size: isBoss ? 28 : 16,
    island: isl.id,
    patrolAngle: Math.random() * Math.PI * 2,
    patrolCenterX: (spawnX + isl.x) / 2,
    patrolCenterY: (spawnY + isl.y) / 2,
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
//  DUEL RESOLUTION
// ===============================================================
function resolveDuel(duelId) {
  const duel = activeDuels[duelId];
  if (!duel) return;

  const cAnswer = duel.answers[duel.challengerId];
  const tAnswer = duel.answers[duel.targetId];
  const challenger = players[duel.challengerId];
  const target = players[duel.targetId];

  const correctText = duel.question.options[duel.correctAnswer];

  let winnerId = null;
  let loserId = null;

  if (cAnswer.correct && !tAnswer.correct) {
    winnerId = duel.challengerId;
    loserId = duel.targetId;
  } else if (!cAnswer.correct && tAnswer.correct) {
    winnerId = duel.targetId;
    loserId = duel.challengerId;
  } else if (cAnswer.correct && tAnswer.correct) {
    // Both correct - faster wins
    winnerId = cAnswer.time <= tAnswer.time ? duel.challengerId : duel.targetId;
    loserId = winnerId === duel.challengerId ? duel.targetId : duel.challengerId;
  }
  // else both wrong - no winner

  const xpWin = 25;
  const coinsWin = 10;
  const damageLose = 10;

  if (winnerId && loserId) {
    const winner = players[winnerId];
    const loser = players[loserId];
    if (winner) {
      winner.xp += xpWin;
      winner.coins += coinsWin;
      winner.score += xpWin;
      const newLevel = Math.floor(winner.xp / 100) + 1;
      if (newLevel > winner.level) {
        winner.level = newLevel;
        winner.health = 100;
        io.emit('levelUp', { level: winner.level, name: winner.name });
      }
    }
    if (loser) {
      loser.health = Math.max(0, loser.health - damageLose);
      if (loser.health <= 0) {
        io.to(loserId).emit('dead');
        io.emit('killfeed', { text: loser.name + ' foi derrotado no duelo!' });
      }
    }

    io.to(winnerId).emit('duelResult', {
      won: true, xp: xpWin, coins: coinsWin, damage: 0,
      opponentName: players[loserId]?.name || 'Jogador',
      correctAnswer: correctText,
      yourTime: duel.answers[winnerId].time,
      opponentTime: duel.answers[loserId].time,
      health: winner ? winner.health : 0
    });
    io.to(loserId).emit('duelResult', {
      won: false, xp: 0, coins: 0, damage: damageLose,
      opponentName: players[winnerId]?.name || 'Jogador',
      correctAnswer: correctText,
      yourTime: duel.answers[loserId].time,
      opponentTime: duel.answers[winnerId].time,
      health: loser ? loser.health : 0
    });

    io.emit('killfeed', { text: (winner?.name || 'Jogador') + ' venceu um duelo contra ' + (loser?.name || 'Jogador') + '!' });
    // Persist duel results
    if (winner) recordDuelResult(winner, true);
    if (loser) recordDuelResult(loser, false);
    if (winner && winner.email) checkAchievements(winner.email, winnerId);
  } else {
    // Both wrong
    if (challenger) { challenger.health = Math.max(0, challenger.health - 5); }
    if (target) { target.health = Math.max(0, target.health - 5); }

    [duel.challengerId, duel.targetId].forEach(sid => {
      const opponent = sid === duel.challengerId ? target : challenger;
      const self = sid === duel.challengerId ? challenger : target;
      io.to(sid).emit('duelResult', {
        won: false, draw: true, xp: 0, coins: 0, damage: 5,
        opponentName: opponent?.name || 'Jogador',
        correctAnswer: correctText,
        yourTime: duel.answers[sid]?.time || 0,
        opponentTime: duel.answers[sid === duel.challengerId ? duel.targetId : duel.challengerId]?.time || 0,
        health: self ? self.health : 0
      });
    });

    io.emit('killfeed', { text: 'Duelo entre ' + (challenger?.name || '?') + ' e ' + (target?.name || '?') + ' terminou em empate!' });
    // Persist draw (both lost)
    if (challenger) recordDuelResult(challenger, false);
    if (target) recordDuelResult(target, false);
  }

  delete activeDuels[duelId];
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
    const nearPlayer = findNearestPlayer(e.x, e.y, 150);

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
      // Don't damage players who are in a quiz
      if (activeQuizzes[nearPlayer.id]) continue;
      // Don't damage players who are in a duel
      let inDuel = false;
      for (const did in activeDuels) {
        const d = activeDuels[did];
        if (d.challengerId === nearPlayer.id || d.targetId === nearPlayer.id) {
          inDuel = true;
          break;
        }
      }
      if (inDuel) continue;
      if (dist < e.size + 18) {
        nearPlayer.health -= 5;
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
          let category;
          if (shooter.customArch) {
            // Pick a random category from the custom archipelago instead of
            // looking up the global islands array (which won't have custom ones)
            const customCats = shooter.customArch.islands.map(i => i.category);
            category = customCats[Math.floor(Math.random() * customCats.length)];
          } else {
            category = getCategoryForEnemy(e);
          }
          const shooterEmail = shooter.email;
          const shooterData = shooterEmail ? getUserData(shooterEmail) : null;
          let shooterProg = {};
          if (shooter.archipelagoId && shooter.archipelagoId !== 'classic' && shooterData) {
            const shooterArch = (shooterData.archipelagos || []).find(a => a.id === shooter.archipelagoId);
            shooterProg = shooterArch && shooterArch.progression ? shooterArch.progression : {};
          } else if (shooterData && shooterData.progression) {
            shooterProg = shooterData.progression;
          }
          const qLevel = shooterProg[category] || 1;
          const question = getRandomQuestion(category, qLevel, players[b.ownerId]);
          if (question) {
            activeQuizzes[b.ownerId] = {
              enemyId: eid,
              questionIndex: question.index,
              category: category,
              level: question.level,
              correctAnswer: question.answer,
              timestamp: now,
              questionData: question
            };
            io.to(b.ownerId).emit('quizStart', {
              enemyId: eid,
              question: question.q,
              options: question.options,
              timeLimit: QUIZ_TIME_LIMIT / 1000,
              category: category,
              level: question.level
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
        const correctText = quiz.questionData ? quiz.questionData.options[correctIdx] : '';
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

  // Check duel timeouts
  for (const duelId in activeDuels) {
    const duel = activeDuels[duelId];
    if (Date.now() - duel.startTime > DUEL_TIME_LIMIT) {
      // Auto-answer wrong for anyone who didn't answer
      if (!duel.answers[duel.challengerId]) {
        duel.answers[duel.challengerId] = { answerIndex: -1, correct: false, time: DUEL_TIME_LIMIT };
      }
      if (!duel.answers[duel.targetId]) {
        duel.answers[duel.targetId] = { answerIndex: -1, correct: false, time: DUEL_TIME_LIMIT };
      }
      resolveDuel(duelId);
    }
  }

  // Clean expired pending duels (15 second timeout)
  for (const targetId in pendingDuels) {
    if (Date.now() - pendingDuels[targetId].timestamp > 15000) {
      io.to(pendingDuels[targetId].challengerId).emit('duelDeclined', { targetName: players[targetId]?.name || 'Jogador' });
      delete pendingDuels[targetId];
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
    characterId: p.characterId || 'luna',
    score: p.score, health: p.health, xp: p.xp, level: p.level,
    coins: p.coins, direction: p.direction, isMoving: p.isMoving
  }));
  const bulletArr = bullets.map(b => ({
    id: b.id, x: b.x, y: b.y, color: b.color
  }));
  io.emit('state', { players: playerArr, enemies: enemyArr, bullets: bulletArr });
}, 1000 / 15);

// ===============================================================
//  CUSTOM MAP GENERATOR
// ===============================================================
function generateCustomMap(arch) {
  const islandCount = Math.min(arch.islands.length, 5);
  const centerX = 3000, centerY = 3000;
  const radius = 1800;

  // Reusable polygon template (normalized, will be scaled by rx/ry)
  const polyTemplate = [
    {x:-0.92,y:-0.13},{x:-0.82,y:-0.50},{x:-0.53,y:-0.74},{x:-0.16,y:-0.82},
    {x:0.21,y:-0.77},{x:0.53,y:-0.69},{x:0.82,y:-0.53},{x:0.95,y:-0.21},
    {x:0.98,y:0.13},{x:0.90,y:0.42},{x:0.74,y:0.63},{x:0.42,y:0.79},
    {x:0.08,y:0.74},{x:-0.26,y:0.82},{x:-0.58,y:0.69},{x:-0.87,y:0.45},
    {x:-0.98,y:0.16}
  ];

  const customIslands = [];
  const customBridges = [];

  // Place subject islands in a circle
  for (let i = 0; i < islandCount; i++) {
    const angle = (i / islandCount) * Math.PI * 2 - Math.PI / 2;
    const ix = Math.round(centerX + Math.cos(angle) * radius);
    const iy = Math.round(centerY + Math.sin(angle) * radius);
    const rx = 608, ry = 512;

    const themes = ['blue', 'green', 'purple', 'brown', 'neon'];
    const archIsland = arch.islands[i];

    customIslands.push({
      id: archIsland.category,
      name: archIsland.name,
      x: ix, y: iy, rx: rx, ry: ry,
      category: archIsland.category,
      theme: archIsland.theme || themes[i % themes.length],
      points: polyTemplate.map(p => ({ x: Math.round(p.x * rx), y: Math.round(p.y * ry) }))
    });
  }

  // Central island
  customIslands.push({
    id: 'central', name: 'Ilha Central',
    x: centerX, y: centerY, rx: 720, ry: 608,
    category: null, theme: 'gold',
    points: polyTemplate.map(p => ({ x: Math.round(p.x * 720), y: Math.round(p.y * 608) }))
  });

  // Bridges: ring + spokes
  for (let i = 0; i < islandCount; i++) {
    const next = (i + 1) % islandCount;
    if (islandCount > 1) {
      customBridges.push({ from: customIslands[i].id, to: customIslands[next].id });
    }
    customBridges.push({ from: customIslands[i].id, to: 'central' });
  }

  // Totems (3 zones per island + central)
  const customTotems = [];
  customIslands.forEach(isl => {
    if (!isl.category) {
      // Central: one totem per custom category
      arch.islands.forEach((ai, idx) => {
        const a = (idx / arch.islands.length) * Math.PI * 2;
        customTotems.push({
          id: 'totem_central_' + idx, x: isl.x + Math.cos(a) * isl.rx * 0.5,
          y: isl.y + Math.sin(a) * isl.ry * 0.5,
          category: ai.category, island: isl.id, zone: 1
        });
      });
    } else {
      // Zone 1
      for (let j = 0; j < 2; j++) {
        const a = (j/2)*Math.PI*2+0.3;
        customTotems.push({ id:'totem_'+isl.id+'_z1_'+j, x:isl.x+Math.cos(a)*isl.rx*0.7, y:isl.y+Math.sin(a)*isl.ry*0.7, category:isl.category, island:isl.id, zone:1 });
      }
      // Zone 2
      for (let j = 0; j < 2; j++) {
        const a = (j/2)*Math.PI*2+1.2;
        customTotems.push({ id:'totem_'+isl.id+'_z2_'+j, x:isl.x+Math.cos(a)*isl.rx*0.45, y:isl.y+Math.sin(a)*isl.ry*0.45, category:isl.category, island:isl.id, zone:2 });
      }
      // Zone 3
      customTotems.push({ id:'totem_'+isl.id+'_z3_0', x:isl.x, y:isl.y, category:isl.category, island:isl.id, zone:3 });
    }
  });

  // Chests
  const customChests = [];
  customIslands.forEach(isl => {
    if (!isl.category) return;
    [{ z:1, r:0.65, a:1.2 }, { z:2, r:0.4, a:2.5 }, { z:3, r:0.15, a:0.8 }].forEach((cfg, j) => {
      customChests.push({
        id:'chest_'+isl.id+'_'+j, x:isl.x+Math.cos(cfg.a)*isl.rx*cfg.r,
        y:isl.y+Math.sin(cfg.a)*isl.ry*cfg.r,
        category:isl.category, island:isl.id, zone:cfg.z,
        openedBy:{}, respawnTime:60000
      });
    });
  });

  // Signs
  const customSigns = [];
  customIslands.forEach(isl => {
    if (!isl.category) return;
    [{r:0.65,a:2.0,z:1}, {r:0.38,a:3.5,z:2}].forEach((cfg, j) => {
      customSigns.push({
        id:'sign_'+isl.id+'_'+j, x:isl.x+Math.cos(cfg.a)*isl.rx*cfg.r,
        y:isl.y+Math.sin(cfg.a)*isl.ry*cfg.r,
        category:isl.category, island:isl.id, tipIndex:j, zone:cfg.z
      });
    });
  });

  // Portals on central
  const centralIsl = customIslands.find(i => i.id === 'central');
  const customPortals = [];
  arch.islands.forEach((ai, idx) => {
    const a = (idx / arch.islands.length) * Math.PI * 2 - Math.PI/2;
    const target = customIslands.find(i => i.id === ai.category);
    if (target) {
      customPortals.push({
        id: 'portal_' + ai.category,
        x: centralIsl.x + Math.cos(a) * 250,
        y: centralIsl.y + Math.sin(a) * 250,
        category: ai.category,
        targetX: target.x, targetY: target.y,
        label: ai.name
      });
    }
  });

  return {
    islands: customIslands, bridges: customBridges, totems: customTotems,
    chests: customChests, infoSigns: customSigns, portals: customPortals
  };
}

// ===============================================================
//  SOCKET.IO
// ===============================================================
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', (data) => {
    const color = nextColor();
    const validChars = ['luna', 'blaze', 'coral', 'pixel', 'flora'];
    const charId = validChars.includes(data.characterId) ? data.characterId : 'luna';

    // Load persisted profile if available
    const playerEmail = data.email || null;
    const rec = playerEmail ? getUserData(playerEmail) : null;

    // Check for custom archipelago FIRST to determine spawn point and load correct profile
    const archId = data.archipelagoId || 'classic';

    let profile;
    let playerProgression;
    let playerAchievements;
    if (archId !== 'classic' && rec) {
      const arch = (rec.archipelagos || []).find(a => a.id === archId);
      profile = arch && arch.profile ? arch.profile : { xp: 0, level: 1, coins: 0 };
      playerProgression = arch && arch.progression ? arch.progression : {};
      playerAchievements = arch && arch.achievements ? arch.achievements : [];
    } else {
      profile = rec && rec.profile ? rec.profile : { xp: 0, level: 1, coins: 0 };
      playerProgression = rec && rec.progression ? rec.progression : { matematica: 1, historia: 1, ciencias: 1, linguas: 1, programacao: 1 };
      playerAchievements = rec && rec.achievements ? rec.achievements : [];
    }

    let gameIslands = islands;
    let gameBridges = bridges;
    let gameTotems = totems;
    let gameChests = chests;
    let gameInfoSigns = infoSigns;
    let gamePortals = portals;
    let customResult = null;

    if (archId !== 'classic' && playerEmail) {
      const archUserData = getUserData(playerEmail);
      const arch = archUserData ? (archUserData.archipelagos || []).find(a => a.id === archId) : null;
      if (arch && arch.islands && arch.islands.length > 0) {
        customResult = generateCustomMap(arch);
        gameIslands = customResult.islands;
        gameBridges = customResult.bridges;
        gameTotems = customResult.totems;
        gameChests = customResult.chests;
        gameInfoSigns = customResult.infoSigns;
        gamePortals = customResult.portals;
      }
    }

    // Spawn on the correct map (custom or classic)
    let spawn;
    if (customResult) {
      // Spawn on central island of custom map
      const centralIsl = gameIslands.find(i => i.id === 'central');
      spawn = centralIsl ? { x: centralIsl.x, y: centralIsl.y } : { x: 3000, y: 3000 };
    } else {
      spawn = randomSpawnOnIsland();
    }

    players[socket.id] = {
      id: socket.id,
      name: data.name || 'Jogador',
      email: playerEmail,
      characterId: charId,
      x: spawn.x,
      y: spawn.y,
      color,
      score: 0,
      health: 100,
      xp: profile.xp || 0,
      level: profile.level || 1,
      coins: profile.coins || 0,
      direction: 'down',
      isMoving: false,
      recentQuestions: new Set()
    };

    players[socket.id].archipelagoId = archId;

    if (customResult) {
      players[socket.id].customArch = (function() {
        const archUserData = getUserData(playerEmail);
        return archUserData ? (archUserData.archipelagos || []).find(a => a.id === archId) : null;
      })();
      players[socket.id].customTotems = customResult.totems;
      players[socket.id].customChests = customResult.chests;
      players[socket.id].customSigns = customResult.infoSigns;
      players[socket.id].customPortals = customResult.portals;
      players[socket.id].customIslands = customResult.islands;
    }

    // Determine achievements list for this session (dynamic for custom, classic for default)
    let initAchievements;
    if (archId !== 'classic' && customResult) {
      const archForAch = (function() {
        const archUserData = getUserData(playerEmail);
        return archUserData ? (archUserData.archipelagos || []).find(a => a.id === archId) : null;
      })();
      initAchievements = buildCustomAchievements(archForAch);
    } else {
      initAchievements = ACHIEVEMENTS;
    }

    socket.emit('init', {
      id: socket.id,
      player: players[socket.id],
      islands: gameIslands,
      bridges: gameBridges,
      totems: gameTotems,
      chests: gameChests.map(c => ({ id: c.id, x: c.x, y: c.y, category: c.category, island: c.island, zone: c.zone || 1 })),
      infoSigns: gameInfoSigns,
      portals: gamePortals,
      mapW: MAP_W,
      mapH: MAP_H,
      allAchievements: initAchievements,
      unlockedAchievements: playerAchievements,
      progression: playerProgression
    });

    io.emit('playerCount', { count: Object.keys(players).length });
    io.emit('killfeed', { text: players[socket.id].name + ' entrou no jogo!' });
  });

  socket.on('move', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    const newX = Math.max(0, Math.min(MAP_W, data.x));
    const newY = Math.max(0, Math.min(MAP_H, data.y));

    // Use custom islands for land check if player is on custom archipelago
    const playerIslands = p.customIslands || islands;
    const playerBridges = p.customIslands ? bridges.concat([]) : bridges;

    // Check land using player's map
    let onLand = false;
    // Check islands
    for (const isl of playerIslands) {
      if (isl.points) {
        const absPoints = isl.points.map(pt => ({ x: isl.x + pt.x, y: isl.y + pt.y }));
        if (pointInPolygon(newX, newY, absPoints)) { onLand = true; break; }
      }
    }
    // Check bridges if not on island
    if (!onLand) {
      for (const br of (p.customIslands ? [] : bridges)) {
        const fromIsl = playerIslands.find(i => i.id === br.from);
        const toIsl = playerIslands.find(i => i.id === br.to);
        if (!fromIsl || !toIsl) continue;
        const dx = toIsl.x - fromIsl.x;
        const dy = toIsl.y - fromIsl.y;
        const len = Math.hypot(dx, dy);
        const nx = dx / len; const ny = dy / len;
        const px = newX - fromIsl.x; const py = newY - fromIsl.y;
        const proj = px * nx + py * ny;
        if (proj < 0 || proj > len) continue;
        if (Math.abs(px * (-ny) + py * nx) < 40) { onLand = true; break; }
      }
    }
    // Also check global bridges for custom maps (bridges between custom islands)
    if (!onLand && p.customIslands) {
      // Generate bridges for the custom map
      const customBridgeList = [];
      const numCustom = playerIslands.filter(i => i.id !== 'central').length;
      for (let ci = 0; ci < numCustom; ci++) {
        const nextIdx = (ci + 1) % numCustom;
        if (numCustom > 1) customBridgeList.push({ from: playerIslands[ci].id, to: playerIslands[nextIdx].id });
        customBridgeList.push({ from: playerIslands[ci].id, to: 'central' });
      }
      for (const br of customBridgeList) {
        const fromIsl = playerIslands.find(i => i.id === br.from);
        const toIsl = playerIslands.find(i => i.id === br.to);
        if (!fromIsl || !toIsl) continue;
        const dx = toIsl.x - fromIsl.x;
        const dy = toIsl.y - fromIsl.y;
        const len = Math.hypot(dx, dy);
        const nx = dx / len; const ny = dy / len;
        const px = newX - fromIsl.x; const py = newY - fromIsl.y;
        const proj = px * nx + py * ny;
        if (proj < 0 || proj > len) continue;
        if (Math.abs(px * (-ny) + py * nx) < 40) { onLand = true; break; }
      }
    }

    if (onLand) {
      p.x = newX;
      p.y = newY;
    }

    p.direction = data.direction || p.direction;
    p.isMoving = data.isMoving || false;

    // Track island visits for achievements
    if (p.email) {
      const curIsland = getIslandAt(p.x, p.y);
      if (curIsland) {
        const visitUserData = getUserData(p.email);
        if (visitUserData) {
          const archId = p.archipelagoId;
          if (archId && archId !== 'classic') {
            const arch = (visitUserData.archipelagos || []).find(a => a.id === archId);
            if (arch) {
              if (!arch.stats) arch.stats = { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] };
              if (!arch.stats.islandsVisited) arch.stats.islandsVisited = [];
              if (!arch.stats.islandsVisited.includes(curIsland.id)) {
                arch.stats.islandsVisited.push(curIsland.id);
                updateUserData(p.email, { archipelagos: visitUserData.archipelagos });
                checkAchievements(p.email, socket.id);
              }
            }
          } else {
            if (!visitUserData.stats) visitUserData.stats = { totalCorrect: 0, totalWrong: 0, totalDuelsWon: 0, totalDuelsLost: 0, islandsVisited: [] };
            if (!visitUserData.stats.islandsVisited) visitUserData.stats.islandsVisited = [];
            if (!visitUserData.stats.islandsVisited.includes(curIsland.id)) {
              visitUserData.stats.islandsVisited.push(curIsland.id);
              saveData();
              checkAchievements(p.email, socket.id);
            }
          }
        }
      }
    }
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
    const qLvl = quiz.level || 1;
    const correctText = quiz.questionData ? quiz.questionData.options[quiz.correctAnswer] : '';

    // Chest quizzes give 2x rewards (30 XP + 10 coins)
    const isChest = !!quiz.isChest;

    if (correct) {
      if (isChest) {
        // Double rewards for chest quiz
        const xpGain = 30;
        const coinGain = 10;
        p.xp += xpGain;
        p.coins += coinGain;
        p.score += xpGain;
        const newLevel = Math.floor(p.xp / 100) + 1;
        if (newLevel > p.level) {
          p.level = newLevel;
          p.health = 100;
          io.emit('levelUp', { level: p.level, name: p.name });
          io.emit('killfeed', { text: p.name + ' subiu para nivel ' + p.level + '!' });
        }
        io.to(socket.id).emit('quizResult', {
          correct: true, xp: xpGain, coins: coinGain, damage: 0,
          correctAnswer: correctText, health: p.health, killed: false,
          isChest: true, bonus: '2x'
        });
        // Record chest quiz result
        recordQuizResult(p, category, true, qLvl, 'chest');
        if (p.email) {
          checkAchievements(p.email, socket.id);
          const newProgLevel = checkProgression(p.email, category, p.archipelagoId);
          if (newProgLevel) {
            socket.emit('progressionUnlock', { category, newLevel: newProgLevel });
          }
        }
      } else {
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
          // Enemy already dead (or totem quiz)
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
        recordQuizResult(p, category, true, qLvl, 'enemy');
        if (p.email) {
          checkAchievements(p.email, socket.id);
          const newProgLevel = checkProgression(p.email, category, p.archipelagoId);
          if (newProgLevel) {
            socket.emit('progressionUnlock', { category, newLevel: newProgLevel });
          }
        }
      }
    } else {
      // Wrong answer
      p.health -= 15;
      if (p.health < 0) p.health = 0;
      io.to(socket.id).emit('quizResult', {
        correct: false, xp: 0, coins: 0, damage: 15,
        correctAnswer: correctText, health: p.health, killed: false,
        isChest: isChest
      });
      if (p.health <= 0) {
        io.to(socket.id).emit('dead');
        io.emit('killfeed', { text: p.name + ' foi derrotado!' });
      }
      recordQuizResult(p, category, false, qLvl, isChest ? 'chest' : 'enemy');
    }

    delete activeQuizzes[socket.id];
  });

  socket.on('totemInteract', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    if (activeQuizzes[socket.id]) return;

    const totemPool = p.customTotems || totems;
    const totem = totemPool.find(t => t.id === data.totemId);
    if (!totem) return;

    // Check distance
    const dist = Math.hypot(p.x - totem.x, p.y - totem.y);
    if (dist > 120) return;

    // Resolve progression for this player (per-archipelago or classic)
    const totemPlayerEmail = p.email;
    const totemUserData = totemPlayerEmail ? getUserData(totemPlayerEmail) : null;
    let totemProg = {};
    if (p.archipelagoId && p.archipelagoId !== 'classic' && totemUserData) {
      const totemArch = (totemUserData.archipelagos || []).find(a => a.id === p.archipelagoId);
      totemProg = totemArch && totemArch.progression ? totemArch.progression : {};
    } else if (totemUserData && totemUserData.progression) {
      totemProg = totemUserData.progression;
    }

    // Zone locking: check if player has unlocked this zone
    const totemZone = totem.zone || 1;
    if (totemZone > 1) {
      const playerLevel = totemProg[totem.category] || 1;
      if (playerLevel < totemZone) {
        socket.emit('zoneLocked', { zone: totemZone, category: totem.category, required: totemZone });
        return;
      }
    }

    // Use player's progression level for question
    const qLevel = totemProg[totem.category] || 1;
    const question = getRandomQuestion(totem.category, qLevel, p);
    if (!question) return;

    activeQuizzes[socket.id] = {
      enemyId: null,
      totemId: totem.id,
      questionIndex: question.index,
      category: totem.category,
      level: question.level,
      correctAnswer: question.answer,
      timestamp: Date.now(),
      questionData: question
    };

    // Pick a random mini-lesson for this category (custom arch first)
    let miniLesson = '';
    if (p.customArch) {
      const customIsland = p.customArch.islands.find(i => i.category === totem.category);
      if (customIsland && customIsland.miniLessons) {
        miniLesson = customIsland.miniLessons[Math.floor(Math.random() * customIsland.miniLessons.length)];
      }
    }
    if (!miniLesson) {
      const lessons = miniLessons[totem.category] || [];
      miniLesson = lessons.length > 0 ? lessons[Math.floor(Math.random() * lessons.length)] : null;
    }

    io.to(socket.id).emit('quizStart', {
      enemyId: null,
      totemId: totem.id,
      question: question.q,
      options: question.options,
      timeLimit: QUIZ_TIME_LIMIT / 1000,
      category: totem.category,
      level: question.level,
      miniLesson: miniLesson
    });
  });

  // ---- Chest Interaction ----
  socket.on('chestInteract', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    if (activeQuizzes[socket.id]) return;

    const chestPool = p.customChests || chests;
    const chest = chestPool.find(c => c.id === data.chestId);
    if (!chest) return;

    // Check distance
    const dist = Math.hypot(p.x - chest.x, p.y - chest.y);
    if (dist > 100) return;

    // Check cooldown per player
    const now = Date.now();
    const lastOpened = chest.openedBy[socket.id] || 0;
    if (now - lastOpened < chest.respawnTime) {
      const remaining = Math.ceil((chest.respawnTime - (now - lastOpened)) / 1000);
      socket.emit('chestCooldown', { chestId: chest.id, remaining });
      return;
    }

    // Resolve progression for this player (per-archipelago or classic)
    const chestPlayerEmail = p.email;
    const chestUserData = chestPlayerEmail ? getUserData(chestPlayerEmail) : null;
    let chestProg = {};
    if (p.archipelagoId && p.archipelagoId !== 'classic' && chestUserData) {
      const chestArch = (chestUserData.archipelagos || []).find(a => a.id === p.archipelagoId);
      chestProg = chestArch && chestArch.progression ? chestArch.progression : {};
    } else if (chestUserData && chestUserData.progression) {
      chestProg = chestUserData.progression;
    }

    // Zone locking for chests
    const chestZone = chest.zone || 1;
    if (chestZone > 1) {
      const playerLevel = chestProg[chest.category] || 1;
      if (playerLevel < chestZone) {
        socket.emit('zoneLocked', { zone: chestZone, category: chest.category, required: chestZone });
        return;
      }
    }

    // Use player's progression level for question
    const chestQLevel = chestProg[chest.category] || 1;
    const question = getRandomQuestion(chest.category, chestQLevel, p);
    if (!question) return;

    // Mark chest as opened for cooldown tracking
    chest.openedBy[socket.id] = now;

    activeQuizzes[socket.id] = {
      enemyId: null,
      chestId: chest.id,
      questionIndex: question.index,
      category: chest.category,
      level: question.level,
      correctAnswer: question.answer,
      timestamp: now,
      isChest: true,
      questionData: question
    };

    socket.emit('quizStart', {
      enemyId: null,
      chestId: chest.id,
      question: question.q,
      options: question.options,
      timeLimit: QUIZ_TIME_LIMIT / 1000,
      category: chest.category,
      level: question.level,
      isChest: true
    });
  });

  // ---- Sign Interaction ----
  socket.on('signInteract', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;

    const signPool = p.customSigns || infoSigns;
    const sign = signPool.find(s => s.id === data.signId);
    if (!sign) return;

    // Check distance
    const dist = Math.hypot(p.x - sign.x, p.y - sign.y);
    if (dist > 80) return;

    let tip = '';
    if (p.customArch) {
      const customIsland = p.customArch.islands.find(i => i.category === sign.category);
      if (customIsland && customIsland.studyTips && customIsland.studyTips[sign.tipIndex]) {
        tip = customIsland.studyTips[sign.tipIndex];
      }
    }
    if (!tip) {
      const tips = studyTips[sign.category] || [];
      tip = tips[sign.tipIndex % tips.length] || 'Dica: Continue estudando!';
    }

    socket.emit('signTip', {
      signId: sign.id,
      tip,
      category: sign.category
    });
  });

  // ---- Portal Teleport ----
  socket.on('usePortal', (data) => {
    const p = players[socket.id];
    if (!p || p.health <= 0) return;
    if (activeQuizzes[socket.id]) return;

    const portalPool = p.customPortals || portals;
    const portal = portalPool.find(pt => pt.id === data.portalId);
    if (!portal) return;

    // Check distance
    const dist = Math.hypot(p.x - portal.x, p.y - portal.y);
    if (dist > 100) return;

    // Teleport to target island
    p.x = portal.targetX;
    p.y = portal.targetY;

    socket.emit('teleported', { x: p.x, y: p.y, island: portal.category });
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

  // ---- Duel System ----
  socket.on('duelChallenge', (data) => {
    const challenger = players[socket.id];
    const target = players[data.targetId];
    if (!challenger || !target) return;
    if (challenger.health <= 0 || target.health <= 0) return;
    if (activeQuizzes[socket.id] || activeQuizzes[data.targetId]) return;
    // Check if either is already in a duel
    for (const did in activeDuels) {
      const d = activeDuels[did];
      if (d.challengerId === socket.id || d.targetId === socket.id) return;
      if (d.challengerId === data.targetId || d.targetId === data.targetId) return;
    }
    if (pendingDuels[data.targetId]) return; // Already has pending challenge

    // Check proximity
    const dist = Math.hypot(challenger.x - target.x, challenger.y - target.y);
    if (dist > 150) return;

    const duelId = 'duel_' + (++duelIdCounter);
    pendingDuels[data.targetId] = {
      challengerId: socket.id,
      challengerName: challenger.name,
      duelId: duelId,
      timestamp: Date.now()
    };

    // Notify target
    io.to(data.targetId).emit('duelRequest', {
      duelId: duelId,
      challengerName: challenger.name,
      challengerId: socket.id
    });

    // Notify challenger that challenge was sent
    socket.emit('duelSent', { targetName: target.name });
  });

  socket.on('duelAccept', (data) => {
    const pending = pendingDuels[socket.id];
    if (!pending || pending.duelId !== data.duelId) return;

    delete pendingDuels[socket.id];

    const challenger = players[pending.challengerId];
    const target = players[socket.id];
    if (!challenger || !target) return;

    // Pick a random category based on current island
    const isl = getIslandAt(challenger.x, challenger.y);
    const category = (isl && isl.category) ? isl.category : Object.keys(questions)[Math.floor(Math.random() * Object.keys(questions).length)];
    // Use challenger's progression level for the duel question (per-archipelago aware)
    const challengerData = challenger.email ? getUserData(challenger.email) : null;
    let challengerProg = {};
    if (challenger.archipelagoId && challenger.archipelagoId !== 'classic' && challengerData) {
      const cArch = (challengerData.archipelagos || []).find(a => a.id === challenger.archipelagoId);
      challengerProg = cArch && cArch.progression ? cArch.progression : {};
    } else if (challengerData && challengerData.progression) {
      challengerProg = challengerData.progression;
    }
    const duelQLevel = challengerProg[category] || 1;
    const question = getRandomQuestion(category, duelQLevel, challenger);
    if (!question) return;

    activeDuels[pending.duelId] = {
      challengerId: pending.challengerId,
      targetId: socket.id,
      question: question,
      category: category,
      correctAnswer: question.answer,
      startTime: Date.now(),
      answers: {}
    };

    // Send same question to both
    const payload = {
      duelId: pending.duelId,
      question: question.q,
      options: question.options,
      category: category,
      timeLimit: DUEL_TIME_LIMIT / 1000
    };
    io.to(pending.challengerId).emit('duelStart', { ...payload, opponentName: target.name });
    io.to(socket.id).emit('duelStart', { ...payload, opponentName: challenger.name });
  });

  socket.on('duelDecline', (data) => {
    const pending = pendingDuels[socket.id];
    if (!pending || pending.duelId !== data.duelId) return;
    delete pendingDuels[socket.id];
    io.to(pending.challengerId).emit('duelDeclined', { targetName: players[socket.id]?.name || 'Jogador' });
  });

  socket.on('duelAnswer', (data) => {
    const duel = activeDuels[data.duelId];
    if (!duel) return;
    if (socket.id !== duel.challengerId && socket.id !== duel.targetId) return;
    if (duel.answers[socket.id]) return; // Already answered

    duel.answers[socket.id] = {
      answerIndex: data.answerIndex,
      correct: data.answerIndex === duel.correctAnswer,
      time: Date.now() - duel.startTime
    };

    // Check if both answered
    if (duel.answers[duel.challengerId] && duel.answers[duel.targetId]) {
      resolveDuel(data.duelId);
    }
  });

  socket.on('respawn', () => {
    const p = players[socket.id];
    if (!p) return;
    let spawn;
    if (p.customIslands) {
      const centralIsl = p.customIslands.find(i => i.id === 'central');
      spawn = centralIsl ? { x: centralIsl.x, y: centralIsl.y } : { x: 3000, y: 3000 };
    } else {
      spawn = randomSpawnOnIsland();
    }
    p.x = spawn.x;
    p.y = spawn.y;
    p.health = 100;
    // Lose some XP on death
    p.xp = Math.max(0, p.xp - 20);
    p.level = Math.floor(p.xp / 100) + 1;
    delete activeQuizzes[socket.id];
    socket.emit('respawned', { player: p });
  });

  // ---- Persistence socket events ----
  socket.on('saveNotes', (data) => {
    const p = players[socket.id];
    if (!p || !p.email) return;
    const { category, content } = data;
    if (!category) return;
    const archId = p.archipelagoId;
    if (archId && archId !== 'classic') {
      const userData = getUserData(p.email);
      const arch = userData ? (userData.archipelagos || []).find(a => a.id === archId) : null;
      if (arch) {
        if (!arch.notes) arch.notes = {};
        arch.notes[category] = (content || '').substring(0, 2000);
        updateUserData(p.email, { archipelagos: userData.archipelagos });
      }
    } else {
      const userData = getUserData(p.email);
      if (userData) {
        if (!userData.notes) userData.notes = {};
        userData.notes[category] = (content || '').substring(0, 2000);
        updateUserData(p.email, { notes: userData.notes });
      }
    }
    socket.emit('notesSaved', { ok: true, category });
    checkAchievements(p.email, socket.id);
  });

  socket.on('getAchievements', () => {
    const p = players[socket.id];
    if (!p || !p.email) {
      socket.emit('achievementsData', { all: ACHIEVEMENTS, unlocked: [] });
      return;
    }
    const rec = getUserData(p.email);
    const archId = p.archipelagoId;
    let unlocked = [];
    let achievementsList;
    if (archId && archId !== 'classic' && rec) {
      const arch = (rec.archipelagos || []).find(a => a.id === archId);
      unlocked = arch && arch.achievements ? arch.achievements : [];
      achievementsList = buildCustomAchievements(arch);
    } else {
      unlocked = rec && rec.achievements ? rec.achievements : [];
      achievementsList = ACHIEVEMENTS;
    }
    socket.emit('achievementsData', {
      all: achievementsList,
      unlocked
    });
  });

  socket.on('loadNotes', () => {
    const p = players[socket.id];
    if (!p || !p.email) {
      socket.emit('notesData', { notes: {} });
      return;
    }
    const rec = getUserData(p.email);
    const archId = p.archipelagoId;
    let notes = {};
    if (archId && archId !== 'classic' && rec) {
      const arch = (rec.archipelagos || []).find(a => a.id === archId);
      notes = arch && arch.notes ? arch.notes : {};
    } else {
      notes = rec ? (rec.notes || {}) : {};
    }
    socket.emit('notesData', { notes });
  });

  socket.on('getProgress', () => {
    const p = players[socket.id];
    if (!p || !p.email) {
      socket.emit('progressData', { profile: {}, quizHistory: [], stats: {} });
      return;
    }
    const rec = getUserData(p.email);
    if (!rec) {
      socket.emit('progressData', { profile: {}, quizHistory: [], stats: {} });
      return;
    }
    const archId = p.archipelagoId;
    if (archId && archId !== 'classic') {
      const arch = (rec.archipelagos || []).find(a => a.id === archId);
      socket.emit('progressData', {
        profile: arch && arch.profile ? arch.profile : { xp: 0, level: 1, coins: 0 },
        quizHistory: arch && arch.quizHistory ? arch.quizHistory : [],
        stats: arch && arch.stats ? arch.stats : {}
      });
    } else {
      socket.emit('progressData', {
        profile: rec.profile || { xp: 0, level: 1, coins: 0 },
        quizHistory: rec.quizHistory || [],
        stats: rec.stats || {}
      });
    }
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      io.emit('killfeed', { text: p.name + ' saiu do jogo.' });
      // Save progress on disconnect
      savePlayerProgress(p);
    }
    delete players[socket.id];
    delete activeQuizzes[socket.id];

    // Clean up duels
    delete pendingDuels[socket.id];
    for (const did in activeDuels) {
      const d = activeDuels[did];
      if (d.challengerId === socket.id || d.targetId === socket.id) {
        const otherId = d.challengerId === socket.id ? d.targetId : d.challengerId;
        io.to(otherId).emit('duelDeclined', { targetName: 'Jogador desconectou' });
        delete activeDuels[did];
      }
    }
    for (const tid in pendingDuels) {
      if (pendingDuels[tid].challengerId === socket.id) {
        delete pendingDuels[tid];
      }
    }

    io.emit('playerCount', { count: Object.keys(players).length });
    console.log('Player disconnected:', socket.id);
  });
});

// --------------- Start ---------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Knowlands server running on port ' + PORT);
});
