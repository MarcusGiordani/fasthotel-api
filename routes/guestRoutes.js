// fasthotel-api/routes/guestRoutes.js
const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, guestController.createGuest);
router.get('/', auth, guestController.getAllGuests);
router.get('/:id', auth, guestController.getGuestById);
router.put('/:id', auth, guestController.updateGuest);
router.delete('/:id', auth, guestController.deleteGuest);

module.exports = router;