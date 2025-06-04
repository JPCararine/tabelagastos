// site/script.js

// --- Variáveis Globais & Constantes ---
let allExpenses = []; // Armazena todas as despesas do usuário
let fixedExpenseTemplates = []; // Modelos para despesas fixas
const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
let activeFilterMonth = new Date().getMonth(); // Mês atual como padrão (0-11)
const currentYear = new Date().getFullYear(); // Ano atual para filtragem

// --- Elementos DOM ---
const navInicioLink = document.getElementById('navInicio');
const navControleGastosLink = document.getElementById('navControleGastos');
const viewInicio = document.getElementById('viewInicio');
const viewControleGastos = document.getElementById('viewControleGastos');
const goToGastosBtn = document.getElementById('goToGastosBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameDisplay = document.getElementById('usernameDisplay');

// Formulário e lista de modelos de gastos fixos
const formGastoFixo = document.getElementById('formGastoFixo');
const descriptionFixoInput = document.getElementById('descriptionFixo'); // Renomeado
const valueFixoInput = document.getElementById('valueFixo'); // Renomeado
const listaGastosFixosUl = document.getElementById('listaGastosFixos');
const btnRepassarFixos = document.getElementById('btnRepassarFixos');
const emptyFixedListMsg = document.querySelector('.empty-fixed-list');

// Formulário de gastos variáveis
const formGastoVariavel = document.getElementById('formGastoVariavel');
const descriptionVariavelInput = document.getElementById('descriptionVariavel'); // Renomeado
const valueVariavelInput = document.getElementById('valueVariavel'); // Renomeado
const dateVariavelInput = document.getElementById('dateVariavel'); // Renomeado

const expensesTableBody = document.querySelector('#tabelaGastos tbody');
const totalMesDisplay = document.getElementById('totalMes'); // Renomeado
const monthFilterContainer = document.querySelector('.month-container');
const btnLimparTodosGastosUsuario = document.getElementById('btnLimparTodosGastosUsuario');


// --- Helper da API ---
async function fetchAPI(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html'; // Redireciona se não houver token
        return Promise.reject(new Error("Token não encontrado. Redirecionando para login.")); // Rejeita a promise
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    if (method !== 'GET' && method !== 'DELETE') { // Para POST, PUT, etc.
        headers['Content-Type'] = 'application/json';
    }

    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, config); // Usando caminhos relativos
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
            return Promise.reject(new Error("Autenticação falhou. Redirecionando para login."));
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Erro ${response.status}: ${response.statusText}` }));
            // console.error('Erro na API:', response.status, errorData);
            alert(`Erro na API: ${errorData.message || response.statusText}`);
            return null; // Ou Promise.reject(errorData) se preferir tratar erros mais explicitamente
        }
        if (response.status === 204) { // No Content
             return { success: true, message: "Operação bem-sucedida, sem conteúdo de resposta."};
        }
        return response.json();
    } catch (error) {
        // console.error('Erro de rede ou fetch:', error);
        alert('Erro de comunicação com o servidor. Verifique sua conexão.');
        return null; // Ou Promise.reject(error)
    }
}

// --- Autenticação & Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');

    // Lógica de redirecionamento
    if (!token && !window.location.pathname.endsWith('/login.html')) {
        window.location.href = 'login.html';
        return;
    }
    if (token && window.location.pathname.endsWith('/login.html')) {
        window.location.href = 'index.html'; // Ou '/' se seu servidor estiver configurado assim
        return;
    }

    // Se estiver na página principal (index.html)
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/site/') ) {
        if (usernameDisplay && username) {
            usernameDisplay.textContent = `Olá, ${username}!`;
        }

        setupEventListeners();
        showView('viewInicio'); // Começa na view de início
        await loadInitialData();
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        });
    }
});

function setupEventListeners() {
    navInicioLink?.addEventListener('click', (e) => { e.preventDefault(); showView('viewInicio'); });
    navControleGastosLink?.addEventListener('click', (e) => { e.preventDefault(); showView('viewControleGastos'); });
    goToGastosBtn?.addEventListener('click', () => showView('viewControleGastos'));

    formGastoFixo?.addEventListener('submit', handleAddFixedExpenseTemplate);
    formGastoVariavel?.addEventListener('submit', handleAddVariableExpense);
    btnRepassarFixos?.addEventListener('click', handleRepassFixedExpenses);
    btnLimparTodosGastosUsuario?.addEventListener('click', handleClearAllUserExpenses);

    monthFilterContainer?.querySelectorAll('.month').forEach((monthElement) => {
        monthElement.addEventListener('click', function() {
            activeFilterMonth = parseInt(this.getAttribute('data-month'));
            renderExpensesAndTotal();
        });
    });
}

async function loadInitialData() {
    try {
        const [fixedTemplatesData, expensesData] = await Promise.all([
            fetchAPI('/api/fixed-expenses-templates'),
            fetchAPI('/api/expenses')
        ]);

        if (fixedTemplatesData) {
            fixedExpenseTemplates = fixedTemplatesData;
            renderFixedExpenseTemplates();
        }
        if (expensesData) {
            allExpenses = expensesData; // API já retorna 'value' e 'date'
            renderExpensesAndTotal();
        }
    } catch (error) {
        // O fetchAPI já trata e exibe alertas, mas pode logar aqui se necessário
        // console.error("Erro ao carregar dados iniciais:", error);
    }
}

function showView(viewIdToShow) {
  document.querySelectorAll('.view-container').forEach(view => view.classList.remove('active-view'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const viewToShow = document.getElementById(viewIdToShow);
  if (viewToShow) {
    viewToShow.classList.add('active-view');
    if (viewIdToShow === 'viewInicio') navInicioLink?.classList.add('active');
    else if (viewIdToShow === 'viewControleGastos') navControleGastosLink?.classList.add('active');
  }
}

// --- Lógica de Modelos de Gastos Fixos ---
function renderFixedExpenseTemplates() {
  if (!listaGastosFixosUl || !emptyFixedListMsg) return;

  listaGastosFixosUl.innerHTML = '';
  if (fixedExpenseTemplates.length === 0) {
    emptyFixedListMsg.style.display = 'block';
    listaGastosFixosUl.style.display = 'none';
  } else {
    emptyFixedListMsg.style.display = 'none';
    listaGastosFixosUl.style.display = 'block';
    fixedExpenseTemplates.forEach((template) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="description-fixo">${template.description}</span>
        <span class="value-fixo">R$ ${parseFloat(template.value).toFixed(2)}</span>
        <button class="remove-fixo-btn" data-id="${template.id}">Remover</button>
      `;
      listaGastosFixosUl.appendChild(li);
    });
    // Adicionar event listeners aos novos botões de remover
    listaGastosFixosUl.querySelectorAll('.remove-fixo-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRemoveFixedExpenseTemplate(btn.dataset.id));
    });
  }
}

async function handleAddFixedExpenseTemplate(event) {
  event.preventDefault();
  if (!descriptionFixoInput || !valueFixoInput) return;

  const description = descriptionFixoInput.value.trim();
  const value = parseFloat(valueFixoInput.value);

  if (!description || isNaN(value) || value <= 0) {
    alert("Preencha a descrição e um valor positivo para o modelo de gasto fixo.");
    return;
  }

  const newTemplate = await fetchAPI('/api/fixed-expenses-templates', 'POST', { description, value });
  if (newTemplate) {
    fixedExpenseTemplates.push(newTemplate);
    descriptionFixoInput.value = '';
    valueFixoInput.value = '';
    renderFixedExpenseTemplates();
  }
}

async function handleRemoveFixedExpenseTemplate(templateId) {
  if (confirm("Tem certeza que deseja remover este modelo de gasto fixo? Isso não removerá gastos já repassados.")) {
    const result = await fetchAPI(`/api/fixed-expenses-templates/${templateId}`, 'DELETE');
    if (result && result.success) {
      fixedExpenseTemplates = fixedExpenseTemplates.filter(t => t.id !== parseInt(templateId));
      renderFixedExpenseTemplates();
    }
  }
}

async function handleRepassFixedExpenses() {
  if (fixedExpenseTemplates.length === 0) {
    alert("Nenhum modelo de gasto fixo cadastrado para repassar.");
    return;
  }
  if (confirm(`Repassar modelos fixos para todos os meses de ${currentYear}? Despesas já existentes para o mês/modelo não serão duplicadas.`)) {
    const result = await fetchAPI('/api/expenses/repass-fixed', 'POST');
    if (result) {
        alert(result.message || "Gastos fixos repassados.");
        const expensesData = await fetchAPI('/api/expenses'); // Recarrega todas as despesas
        if (expensesData) {
            allExpenses = expensesData;
            renderExpensesAndTotal();
        }
    }
  }
}

// --- Lógica de Gastos (Variáveis e Fixos Repassados) ---
function formatDateForDisplay(isoDate) {
  if (!isoDate) return '';
  // Assume que isoDate está no formato AAAA-MM-DD
  const parts = isoDate.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : isoDate;
}

function updateClearAllButtonVisibility() {
  if (!btnLimparTodosGastosUsuario) return;
  btnLimparTodosGastosUsuario.style.display = allExpenses.length > 0 ? 'block' : 'none';
}

async function handleAddVariableExpense(event) {
  event.preventDefault();
  if (!descriptionVariavelInput || !valueVariavelInput || !dateVariavelInput) return;

  const description = descriptionVariavelInput.value.trim();
  const value = parseFloat(valueVariavelInput.value);
  const date = dateVariavelInput.value; // Formato AAAA-MM-DD

  if (!description || isNaN(value) || value <= 0 || !date) {
    alert("Preencha todos os campos do gasto variável corretamente (descrição, valor positivo e data).");
    return;
  }
  // Validação simples de formato de data
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    alert("Formato de data inválido. Use AAAA-MM-DD.");
    return;
  }

  const newExpense = await fetchAPI('/api/expenses', 'POST', { description, value, date });
  if (newExpense) {
    allExpenses.push(newExpense); // API retorna o objeto com 'id', 'value', 'date', etc.
    descriptionVariavelInput.value = '';
    valueVariavelInput.value = '';
    dateVariavelInput.value = ''; // Limpa o campo de data
    renderExpensesAndTotal();
  }
}

function renderExpensesAndTotal() {
  if (!expensesTableBody || !totalMesDisplay || !monthFilterContainer) {
    // console.warn("Elementos essenciais para renderização de gastos não encontrados.");
    return;
  }
  expensesTableBody.innerHTML = '';
  let monthTotal = 0;

  // Ordena por data (mais recente primeiro) e depois por ID (para consistência se houver datas iguais)
  const sortedExpenses = [...allExpenses].sort((a, b) => {
    const dateComparison = new Date(b.date) - new Date(a.date);
    if (dateComparison !== 0) return dateComparison;
    return b.id - a.id; // Mais recente ID primeiro se datas iguais
  });

  sortedExpenses.forEach((expense) => {
    if (!expense.date) {
        // console.warn("Gasto sem data encontrado:", expense);
        return;
    }
    const expenseDate = new Date(expense.date + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso

    if (expenseDate.getMonth() === activeFilterMonth && expenseDate.getFullYear() === currentYear) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', expense.id);

      // Escapar aspas simples para o onclick
      const escapedDescription = expense.description.replace(/'/g, "\\'");

      tr.innerHTML = `
        <td class="description-cell">
          <span>${expense.description}</span>
          <button class="edit-btn" data-field="description" data-current-value="${escapedDescription}">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td class="value-cell">
          <span>R$ ${parseFloat(expense.value).toFixed(2)}</span>
          <button class="edit-btn" data-field="value" data-current-value="${expense.value}">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td class="date-cell">
          <span>${formatDateForDisplay(expense.date)}</span>
          <button class="edit-btn" data-field="date" data-current-value="${expense.date}">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td>
          <button class="remove-btn" data-id="${expense.id}"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      expensesTableBody.appendChild(tr);
      monthTotal += parseFloat(expense.value);
    }
  });

  totalMesDisplay.innerText = `Total de ${months[activeFilterMonth]}: R$ ${monthTotal.toFixed(2)}`;

  // Atualiza a classe 'active' nos botões de mês
  monthFilterContainer.querySelectorAll('.month').forEach(monthEl => {
    monthEl.classList.toggle('active', parseInt(monthEl.getAttribute('data-month')) === activeFilterMonth);
  });

  updateClearAllButtonVisibility();
  attachActionListenersToTable(); // Reatribui listeners após renderizar
}

function attachActionListenersToTable() {
    expensesTableBody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            const expenseId = parseInt(row.dataset.id);
            const field = e.currentTarget.dataset.field;
            const currentValue = e.currentTarget.dataset.currentValue;
            handleEditExpenseField(expenseId, field, currentValue);
        });
    });
    expensesTableBody.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const expenseId = parseInt(e.currentTarget.dataset.id);
            handleRemoveExpense(expenseId);
        });
    });
}


async function handleEditExpenseField(expenseId, field, currentValue) {
    const expense = allExpenses.find(exp => exp.id === expenseId);
    if (!expense) {
        alert("Gasto não encontrado para edição.");
        return;
    }

    let newValuePrompt;
    let updatedData = { description: expense.description, value: expense.value, date: expense.date }; // Nomes dos campos como na API

    if (field === 'description') {
        newValuePrompt = prompt("Edite a descrição:", currentValue);
        if (newValuePrompt === null) return; // Usuário cancelou
        if (newValuePrompt.trim() === '') {
            alert("Descrição não pode ser vazia."); return;
        }
        updatedData.description = newValuePrompt.trim();
    } else if (field === 'value') {
        const currentValueFormatted = parseFloat(currentValue).toFixed(2).replace(".", ",");
        newValuePrompt = prompt("Edite o valor (R$):", currentValueFormatted);
        if (newValuePrompt === null) return;
        const valueFloat = parseFloat(newValuePrompt.replace(",", "."));
        if (isNaN(valueFloat) || valueFloat < 0) { // Permite 0
            alert("Valor inválido. Insira um número não negativo."); return;
        }
        updatedData.value = valueFloat;
    } else if (field === 'date') {
        newValuePrompt = prompt("Edite a data (AAAA-MM-DD):", currentValue);
        if (newValuePrompt === null) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newValuePrompt)) {
            alert("Formato de data inválido. Use AAAA-MM-DD."); return;
        }
        const testDate = new Date(newValuePrompt + 'T00:00:00');
        if (!(testDate && testDate.toISOString().slice(0,10) === newValuePrompt)) {
            alert("Data inválida (ex: dia ou mês inexistente). Use AAAA-MM-DD."); return;
        }
        updatedData.date = newValuePrompt;
    } else {
        return; // Campo desconhecido
    }

    const result = await fetchAPI(`/api/expenses/${expenseId}`, 'PUT', updatedData);
    if (result && result.success) { // Verifica se a API retornou sucesso
        const expenseIndex = allExpenses.findIndex(exp => exp.id === expenseId);
        if (expenseIndex !== -1) {
            // Atualiza o objeto no array local com os dados enviados para a API
            allExpenses[expenseIndex] = {
                ...allExpenses[expenseIndex], // Mantém outras propriedades como is_from_template
                description: updatedData.description,
                value: updatedData.value,
                date: updatedData.date,
            };
        }
        renderExpensesAndTotal();
    }
}

async function handleRemoveExpense(expenseId) {
  if (confirm("Tem certeza que deseja remover este gasto?")) {
    const result = await fetchAPI(`/api/expenses/${expenseId}`, 'DELETE');
    if (result && result.success) {
      allExpenses = allExpenses.filter(exp => exp.id !== expenseId);
      renderExpensesAndTotal();
    }
  }
}

async function handleClearAllUserExpenses() {
  if (allExpenses.length === 0) {
    alert("Não há gastos para limpar.");
    return;
  }
  if (confirm("Tem certeza que deseja remover TODOS os seus gastos? Esta ação não pode ser desfeita.")) {
    const result = await fetchAPI('/api/expenses/all', 'DELETE');
    if (result && result.success) {
      allExpenses = [];
      renderExpensesAndTotal();
      alert(result.message || "Todos os seus gastos foram removidos.");
    }
  }
}