// fasthotel-api/controllers/reportController.js

const pool = require('../config/db');

// @route   GET /api/relatorios/calendario-quartos
// @desc    Obter dados para o calendário de reservas por mês/ano
// @access  Private (Admin, Recepcionista)
const getRoomAvailabilityForMonth = async (req, res) => {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ message: 'Parâmetros "ano" e "mes" são obrigatórios.' });
    }

    try {
        const startDate = new Date(Date.UTC(parseInt(ano), parseInt(mes) - 1, 1));
        const endDate = new Date(Date.UTC(parseInt(ano), parseInt(mes), 0));

        const roomsResult = await pool.query('SELECT id, numero, tipo, capacidade, status FROM quartos ORDER BY numero::INTEGER ASC');
        const rooms = roomsResult.rows;

        if (rooms.length === 0) {
            return res.status(200).json({ message: 'Nenhum quarto cadastrado.', availability: [] });
        }

        const bookingsResult = await pool.query(
            `SELECT
                r.quarto_id,
                r.data_checkin,
                r.data_checkout,
                u.nome AS usuario_responsavel_nome,
                u.email AS usuario_email,
                hp.nome AS hospede_principal_nome
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN quartos q ON r.quarto_id = q.id
            LEFT JOIN hospedes hp ON r.hospede_principal_id = hp.id
            WHERE r.status_reserva = 'confirmada'
            AND r.data_checkin <= $2 AND r.data_checkout >= $1`,
            [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
        );
        const bookings = bookingsResult.rows;

        const availability = [];
        const daysInMonth = endDate.getUTCDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(parseInt(ano), parseInt(mes) - 1, day));
            const currentDateStr = currentDate.toISOString().split('T')[0];

            const dailyAvailability = {
                date: currentDateStr,
                rooms: {}
            };

            rooms.forEach(room => {
                dailyAvailability.rooms[room.numero] = {
                    status: 'disponivel',
                    quarto_id: room.id,
                    tipo: room.tipo,
                    capacidade: room.capacidade,
                    hospede: null
                };
            });

            bookings.forEach(booking => {
                const checkin = new Date(booking.data_checkin);
                const checkout = new Date(booking.data_checkout);

                const currentDayUTC = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
                const checkinUTC = new Date(Date.UTC(checkin.getFullYear(), checkin.getMonth(), checkin.getDate()));
                const checkoutUTC = new Date(Date.UTC(checkout.getFullYear(), checkout.getMonth(), checkout.getDate()));

                if (currentDayUTC >= checkinUTC && currentDayUTC < checkoutUTC) {
                    const roomNumero = rooms.find(r => r.id === booking.quarto_id)?.numero;
                    if (roomNumero) {
                        dailyAvailability.rooms[roomNumero].status = 'reservado';
                        dailyAvailability.rooms[roomNumero].hospede = booking.hospede_principal_nome || booking.usuario_responsavel_nome;
                    }
                }
            });
            availability.push(dailyAvailability);
        }

        res.status(200).json({
            message: `Disponibilidade para ${mes}/${ano} gerada com sucesso.`,
            availability: availability
        });

    } catch (err) {
        console.error('Erro ao buscar disponibilidade do calendário:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar disponibilidade do calendário.', error: err.message });
    }
};

// @route   GET /api/relatorios/dashboard-summary
// @desc    Obtém um resumo de estatísticas para o dashboard
// @access  Private (Admin, Recepcionista)
const getDashboardSummary = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const totalRoomsResult = await pool.query('SELECT COUNT(*) FROM quartos');
        const totalRooms = parseInt(totalRoomsResult.rows[0].count, 10);

        const availableRoomsResult = await pool.query(
            `SELECT q.id, q.numero
             FROM quartos q
             LEFT JOIN reservas r ON q.id = r.quarto_id
                AND (r.status_reserva = 'confirmada' OR r.status_reserva = 'checkin')
                AND ($1 BETWEEN r.data_checkin AND r.data_checkout - INTERVAL '1 day')
             WHERE r.id IS NULL`,
            [today]
        );
        const availableRooms = availableRoomsResult.rows.length;

        const occupiedRoomsResult = await pool.query(
            `SELECT COUNT(DISTINCT quarto_id) FROM reservas
             WHERE $1 BETWEEN data_checkin AND data_checkout - INTERVAL '1 day'
             AND (status_reserva = 'confirmada' OR status_reserva = 'checkin')`,
            [today]
        );
        const occupiedRooms = parseInt(occupiedRoomsResult.rows[0].count, 10);

        const checkInsTodayResult = await pool.query(
            `SELECT COUNT(*) FROM reservas
             WHERE data_checkin = $1 AND status_reserva = 'confirmada'`,
            [today]
        );
        const checkInsToday = parseInt(checkInsTodayResult.rows[0].count, 10);

        const checkOutsTodayResult = await pool.query(
            `SELECT COUNT(*) FROM reservas
             WHERE data_checkout = $1 AND (status_reserva = 'confirmada' OR status_reserva = 'checkin')`,
            [today]
        );
        const checkOutsToday = parseInt(checkOutsTodayResult.rows[0].count, 10);

        const guestsInHouseResult = await pool.query(
            `SELECT COUNT(DISTINCT r.usuario_id) FROM reservas r
             WHERE $1 BETWEEN r.data_checkin AND r.data_checkout - INTERVAL '1 day'
             AND (r.status_reserva = 'confirmada' OR r.status_reserva = 'checkin')`,
            [today]
        );
        const guestsInHouse = parseInt(guestsInHouseResult.rows[0].count, 10);

        const pendingPaymentsResult = await pool.query(
            `SELECT COUNT(*) FROM pagamentos p
             JOIN reservas r ON p.reserva_id = r.id
             WHERE p.status_pagamento = 'pendente'
             OR (p.valor_pago < r.preco_total AND p.status_pagamento = 'aprovado')`
        );
        const pendingPayments = parseInt(pendingPaymentsResult.rows[0].count, 10);

        const latestReservationsResult = await pool.query(
            `SELECT
                r.id,
                r.data_checkin,
                r.data_checkout,
                q.numero AS quarto_numero,
                u.nome AS usuario_nome
            FROM reservas r
            JOIN quartos q ON r.quarto_id = q.id
            JOIN usuarios u ON r.usuario_id = u.id
            ORDER BY r.data_reserva DESC
            LIMIT 5`
        );
        const latestReservations = latestReservationsResult.rows;

        res.status(200).json({
            totalRooms,
            availableRooms,
            occupiedRooms,
            checkInsToday,
            checkOutsToday,
            guestsInHouse,
            pendingPayments,
            latestReservations
        });

    } catch (err) {
        console.error('Erro ao obter resumo do dashboard:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao obter resumo do dashboard.', error: err.message });
    }
};

/* ======================= ANALYTICS ADICIONAIS ======================= */

// @route   GET /api/relatorios/top-servicos
// @desc    Top N serviços consumidos (quantidade e faturamento) no período
// @access  Private
const getTopServicos = async (req, res) => {
    const { from, to, limit = 10 } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD).' });
    try {
        const sql = `
            SELECT
                s.id,
                s.nome,
                COALESCE(SUM(c.quantidade),0) AS quantidade_total,
                COALESCE(SUM(c.quantidade * c.preco_unitario),0) AS faturamento
            FROM servicos s
            LEFT JOIN consumos c ON c.servico_id = s.id
            LEFT JOIN reservas r ON r.id = c.reserva_id
                AND r.data_checkin BETWEEN $1 AND $2
            GROUP BY s.id, s.nome
            ORDER BY quantidade_total DESC, faturamento DESC
            LIMIT $3;
        `;
        const { rows } = await pool.query(sql, [from, to, limit]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getTopServicos:', err.message);
        res.status(500).json({ message: 'Erro no servidor em top-servicos.', error: err.message });
    }
};

// @route   GET /api/relatorios/hospedes-top
// @desc    Hóspedes que mais gastaram no período (preço da reserva + consumos)
// @access  Private
const getHospedesTop = async (req, res) => {
    const { from, to, limit = 10 } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD).' });
    try {
        const sql = `
            WITH consumo_por_reserva AS (
                SELECT c.reserva_id, SUM(c.quantidade * c.preco_unitario) AS valor_consumos
                FROM consumos c
                GROUP BY c.reserva_id
            )
            SELECT
                h.id,
                h.nome,
                COALESCE(SUM(r.preco_total),0) + COALESCE(SUM(cp.valor_consumos),0) AS total_gasto,
                COUNT(r.id) AS qtd_reservas
            FROM hospedes h
            JOIN reservas r ON r.hospede_principal_id = h.id
            LEFT JOIN consumo_por_reserva cp ON cp.reserva_id = r.id
            WHERE r.data_checkin BETWEEN $1 AND $2
            GROUP BY h.id, h.nome
            ORDER BY total_gasto DESC
            LIMIT $3;
        `;
        const { rows } = await pool.query(sql, [from, to, limit]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getHospedesTop:', err.message);
        res.status(500).json({ message: 'Erro no servidor em hospedes-top.', error: err.message });
    }
};

// @route   GET /api/relatorios/ticket-medio-por-hospede
// @desc    Ticket médio por hóspede no período
// @access  Private
const getTicketMedioPorHospede = async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'Parâmetros "from" e "to" são obrigatórios (YYYY-MM-DD).' });
    try {
        const sql = `
            WITH consumo_por_reserva AS (
                SELECT c.reserva_id, SUM(c.quantidade * c.preco_unitario) AS valor_consumos
                FROM consumos c
                GROUP BY c.reserva_id
            ),
            total_por_reserva AS (
                SELECT r.id, r.hospede_principal_id,
                       COALESCE(r.preco_total,0) + COALESCE(cp.valor_consumos,0) AS total_reserva
                FROM reservas r
                LEFT JOIN consumo_por_reserva cp ON cp.reserva_id = r.id
                WHERE r.data_checkin BETWEEN $1 AND $2
            )
            SELECT h.id, h.nome,
                   AVG(tpr.total_reserva) AS ticket_medio,
                   COUNT(tpr.id) AS qtd_reservas
            FROM total_por_reserva tpr
            JOIN hospedes h ON h.id = tpr.hospede_principal_id
            GROUP BY h.id, h.nome
            ORDER BY ticket_medio DESC;
        `;
        const { rows } = await pool.query(sql, [from, to]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getTicketMedioPorHospede:', err.message);
        res.status(500).json({ message: 'Erro no servidor em ticket-medio-por-hospede.', error: err.message });
    }
};

// @route   GET /api/relatorios/hospedes-uma-estadia
// @desc    Hóspedes com exatamente 1 reserva
// @access  Private
const getHospedesUmaEstadia = async (req, res) => {
    try {
        const sql = `
            SELECT h.id, h.nome, COUNT(r.id) AS reservas
            FROM hospedes h
            LEFT JOIN reservas r ON r.hospede_principal_id = h.id
            GROUP BY h.id, h.nome
            HAVING COUNT(r.id) = 1
            ORDER BY h.nome ASC;
        `;
        const { rows } = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getHospedesUmaEstadia:', err.message);
        res.status(500).json({ message: 'Erro no servidor em hospedes-uma-estadia.', error: err.message });
    }
};

// @route   GET /api/relatorios/ocupacao-mensal
// @desc    Ocupação (reservas/diárias) por mês do ano informado
// @access  Private
const getOcupacaoMensal = async (req, res) => {
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ message: 'Parâmetro "ano" é obrigatório (YYYY).' });
    try {
        const sql = `
            SELECT
              EXTRACT(MONTH FROM r.data_checkin)::int AS mes,
              COUNT(r.id) AS reservas,
              SUM( GREATEST(0, (r.data_checkout::date - r.data_checkin::date)) ) AS diarias
            FROM reservas r
            WHERE EXTRACT(YEAR FROM r.data_checkin) = $1
            GROUP BY EXTRACT(MONTH FROM r.data_checkin)
            ORDER BY mes;
        `;
        const { rows } = await pool.query(sql, [ano]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getOcupacaoMensal:', err.message);
        res.status(500).json({ message: 'Erro no servidor em ocupacao-mensal.', error: err.message });
    }
};

// @route   GET /api/relatorios/receita-por-mes
// @desc    Receita total (reserva + consumos) por mês do ano informado
// @access  Private
const getReceitaPorMes = async (req, res) => {
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ message: 'Parâmetro "ano" é obrigatório (YYYY).' });
    try {
        const sql = `
            WITH consumo_por_reserva AS (
                SELECT c.reserva_id, SUM(c.quantidade * c.preco_unitario) AS valor_consumos
                FROM consumos c
                GROUP BY c.reserva_id
            )
            SELECT
                EXTRACT(MONTH FROM r.data_checkin)::int AS mes,
                SUM(COALESCE(r.preco_total,0) + COALESCE(cp.valor_consumos,0)) AS receita
            FROM reservas r
            LEFT JOIN consumo_por_reserva cp ON cp.reserva_id = r.id
            WHERE EXTRACT(YEAR FROM r.data_checkin) = $1
            GROUP BY EXTRACT(MONTH FROM r.data_checkin)
            ORDER BY mes;
        `;
        const { rows } = await pool.query(sql, [ano]);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getReceitaPorMes:', err.message);
        res.status(500).json({ message: 'Erro no servidor em receita-por-mes.', error: err.message });
    }
};

// --- NOVA FUNÇÃO ADICIONADA ---
// @route   GET /api/relatorios/preco-medio-por-tipo-quarto
// @desc    Preço médio da diária por tipo de quarto
// @access  Private
const getPrecoMedioPorTipoQuarto = async (req, res) => {
    try {
        const sql = `
            -- Nova Consulta (Correta)
SELECT
    tipo AS tipo_quarto,
    COALESCE(AVG(preco_por_noite), 0) AS preco_medio
FROM quartos
GROUP BY tipo
ORDER BY tipo;
        `;
        const { rows } = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('Erro em getPrecoMedioPorTipoQuarto:', err.message);
        res.status(500).json({ message: 'Erro no servidor em preco-medio-por-tipo-quarto.', error: err.message });
    }
};


module.exports = {
    getRoomAvailabilityForMonth,
    getDashboardSummary,
    getTopServicos,
    getHospedesTop,
    getTicketMedioPorHospede,
    getHospedesUmaEstadia,
    getOcupacaoMensal,
    getReceitaPorMes,
    getPrecoMedioPorTipoQuarto // <-- JÁ EXPORTADO
};