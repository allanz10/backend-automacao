const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Nova ferramenta do banco de dados
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração da conexão com o Banco de Dados
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Teste para ver se a conexão deu certo
pool.connect()
    .then(() => console.log('✅ Banco de dados conectado com sucesso!'))
    .catch(err => console.error('❌ Erro ao conectar no banco:', err));

// Rotas da interface
app.post('/api/auth/login', (req, res) => {
    res.json({ mensagem: "Login simulado. Banco de dados conectado!" });
});

app.get('/api/videos', (req, res) => {
    res.json({ videos: [], counts: { todos: 0 } });
});

app.get('/api/accounts', (req, res) => {
    res.json([]);
});

app.get('/api/dashboard', (req, res) => {
    res.json({ stats: { total: 0 } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
