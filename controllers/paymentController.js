// fasthotel-api/controllers/paymentController.js
const pool = require('../config/db');

// Criar um novo pagamento
const createPayment = async (req, res) => {
    const { reserva_id, valor_pago, metodo_pagamento, status_pagamento } = req.body;

    try {
        const bookingExists = await pool.query('SELECT id FROM reservas WHERE id = $1', [reserva_id]);
        if (bookingExists.rows.length === 0) {
            return res.status(404).json({ message: 'Reserva não encontrada.' });
        }

        const newPayment = await pool.query(
            'INSERT INTO pagamentos (reserva_id, valor_pago, metodo_pagamento, status_pagamento) VALUES ($1, $2, $3, $4) RETURNING *',
            [reserva_id, valor_pago, metodo_pagamento, status_pagamento || 'aprovado']
        );
        res.status(201).json({
            message: 'Pagamento registrado com sucesso!',
            payment: newPayment.rows[0]
        });
    } catch (err) {
        console.error('Erro ao registrar pagamento:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao registrar pagamento.', error: err.message });
    }
};

// Obter todos os pagamentos (Histórico de transações individuais filtrado)
const getAllPayments = async (req, res) => {
    const { reserva_id } = req.query;
    try {
        let query = `
            SELECT
                p.id,
                p.reserva_id,
                r.data_checkin,
                r.data_checkout,
                p.valor_pago,
                p.data_pagamento,
                p.metodo_pagamento,
                p.status_pagamento,
                u.nome AS usuario_nome,
                q.numero AS quarto_numero,
                r.status_reserva AS status_da_reserva,
                hp.nome AS hospede_principal_nome
            FROM
                pagamentos p
            JOIN
                reservas r ON p.reserva_id = r.id
            JOIN
                usuarios u ON r.usuario_id = u.id
            JOIN
                quartos q ON r.quarto_id = q.id
            LEFT JOIN
                hospedes hp ON r.hospede_principal_id = hp.id
            WHERE
                r.status_reserva NOT IN ('finalizada', 'cancelada')
        `;
        const params = [];

        if (reserva_id) {
            query += (params.length === 0 ? ' WHERE ' : ' AND ') + 'p.reserva_id = $1';
            params.push(reserva_id);
        }
        
        query += ' ORDER BY p.data_pagamento DESC';

        const allPayments = await pool.query(query, params);
        res.status(200).json(allPayments.rows);
    } catch (err) {
        console.error('Erro ao buscar pagamentos:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar pagamentos.', error: err.message });
    }
};

// Obter pagamento por ID
const getPaymentById = async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await pool.query(
            `SELECT
                p.id,
                p.reserva_id,
                r.data_checkin,
                r.data_checkout,
                p.valor_pago,
                p.data_pagamento,
                p.metodo_pagamento,
                p.status_pagamento,
                u.nome AS usuario_nome,
                q.numero AS quarto_numero,
                hp.nome AS hospede_principal_nome
            FROM
                pagamentos p
            JOIN
                reservas r ON p.reserva_id = r.id
            JOIN
                usuarios u ON r.usuario_id = u.id
            JOIN
                quartos q ON r.quarto_id = q.id
            LEFT JOIN
                hospedes hp ON r.hospede_principal_id = hp.id
            WHERE p.id = $1`,
            [id]
        );
        if (payment.rows.length === 0) {
            return res.status(404).json({ message: 'Pagamento não encontrado.' });
        }
        res.status(200).json(payment.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar pagamento por ID:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao buscar pagamento.', error: err.message });
    }
};

// Atualizar um pagamento (status, método, valor)
const updatePayment = async (req, res) => {
    const { id } = req.params;
    const { valor_pago, metodo_pagamento, status_pagamento } = req.body;

    try {
        const updatedPayment = await pool.query(
            `UPDATE pagamentos SET
                valor_pago = COALESCE($1, valor_pago),
                metodo_pagamento = COALESCE($2, metodo_pagamento),
                status_pagamento = COALESCE($3, status_pagamento)
             WHERE id = $4
             RETURNING *`,
            [valor_pago, metodo_pagamento, status_pagamento, id]
        );

        if (updatedPayment.rows.length === 0) {
            return res.status(404).json({ message: 'Pagamento não encontrado para atualização.' });
        }

        res.status(200).json({
            message: 'Pagamento atualizado com sucesso!',
            payment: updatedPayment.rows[0]
        });

    } catch (err) {
        console.error('Erro ao atualizar pagamento:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao atualizar pagamento.', error: err.message });
    }
};

// Deletar um pagamento
const deletePayment = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedPayment = await pool.query('DELETE FROM pagamentos WHERE id = $1 RETURNING id', [id]);
        if (deletedPayment.rows.length === 0) {
            return res.status(404).json({ message: 'Pagamento não encontrado para exclusão.' });
        }
        res.status(200).json({ message: 'Pagamento excluído com sucesso!', id: id });
    } catch (err) {
        console.error('Erro ao deletar pagamento:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao deletar pagamento.', error: err.message });
    }
};

// Função para obter o extrato completo de pagamento de uma reserva
const getPaymentExtract = async (req, res) => {
    const { reserva_id } = req.params; // ID da reserva para o extrato

    try {
        // 1. Buscar detalhes da reserva, quarto e AGORA O HÓSPEDE PRINCIPAL
        const bookingDetails = await pool.query(
            `SELECT
                r.id AS reserva_id,
                r.data_checkin,
                r.data_checkout,
                r.preco_total AS preco_diarias,
                u.nome AS usuario_responsavel_nome,
                u.email AS usuario_responsavel_email,
                q.numero AS quarto_numero,
                q.tipo AS quarto_tipo,
                q.capacidade AS quarto_capacidade,
                q.preco_por_noite AS quarto_preco_por_noite,
                hp.nome AS hospede_principal_nome,
                hp.sobrenome AS hospede_principal_sobrenome,
                hp.cpf AS hospede_principal_cpf,
                hp.email AS hospede_principal_email_contato
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN quartos q ON r.quarto_id = q.id
            LEFT JOIN hospedes hp ON r.hospede_principal_id = hp.id
            WHERE r.id = $1`,
            [reserva_id]
        );

        if (bookingDetails.rows.length === 0) {
            return res.status(404).json({ message: 'Reserva não encontrada para gerar extrato.' });
        }
        const booking = bookingDetails.rows[0];

        // 2. Buscar consumos associados a esta reserva
        const consumptions = await pool.query(
            `SELECT
                c.id,
                s.nome AS servico_nome,
                s.descricao AS servico_descricao,
                c.quantidade,
                c.preco_unitario,
                (c.quantidade * c.preco_unitario) AS subtotal_item
            FROM consumos c
            JOIN servicos s ON c.servico_id = s.id
            WHERE c.reserva_id = $1
            ORDER BY c.data_consumo ASC`,
            [reserva_id]
        );

        // 3. Buscar pagamentos realizados para esta reserva
        const payments = await pool.query(
            `SELECT
                p.id,
                p.valor_pago,
                p.data_pagamento,
                p.metodo_pagamento,
                p.status_pagamento
            FROM pagamentos p
            WHERE p.reserva_id = $1
            ORDER BY p.data_pagamento ASC`,
            [reserva_id]
        );

        // 4. Calcular totais
        let totalConsumo = 0;
        consumptions.rows.forEach(item => {
            totalConsumo += parseFloat(item.subtotal_item);
        });

        const totalBruto = parseFloat(booking.preco_diarias) + totalConsumo;

        const desconto = 0.05;
        const valorFinal = totalBruto * (1 - desconto);

        // --- NOVO CÁLCULO DE STATUS GERAL DO PAGAMENTO (SIMPLIFICADO) ---
        let statusPagamentoFinal = 'Não Pago';
        let totalPago = payments.rows.reduce((sum, p) => sum + parseFloat(p.valor_pago), 0);
        
        if (totalPago >= valorFinal) {
            statusPagamentoFinal = 'Pago';
        } else {
            statusPagamentoFinal = 'Não Pago'; // Inclui "Parcialmente Pago" como "Não Pago"
        }
        // ----------------------------------------------------

        res.status(200).json({
            reserva: {
                id: booking.reserva_id,
                data_entrada: booking.data_checkin,
                data_saida: booking.data_checkout,
                total_diarias: parseFloat(booking.preco_diarias),
                hospede_principal_nome: booking.hospede_principal_nome || booking.usuario_responsavel_nome,
                hospede_principal_email: booking.hospede_principal_email_contato || booking.usuario_responsavel_email
            },
            quarto: {
                numero: booking.quarto_numero,
                tipo: booking.quarto_tipo,
                capacidade: booking.quarto_capacidade,
                preco_por_noite: parseFloat(booking.quarto_preco_por_noite)
            },
            consumos: consumptions.rows.map(item => ({
                id: item.id,
                servico_nome: item.servico_nome,
                descricao: item.descricao,
                quantidade: item.quantidade,
                preco_unitario: parseFloat(item.preco_unitario),
                subtotal_item: parseFloat(item.subtotal_item)
            })),
            total_consumo: parseFloat(totalConsumo.toFixed(2)),
            total_bruto_a_pagar: parseFloat(totalBruto.toFixed(2)),
            desconto_percentual: (desconto * 100),
            valor_final_com_desconto: parseFloat(valorFinal.toFixed(2)),
            pagamentos_realizados: payments.rows.map(p => ({
                id: p.id,
                valor_pago: parseFloat(p.valor_pago),
                data_pagamento: p.data_pagamento,
                metodo_pagamento: p.metodo_pagamento,
                status_pagamento: p.status_pagamento
            })),
            status_pagamento_geral: statusPagamentoFinal
        });

    } catch (err) {
        console.error('Erro ao gerar extrato de pagamento:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao gerar extrato de pagamento.', error: err.message });
    }
};

// @route   GET /api/pagamentos/resumos-reservas
// @desc    Obtém um resumo do status de pagamento para cada reserva ativa
// @access  Private (Admin, Recepcionista)
const getReservationPaymentSummaries = async (req, res) => {
    try {
        const summaries = await pool.query(
            `SELECT
                r.id AS reserva_id,
                r.data_checkin,
                r.data_checkout,
                r.preco_total AS total_diarias,
                r.status_reserva,
                u.nome AS usuario_responsavel_nome,
                u.email AS usuario_responsavel_email,
                q.numero AS quarto_numero,
                q.tipo AS quarto_tipo,
                hp.nome AS hospede_principal_nome,
                hp.sobrenome AS hospede_principal_sobrenome,
                hp.cpf AS hospede_principal_cpf,
                COALESCE(SUM(p.valor_pago), 0) AS total_pago,
                COALESCE((
                    SELECT SUM(c.quantidade * c.preco_unitario)
                    FROM consumos c
                    WHERE c.reserva_id = r.id
                ), 0) AS total_consumo_agregado
            FROM
                reservas r
            JOIN
                usuarios u ON r.usuario_id = u.id
            JOIN
                quartos q ON r.quarto_id = q.id
            LEFT JOIN
                hospedes hp ON r.hospede_principal_id = hp.id
            LEFT JOIN
                pagamentos p ON r.id = p.reserva_id
            WHERE
                r.status_reserva NOT IN ('finalizada', 'cancelada')
            GROUP BY
                r.id, u.id, q.id, hp.id, u.nome, u.email, q.numero, q.tipo, hp.nome, hp.sobrenome, hp.cpf
            ORDER BY
                r.data_reserva DESC;
            `
        );

        const detailedSummaries = summaries.rows.map(row => {
            const totalBruto = parseFloat(row.total_diarias) + parseFloat(row.total_consumo_agregado);
            const descontoPercentual = 0.05;
            const valorFinalComDesconto = totalBruto * (1 - descontoPercentual);
            const totalPago = parseFloat(row.total_pago);

            // --- NOVO CÁLCULO DE STATUS GERAL DO PAGAMENTO PARA RESUMOS (SIMPLIFICADO) ---
            let statusPagamentoGeral = 'Não Pago';
            if (totalPago >= valorFinalComDesconto) {
                statusPagamentoGeral = 'Pago';
            } else {
                statusPagamentoGeral = 'Não Pago'; // Inclui "Parcialmente Pago" como "Não Pago"
            }
            // ----------------------------------------------------

            return {
                reserva_id: row.reserva_id,
                usuario_nome: row.hospede_principal_nome || row.usuario_responsavel_nome,
                usuario_email: row.usuario_responsavel_email,
                quarto_numero: row.quarto_numero,
                status_reserva: row.status_reserva,
                total_diarias: parseFloat(row.total_diarias),
                total_consumo: parseFloat(row.total_consumo_agregado),
                total_bruto_a_pagar: parseFloat(totalBruto.toFixed(2)),
                desconto_percentual: (descontoPercentual * 100),
                valor_final_com_desconto: parseFloat(valorFinalComDesconto.toFixed(2)),
                total_pago: totalPago,
                status_pagamento_geral: statusPagamentoGeral,
                data_checkin: row.data_checkin,
                data_checkout: row.data_checkout,
                hospede_principal_cpf: row.hospede_principal_cpf || 'N/A'
            };
        });

        res.status(200).json(detailedSummaries);

    } catch (err) {
        console.error('Erro ao obter resumo de pagamentos por reserva:', err.message);
        res.status(500).json({ message: 'Erro no servidor ao obter resumo de pagamentos por reserva.', error: err.message });
    }
};


module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getPaymentExtract,
    getReservationPaymentSummaries,
};