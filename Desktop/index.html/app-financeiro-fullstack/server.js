// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path'); // Para lidar com caminhos de arquivos
const db = require('./database.js');

const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do diretório 'site'
app.use(express.static(path.join(__dirname, 'site')));


// Use uma variável de ambiente para o segredo JWT em produção
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-muito-secreta-mude-isso-para-algo-forte';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Não autorizado

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Proibido (token inválido ou expirado)
        req.user = user;
        next();
    });
};

app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios." });
    }
    if (password.length < 6) { // Exemplo de validação de senha
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10); // Aumentado o salt rounds

    const sql = 'INSERT INTO users (username, password) VALUES (?,?)';
    db.run(sql, [username, hashedPassword], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed: users.username')) {
                return res.status(409).json({ message: "Nome de usuário já existe." });
            }
            console.error("Erro ao registrar usuário:", err.message);
            return res.status(500).json({ message: "Erro interno ao registrar usuário."});
        }
        res.status(201).json({ message: "Usuário registrado com sucesso!", userId: this.lastID });
    });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios." });
    }

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err) {
            console.error("Erro ao fazer login (db.get):", err.message);
            return res.status(500).json({ message: "Erro interno ao tentar fazer login." });
        }
        if (!user) {
            return res.status(401).json({ message: "Credenciais inválidas." });
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ message: "Credenciais inválidas." });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
            expiresIn: '24h'
        });
        res.status(200).json({ message: "Login bem-sucedido!", token: token, username: user.username });
    });
});

app.get('/api/fixed-expenses-templates', authenticateToken, (req, res) => {
    const sql = "SELECT * FROM fixed_expense_templates WHERE user_id = ?";
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar modelos de despesas fixas:", err.message);
            return res.status(500).json({ error: "Erro interno ao buscar modelos de despesas fixas." });
        }
        res.json(rows);
    });
});

app.post('/api/fixed-expenses-templates', authenticateToken, (req, res) => {
    const { description, value } = req.body; // Frontend envia 'description' e 'value'
    if (!description || typeof description !== 'string' || description.trim() === '' || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        return res.status(400).json({error: "Entrada inválida para modelo de despesa fixa. Descrição e valor positivo são obrigatórios."})
    }
    const sql = "INSERT INTO fixed_expense_templates (user_id, description, value) VALUES (?, ?, ?)";
    db.run(sql, [req.user.id, description.trim(), parseFloat(value)], function(err) {
        if (err) {
            console.error("Erro ao inserir modelo de despesa fixa:", err.message);
            return res.status(500).json({ error: "Erro interno ao criar modelo de despesa fixa." });
        }
        res.status(201).json({ id: this.lastID, user_id: req.user.id, description: description.trim(), value: parseFloat(value) });
    });
});


app.delete('/api/fixed-expenses-templates/:id', authenticateToken, (req, res) => {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
        return res.status(400).json({ message: "ID do modelo inválido." });
    }
    // console.log(`Backend: Recebida requisição DELETE para /api/fixed-expenses-templates/${templateId}`);
    // console.log(`Backend: User ID do token: ${req.user.id}`);

    const sql = "DELETE FROM fixed_expense_templates WHERE id = ? AND user_id = ?";
    db.run(sql, [templateId, req.user.id], function(err) {
        if (err) {
            console.error("Backend: Erro ao executar SQL DELETE template:", err.message);
            return res.status(500).json({ error: "Erro interno ao excluir modelo." });
        }
        // console.log(`Backend: SQL DELETE template executado. Linhas alteradas: ${this.changes}`);
        if (this.changes === 0) {
            return res.status(404).json({ message: "Modelo não encontrado ou não pertence ao usuário." });
        }
        res.status(200).json({ message: "Modelo de despesa fixa excluído.", success: true });
    });
});

app.post('/api/expenses/repass-fixed', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const anoCorrenteParaRepasse = new Date().getFullYear(); // Obter dinamicamente

    // Usar uma transação para garantir atomicidade
    db.serialize(async () => {
        try {
            await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', err => err ? reject(err) : resolve()));

            const templatesSql = "SELECT * FROM fixed_expense_templates WHERE user_id = ?";
            const templates = await new Promise((resolve, reject) => {
                db.all(templatesSql, [userId], (err, rows) => err ? reject(err) : resolve(rows));
            });

            if (templates.length === 0) {
                await new Promise((resolve, reject) => db.run('ROLLBACK', err => err ? reject(err) : resolve()));
                return res.status(400).json({ message: "Nenhum modelo de despesa fixa encontrado para este usuário." });
            }

            let addedCount = 0;
            const insertExpenseSql = "INSERT INTO expenses (user_id, description, value, date, is_from_template, template_id) VALUES (?, ?, ?, ?, 1, ?)";

            for (let mes = 0; mes < 12; mes++) {
                const primeiroDiaDoMes = `${anoCorrenteParaRepasse}-${String(mes + 1).padStart(2, '0')}-01`;
                for (const template of templates) {
                    const checkSql = `SELECT id FROM expenses WHERE user_id = ? AND template_id = ? AND date LIKE ?`;
                    // Verifica se já existe uma despesa originada deste template para o mês/ano específico
                    const existing = await new Promise((resolve, reject) => {
                         db.get(checkSql, [userId, template.id, `${anoCorrenteParaRepasse}-${String(mes + 1).padStart(2, '0')}-%`], (err, row) => err ? reject(err) : resolve(row));
                    });

                    if (!existing) {
                        await new Promise((resolve, reject) => {
                            db.run(insertExpenseSql, [userId, template.description, template.value, primeiroDiaDoMes, template.id], function(err) {
                                if (err) reject(err);
                                else {
                                    addedCount++;
                                    resolve();
                                }
                            });
                        });
                    }
                }
            }
            await new Promise((resolve, reject) => db.run('COMMIT', err => err ? reject(err) : resolve()));
            res.status(200).json({ message: `${addedCount} despesas fixas repassadas com sucesso para ${anoCorrenteParaRepasse}.` });

        } catch (error) {
            await new Promise((resolve, reject) => db.run('ROLLBACK', err => console.error("Erro no rollback:", err) /* Não rejeitar para evitar erro não tratado */));
            console.error("Erro ao repassar despesas fixas:", error);
            res.status(500).json({ error: "Falha ao repassar despesas fixas.", details: error.message });
        }
    });
});

app.get('/api/expenses', authenticateToken, (req, res) => {
    const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC";
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar despesas:", err.message);
            return res.status(500).json({ error: "Erro interno ao buscar despesas." });
        }
        res.json(rows);
    });
});

app.post('/api/expenses', authenticateToken, (req, res) => {
    const { description, value, date } = req.body; // Frontend envia 'description', 'value' e 'date'
     if (!description || typeof description !== 'string' || description.trim() === '' ||
         isNaN(parseFloat(value)) || parseFloat(value) <= 0 ||
         !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ) {
        return res.status(400).json({error: "Entrada inválida para despesa. Descrição, valor positivo e data (AAAA-MM-DD) são obrigatórios."})
    }
    const sql = "INSERT INTO expenses (user_id, description, value, date, is_from_template) VALUES (?, ?, ?, ?, 0)";
    db.run(sql, [req.user.id, description.trim(), parseFloat(value), date], function(err) {
        if (err) {
            console.error("Erro ao inserir despesa:", err.message);
            return res.status(500).json({ error: "Erro interno ao criar despesa." });
        }
        // Retorna o objeto completo para o frontend, incluindo o 'value' e 'date' corretos
        res.status(201).json({ id: this.lastID, user_id: req.user.id, description: description.trim(), value: parseFloat(value), date: date, is_from_template: 0, template_id: null });
    });
});

app.put('/api/expenses/:id', authenticateToken, (req, res) => {
    const expenseId = parseInt(req.params.id);
    const { description, value, date } = req.body; // Frontend envia 'description', 'value' e 'date'

    if (isNaN(expenseId)) {
        return res.status(400).json({ message: "ID da despesa inválido." });
    }
    if (!description || typeof description !== 'string' || description.trim() === '' ||
        isNaN(parseFloat(value)) || parseFloat(value) < 0 || // Permite 0, mas não negativo
        !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ) {
       return res.status(400).json({error: "Entrada inválida para atualização de despesa. Descrição, valor (não negativo) e data (AAAA-MM-DD) são obrigatórios."})
   }

    const sql = "UPDATE expenses SET description = ?, value = ?, date = ? WHERE id = ? AND user_id = ?";
    db.run(sql, [description.trim(), parseFloat(value), date, expenseId, req.user.id], function(err) {
        if (err) {
            console.error("Erro ao atualizar despesa:", err.message);
            return res.status(500).json({ error: "Erro interno ao atualizar despesa." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Despesa não encontrada ou não pertence ao usuário." });
        }
        res.status(200).json({ message: "Despesa atualizada.", success: true });
    });
});

app.delete('/api/expenses/all', authenticateToken, (req, res) => {
    // console.log(`Backend: Recebida requisição DELETE para /api/expenses/all`);
    // console.log(`Backend: User ID do token: ${req.user.id}`);
    const sql = "DELETE FROM expenses WHERE user_id = ?";
    db.run(sql, [req.user.id], function(err) {
        if (err) {
            console.error("Backend: Erro ao executar SQL DELETE ALL:", err.message);
            return res.status(500).json({ error: "Erro interno ao excluir todas as despesas." });
        }
        // console.log(`Backend: SQL DELETE ALL executado. Linhas alteradas: ${this.changes}`);
        res.status(200).json({ message: `Todas as ${this.changes} despesas foram excluídas para o usuário.`, success: true });
    });
});

app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
        return res.status(400).json({ message: "ID da despesa inválido." });
    }
    // console.log(`Backend: Recebida requisição DELETE para /api/expenses/${expenseId}`);
    // console.log(`Backend: User ID do token: ${req.user.id}`);

    const sql = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
    db.run(sql, [expenseId, req.user.id], function(err) {
        if (err) {
            console.error("Backend: Erro ao executar SQL DELETE:", err.message);
            return res.status(500).json({ error: "Erro interno ao excluir despesa." });
        }
        // console.log(`Backend: SQL DELETE executado. Linhas alteradas: ${this.changes}`);
        if (this.changes === 0) {
            return res.status(404).json({ message: "Despesa não encontrada ou não pertence ao usuário." });
        }
        res.status(200).json({ message: "Despesa excluída.", success: true });
    });
});

// Rota catch-all para servir o index.html para rotas de frontend não API (SPA behavior)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) { // Evita que rotas de API sejam capturadas
        res.sendFile(path.join(__dirname, 'site', 'index.html'));
    } else {
        res.status(404).send('API endpoint not found');
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse o frontend em http://localhost:${PORT}/login.html ou http://localhost:${PORT}/ (após login)`);
});