// fasthotel-api/controllers/chatController.js

const pool = require('../config/db');

// @route   POST /api/chat/
// @desc    Cria uma nova conversa de chat
// @access  Private (Admin, Recepcionista, Hospede)
exports.createConversation = async (req, res) => {
    const { hospede_id, atendente_usuario_id } = req.body;

    // TODO: Adicionar validação de entrada (ex: Joi ou Express-validator)
    if (!hospede_id) {
        return res.status(400).json({ message: 'O ID do hóspede é obrigatório para iniciar uma conversa.' });
    }

    try {
        // Verificar se já existe uma conversa "aberta" para este hóspede
        const existingConversation = await pool.query(
            `SELECT * FROM conversas_chat
             WHERE hospede_id = $1 AND status = 'aberta'`,
            [hospede_id]
        );

        if (existingConversation.rows.length > 0) {
            return res.status(200).json({
                message: 'Já existe uma conversa aberta para este hóspede.',
                conversa: existingConversation.rows[0]
            });
        }

        const newConversation = await pool.query(
            `INSERT INTO conversas_chat (hospede_id, atendente_usuario_id)
             VALUES ($1, $2) RETURNING *`,
            [hospede_id, atendente_usuario_id || null] // atendente_usuario_id pode ser nulo no início
        );

        res.status(201).json({
            message: 'Conversa de chat criada com sucesso!',
            conversa: newConversation.rows[0]
        });
    } catch (err) {
        console.error('Erro ao criar conversa de chat:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao criar conversa de chat.' });
    }
};

// @route   GET /api/chat/
// @desc    Lista todas as conversas de chat (para a recepção)
// @access  Private (Admin, Recepcionista)
exports.getConversations = async (req, res) => {
    try {
        // Busca conversas e junta com informações do hóspede e do atendente (se houver)
        const conversations = await pool.query(
            `SELECT
                cc.id AS conversa_id,
                cc.hospede_id,
                h.nome AS hospede_nome,
                h.sobrenome AS hospede_sobrenome,
                h.cpf AS hospede_cpf,
                cc.atendente_usuario_id,
                u.nome AS atendente_nome,
                -- u.sobrenome AS atendente_sobrenome, -- <--- LINHA REMOVIDA/COMENTADA AQUI
                cc.status,
                cc.data_inicio,
                cc.data_fim,
                (SELECT mc.conteudo FROM mensagens_chat mc WHERE mc.conversa_id = cc.id ORDER BY mc.data_envio DESC LIMIT 1) AS ultima_mensagem_conteudo,
                (SELECT mc.data_envio FROM mensagens_chat mc WHERE mc.conversa_id = cc.id ORDER BY mc.data_envio DESC LIMIT 1) AS ultima_mensagem_data
            FROM conversas_chat cc
            JOIN hospedes h ON cc.hospede_id = h.id
            LEFT JOIN usuarios u ON cc.atendente_usuario_id = u.id
            ORDER BY cc.data_inicio DESC`
        );

        res.status(200).json(conversations.rows);
    } catch (err) {
        console.error('Erro ao listar conversas de chat:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao listar conversas de chat.' });
    }
};

// @route   GET /api/chat/:conversaId/mensagens
// @desc    Obtém as mensagens de uma conversa específica
// @access  Private (Admin, Recepcionista, Hospede - se for sua conversa)
exports.getMessagesByConversationId = async (req, res) => {
    const { conversaId } = req.params;
    const userId = req.user.id; // ID do usuário logado (do token)
    const userType = req.user.tipo_usuario; // Tipo do usuário logado

    try {
        // Verificar se o usuário logado tem permissão para acessar esta conversa
        const conversation = await pool.query(
            `SELECT hospede_id, atendente_usuario_id FROM conversas_chat WHERE id = $1`,
            [conversaId]
        );

        if (conversation.rows.length === 0) {
            return res.status(404).json({ message: 'Conversa não encontrada.' });
        }

        const { hospede_id, atendente_usuario_id } = conversation.rows[0];

        // Se não for admin/recepcionista, verifica se é o hóspede da conversa ou o atendente
        if (userType !== 'admin' && userType !== 'recepcionista') {
            // Lógica de autorização para hóspede/usuário não-admin/recepcionista
            // TODO: Aqui você precisaria de uma lógica mais robusta para verificar
            // se o req.user.id (do usuário logado) corresponde ao hospede_id da conversa
            // ou ao atendente_usuario_id. Atualmente, seu token de usuário não tem hospede_id.
            // Para testar, considere o usuário logado como o atendente ou o admin por enquanto.
            if (userType === 'hospede' && req.user.hospede_id !== hospede_id) {
                return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver esta conversa.' });
            }
            if (userType !== 'hospede' && userId !== atendente_usuario_id) {
                return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver esta conversa.' });
            }
        }


        const messages = await pool.query(
            `SELECT
                mc.id,
                mc.conversa_id,
                mc.remetente_tipo,
                mc.remetente_id_interno,
                mc.conteudo,
                mc.data_envio,
                mc.lida,
                CASE
                    WHEN mc.remetente_tipo = 'usuario' THEN u.nome
                    WHEN mc.remetente_tipo = 'hospede' THEN h.nome || ' ' || h.sobrenome
                    ELSE 'Desconhecido'
                END AS remetente_nome
            FROM mensagens_chat mc
            LEFT JOIN usuarios u ON mc.remetente_tipo = 'usuario' AND mc.remetente_id_interno = u.id
            LEFT JOIN hospedes h ON mc.remetente_tipo = 'hospede' AND mc.remetente_id_interno = h.id
            WHERE mc.conversa_id = $1
            ORDER BY mc.data_envio ASC`,
            [conversaId]
        );

        res.status(200).json(messages.rows);
    } catch (err) {
        console.error('Erro ao obter mensagens da conversa:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao obter mensagens da conversa.' });
    }
};

// @route   PUT /api/chat/:conversaId/mensagens/lida
// @desc    Marca mensagens de uma conversa como lidas
// @access  Private (Admin, Recepcionista, Hospede)
exports.markMessagesAsRead = async (req, res) => {
    const { conversaId } = req.params;
    const { remetente_tipo_lido } = req.body; // 'hospede' ou 'usuario' - para marcar como lidas as mensagens enviadas pelo OUTRO tipo

    if (!remetente_tipo_lido) {
        return res.status(400).json({ message: 'O tipo de remetente a ser marcado como lido é obrigatório.' });
    }

    try {
        await pool.query(
            `UPDATE mensagens_chat
             SET lida = TRUE
             WHERE conversa_id = $1 AND remetente_tipo = $2 AND lida = FALSE`,
            [conversaId, remetente_tipo_lido]
        );

        res.status(200).json({ message: 'Mensagens marcadas como lidas com sucesso.' });
    } catch (err) {
        console.error('Erro ao marcar mensagens como lidas:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao marcar mensagens como lidas.' });
    }
};