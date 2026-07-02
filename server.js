const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Permite que o seu site (frontend) converse com este servidor
app.use(cors());
// Permite que o servidor entenda dados em formato JSON
app.use(express.json());

// Rota de teste para ver se o servidor está online
app.get('/', (req, res) => {
    res.send('Motor do sistema online e rodando perfeitamente!');
});

// Esqueleto das rotas que o seu Frontend vai usar no futuro
app.post('/api/auth/login', (req, res) => {
    res.json({ mensagem: "Login simulado com sucesso. O banco de dados será conectado em breve." });
});

app.get('/api/videos', (req, res) => {
    res.json({ videos: [], mensagem: "Lista de vídeos vazia. Banco de dados pendente." });
});

// Define a porta que o Railway vai usar
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
