// routes/ttc-processing.routes.js
const express = require('express');

module.exports = function makeTtcRoutes(ttcService) {
  const router = express.Router();

  // 1) Botón manual (procesar todo o solo hoy)
  // POST /processing/ttc/run?onlyToday=true
  router.post('/processing/ttc/run', async (req, res) => {
    try {
      const onlyToday = String(req.query.onlyToday || '').toLowerCase() === 'true';
      const processed = await ttcService.process({ onlyToday });
      res.json({ ok: true, processed });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, msg: 'Error al procesar TTC' });
    }
  });

  // 2) Recalcular UNA fecha exacta: body { date: "YYYY-MM-DD" }
  router.post('/processing/ttc/recalc-date', async (req, res) => {
    try {
      const { date } = req.body || {};
      if (!date) return res.status(400).json({ ok: false, msg: 'Falta date' });
      const processed = await ttcService.processDate(date);
      res.json({ ok: true, processed, date });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, msg: 'Error al recalcular fecha' });
    }
  });

  // 3) Procesar fechas pendientes de la cola (para cron o job)
  router.post('/processing/ttc/process-pending', async (_req, res) => {
    try {
      const processed = await ttcService.processPendingQueue();
      res.json({ ok: true, processed });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, msg: 'Error al procesar pendientes' });
    }
  });

  return router;
};
