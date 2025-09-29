// fasthotel-api/controllers/guestController.js
const pool = require('../config/db'); // Importa a conexão com o banco de dados
const bcrypt = require('bcryptjs'); // Para hash de senhas
const jwt = require('jsonwebtoken'); // Importa a biblioteca jsonwebtoken
const { validationResult } = require('express-validator'); // Importar validationResult

// Criar um novo hóspede
const createGuest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        nome, sobrenome, cpf, rg, data_nascimento, email,
        telefone, endereco, numero, bairro, cep, cidade, estado,
    } = req.body;

    try {
        if (cpf) {
            const existingGuest = await pool.query('SELECT id FROM hospedes WHERE cpf = $1', [cpf]);
            if (existingGuest.rows.length > 0) {
                return res.status(400).json({ message: 'CPF já cadastrado para outro hóspede.' });
            }
        }
        if (rg) {
            const existingGuest = await pool.query('SELECT id FROM hospedes WHERE rg = $1', [rg]);
            if (existingGuest.rows.length > 0) {
                return res.status(400).json({ message: 'RG já cadastrado para outro hóspede.' });
            }
        }

        const newGuest = await pool.query(
            `INSERT INTO hospedes (nome, sobrenome, cpf, rg, data_nascimento, email,
                                   telefone, endereco, numero, bairro, cep, cidade, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [nome, sobrenome, cpf, rg, data_nascimento, email,
             telefone, endereco, numero, bairro, cep, cidade, estado]
        );

        res.status(201).json({
            message: 'Hóspede cadastrado com sucesso!',
            guest: newGuest.rows[0]
        });

    } catch (err) {
        console.error('Erro ao cadastrar hóspede:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao cadastrar hóspede.', error: err.message });
    }
};

// Obter todos os hóspedes
// AGORA FILTRA HÓSPEDES COM BASE EM SUAS RESERVAS ATIVAS
const getAllGuests = async (req, res) => {
    try {
        const allGuests = await pool.query(
            `SELECT
                h.id,
                h.nome,
                h.sobrenome,
                h.cpf,
                h.rg,
                h.data_nascimento,
                h.email,
                h.telefone,
                h.endereco,
                h.numero,
                h.bairro,
                h.cep,
                h.cidade,
                h.estado
            FROM
                hospedes h
            WHERE
                h.id IN (
                    SELECT r.hospede_principal_id
                    FROM reservas r
                    WHERE r.hospede_principal_id IS NOT NULL
                    AND r.status_reserva NOT IN ('finalizada', 'cancelada')
                )
                OR NOT EXISTS (
                    SELECT 1 FROM reservas r
                    WHERE r.hospede_principal_id = h.id
                )
            ORDER BY h.nome ASC`
        );
        res.status(200).json(allGuests.rows);
    } catch (err) {
        console.error('Erro ao buscar hóspedes:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar hóspedes.', error: err.message });
    }
};

// Obter hóspede por ID
const getGuestById = async (req, res) => {
    const { id } = req.params;
    try {
        const guest = await pool.query('SELECT * FROM hospedes WHERE id = $1', [id]);
        if (guest.rows.length === 0) {
            return res.status(404).json({ message: 'Hóspede não encontrado.' });
        }
        res.status(200).json(guest.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar hóspede por ID:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar hóspede.', error: err.message });
    }
};

// Atualizar um hóspede
const updateGuest = async (req, res) => {
    const { id } = req.params;
    const {
        nome, sobrenome, cpf, rg, data_nascimento, email,
        telefone, endereco, numero, bairro, cep, cidade, estado
    } = req.body;

    try {
        const updatedGuest = await pool.query(
            `UPDATE hospedes SET
                nome = $1, sobrenome = $2, cpf = $3, rg = $4, data_nascimento = $5, email = $6,
                telefone = $7, endereco = $8, numero = $9, bairro = $10, cep = $11, cidade = $12, estado = $13
             WHERE id = $14
             RETURNING *`,
            [nome, sobrenome, cpf, rg, data_nascimento, email,
             telefone, endereco, numero, bairro, cep, cidade, estado, id]
        );

        if (updatedGuest.rows.length === 0) {
            return res.status(404).json({ message: 'Hóspede não encontrado para atualização.' });
        }

        res.status(200).json({
            message: 'Hóspede atualizado com sucesso!',
            guest: updatedGuest.rows[0]
        });

    } catch (err) {
        console.error('Erro ao atualizar hóspede:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao atualizar hóspede.', error: err.message });
    }
};

// Deletar um hóspede e suas reservas, pagamentos e consumos associados
const deleteGuest = async (req, res) => {
    const { id } = req.params; // ID do hóspede a ser deletado
    const client = await pool.connect(); // Obter um cliente do pool para a transação

    try {
        await client.query('BEGIN'); // Iniciar a transação

        // 1. Encontrar todas as reservas associadas a este hóspede principal
        const reservationsToDelete = await client.query(
            `SELECT id FROM reservas WHERE hospede_principal_id = $1`,
            [id]
        );
        const reservaIds = reservationsToDelete.rows.map(row => row.id);

        if (reservaIds.length > 0) {
            // 2. Deletar as reservas.
            // Isso acionará a deleção em cascata para 'pagamentos' e 'consumos'
            // porque 'pagamentos' e 'consumos' têm ON DELETE CASCADE para 'reservas'.
            await client.query(
                `DELETE FROM reservas WHERE id = ANY($1::int[])`, // Use ANY para deletar múltiplos IDs
                [reservaIds]
            );
        }

        // 3. Deletar o próprio hóspede
        const deletedGuestResult = await client.query('DELETE FROM hospedes WHERE id = $1 RETURNING id', [id]);

        if (deletedGuestResult.rows.length === 0) {
            await client.query('ROLLBACK'); // Reverter se o hóspede não for encontrado
            return res.status(404).json({ message: 'Hóspede não encontrado para exclusão.' });
        }

        await client.query('COMMIT'); // Confirmar a transação
        res.status(200).json({
            message: `Hóspede ${id} e todas as suas reservas, pagamentos e consumos associados foram excluídos com sucesso.`,
            id: id
        });

    } catch (err) {
        await client.query('ROLLBACK'); // Reverter a transação em caso de erro
        console.error('Erro ao deletar hóspede e dados associados:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao deletar hóspede e dados associados.', error: err.message });
    } finally {
        client.release(); // Liberar o cliente de volta para o pool
    }
};

module.exports = {
    createGuest,
    getAllGuests,
    getGuestById,
    updateGuest,
    deleteGuest
};