// fasthotel-api/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const guestRoutes = require('./routes/guestRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const consumptionRoutes = require('./routes/consumptionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const chatRoutes = require('./routes/chatRoutes'); // Importação das rotas de chat

const http = require('http'); // <-- NOVO/MODIFICADO PARA CHAT: Importa o módulo HTTP
const { Server } = require('socket.io'); // <-- NOVO/MODIFICADO PARA CHAT: Importa o Socket.IO Server

const app = express();
const port = process.env.PORT || 5000;

// Configuração do CORS para Express (HTTP REST API)
app.use(cors());
app.use(express.json());

// Rotas da API REST
app.get('/', (req, res) => {
    res.send('API FastHotel está rodando!');
});

app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.status(200).json({ message: 'Conexão com o banco de dados bem-sucedida!', time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro na conexão com o banco de dados.', error: err.message });
    }
});

// Usar as rotas da API REST
app.use('/api/usuarios', userRoutes);
app.use('/api/quartos', roomRoutes);
app.use('/api/reservas', bookingRoutes);
app.use('/api/hospedes', guestRoutes);
app.use('/api/servicos', serviceRoutes);
app.use('/api/consumos', consumptionRoutes);
app.use('/api/pagamentos', paymentRoutes);
app.use('/api/relatorios', reportRoutes);
app.use('/api/chat', chatRoutes); // Usar as rotas de chat

// --- Configuração do Servidor HTTP para Socket.IO --- // <-- ESSAS SÃO AS LINHAS QUE FALTAVAM
const server = http.createServer(app); // Cria um servidor HTTP a partir do app Express

// Configuração do Socket.IO (permitindo CORS para a porta do React)
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Permita conexões do seu front-end React
        methods: ["GET", "POST"] // Métodos HTTP permitidos para o handshake do CORS do Socket.IO
    }
});

// Eventos do Socket.IO
io.on('connection', (socket) => {
    console.log(`[SOCKET.IO] Usuário conectado: ${socket.id}`);

    socket.on('join_room', (conversa_id) => {
        socket.join(conversa_id);
        console.log(`[SOCKET.IO] Usuário ${socket.id} entrou na sala: ${conversa_id}`);
    });

    socket.on('send_message', async (messageData) => {
        // messageData deve conter: { conversa_id, remetente_tipo, remetente_id_interno, conteudo }
        console.log(`[SOCKET.IO] Mensagem recebida na sala ${messageData.conversa_id}: ${messageData.conteudo}`);

        try {
            // Salvar a mensagem no banco de dados
            const newMessage = await pool.query(
                `INSERT INTO mensagens_chat (conversa_id, remetente_tipo, remetente_id_interno, conteudo)
                 VALUES ($1, $2, $3, $4) RETURNING id, data_envio`,
                [messageData.conversa_id, messageData.remetente_tipo, messageData.remetente_id_interno, messageData.conteudo]
            );

            const fullMessage = {
                ...messageData,
                id: newMessage.rows[0].id,
                data_envio: newMessage.rows[0].data_envio
            };

            // Envia a mensagem para todos os clientes na mesma sala
            io.to(messageData.conversa_id).emit('receive_message', fullMessage);
        } catch (err) {
            console.error('[SOCKET.IO] Erro ao salvar/enviar mensagem:', err.message);
            socket.emit('message_error', { message: 'Falha ao enviar a mensagem.' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[SOCKET.IO] Usuário desconectado: ${socket.id}`);
    });
});

// --- Iniciar o Servidor HTTP (Socket.IO e Express) --- // <-- MODIFICADO: Agora 'server.listen'
server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Servidor Socket.IO rodando em ws://localhost:${port}`);
});