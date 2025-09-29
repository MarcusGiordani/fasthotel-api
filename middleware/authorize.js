// fasthotel-api/middleware/authorize.js
// Middleware para verificar autorização baseada em tipo_usuario (roles)

const authorize = (allowedRoles) => {
    return (req, res, next) => {
        // req.user é populado pelo authMiddleware (que verifica o JWT)
        if (!req.user || !req.user.tipo_usuario) {
            // Isso não deveria acontecer se o authMiddleware for executado antes e token for válido
            return res.status(401).json({ message: 'Autenticação necessária.' });
        }

        const { tipo_usuario } = req.user;

        // Verifica se o tipo_usuario do usuário logado está entre os roles permitidos
        if (allowedRoles.includes(tipo_usuario)) {
            next(); // O usuário tem permissão, prossegue para a próxima função da rota
        } else {
            res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
        }
    };
};

module.exports = authorize;