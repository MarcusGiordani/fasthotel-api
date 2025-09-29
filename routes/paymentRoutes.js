const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');

// Rotas do CRUD de Pagamentos
router.post('/', auth, paymentController.createPayment);
router.get('/', auth, paymentController.getAllPayments);

// NOVA ORDEM: A rota mais específica deve vir ANTES da rota com parâmetro dinâmico
router.get('/resumos-reservas', auth, authorize(['admin', 'recepcionista']), paymentController.getReservationPaymentSummaries); // <-- MOVIDA PARA CIMA

router.get('/:id', auth, paymentController.getPaymentById); // <-- AGORA VEM DEPOIS

router.put('/:id', auth, authorize(['admin', 'recepcionista']), paymentController.updatePayment);
router.delete('/:id', auth, authorize(['admin']), paymentController.deletePayment);

// Rota para o extrato de pagamento de uma reserva específica
router.get('/extrato/:reserva_id', auth, authorize(['admin', 'recepcionista']), paymentController.getPaymentExtract);


module.exports = router;