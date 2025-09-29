// fasthotel-api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    // Obter o token do cabeçalho da requisição
    // O front-end React geralmente enviará o token no cabeçalho 'x-auth-token' ou 'Authorization'
    const token = req.header('x-auth-token');

    // Se você preferir usar o cabeçalho Authorization com o prefixo 'Bearer ',
    // você pode ajustar assim:
    /*
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ message: 'Nenhum token de autorização fornecido.' });
    }
    const token = authHeader.split(' ')[1]; // Pega a segunda parte: "Bearer [TOKEN]"
    */

    // Verificar se não há token
    if (!token) {
        return res.status(401).json({ message: 'Nenhum token, autorização negada.' });
    }

    try {
        // Verificar o token usando a chave secreta do JWT
        // process.env.JWT_SECRET deve estar definido no seu arquivo .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Anexar os dados do usuário (id e tipo_usuario) do token à requisição
        // Isso permite que você acesse req.user.id e req.user.tipo_usuario nas rotas protegidas
        req.user = decoded.user;
        next(); // Prosseguir para a próxima função middleware/rota na cadeia
    } catch (err) {
        // Se o token for inválido ou expirado, ele cairá aqui
        console.error('Erro de autenticação:', err.message);
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
};

module.exports = auth;