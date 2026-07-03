const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o Banco de Dados
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-super-segura-123';

// Cria a tabela de usuários automaticamente se ela não existir
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                password VARCHAR(255),
                role VARCHAR(20) DEFAULT 'user',
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Adicione isto dentro da função initDB, logo após a criação da tabela de usuários:
await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255),
        caption TEXT,
        video_url TEXT,
        status VARCHAR(50) DEFAULT 'pendente',
        scheduled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);
        console.log('✅ Tabela de usuários pronta!');
    } catch (err) {
        console.error('❌ Erro ao criar tabelas:', err);
    }
}
initDB();

// ---------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO (O funcionamento real do sistema!)
// ---------------------------------------------------------

// Rota para Criar Conta (Signup)
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Verifica se o e-mail já existe
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'E-mail já cadastrado' });
        }
        
        // Criptografa a senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // O primeiro usuário a se cadastrar vira 'admin', os próximos viram 'user'
        const allUsers = await pool.query('SELECT id FROM users LIMIT 1');
        const role = allUsers.rows.length === 0 ? 'admin' : 'user';

        // Salva no banco de dados
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        const user = newUser.rows[0];
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro no servidor' });
    }
});

// Rota para Entrar (Login)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Busca o usuário pelo e-mail
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Usuário não encontrado' });
        }

        const user = result.rows[0];
        
        // Compara as senhas
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ success: false, error: 'Senha incorreta' });
        }

        // Se estiver tudo certo, gera a chave de acesso (token)
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            success: true, 
            token, 
            user: { id: user.id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro no servidor' });
    }
});

// Checa a sessão ao atualizar a página
app.get('/api/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.json({ user: null });

        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.userId]);
        
        if (result.rows.length > 0) res.json({ user: result.rows[0] });
        else res.json({ user: null });
    } catch (err) {
        res.json({ user: null });
    }
});

// Rotas placeholder para a interface não dar erro
app.get('/api/videos', (req, res) => res.json({ videos: [], counts: { todos: 0 } }));
app.get('/api/accounts', (req, res) => res.json([]));
app.get('/api/dashboard', (req, res) => res.json({ stats: { total: 0 } }));
app.get('/api/categories', (req, res) => res.json([]));
app.get('/api/captions', (req, res) => res.json([]));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Rota que inicia o Login com Instagram/Facebook
app.get('/api/auth/facebook', (req, res) => {
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=instagram_basic,instagram_content_publish,pages_read_engagement`;
    res.json({ url: authUrl });
});

// Rota de retorno que o Facebook vai chamar
app.get('/api/auth/facebook/callback', async (req, res) => {
    const { code } = req.query;
    // Aqui o servidor usa o 'code' para trocar pelo Token de acesso
    // e salva esse token no banco de dados para o usuário logado.
    res.send("Conexão recebida! (Lógica de troca de token em desenvolvimento)");
});
