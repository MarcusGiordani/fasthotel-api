// fasthotel-api/controllers/roomController.js
const pool = require('../config/db'); // Importa a conexão com o banco de dados

// Criar um novo quarto
const createRoom = async (req, res) => {
    const { numero, tipo, capacidade, preco_por_noite, status, descricao, url_imagem } = req.body;

    try {
        // 1. Verificar se o número do quarto já existe
        const existingRoom = await pool.query('SELECT * FROM quartos WHERE numero = $1', [numero]);
        if (existingRoom.rows.length > 0) {
            return res.status(400).json({ message: 'Número do quarto já cadastrado.' });
        }

        // 2. Inserir o novo quarto no banco de dados
        const newRoom = await pool.query(
            'INSERT INTO quartos (numero, tipo, capacidade, preco_por_noite, status, descricao, url_imagem) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [numero, tipo, capacidade, preco_por_noite, status || 'disponivel', descricao, url_imagem] // 'disponivel' como padrão
        );

        res.status(201).json({
            message: 'Quarto criado com sucesso!',
            room: newRoom.rows[0]
        });

    } catch (err) {
        console.error('Erro ao criar quarto:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao criar quarto.', error: err.message });
    }
};

// Obter todos os quartos (com filtros de disponibilidade se desejar)
const getAllRooms = async (req, res) => {
    // Exemplo de filtro: /api/quartos?status=disponivel
    const { status } = req.query; // Pega o parâmetro 'status' da URL

    try {
        let query = 'SELECT * FROM quartos';
        const params = [];

        if (status) {
            query += ' WHERE status = $1';
            params.push(status);
        }

        const allRooms = await pool.query(query, params);
        res.status(200).json(allRooms.rows);
    } catch (err) {
        console.error('Erro ao buscar quartos:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar quartos.', error: err.message });
    }
};

// Obter um quarto por ID
const getRoomById = async (req, res) => {
    const { id } = req.params;
    try {
        const room = await pool.query('SELECT * FROM quartos WHERE id = $1', [id]);
        if (room.rows.length === 0) {
            return res.status(404).json({ message: 'Quarto não encontrado.' });
        }
        res.status(200).json(room.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar quarto por ID:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar quarto.', error: err.message });
    }
};

// Atualizar um quarto
const updateRoom = async (req, res) => {
    const { id } = req.params;
    const { numero, tipo, capacidade, preco_por_noite, status, descricao, url_imagem } = req.body;

    try {
        const updatedRoom = await pool.query(
            'UPDATE quartos SET numero = $1, tipo = $2, capacidade = $3, preco_por_noite = $4, status = $5, descricao = $6, url_imagem = $7 WHERE id = $8 RETURNING *',
            [numero, tipo, capacidade, preco_por_noite, status, descricao, url_imagem, id]
        );

        if (updatedRoom.rows.length === 0) {
            return res.status(404).json({ message: 'Quarto não encontrado para atualização.' });
        }

        res.status(200).json({
            message: 'Quarto atualizado com sucesso!',
            room: updatedRoom.rows[0]
        });

    } catch (err) {
        console.error('Erro ao atualizar quarto:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao atualizar quarto.', error: err.message });
    }
};

// Deletar um quarto
const deleteRoom = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedRoom = await pool.query('DELETE FROM quartos WHERE id = $1 RETURNING id', [id]);
        if (deletedRoom.rows.length === 0) {
            return res.status(404).json({ message: 'Quarto não encontrado para exclusão.' });
        }
        res.status(200).json({ message: 'Quarto excluído com sucesso!', id: id });
    } catch (err) {
        console.error('Erro ao deletar quarto:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao deletar quarto.', error: err.message });
    }
};

module.exports = {
    createRoom,
    getAllRooms,
    getRoomById,
    updateRoom,
    deleteRoom
};