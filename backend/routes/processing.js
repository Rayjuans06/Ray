// backend/routes/processing.js
const express = require('express');

module.exports = function (db) {
  const router = express.Router();
  const { process } = require('../services/processingService')(db);

  // Procesar todo el historial
  router.post('/process-all', async (req, res, next) => {
    try {
      const count = await process({ onlyToday: false });
      res.json({ success: true, groupsProcessed: count });
    } catch (err) {
      next(err);
    }
  });

  // Procesar solo el día actual
  router.post('/process-today', async (req, res, next) => {
    try {
      const count = await process({ onlyToday: true });
      res.json({ success: true, groupsProcessed: count });
    } catch (err) {
      next(err);
    }
  });

  // Obtener resultados con filtros
  router.get('/productnb', (req, res, next) => {
    // Soporta id_area (nuevo), id_CCenter (legacy) y cost_center (por si acaso)
    const {
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      id_area,
      id_CCenter,   // legacy (lo mapeamos a id_area)
      cost_center   // opcional: filtrar por código de cost center
    } = req.query;

    let sql = `
      SELECT 
        p.Id_ProductNb,
        p.date,
        a.Cost_center,
        a.nombre_area,
        p.SumaTurno1,
        p.SumaTurno2,
        p.SumaTurno3,
        p.SumaTurnos
      FROM productnb p
      JOIN area a ON p.id_area = a.id_area
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ` AND p.date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND p.date <= ?`;
      params.push(endDate);
    }

    // Acepta id_area nuevo o id_CCenter legacy
    if (id_area) {
      sql += ` AND p.id_area = ?`;
      params.push(id_area);
    } else if (id_CCenter) {
      sql += ` AND p.id_area = ?`;
      params.push(id_CCenter);
    }

    if (cost_center) {
      sql += ` AND a.Cost_center = ?`;
      params.push(cost_center);
    }

    sql += ` ORDER BY p.date DESC`;
    // Si quieres paginación en BD, descomenta estas dos líneas:
    // sql += ` LIMIT ? OFFSET ?`;
    // params.push(Number(limit), Number(offset));

    db.query(sql, params, (err, rows) => {
      if (err) return next(err);

      const formatted = rows.map(row => ({
        ...row,
        date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      }));

      res.json(formatted);
    });
  });

  // Obtener centros/áreas para selects
  router.get('/ccenters', (req, res, next) => {
    const sql = `
      SELECT 
        a.id_area,
        a.Cost_center,
        a.nombre_area
      FROM area a
      ORDER BY a.nombre_area
    `;
    db.query(sql, (err, results) => {
      if (err) return next(err);
      // Formato amigable para frontend
      const out = results.map(r => ({
        id_area: r.id_area,
        cost_center: r.Cost_center,
        nombre_area: r.nombre_area || `Centro ${r.Cost_center}`
      }));
      res.json(out);
    });
  });

  return router;
};
