// fasthotel-api/controllers/userController.js
const pool = require('../config/db'); // Importa a conexão com o banco de dados
const bcrypt = require('bcryptjs'); // Para hash de senhas
const jwt = require('jsonwebtoken'); // Importa a biblioteca jsonwebtoken
const { validationResult } = require('express-validator'); // <-- NOVO: Importar validationResult

// Criar um novo usuário
const createUser = async (req, res) => {
    // --- NOVO: Lidar com erros de validação do express-validator ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // -----------------------------------------------------------

    const { nome, email, senha, tipo_usuario } = req.body;

    try {
        // 1. Verificar se o usuário já existe (após a validação de formato)
        const existingUser = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Email já cadastrado.' });
        }

        // 2. Hash da senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        // 3. Inserir o novo usuário no banco de dados
        const newUser = await pool.query(
            'INSERT INTO usuarios (nome, email, senha, tipo_usuario) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, tipo_usuario, data_cadastro',
            [nome, email, senhaHash, tipo_usuario || 'cliente']
        );

        res.status(201).json({
            message: 'Usuário criado com sucesso!',
            user: newUser.rows[0]
        });

    } catch (err) {
        console.error('Erro ao criar usuário:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao criar usuário.', error: err.message });
    }
};

// Obter todos os usuários
const getAllUsers = async (req, res) => {
    try {
        const allUsers = await pool.query('SELECT id, nome, email, tipo_usuario, data_cadastro FROM usuarios');
        res.status(200).json(allUsers.rows);
    } catch (err) {
        console.error('Erro ao buscar usuários:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar usuários.', error: err.message });
    }
};

// Obter um usuário por ID
const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await pool.query('SELECT id, nome, email, tipo_usuario, data_cadastro FROM usuarios WHERE id = $1', [id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json(user.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar usuário por ID:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar usuário.', error: err.message });
    }
};

// Atualizar um usuário
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { nome, email, tipo_usuario } = req.body;

    try {
        const updatedUser = await pool.query(
            'UPDATE usuarios SET nome = $1, email = $2, tipo_usuario = $3 WHERE id = $4 RETURNING id, nome, email, tipo_usuario',
            [nome, email, tipo_usuario, id]
        );

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado para atualização.' });
        }

        res.status(200).json({
            message: 'Usuário atualizado com sucesso!',
            user: updatedUser.rows[0]
        });

    } catch (err) {
        console.error('Erro ao atualizar usuário:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao atualizar usuário.', error: err.message });
    }
};

// Deletar um usuário
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedUser = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
        if (deletedUser.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado para exclusão.' });
        }
        res.status(200).json({ message: 'Usuário excluído com sucesso!', id: id });
    } catch (err) {
        console.error('Erro ao deletar usuário:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao deletar usuário.', error: err.message });
    }
};

// Função de Login
const loginUser = async (req, res) => {
    const { email, senha } = req.body;

    try {
        // 1. Verificar se o usuário existe
        const user = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        const foundUser = user.rows[0];

        // 2. Comparar a senha fornecida com a senha hashada no banco de dados
        const isMatch = await bcrypt.compare(senha, foundUser.senha);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        // 3. Gerar um JSON Web Token (JWT)
        const payload = {
            user: {
                id: foundUser.id,
                tipo_usuario: foundUser.tipo_usuario
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.status(200).json({
                    message: 'Login bem-sucedido!',
                    token,
                    user: {
                        id: foundUser.id,
                        nome: foundUser.nome,
                        email: foundUser.email,
                        tipo_usuario: foundUser.tipo_usuario
                    }
                });
            }
        );

    } catch (err) {
        console.error('Erro no login:', err.message);
        res.status(500).json({ message: 'Erro no servidor durante o login.', error: err.message });
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    loginUser
};