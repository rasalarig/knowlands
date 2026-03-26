const signupLink = document.getElementById("signupLink");
const forgotLink = document.getElementById("forgotLink");
const signupModal = document.getElementById("signupModal");
const forgotModal = document.getElementById("forgotModal");
const closeButtons = document.querySelectorAll("[data-close]");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const forgotForm = document.getElementById("forgotForm");
const googleLoginBtn = document.getElementById("googleLoginBtn");

const signupCpf = document.getElementById("signupCpf");
const signupPhone = document.getElementById("signupPhone");

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeModal(signupModal);
  closeModal(forgotModal);
}

if (signupLink) {
  signupLink.addEventListener("click", function (event) {
    event.preventDefault();
    openModal(signupModal);
  });
}

if (forgotLink) {
  forgotLink.addEventListener("click", function (event) {
    event.preventDefault();
    openModal(forgotModal);
  });
}

closeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const modalId = this.getAttribute("data-close");
    const modal = document.getElementById(modalId);
    closeModal(modal);
  });
});

[signupModal, forgotModal].forEach(function (modal) {
  if (!modal) return;

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAllModals();
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Preencha e-mail e senha.");
      return;
    }

    alert("Login enviado. Aqui você conectará ao backend.");
  });
}

if (signupForm) {
  signupForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("signupName").value.trim();
    const cpf = document.getElementById("signupCpf").value.trim();
    const address = document.getElementById("signupAddress").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;

    if (!name || !cpf || !address || !phone || !email || !password || !confirmPassword) {
      alert("Preencha todos os campos do cadastro.");
      return;
    }

    if (password !== confirmPassword) {
      alert("As senhas não coincidem.");
      return;
    }

    alert("Cadastro enviado com sucesso. Aqui você conectará ao backend.");
    signupForm.reset();
    closeModal(signupModal);
  });
}

if (forgotForm) {
  forgotForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("forgotEmail").value.trim();

    if (!email) {
      alert("Digite seu e-mail.");
      return;
    }

    alert("Solicitação de recuperação enviada. Aqui você conectará ao backend.");
    forgotForm.reset();
    closeModal(forgotModal);
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", function () {
    alert("Aqui você conectará o login com Google.");
  });
}

if (signupCpf) {
  signupCpf.addEventListener("input", function () {
    let value = this.value.replace(/\D/g, "");
    value = value.slice(0, 11);

    if (value.length > 9) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    } else if (value.length > 3) {
      value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    }

    this.value = value;
  });
}

if (signupPhone) {
  signupPhone.addEventListener("input", function () {
    let value = this.value.replace(/\D/g, "");
    value = value.slice(0, 11);

    if (value.length > 10) {
      value = value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (value.length > 6) {
      value = value.replace(/(\d{2})(\d{4,5})(\d{1,4})/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/(\d{2})(\d{1,5})/, "($1) $2");
    } else if (value.length > 0) {
      value = value.replace(/(\d{1,2})/, "($1");
    }

    this.value = value;
  });
}