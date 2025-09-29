const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController'); // Certifique-se que o nome do controlador é 'bookingController'
const auth = require('../middleware/authMiddleware'); // Middleware de autenticação
const authorize = require('../middleware/authorize'); // Middleware de autorização

// Rotas para o CRUD de Reservas (todas protegidas)
router.post('/', auth, bookingController.createBooking);
router.get('/', auth, bookingController.getAllBookings);
router.get('/:id', auth, bookingController.getBookingById);
router.put('/:id', auth, authorize(['admin', 'recepcionista']), bookingController.updateBooking); // Update por admin/recepcionista
router.delete('/:id', auth, authorize(['admin']), bookingController.deleteBooking); // Delete por admin

// Rota para finalizar uma reserva (check-out)
router.put('/:id/finalizar', auth, authorize(['admin', 'recepcionista']), bookingController.finalizarReserva);

module.exports = router;