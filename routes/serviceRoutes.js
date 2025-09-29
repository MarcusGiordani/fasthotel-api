// fasthotel-api/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const auth = require('../middleware/authMiddleware'); // Middleware de autenticação

// Rotas para o CRUD de Serviços (todas protegidas, idealmente apenas para admin/recepcionista)
router.post('/', auth, serviceController.createService);
router.get('/', auth, serviceController.getAllServices);
router.get('/:id', auth, serviceController.getServiceById);
router.put('/:id', auth, serviceController.updateService);
router.delete('/:id', auth, serviceController.deleteService);

module.exports = router;