const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize'); // Certifique-se que está importado
const { body, validationResult } = require('express-validator'); // <-- NOVO: Importar body e validationResult

// Rotas para o CRUD de Usuários
router.post(
    '/',
    [ // <-- NOVO: Array de middlewares de validação
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório.').isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres.'),
        body('email').isEmail().withMessage('Email inválido.').normalizeEmail(),
        body('senha').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.'),
        body('tipo_usuario').optional().isIn(['admin', 'recepcionista', 'cliente']).withMessage('Tipo de usuário inválido.')
    ],
    userController.createUser // <-- O controlador será chamado DEPOIS da validação
);

router.get('/', auth, authorize(['admin']), userController.getAllUsers); // Apenas admin lista todos
router.get('/:id', auth, authorize(['admin', 'recepcionista', 'cliente']), userController.getUserById);
router.put('/:id', auth, authorize(['admin', 'recepcionista', 'cliente']), userController.updateUser); // Permitir cliente atualizar o próprio perfil (requer lógica no controller)
router.delete('/:id', auth, authorize(['admin']), userController.deleteUser); // Apenas admin deleta

// Rota de Login (não protegida por auth/authorize, pois é para obter o token)
router.post('/login', userController.loginUser);

module.exports = router;