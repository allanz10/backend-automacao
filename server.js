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
            // Adicione isto dentro da função initDB() no server.js
await pool.query(`
    CREATE TABLE IF NOT EXISTS social_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        platform VARCHAR(50) DEFAULT 'instagram',
        instagram_id VARCHAR(100),
        username VARCHAR(100),
        access_token TEXT,
        expires_at TIMESTAMP,
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

// Adicione esta rota ao seu server.js
app.post('/api/add-account', async (req, res) => {
    const { username, token } = req.body; // Verifique se o nome do campo é 'token' ou 'access_token' conforme seu HTML
    const userId = req.user.id; 

    if (!username || !token) {
        return res.status(400).json({ error: 'Usuário e Token são obrigatórios' });
    }

    try {
        // Insere a conta no banco de dados
        await db.query(
            'INSERT INTO social_accounts (user_id, username, access_token) VALUES ($1, $2, $3)',
            [userId, username, token]
        );
        
        res.json({ success: true, message: 'Conta conectada com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar conta:', err);
        res.status(500).json({ error: 'Erro interno ao salvar no banco' });
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
// Rota real para listar as contas conectadas
// Rota blindada para listar as contas conectadas sem travar o site
app.get('/api/accounts', async (req, res) => {
    try {
        // Tenta buscar as contas no banco de dados
        const result = await pool.query(
            'SELECT id, platform, instagram_id, username, created_at FROM social_accounts WHERE user_id = $1 ORDER BY created_at DESC',
            [1]
        );
        
        // Se deu tudo certo, envia os dados encontrados
        return res.json(result.rows || []);
    } catch (err) {
        // Se o banco falhar ou a tabela não existir, avisa o log...
        console.error("Aviso: Não foi possível ler a tabela social_accounts:", err.message);
        
        // ...mas devolve uma lista vazia para o site NÃO TRAVAR na tela cinza!
        return res.json([]);
    }
});
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
    // O Facebook manda o código de autorização pela URL
    const { code } = req.query;

    if (!code) {
        return res.send("Erro: Código de autorização não recebido da Meta.");
    }

    try {
        // 1. Trocar o 'code' pelo Token de Acesso de Curta Duração
        const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.REDIRECT_URI}&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`);
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error("Erro no Token:", tokenData.error);
            return res.send("Erro ao obter o token primário do Facebook.");
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Trocar por um Token de Longa Duração (Dura 60 dias)
        const longTokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`);
        const longTokenData = await longTokenResponse.json();
        const accessToken = longTokenData.access_token || shortLivedToken;

        // 3. Obter o ID do Perfil
        const profileResponse = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`);
        const profileData = await profileResponse.json();

        // Calcula a data de validade (60 dias a partir de hoje)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);

        // 4. Salvar ou Atualizar no Banco de Dados
        // Nota: Em um sistema completo, pegaríamos o ID do usuário logado através de sessão ou token JWT enviado no parâmetro 'state'.
        // Aqui usaremos o user_id = 1 (você, o administrador principal) como padrão para garantir que funcione de imediato.
        const userId = 1; 

        const existing = await pool.query('SELECT id FROM social_accounts WHERE instagram_id = $1', [profileData.id]);
        
        if (existing.rows.length > 0) {
            // Se a conta já existir no banco, apenas atualiza o token e a validade
            await pool.query(
                'UPDATE social_accounts SET access_token = $1, expires_at = $2 WHERE instagram_id = $3', 
                [accessToken, expiresAt, profileData.id]
            );
        } else {
            // Se for uma conta nova, insere todos os dados
            await pool.query(
                'INSERT INTO social_accounts (user_id, platform, instagram_id, username, access_token, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', 
                [userId, 'instagram', profileData.id, profileData.name, accessToken, expiresAt]
            );
        }

        // 5. Redirecionar de volta para o seu site no Railway
        res.redirect('https://aspas7-production.up.railway.app');

    } catch (err) {
        console.error("Erro no Callback:", err);
        res.send("Erro interno do servidor ao processar a conexão com o Instagram.");
    }
});
