// fasthotel-api/controllers/serviceController.js
const pool = require('../config/db');

// Criar um novo serviço
const createService = async (req, res) => {
    const { nome, descricao, preco } = req.body;

    try {
        const newService = await pool.query(
            'INSERT INTO servicos (nome, descricao, preco) VALUES ($1, $2, $3) RETURNING *',
            [nome, descricao, preco]
        );
        res.status(201).json({
            message: 'Serviço criado com sucesso!',
            service: newService.rows[0]
        });
    } catch (err) {
        console.error('Erro ao criar serviço:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao criar serviço.', error: err.message });
    }
};

// Obter todos os serviços
const getAllServices = async (req, res) => {
    try {
        const allServices = await pool.query('SELECT * FROM servicos ORDER BY nome ASC');
        res.status(200).json(allServices.rows);
    } catch (err) {
        console.error('Erro ao buscar serviços:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar serviços.', error: err.message });
    }
};

// Obter serviço por ID
const getServiceById = async (req, res) => {
    const { id } = req.params;
    try {
        const service = await pool.query('SELECT * FROM servicos WHERE id = $1', [id]);
        if (service.rows.length === 0) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }
        res.status(200).json(service.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar serviço por ID:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar serviço.', error: err.message });
    }
};

// Atualizar um serviço
const updateService = async (req, res) => {
    const { id } = req.params;
    const { nome, descricao, preco } = req.body;
    try {
        const updatedService = await pool.query(
            'UPDATE servicos SET nome = $1, descricao = $2, preco = $3 WHERE id = $4 RETURNING *',
            [nome, descricao, preco, id]
        );
        if (updatedService.rows.length === 0) {
            return res.status(404).json({ message: 'Serviço não encontrado para atualização.' });
        }
        res.status(200).json({
            message: 'Serviço atualizado com sucesso!',
            service: updatedService.rows[0]
        });
    } catch (err) {
        console.error('Erro ao atualizar serviço:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao atualizar serviço.', error: err.message });
    }
};

// Deletar um serviço
const deleteService = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedService = await pool.query('DELETE FROM servicos WHERE id = $1 RETURNING id', [id]);
        if (deletedService.rows.length === 0) {
            return res.status(404).json({ message: 'Serviço não encontrado para exclusão.' });
        }
        res.status(200).json({ message: 'Serviço excluído com sucesso!', id: id });
    } catch (err) {
        console.error('Erro ao deletar serviço:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao deletar serviço.', error: err.message });
    }
};

module.exports = {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService
};