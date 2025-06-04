// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database.js');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('site'));

const JWT_SECRET = 'sua-chave-muito-secreta-mude-isso';
const ANO_ATUAL = new Date().getFullYear();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios." });
    }

    const hashedPassword = bcrypt.hashSync(password, 8);

    const sql = 'INSERT INTO users (username, password) VALUES (?,?)';
    db.run(sql, [username, hashedPassword], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed: users.username')) {
                return res.status(409).json({ message: "Nome de usuário já existe." });
            }
            return res.status(500).json({ message: "Erro ao registrar usuário.", error: err.message });
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
            return res.status(500).json({ message: "Erro ao fazer login.", error: err.message });
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
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/fixed-expenses-templates', authenticateToken, (req, res) => {
    const { descricao, valor } = req.body;
    if (!descricao || isNaN(parseFloat(valor)) || parseFloat(valor) <=0) {
        return res.status(400).json({error: "Entrada inválida para modelo de despesa fixa."})
    }
    const sql = "INSERT INTO fixed_expense_templates (user_id, description, value) VALUES (?, ?, ?)";
    db.run(sql, [req.user.id, descricao, parseFloat(valor)], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, user_id: req.user.id, description: descricao, value: parseFloat(valor) });
    });
});


app.delete('/api/fixed-expenses-templates/:id', authenticateToken, (req, res) => {
    console.log(`Backend: Recebida requisição DELETE para /api/fixed-expenses-templates/${req.params.id}`);
    console.log(`Backend: User ID do token: ${req.user.id}`);
    console.log(`Backend: ID do template (req.params.id): ${req.params.id}`);

    const sql = "DELETE FROM fixed_expense_templates WHERE id = ? AND user_id = ?";
    db.run(sql, [req.params.id, req.user.id], function(err) {
        if (err) {
            console.error("Backend: Erro ao executar SQL DELETE template:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Backend: SQL DELETE template executado. Linhas alteradas: ${this.changes}`);
        if (this.changes === 0) {
            return res.status(404).json({ message: "Modelo não encontrado ou não pertence ao usuário." });
        }
        
        res.status(200).json({ message: "Modelo de despesa fixa excluído.", success: true });
    });
});

app.post('/api/expenses/repass-fixed', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const templatesSql = "SELECT * FROM fixed_expense_templates WHERE user_id = ?";
        const templates = await new Promise((resolve, reject) => {
            db.all(templatesSql, [userId], (err, rows) => err ? reject(err) : resolve(rows));
        });

        if (templates.length === 0) {
            return res.status(400).json({ message: "Nenhum modelo de despesa fixa encontrado para este usuário." });
        }

        let addedCount = 0;
        const insertExpenseSql = "INSERT INTO expenses (user_id, description, value, date, is_from_template, template_id) VALUES (?, ?, ?, ?, 1, ?)";

        for (let mes = 0; mes < 12; mes++) {
            const primeiroDiaDoMes = `${ANO_ATUAL}-${String(mes + 1).padStart(2, '0')}-01`;
            for (const template of templates) {
                const checkSql = `SELECT id FROM expenses WHERE user_id = ? AND description = ? AND value = ? AND date = ? AND template_id = ?`;
                const existing = await new Promise((resolve, reject) => {
                    db.get(checkSql, [userId, template.description, template.value, primeiroDiaDoMes, template.id], (err, row) => err ? reject(err) : resolve(row));
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
        res.status(200).json({ message: `${addedCount} despesas fixas repassadas com sucesso.` });
    } catch (error) {
        console.error("Erro ao repassar despesas fixas:", error);
        res.status(500).json({ error: "Falha ao repassar despesas fixas.", details: error.message });
    }
});

app.get('/api/expenses', authenticateToken, (req, res) => {
    const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC";
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/expenses', authenticateToken, (req, res) => {
    const { descricao, valor, data } = req.body;
     if (!descricao || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0 || !data ) {
        return res.status(400).json({error: "Entrada inválida para despesa."})
    }
    const sql = "INSERT INTO expenses (user_id, description, value, date, is_from_template) VALUES (?, ?, ?, ?, 0)";
    db.run(sql, [req.user.id, descricao, parseFloat(valor), data], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, user_id: req.user.id, description: descricao, value: parseFloat(valor), data: data });
    });
});

app.put('/api/expenses/:id', authenticateToken, (req, res) => {
    const { descricao, valor, data } = req.body;
     if (!descricao || isNaN(parseFloat(valor)) || parseFloat(valor) < 0 || !data ) {
        return res.status(400).json({error: "Entrada inválida para atualização de despesa."})
    }
    const sql = "UPDATE expenses SET description = ?, value = ?, date = ? WHERE id = ? AND user_id = ?";
    db.run(sql, [descricao, parseFloat(valor), data, req.params.id, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Despesa não encontrada ou não pertence ao usuário." });
        }
        res.status(200).json({ message: "Despesa atualizada." });
    });
});

app.delete('/api/expenses/all', authenticateToken, (req, res) => {
    console.log(`Backend: Recebida requisição DELETE para /api/expenses/all (rota correta)`);
    console.log(`Backend: User ID do token: ${req.user.id}`);
    const sql = "DELETE FROM expenses WHERE user_id = ?";
    db.run(sql, [req.user.id], function(err) {
        if (err) {
            console.error("Backend: Erro ao executar SQL DELETE ALL:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Backend: SQL DELETE ALL executado. Linhas alteradas: ${this.changes}`);
        res.status(200).json({ message: `Todas as ${this.changes} despesas foram excluídas para o usuário.`, success: true });
    });
});

app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
    if (isNaN(parseInt(req.params.id))) {
        return res.status(400).json({ message: "ID da despesa inválido." });
    }
    console.log(`Backend: Recebida requisição DELETE para /api/expenses/${req.params.id}`);
    console.log(`Backend: User ID do token: ${req.user.id}`);
    console.log(`Backend: ID da despesa (req.params.id): ${req.params.id}`);

    const sql = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
    db.run(sql, [req.params.id, req.user.id], function(err) {
        if (err) {
            console.error("Backend: Erro ao executar SQL DELETE:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Backend: SQL DELETE executado. Linhas alteradas: ${this.changes}`);
        if (this.changes === 0) {
            return res.status(404).json({ message: "Despesa não encontrada ou não pertence ao usuário." });
        }
        res.status(200).json({ message: "Despesa excluída.", success: true });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse o frontend em http://localhost:${PORT}/login.html ou http://localhost:${PORT}/index.html (após login)`);
});