// site/login.js

const loginFormContainer = document.getElementById('login-form-container');
const registerFormContainer = document.getElementById('register-form-container');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginErrorDiv = document.getElementById('loginError');
const registerErrorDiv = document.getElementById('registerError');
const registerSuccessDiv = document.getElementById('registerSuccess');

// Elementos para "Ver Senha"
const loginPasswordInput = document.getElementById('loginPassword');
const toggleLoginPasswordBtn = document.getElementById('toggleLoginPassword');
const registerPasswordInput = document.getElementById('registerPassword');
const toggleRegisterPasswordBtn = document.getElementById('toggleRegisterPassword');

// Função para limpar e esconder todas as mensagens de erro/sucesso
function hideMessages() {
    if (loginErrorDiv) {
        loginErrorDiv.style.display = 'none';
        loginErrorDiv.textContent = '';
    }
    if (registerErrorDiv) {
        registerErrorDiv.style.display = 'none';
        registerErrorDiv.textContent = '';
    }
    if (registerSuccessDiv) {
        registerSuccessDiv.style.display = 'none';
        registerSuccessDiv.textContent = '';
    }
}

// Função para alternar visibilidade da senha
function togglePasswordVisibility(passwordInput, toggleButton) {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.classList.remove('fa-eye');
        toggleButton.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleButton.classList.remove('fa-eye-slash');
        toggleButton.classList.add('fa-eye');
    }
}

// Adiciona listeners aos botões de "Ver Senha"
// Verifica se os elementos existem antes de adicionar listeners
if (toggleLoginPasswordBtn && loginPasswordInput) {
    toggleLoginPasswordBtn.addEventListener('click', () => {
        togglePasswordVisibility(loginPasswordInput, toggleLoginPasswordBtn);
    });
}
if (toggleRegisterPasswordBtn && registerPasswordInput) {
    toggleRegisterPasswordBtn.addEventListener('click', () => {
        togglePasswordVisibility(registerPasswordInput, toggleRegisterPasswordBtn);
    });
}

// Redireciona se já estiver logado
if (localStorage.getItem('authToken')) {
    window.location.href = 'index.html'; // Assume que index.html está na mesma pasta (site/)
}

// Listeners para alternar entre formulário de login e registro
// Verifica se os elementos existem antes de adicionar listeners
if (showRegisterLink && loginFormContainer && registerFormContainer) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginFormContainer.style.display = 'none';
      registerFormContainer.style.display = 'block';
      hideMessages();
    });
}

if (showLoginLink && loginFormContainer && registerFormContainer) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      registerFormContainer.style.display = 'none';
      loginFormContainer.style.display = 'block';
      hideMessages();
    });
}

// Listener para submissão do formulário de login
// Verifica se os elementos existem antes de adicionar listeners
if (loginForm && loginPasswordInput) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessages();
      const username = document.getElementById('loginUsername').value; // Pode pegar diretamente aqui
      const password = loginPasswordInput.value;

      try {
        const response = await fetch('/auth/login', { // Rota relativa ao servidor que serve a página
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('username', data.username);
          window.location.href = 'index.html';
        } else {
          if(loginErrorDiv) {
            loginErrorDiv.textContent = data.message || 'Erro no login.';
            loginErrorDiv.style.display = 'block';
          }
        }
      } catch (error) {
        if(loginErrorDiv) {
            loginErrorDiv.textContent = 'Falha na comunicação com o servidor.';
            loginErrorDiv.style.display = 'block';
        }
        console.error('Erro no login:', error);
      }
    });
}

// Listener para submissão do formulário de registro
// Verifica se os elementos existem antes de adicionar listeners
if (registerForm && registerPasswordInput) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessages();
      const username = document.getElementById('registerUsername').value; // Pode pegar diretamente aqui
      const password = registerPasswordInput.value;

      try {
        const response = await fetch('/auth/register', { // Rota relativa ao servidor que serve a página
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
          if(registerSuccessDiv) {
            registerSuccessDiv.textContent = 'Usuário registrado com sucesso! Faça o login.';
            registerSuccessDiv.style.display = 'block';
          }
          registerForm.reset();
        } else {
          if(registerErrorDiv) {
            registerErrorDiv.textContent = data.message || 'Erro no registro.';
            registerErrorDiv.style.display = 'block';
          }
        }
      } catch (error) {
        if(registerErrorDiv) {
            registerErrorDiv.textContent = 'Falha na comunicação com o servidor.';
            registerErrorDiv.style.display = 'block';
        }
        console.error('Erro no registro:', error);
      }
    });
}