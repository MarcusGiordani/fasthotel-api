// fasthotel-api/routes/consumptionRoutes.js
const express = require('express');
const router = express.Router();
const consumptionController = require('../controllers/consumptionController');
const auth = require('../middleware/authMiddleware'); // Middleware de autenticação

// Rotas para o CRUD de Consumos (todas protegidas)
router.post('/', auth, consumptionController.createConsumption);
router.get('/', auth, consumptionController.getAllConsumptions);
router.get('/:id', auth, consumptionController.getConsumptionById);
router.put('/:id', auth, consumptionController.updateConsumption);
router.delete('/:id', auth, consumptionController.deleteConsumption);

module.exports = router;