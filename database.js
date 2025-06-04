
const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT
            );

            CREATE TABLE IF NOT EXISTS fixed_expense_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                description TEXT,
                value REAL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                description TEXT,
                value REAL,
                date TEXT,
                is_from_template INTEGER DEFAULT 0, -- 0 para falso, 1 para verdadeiro
                template_id INTEGER DEFAULT NULL, -- Opcional: link para o modelo
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `, (err) => {
            if (err) {
                
                console.error("Erro ao criar tabelas:", err.message);
            } else {
                console.log("Tabelas verificadas/criadas com sucesso.");
            }
        });
    }
});

module.exports = db;