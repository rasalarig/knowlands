/* ---- Google OAuth2 ---- */
let googleClientId = '';
let googleInitRetries = 0;
const MAX_GOOGLE_RETRIES = 5;

async function initGoogleAuth() {
  try {
    const res = await fetch('/api/auth/google-client-id');
    const data = await res.json();
    googleClientId = data.clientId;

    const btn = document.getElementById('googleSignInBtn');

    if (googleClientId) {
      // Client ID is available - try to initialize GSI
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        // GSI is loaded, initialize normally
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleLogin,
          auto_select: false
        });

        if (btn) {
          btn.addEventListener('click', () => {
            google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                google.accounts.id.prompt();
              }
            });
          });
        }
      } else if (googleInitRetries < MAX_GOOGLE_RETRIES) {
        // GSI not loaded yet, retry after a delay
        googleInitRetries++;
        setTimeout(initGoogleAuth, 1000);
      } else {
        // Max retries reached, show error on click
        if (btn) {
          btn.addEventListener('click', () => {
            showMsg('loginError', 'Login com Google nao disponivel. Tente recarregar a pagina.');
          });
        }
      }
    } else {
      // No client ID configured - show error on click
      if (btn) {
        btn.addEventListener('click', () => {
          showMsg('loginError', 'Login com Google nao configurado.');
        });
      }
    }
  } catch (err) {
    console.warn('Google Auth not available:', err);
    // On fetch error, still let the button work but show an error
    const btn = document.getElementById('googleSignInBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        showMsg('loginError', 'Login com Google nao disponivel.');
      });
    }
  }
}

// Handle Google login callback
async function handleGoogleLogin(response) {
  hideMsg('loginError');
  hideMsg('loginSuccess');

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg('loginError', data.error || 'Erro ao fazer login com Google.');
      return;
    }

    sessionStorage.setItem('username', data.user.name);
    sessionStorage.setItem('email', data.user.email);
    if (data.user.picture) sessionStorage.setItem('picture', data.user.picture);
    // Clear any previous character selection so user picks again
    sessionStorage.removeItem('characterId');

    showMsg('loginSuccess', 'Login com Google bem-sucedido! Entrando...');
    setTimeout(() => { window.location.href = '/select.html'; }, 600);
  } catch (err) {
    showMsg('loginError', 'Erro de conexao. Tente novamente.');
  }
}

// Make handleGoogleLogin global for GSI callback
window.handleGoogleLogin = handleGoogleLogin;

// Initialize when GSI script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initGoogleAuth, 500);
  });
} else {
  setTimeout(initGoogleAuth, 500);
}

/* ---- Knowlands Login / Signup ---- */

const signupLink = document.getElementById('signupLink');
const signupModal = document.getElementById('signupModal');
const closeButtons = document.querySelectorAll('[data-close]');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// ---- Helpers ----
function showMsg(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function hideMsg(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ---- Modals ----
function openModal(modal) {
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

if (signupLink) {
  signupLink.addEventListener('click', function (e) {
    e.preventDefault();
    openModal(signupModal);
  });
}

closeButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    const modalId = this.getAttribute('data-close');
    closeModal(document.getElementById(modalId));
  });
});

if (signupModal) {
  signupModal.addEventListener('click', function (e) {
    if (e.target === signupModal) closeModal(signupModal);
  });
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal(signupModal);
});

// ---- Login ----
if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideMsg('loginError');
    hideMsg('loginSuccess');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showMsg('loginError', 'Preencha e-mail e senha.');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg('loginError', data.error || 'Erro ao fazer login.');
        return;
      }

      sessionStorage.setItem('username', data.user.name);
      sessionStorage.setItem('email', data.user.email);
      // Clear any previous character selection so user picks again
      sessionStorage.removeItem('characterId');
      showMsg('loginSuccess', 'Login bem-sucedido! Entrando...');
      setTimeout(() => { window.location.href = '/select.html'; }, 600);
    } catch (err) {
      showMsg('loginError', 'Erro de conexao. Tente novamente.');
    }
  });
}

// ---- Signup ----
if (signupForm) {
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideMsg('signupError');
    hideMsg('signupSuccess');

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirmPassword').value;

    if (!name || !email || !password || !confirm) {
      showMsg('signupError', 'Preencha todos os campos.');
      return;
    }

    if (password !== confirm) {
      showMsg('signupError', 'As senhas nao coincidem.');
      return;
    }

    if (password.length < 4) {
      showMsg('signupError', 'A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showMsg('signupError', data.error || 'Erro ao cadastrar.');
        return;
      }

      showMsg('signupSuccess', 'Conta criada! Faca login para jogar.');
      signupForm.reset();
      setTimeout(() => { closeModal(signupModal); }, 1500);
    } catch (err) {
      showMsg('signupError', 'Erro de conexao. Tente novamente.');
    }
  });
}
