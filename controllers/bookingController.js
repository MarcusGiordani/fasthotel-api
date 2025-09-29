const pool = require('../config/db');

// Função auxiliar para verificar disponibilidade e calcular preço (reutilizada de createBooking)
const checkAvailabilityAndPrice = async (quarto_id, data_checkin, data_checkout, reserva_id_to_ignore = null) => {
    try {
        const roomResult = await pool.query('SELECT preco_por_noite, status, numero FROM quartos WHERE id = $1', [quarto_id]);
        if (roomResult.rows.length === 0) {
            return { error: 'Quarto não encontrado.' };
        }
        const room = roomResult.rows[0];

        // Se o quarto não está disponível, a menos que seja a própria reserva sendo atualizada
        if (room.status !== 'disponivel' && !reserva_id_to_ignore) {
            return { error: `Quarto ${room.numero} não está disponível (status: ${room.status}).` };
        }

        let overlapQuery = `
            SELECT id FROM reservas
            WHERE quarto_id = $1
            AND status_reserva IN ('confirmada', 'checkin')
            AND ($2 < data_checkout AND $3 > data_checkin)
        `;
        const overlapParams = [quarto_id, data_checkin, data_checkout];

        if (reserva_id_to_ignore) {
            overlapQuery += ` AND id <> $${overlapParams.length + 1}`;
            overlapParams.push(reserva_id_to_ignore);
        }

        const overlapResult = await pool.query(overlapQuery, overlapParams);

        if (overlapResult.rows.length > 0) {
            return { error: 'Quarto já reservado para as datas selecionadas.' };
        }

        const checkinDate = new Date(data_checkin);
        const checkoutDate = new Date(data_checkout);
        const diffTime = Math.abs(checkoutDate.getTime() - checkinDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return { error: 'A data de check-out deve ser posterior à data de check-in.' };
        }

        const preco_total = room.preco_por_noite * diffDays;

        return { preco_total: preco_total.toFixed(2), room_status: room.status };

    } catch (err) {
        console.error('Erro ao verificar disponibilidade/preço:', err.message);
        return { error: 'Erro interno ao verificar disponibilidade.' };
    }
};


// Criar uma nova reserva
const createBooking = async (req, res) => {
    // req.user virá do middleware de autenticação
    const usuario_id = req.user.id; // Usuário logado que faz a reserva
    const { quarto_id, data_checkin, data_checkout, hospede_principal_id } = req.body; // <-- NOVO: hospede_principal_id aqui

    try {
        // 1. Validar datas
        if (new Date(data_checkin) >= new Date(data_checkout)) {
            return res.status(400).json({ message: 'A data de check-out deve ser posterior à data de check-in.' });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(data_checkin) < today) {
            return res.status(400).json({ message: 'A data de check-in não pode ser no passado.' });
        }

        // 2. Verificar disponibilidade e calcular preço
        const { error, preco_total } = await checkAvailabilityAndPrice(quarto_id, data_checkin, data_checkout);

        if (error) {
            return res.status(400).json({ message: error });
        }

        const client = await pool.connect(); // Obtém um cliente do pool para a transação
        try {
            await client.query('BEGIN'); // Inicia uma transação

            const newBooking = await client.query( // Usar 'client' para a transação
                `INSERT INTO reservas (usuario_id, quarto_id, data_checkin, data_checkout, preco_total, hospede_principal_id)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, // <-- Adicionado $6 para hospede_principal_id
                [usuario_id, quarto_id, data_checkin, data_checkout, preco_total, hospede_principal_id || null] // <-- Passado hospede_principal_id
            );

            await client.query('COMMIT'); // Confirma a transação
            res.status(201).json({
                message: 'Reserva criada com sucesso!',
                booking: newBooking.rows[0]
            });

        } catch (err) {
            await client.query('ROLLBACK'); // Reverte a transação em caso de erro
            throw err; // Lança o erro para ser pego pelo catch externo
        } finally {
            client.release(); // Libera o cliente de volta para o pool
        }

    } catch (err) {
        console.error('Erro ao criar reserva:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao criar reserva.', error: err.message });
    }
};


// Obter todas as reservas (para admin, ou todas do próprio usuário)
const getAllBookings = async (req, res) => {
    const usuario_id = req.user.id;
    const tipo_usuario = req.user.tipo_usuario;

    try {
        let query = `
            SELECT
                r.id,
                r.data_checkin,
                r.data_checkout,
                r.preco_total,
                r.status_reserva,
                r.data_reserva,
                u.nome AS usuario_nome,
                u.email AS usuario_email,
                q.numero AS quarto_numero,
                q.tipo AS quarto_tipo,
                q.preco_por_noite AS quarto_preco_por_noite
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN quartos q ON r.quarto_id = q.id
        `;
        const params = [];

        // Se não for admin, mostrar apenas as reservas do próprio usuário
        if (tipo_usuario !== 'admin') {
            query += ' WHERE r.usuario_id = $1';
            params.push(usuario_id);
        }

        const allBookings = await pool.query(query, params);
        res.status(200).json(allBookings.rows);
    } catch (err) {
        console.error('Erro ao buscar reservas:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar reservas.', error: err.message });
    }
};

// Obter uma reserva por ID (apenas se for do próprio usuário ou admin)
const getBookingById = async (req, res) => {
    const { id } = req.params;
    const usuario_id = req.user.id;
    const tipo_usuario = req.user.tipo_usuario;

    try {
        let query = `
            SELECT
                r.id,
                r.data_checkin,
                r.data_checkout,
                r.preco_total,
                r.status_reserva,
                r.data_reserva,
                u.nome AS usuario_nome,
                u.email AS usuario_email,
                q.numero AS quarto_numero,
                q.tipo AS quarto_tipo,
                q.preco_por_noite AS quarto_preco_por_noite
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN quartos q ON r.quarto_id = q.id
            WHERE r.id = $1
        `;
        const params = [id];

        // Se não for admin, adicionar condição para o próprio usuário
        if (tipo_usuario !== 'admin') {
            query += ' AND r.usuario_id = $2';
            params.push(usuario_id);
        }

        const booking = await pool.query(query, params);

        if (booking.rows.length === 0) {
            return res.status(404).json({ message: 'Reserva não encontrada ou você não tem permissão para acessá-la.' });
        }
        res.status(200).json(booking.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar reserva por ID:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar reserva.', error: err.message });
    }
};

// Atualizar uma reserva (ex: mudar status da reserva, apenas para admin ou recepcionista)
const updateBooking = async (req, res) => {
    const { id } = req.params;
    const { status_reserva, data_checkin, data_checkout, quarto_id } = req.body;
    const tipo_usuario = req.user.tipo_usuario;

    // Apenas admin ou recepcionista podem atualizar reservas
    if (tipo_usuario !== 'admin' && tipo_usuario !== 'recepcionista') {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para atualizar reservas.' });
    }

    try {
        let query = 'UPDATE reservas SET ';
        const updates = [];
        const params = [];
        let paramIndex = 1;

        // Se data_checkin e data_checkout forem passados para alteração, re-validar e recalcular preço
        let newPrice = null;
        if (data_checkin && data_checkout && quarto_id) {
            const { error, preco_total } = await checkAvailabilityAndPrice(quarto_id, data_checkin, data_checkout, parseInt(id)); // Passa ID da reserva para ignorar na validação
            if (error) {
                return res.status(400).json({ message: error });
            }
            newPrice = preco_total;
        }

        if (status_reserva) {
            updates.push(`status_reserva = $${paramIndex++}`);
            params.push(status_reserva);
        }
        if (data_checkin) {
            updates.push(`data_checkin = $${paramIndex++}`);
            params.push(data_checkin);
        }
        if (data_checkout) {
            updates.push(`data_checkout = $${paramIndex++}`);
            params.push(data_checkout);
        }
        if (newPrice !== null) {
            updates.push(`preco_total = $${paramIndex++}`);
            params.push(newPrice);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Nenhum campo para atualizar fornecido.' });
        }

        query += updates.join(', ') + ` WHERE id = $${paramIndex++} RETURNING *`;
        params.push(id);

        const updatedBooking = await pool.query(query, params);

        if (updatedBooking.rows.length === 0) {
            return res.status(404).json({ message: 'Reserva não encontrada para atualização.' });
        }

        res.status(200).json({
            message: 'Reserva atualizada com sucesso!',
            reserva: updatedBooking.rows[0]
        });

    } catch (err) {
        console.error('Erro ao atualizar reserva:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao atualizar reserva.', error: err.message });
    }
};

// Deletar uma reserva (apenas para admin)
const deleteBooking = async (req, res) => {
    const { id } = req.params;
    const tipo_usuario = req.user.tipo_usuario;

    // Apenas admin pode deletar reservas
    if (tipo_usuario !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para deletar reservas.' });
    }

    try {
        const deletedBooking = await pool.query('DELETE FROM reservas WHERE id = $1 RETURNING id', [id]);
        if (deletedBooking.rows.length === 0) {
            return res.status(404).json({ message: 'Reserva não encontrada para exclusão.' });
        }
        res.status(200).json({ message: 'Reserva excluída com sucesso!', id: id });
    } catch (err) {
        console.error('Erro ao deletar reserva:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao deletar reserva.', error: err.message });
    }
};

// @route   PUT /api/reservas/:id/finalizar
// @desc    Finalizar uma reserva (realizar check-out)
// @access  Private (Admin, Recepcionista)
const finalizarReserva = async (req, res) => {
    const { id } = req.params; // ID da reserva
    const client = await pool.connect(); // Obtém um cliente do pool para a transação

    try {
        await client.query('BEGIN'); // Inicia a transação

        // 1. Atualizar o status da reserva para 'finalizada' ou 'check-out'
        // E registrar a data de check-out real se for diferente da prevista
        const updateReservaQuery = `
            UPDATE reservas
            SET status_reserva = 'finalizada',
                data_checkout_real = NOW()
            WHERE id = $1 AND (status_reserva = 'confirmada' OR status_reserva = 'checkin')
            RETURNING *;
        `;
        const result = await client.query(updateReservaQuery, [id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Reserva não encontrada ou já finalizada/cancelada.' });
        }

        const reservaFinalizada = result.rows[0];
        const quartoId = reservaFinalizada.quarto_id;

        // 2. Opcional: Atualizar o status do quarto para 'disponível'
        // Isso depende da sua lógica de negócio. Se o quarto só fica disponível
        // após limpeza, você pode ter um status 'limpeza' ou não mudar aqui.
        const updateQuartoQuery = `
            UPDATE quartos
            SET status = 'disponivel'
            WHERE id = $1;
        `;
        await client.query(updateQuartoQuery, [quartoId]);

        await client.query('COMMIT'); // Confirma a transação
        res.status(200).json({
            message: `Reserva ${id} finalizada com sucesso. Quarto ${reservaFinalizada.quarto_id} agora disponível.`,
            reserva: reservaFinalizada
        });

    } catch (err) {
        await client.query('ROLLBACK'); // Reverte a transação em caso de erro
        console.error('Erro ao finalizar reserva:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao finalizar reserva.', error: err.message });
    } finally {
        client.release(); // Libera o cliente de volta para o pool
    }
};


module.exports = {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
    finalizarReserva, // Exporta a nova função
};