// fasthotel-api/routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');

// Rota para iniciar uma nova conversa de chat
// Pode ser acessada por hóspedes (se tiverem login) ou pela recepção
router.post(
    '/',
    auth,
    authorize(['admin', 'recepcionista', 'hospede']), // Permite que hóspedes também criem conversas
    chatController.createConversation
);

// Rota para listar todas as conversas de chat (para a recepção)
router.get(
    '/',
    auth,
    authorize(['admin', 'recepcionista']),
    chatController.getConversations
);

// Rota para obter as mensagens de uma conversa específica
router.get(
    '/:conversaId/mensagens',
    auth,
    authorize(['admin', 'recepcionista', 'hospede']), // Hóspede pode ver suas próprias mensagens
    chatController.getMessagesByConversationId
);

// Rota para marcar mensagens como lidas (opcional, mas útil)
router.put(
    '/:conversaId/mensagens/lida',
    auth,
    authorize(['admin', 'recepcionista', 'hospede']),
    chatController.markMessagesAsRead
);

module.exports = router;