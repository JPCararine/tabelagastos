
let gastos = []; 
let gastosFixosTemplates = []; 
const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const anoAtual = new Date().getFullYear();
let mesFiltroAtivo = new Date().getMonth();

const API_BASE_URL = 'http://localhost:3000'; 


const navInicioLink = document.getElementById('navInicio');
const navControleGastosLink = document.getElementById('navControleGastos');
const viewInicio = document.getElementById('viewInicio');
const viewControleGastos = document.getElementById('viewControleGastos');
const goToGastosBtn = document.getElementById('goToGastosBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameDisplay = document.getElementById('usernameDisplay');

const formGastoFixo = document.getElementById('formGastoFixo');
const descricaoFixoInput = document.getElementById('descricaoFixo');
const valorFixoInput = document.getElementById('valorFixo');
const listaGastosFixosUl = document.getElementById('listaGastosFixos');
const btnRepassarFixos = document.getElementById('btnRepassarFixos');
const emptyFixedListMsg = document.querySelector('.empty-fixed-list');

const formGastoVariavel = document.getElementById('formGastoVariavel');
const descricaoInput = document.getElementById('descricao');
const valorInput = document.getElementById('valor');
const dataInput = document.getElementById('data');

const btnLimparTodosGastosUsuario = document.getElementById('btnLimparTodosGastosUsuario');


async function fetchAPI(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, config);
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
            return;
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error('Erro na API:', response.status, errorData);
            alert(`Erro na API: ${errorData.message || response.statusText}`);
            return null;
        }
        if (response.status === 204) {
             return { success: true, message: "Operação bem-sucedida, sem conteúdo."};
        }
        return response.json();
    } catch (error) {
        console.error('Erro de rede ou fetch:', error);
        alert('Erro de comunicação com o servidor.');
        return null;
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');

    if (!token && window.location.pathname !== '/login.html') { 
        window.location.href = 'login.html';
        return;
    }
     if (token && window.location.pathname === '/login.html'){ 
        window.location.href = 'index.html';
        return;
    }


    if (usernameDisplay && username) {
        usernameDisplay.textContent = `Olá, ${username}!`;
    }

    
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        mostrarView('viewInicio');
        await loadInitialData();

        if (formGastoFixo) formGastoFixo.addEventListener('submit', (e) => { e.preventDefault(); adicionarGastoFixoTemplate(); });
        if (formGastoVariavel) formGastoVariavel.addEventListener('submit', (e) => { e.preventDefault(); adicionarGasto(); });
        if (btnRepassarFixos) btnRepassarFixos.addEventListener('click', repassarGastosFixosParaMeses);
        if (btnLimparTodosGastosUsuario) btnLimparTodosGastosUsuario.addEventListener('click', limparTodosGastosDoUsuario);

        document.querySelectorAll('.month').forEach((monthElement) => {
            monthElement.addEventListener('click', function() {
                mesFiltroAtivo = parseInt(this.getAttribute('data-month'));
                renderizarGastosETotal();
            });
        });

        navInicioLink?.addEventListener('click', (e) => { e.preventDefault(); mostrarView('viewInicio'); });
        navControleGastosLink?.addEventListener('click', (e) => { e.preventDefault(); mostrarView('viewControleGastos'); });
        goToGastosBtn?.addEventListener('click', () => mostrarView('viewControleGastos'));
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        });
    }
});

async function loadInitialData() {
    const [fixedTemplatesData, expensesData] = await Promise.all([
        fetchAPI('/api/fixed-expenses-templates'),
        fetchAPI('/api/expenses')
    ]);

    if (fixedTemplatesData) {
        gastosFixosTemplates = fixedTemplatesData;
        renderizarGastosFixosTemplates();
    }
    if (expensesData) {
        gastos = expensesData.map(g => ({...g, valor: g.value }));
        renderizarGastosETotal();
    }
}

function mostrarView(viewIdToShow) {
  document.querySelectorAll('.view-container').forEach(view => view.classList.remove('active-view'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  const viewToShow = document.getElementById(viewIdToShow);
  if (viewToShow) {
    viewToShow.classList.add('active-view');
    if (viewIdToShow === 'viewInicio') navInicioLink?.classList.add('active');
    else if (viewIdToShow === 'viewControleGastos') navControleGastosLink?.classList.add('active');
  }
}

function renderizarGastosFixosTemplates() {
  if (!listaGastosFixosUl || !emptyFixedListMsg) return;
  listaGastosFixosUl.innerHTML = '';
  if (gastosFixosTemplates.length === 0) {
    emptyFixedListMsg.style.display = 'block';
    listaGastosFixosUl.style.display = 'none';
  } else {
    emptyFixedListMsg.style.display = 'none';
    listaGastosFixosUl.style.display = 'block';
    gastosFixosTemplates.forEach((gasto) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="descricao-fixo">${gasto.description}</span>
        <span class="valor-fixo">R$ ${parseFloat(gasto.value).toFixed(2)}</span>
        <button class="remover-fixo" onclick="removerGastoFixoTemplate(${gasto.id})">Remover</button>
      `;
      listaGastosFixosUl.appendChild(li);
    });
  }
}

async function adicionarGastoFixoTemplate() {
  if (!descricaoFixoInput || !valorFixoInput) return;
  const descricao = descricaoFixoInput.value.trim();
  const valor = parseFloat(valorFixoInput.value);

  if (!descricao || isNaN(valor) || valor <= 0) {
    alert("Preencha a descrição e um valor válido para o modelo de gasto fixo.");
    return;
  }

  const novoTemplate = await fetchAPI('/api/fixed-expenses-templates', 'POST', { descricao, valor });
  if (novoTemplate) {
    gastosFixosTemplates.push(novoTemplate);
    descricaoFixoInput.value = '';
    valorFixoInput.value = '';
    renderizarGastosFixosTemplates();
  }
}

async function removerGastoFixoTemplate(templateId) {
  
  console.log("Frontend: Tentando remover modelo de gasto fixo com ID:", templateId);
  if (confirm("Tem certeza que deseja remover este modelo de gasto fixo? Isso não removerá gastos já repassados.")) {
    const result = await fetchAPI(`/api/fixed-expenses-templates/${templateId}`, 'DELETE');
    if (result && result.success) {
      gastosFixosTemplates = gastosFixosTemplates.filter(t => t.id !== templateId);
      renderizarGastosFixosTemplates();
    }
   
  }
}

async function repassarGastosFixosParaMeses() {
  if (gastosFixosTemplates.length === 0) {
    alert("Nenhum modelo de gasto fixo cadastrado para repassar.");
    return;
  }
  const result = await fetchAPI('/api/expenses/repass-fixed', 'POST');
  if (result) {
    alert(result.message || "Gastos fixos repassados.");
    const expensesData = await fetchAPI('/api/expenses');
    if (expensesData) {
         gastos = expensesData.map(g => ({...g, valor: g.value }));
         renderizarGastosETotal();
    }
  }
}

function formatarData(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function atualizarVisibilidadeBotaoLimpar() {
  if (!btnLimparTodosGastosUsuario) return;
  if (gastos.length > 0) {
    btnLimparTodosGastosUsuario.style.display = 'block';
  } else {
    btnLimparTodosGastosUsuario.style.display = 'none';
  }
}



async function adicionarGasto() {
  if (!descricaoInput || !valorInput || !dataInput) {
    console.error("Inputs do formulário de gastos variáveis não encontrados.");
    return;
  }
  const descricao = descricaoInput.value.trim();
  const valor = parseFloat(valorInput.value);
  const dataValor = dataInput.value;

  if (!descricao || isNaN(valor) || valor <= 0 || !dataValor) {
    alert("Preencha todos os campos do gasto variável corretamente (descrição, valor positivo e data).");
    return;
  }
  const testDate = new Date(dataValor + 'T00:00:00');
  if (!dataValor.match(/^\d{4}-\d{2}-\d{2}$/) || !(testDate && testDate.toISOString().slice(0,10) === dataValor)) {
    alert("Formato de data inválido ou data inexistente. Use AAAA-MM-DD.");
    return;
  }

  const novoGasto = await fetchAPI('/api/expenses', 'POST', { descricao, valor, data: dataValor });
  console.log("Gasto retornado pela API:", novoGasto);

  if (novoGasto) {
    gastos.push({...novoGasto, valor: novoGasto.value });
    console.log("Array gastos após push:", JSON.parse(JSON.stringify(gastos)));
    
    descricaoInput.value = '';
    valorInput.value = '';
    dataInput.value = '';
    
    console.log("Chamando renderizarGastosETotal após adicionar gasto");
    renderizarGastosETotal();
  }
}



async function adicionarGasto() {
  if (!descricaoInput || !valorInput || !dataInput) {
    console.error("Inputs do formulário de gastos variáveis não encontrados.");
    return;
  }
  const descricao = descricaoInput.value.trim();
  const valor = parseFloat(valorInput.value);
  const dataValor = dataInput.value;

  if (!descricao || isNaN(valor) || valor <= 0 || !dataValor) {
    alert("Preencha todos os campos do gasto variável corretamente (descrição, valor positivo e data).");
    return;
  }
  const testDate = new Date(dataValor + 'T00:00:00');
  if (!dataValor.match(/^\d{4}-\d{2}-\d{2}$/) || !(testDate && testDate.toISOString().slice(0,10) === dataValor)) {
    alert("Formato de data inválido ou data inexistente. Use AAAA-MM-DD.");
    return;
  }

  const novoGasto = await fetchAPI('/api/expenses', 'POST', { descricao, valor, data: dataValor });
  console.log("Gasto retornado pela API:", novoGasto);

  if (novoGasto) {
    
    const gastoParaArray = {
        id: novoGasto.id,
        user_id: novoGasto.user_id,
        description: novoGasto.description,
        value: novoGasto.value, 
        valor: novoGasto.value, 
        date: novoGasto.data     
    };
    gastos.push(gastoParaArray);
    console.log("Array gastos após push:", JSON.parse(JSON.stringify(gastos)));

    descricaoInput.value = '';
    valorInput.value = '';
    dataInput.value = '';
    
    console.log("Chamando renderizarGastosETotal após adicionar gasto");
    renderizarGastosETotal();
  }
}

function renderizarGastosETotal() {
  console.log("Dentro de renderizarGastosETotal. Mês Filtro Ativo:", mesFiltroAtivo, "Ano Atual:", anoAtual);

  const tbody = document.querySelector('#tabelaGastos tbody');
  if (!tbody) {
      console.warn("Elemento tbody da tabela de gastos não encontrado.");
      return;
  }
  tbody.innerHTML = '';
  let totalMes = 0;
  let countGastosNoMesAtual = 0;

  const gastosOrdenados = [...gastos].sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log("Gastos ordenados para renderização:", JSON.parse(JSON.stringify(gastosOrdenados)));

  gastosOrdenados.forEach((g) => {
    console.log("Objeto g no início do forEach:", JSON.parse(JSON.stringify(g)));
    console.log("Tipo de g.date:", typeof g.date, "Valor de g.date:", g.date); 
    console.log("Condição '!g.date' resulta em:", !g.date);
    
    
    if (typeof g.date !== 'string' || g.date.trim() === '') {
        console.warn("Gasto com 'date' inválida (não é string ou está vazia):", g);
        return; 
    }
    const dataGasto = new Date(g.date + 'T00:00:00');

    
    if (isNaN(dataGasto.getTime())) {
        console.warn("Objeto Date inválido criado a partir de g.date:", g.date, "Gasto:", g);
        return;
    }

    console.log(
        "Verificando gasto:", g.description,
        "Data do gasto:", g.date,
        "Objeto Date:", dataGasto.toISOString(),
        "Mês do gasto (0-11):", dataGasto.getMonth(),
        "Ano do gasto:", dataGasto.getFullYear(),
        "Condição do Mês:", dataGasto.getMonth() === parseInt(mesFiltroAtivo),
        "Condição do Ano:", dataGasto.getFullYear() === anoAtual,
        "Passou no filtro?:", (dataGasto.getMonth() === parseInt(mesFiltroAtivo) && dataGasto.getFullYear() === anoAtual)
    );

    if (dataGasto.getMonth() === parseInt(mesFiltroAtivo) && dataGasto.getFullYear() === anoAtual) {
      countGastosNoMesAtual++;
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', g.id);

      const descricaoEscapada = g.description.replace(/'/g, "\\'");

      tr.innerHTML = `
        <td class="descricao">
          <span>${g.description}</span>
          <button class="edit-btn" onclick="editarCampo(${g.id}, 'descricao', '${descricaoEscapada}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td class="valor">
          <span>R$ ${g.valor.toFixed(2)}</span>
          <button class="edit-btn" onclick="editarCampo(${g.id}, 'valor', ${g.valor})">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td class="data">
          <span>${formatarData(g.date)}</span>
          <button class="edit-btn" onclick="editarCampo(${g.id}, 'data', '${g.date}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td>
          <button class="remover" onclick="removerGasto(${g.id})">Remover</button>
        </td>
      `;
      tbody.appendChild(tr);
      console.log("Linha TR adicionada ao tbody. Conteúdo do tbody:", tbody.innerHTML); 
    }
  });

  console.log("Total de gastos renderizados para o mês:", countGastosNoMesAtual);

  const mesSelecionadoNome = meses[parseInt(mesFiltroAtivo)];
  const totalElement = document.getElementById('total');
  if (totalElement) {
      totalElement.innerText = `Total de ${mesSelecionadoNome}: R$ ${totalMes.toFixed(2)}`;
  }

  document.querySelectorAll('.month').forEach(monthEl => {
    if (parseInt(monthEl.getAttribute('data-month')) === parseInt(mesFiltroAtivo)) {
      monthEl.classList.add('active');
    } else {
      monthEl.classList.remove('active');
    }
  });
  atualizarVisibilidadeBotaoLimpar();
}

function renderizarGastosETotal() {
  console.log("Dentro de renderizarGastosETotal. Mês Filtro Ativo:", mesFiltroAtivo, "Ano Atual:", anoAtual); // LOG 1

  const tbody = document.querySelector('#tabelaGastos tbody');
  if (!tbody) {
      console.warn("Elemento tbody da tabela de gastos não encontrado.");
      return;
  }
  tbody.innerHTML = '';
  let totalMes = 0;
  let countGastosNoMesAtual = 0;

  
  const gastosOrdenados = [...gastos].sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log("Gastos ordenados para renderização:", JSON.parse(JSON.stringify(gastosOrdenados))); 

  gastosOrdenados.forEach((g) => {
    
    if (!g.date) {
        console.warn("Gasto sem data encontrado:", g);
        return; 
    }
   
    const dataGasto = new Date(g.date + 'T00:00:00');

    
    console.log(
        "Verificando gasto:", g.description,
        "Data do gasto:", g.date,
        "Objeto Date:", dataGasto.toISOString(),
        "Mês do gasto (0-11):", dataGasto.getMonth(),
        "Ano do gasto:", dataGasto.getFullYear(),
        "Condição do Mês:", dataGasto.getMonth() === parseInt(mesFiltroAtivo), 
        "Condição do Ano:", dataGasto.getFullYear() === anoAtual,
        "Passou no filtro?:", (dataGasto.getMonth() === parseInt(mesFiltroAtivo) && dataGasto.getFullYear() === anoAtual)
    ); 

    if (dataGasto && dataGasto.getMonth() === parseInt(mesFiltroAtivo) && dataGasto.getFullYear() === anoAtual) {
      countGastosNoMesAtual++;
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', g.id);

      const descricaoEscapada = g.description.replace(/'/g, "\\'");

      tr.innerHTML = `
        <td class="descricao">
          <span>${g.description}</span>
          <button class="edit-btn" onclick="editarCampo(${g.id}, 'descricao', '${descricaoEscapada}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td class="valor">
          <span>R$ ${g.valor.toFixed(2)}</span>
          <button class="edit-btn" onclick="editarCampo(${g.id}, 'valor', ${g.valor})">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td class="data">
          <span>${formatarData(g.date)}</span>
          <button class="edit-btn" onclick="editarCampo(${g.id}, 'data', '${g.date}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td>
          <button class="remover" onclick="removerGasto(${g.id})">Remover</button>
        </td>
      `;
      tbody.appendChild(tr);
      totalMes += g.valor;
    }
  });

  console.log("Total de gastos renderizados para o mês:", countGastosNoMesAtual); 

  const mesSelecionadoNome = meses[parseInt(mesFiltroAtivo)]; 
  const totalElement = document.getElementById('total');
  if (totalElement) {
      totalElement.innerText = `Total de ${mesSelecionadoNome}: R$ ${totalMes.toFixed(2)}`;
  }

  document.querySelectorAll('.month').forEach(monthEl => {
    if (parseInt(monthEl.getAttribute('data-month')) === parseInt(mesFiltroAtivo)) {
      monthEl.classList.add('active');
    } else {
      monthEl.classList.remove('active');
    }
  });
  atualizarVisibilidadeBotaoLimpar();
}



async function editarCampo(gastoId, campo, valorAtual) {
   console.log("Frontend: Tentando editar campo para gastoId:", gastoId, "Campo:", campo, "Valor Atual:", valorAtual);
    const gasto = gastos.find(g => g.id === gastoId);
    if (!gasto) {
        alert("Gasto não encontrado para edição.");
        return;
    }

    let novoValorPrompt; 
    let updatedData = { description: gasto.description, value: gasto.valor, date: gasto.date };

    if (campo === 'descricao') {
        novoValorPrompt = prompt("Edite a descrição:", valorAtual);
        if (novoValorPrompt !== null && novoValorPrompt.trim() !== '') {
            updatedData.description = novoValorPrompt.trim();
        } else if (novoValorPrompt !== null) {
            alert("Descrição não pode ser vazia."); return;
        } else return;
    } else if (campo === 'valor') {
        const valorAtualFormatado = parseFloat(valorAtual).toFixed(2).replace(".", ",");
        novoValorPrompt = prompt("Edite o valor (R$):", valorAtualFormatado);
        if (novoValorPrompt !== null) {
            const valorFloat = parseFloat(novoValorPrompt.replace(",", "."));
            if (!isNaN(valorFloat) && valorFloat >= 0) {
                updatedData.value = valorFloat;
            } else {
                alert("Valor inválido."); return;
            }
        } else return;
    } else if (campo === 'data') {
        novoValorPrompt = prompt("Edite a data (AAAA-MM-DD):", valorAtual);
        if (novoValorPrompt !== null && /^\d{4}-\d{2}-\d{2}$/.test(novoValorPrompt)) {
            const testDate = new Date(novoValorPrompt + 'T00:00:00');
            if (testDate && testDate.toISOString().slice(0,10) === novoValorPrompt) {
                 updatedData.date = novoValorPrompt;
            } else {
                alert("Data inválida (ex: dia ou mês inexistente). Use AAAA-MM-DD."); return;
            }
        } else if (novoValorPrompt !== null) {
            alert("Formato de data inválido. Use AAAA-MM-DD."); return;
        } else return;
    } else {
        return;
    }

    const result = await fetchAPI(`/api/expenses/${gastoId}`, 'PUT', updatedData);
    if (result) {
        const gastoIndex = gastos.findIndex(g => g.id === gastoId);
        if (gastoIndex !== -1) {
            gastos[gastoIndex] = {
                ...gastos[gastoIndex],
                description: updatedData.description,
                valor: updatedData.value,
                date: updatedData.date,
            };
        }
        renderizarGastosETotal();
    }
}

async function removerGasto(gastoId) {
  console.log("Frontend: Tentando remover gasto com ID:", gastoId);
  if (confirm("Tem certeza que deseja remover este gasto?")) {
    const result = await fetchAPI(`/api/expenses/${gastoId}`, 'DELETE');
    if (result && result.success) {
      gastos = gastos.filter(g => g.id !== gastoId);
      renderizarGastosETotal();
    }
  }
}

async function limparTodosGastosDoUsuario() {
  if (gastos.length === 0) {
    alert("Não há gastos para limpar.");
    return;
  }
  if (confirm("Tem certeza que deseja remover TODOS os seus gastos? Esta ação não pode ser desfeita.")) {
    const result = await fetchAPI('/api/expenses/all', 'DELETE');
    if (result && result.success) {
      gastos = [];
      renderizarGastosETotal();
      alert(result.message || "Todos os seus gastos foram removidos.");
    }
  }
}