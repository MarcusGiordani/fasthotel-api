// fasthotel-api/routes/roomRoutes.js
const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController'); // Importa o controlador de quartos

// Rotas para o CRUD de Quartos
router.post('/', roomController.createRoom);         // Criar um novo quarto
router.get('/', roomController.getAllRooms);         // Obter todos os quartos (com filtros)
router.get('/:id', roomController.getRoomById);      // Obter um quarto por ID
router.put('/:id', roomController.updateRoom);       // Atualizar um quarto
router.delete('/:id', roomController.deleteRoom);    // Deletar um quarto

module.exports = router;