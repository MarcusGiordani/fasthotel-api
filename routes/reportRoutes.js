// fasthotel-api/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/authMiddleware'); // Middleware de autenticação
const authorize = require('../middleware/authorize'); // Middleware de autorização

// Rota para obter a disponibilidade dos quartos para o calendário
router.get('/calendario-quartos', auth, authorize(['admin', 'recepcionista']), reportController.getRoomAvailabilityForMonth);

// Rota para o resumo do dashboard
router.get('/dashboard-summary', auth, authorize(['admin', 'recepcionista']), reportController.getDashboardSummary);

// ======================= NOVOS RELATÓRIOS =======================

// Top N serviços consumidos
router.get('/top-servicos', auth, authorize(['admin', 'recepcionista']), reportController.getTopServicos);

// Hóspedes que mais gastaram
router.get('/hospedes-top', auth, authorize(['admin', 'recepcionista']), reportController.getHospedesTop);

// Ticket médio por hóspede
router.get('/ticket-medio-por-hospede', auth, authorize(['admin', 'recepcionista']), reportController.getTicketMedioPorHospede);

// Hóspedes com apenas uma estadia
router.get('/hospedes-uma-estadia', auth, authorize(['admin', 'recepcionista']), reportController.getHospedesUmaEstadia);

// Preço médio por tipo de quarto <-- ADICIONE ESTA LINHA
router.get('/preco-medio-por-tipo-quarto', auth, authorize(['admin', 'recepcionista']), reportController.getPrecoMedioPorTipoQuarto);

// Ocupação mensal
router.get('/ocupacao-mensal', auth, authorize(['admin', 'recepcionista']), reportController.getOcupacaoMensal);

// Receita por mês
router.get('/receita-por-mes', auth, authorize(['admin', 'recepcionista']), reportController.getReceitaPorMes);


module.exports = router;