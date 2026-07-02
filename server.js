const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Diz ao servidor para exibir a sua Interface (os arquivos da pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// Esqueleto das rotas que o seu Frontend vai usar
app.post('/api/auth/login', (req, res) => {
    res.json({ mensagem: "Login simulado. O banco de dados será conectado em breve." });
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

// Define a porta que o Railway vai usar
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
