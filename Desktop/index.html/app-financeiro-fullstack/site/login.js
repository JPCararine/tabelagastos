// site/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginMessageDiv = document.getElementById('loginMessage'); // Renomeado
    const registerMessageDiv = document.getElementById('registerMessage'); // Renomeado

    const loginPasswordInput = document.getElementById('loginPassword');
    const toggleLoginPasswordBtn = document.getElementById('toggleLoginPassword');
    const registerPasswordInput = document.getElementById('registerPassword');
    const toggleRegisterPasswordBtn = document.getElementById('toggleRegisterPassword');

    function displayMessage(element, message, isError = true) {
        if (element) {
            element.textContent = message;
            element.className = 'message-display'; // Reset classes
            if (isError) {
                element.classList.add('error-message');
            } else {
                element.classList.add('success-message');
            }
            element.style.display = 'block';
        }
    }

    function hideMessages() {
        if (loginMessageDiv) loginMessageDiv.style.display = 'none';
        if (registerMessageDiv) registerMessageDiv.style.display = 'none';
    }

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

    if (localStorage.getItem('authToken')) {
        window.location.href = 'index.html';
    }

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

    if (loginForm && loginPasswordInput) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessages();
            const username = document.getElementById('loginUsername').value;
            const password = loginPasswordInput.value;

            if (!username || !password) {
                displayMessage(loginMessageDiv, "Usuário e senha são obrigatórios.");
                return;
            }

            try {
                const response = await fetch('/auth/login', {
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
                    displayMessage(loginMessageDiv, data.message || 'Erro no login.');
                }
            } catch (error) {
                displayMessage(loginMessageDiv, 'Falha na comunicação com o servidor.');
                // console.error('Erro no login:', error);
            }
        });
    }

    if (registerForm && registerPasswordInput) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessages();
            const username = document.getElementById('registerUsername').value;
            const password = registerPasswordInput.value;

            if (!username || !password) {
                displayMessage(registerMessageDiv, "Usuário e senha são obrigatórios.");
                return;
            }
            if (password.length < 6) {
                 displayMessage(registerMessageDiv, "A senha deve ter pelo menos 6 caracteres.");
                return;
            }


            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    displayMessage(registerMessageDiv, 'Usuário registrado com sucesso! Faça o login.', false);
                    registerForm.reset();
                     // Opcional: redirecionar para login ou mostrar formulário de login
                    // setTimeout(() => {
                    //    showLoginLink.click();
                    // }, 2000);
                } else {
                    displayMessage(registerMessageDiv, data.message || 'Erro no registro.');
                }
            } catch (error) {
                displayMessage(registerMessageDiv, 'Falha na comunicação com o servidor.');
                // console.error('Erro no registro:', error);
            }
        });
    }
});