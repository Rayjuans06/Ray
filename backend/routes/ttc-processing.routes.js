// routes/ttc-processing.routes.js
const express = require('express');

module.exports = function ttcRoutes(db) {
  const router = express.Router();

  // ================
  // GET /api/ttc
  // ================
  router.get('/ttc', (req, res) => {
    let {
      date_from,
      date_to,
      employee,        // filtra por Employee_name (alias 'employee' por compatibilidad)
      area,            // id_area
      cost_center,
      limit = '200',
      offset = '0',
    } = req.query;

    const params = [];
    let where = '1=1';

    if (date_from) { where += ' AND t.Date_TTC >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND t.Date_TTC <= ?'; params.push(date_to); }
    if (employee)  { where += ' AND t.Employee_name = ?'; params.push(employee); }

    // Filtros por área / cost_center vía clipper, igualando por Employee_name + Date_TTC
    let joinClip = '';
    if (area || cost_center) {
      joinClip = `
        INNER JOIN clipper c
          ON c.Employee_name = t.Employee_name
         AND c.date          = t.Date_TTC
      `;
      if (area) {
        where += ' AND c.id_area = ?';
        params.push(Number(area));
      }
      if (cost_center) {
        where += ' AND c.cost_center = ?';
        params.push(cost_center);
      }
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM ttc t
      ${joinClip}
      WHERE ${where}
    `;

    const dataSql = `
      SELECT
        t.Id_TTC,
        t.Employee,           -- lo poblamos igual que Employee_name
        t.Employee_name,
        t.Date_TTC,
        t.date,               -- tu columna NOT NULL
        t.shift_TTC1, t.shift_TTC2, t.shift_TTC3, t.TTG,
        t.ttc_total, t.ttc_NP, t.updated_at,
        SEC_TO_TIME(t.shift_TTC1) AS shift1_hms,
        SEC_TO_TIME(t.shift_TTC2) AS shift2_hms,
        SEC_TO_TIME(t.shift_TTC3) AS shift3_hms,
        SEC_TO_TIME(t.TTG)        AS total_hms
      FROM ttc t
      ${joinClip}
      WHERE ${where}
      ORDER BY t.Date_TTC DESC, t.Employee_name ASC
      LIMIT ? OFFSET ?
    `;

    db.query(countSql, params, (err, countRows) => {
      if (err) {
        console.error('❌ /api/ttc count error:', err);
        return res.status(500).json({ error: err.sqlMessage || 'DB error (count)' });
      }
      const total = countRows?.[0]?.total || 0;

      db.query(dataSql, [...params, Number(limit), Number(offset)], (err2, rows) => {
        if (err2) {
          console.error('❌ /api/ttc data error:', err2);
          return res.status(500).json({ error: err2.sqlMessage || 'DB error' });
        }
        res.set('X-Total-Count', String(total));
        res.json(rows);
      });
    });
  });

  // ===========================
  // POST /api/ttc/rebuild
  // Recalcula por rango (y opcional id_area / cost_center)
  // ===========================
  router.post('/ttc/rebuild', (req, res) => {
    const { date_from, date_to, id_area, cost_center } = req.body;
    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from y date_to son obligatorios (YYYY-MM-DD).' });
    }

    // WHERE dinámico en clipper
    let where = 'c.`date` BETWEEN ? AND ?';
    const params = [date_from, date_to];

    if (id_area) {
      where += ' AND c.id_area = ?';
      params.push(Number(id_area));
    }
    if (cost_center) {
      where += ' AND c.cost_center = ?';
      params.push(cost_center);
    }

    // NOTA: usamos Employee_name como clave; poblamos Employee = Employee_name.
    // Llenamos Date_TTC y también la columna NOT NULL `date`.
    // TTG y ttc_total en segundos (mantén consistencia con tu UI).
    const upsertSql = `
      INSERT INTO ttc (
        Employee,
        Employee_name,
        Date_TTC,
        \`date\`,
        shift_TTC1,
        shift_TTC2,
        shift_TTC3,
        TTG,
        ttc_total
      )
      SELECT
        c.Employee_name                                AS Employee,
        c.Employee_name                                AS Employee_name,
        c.\`date\`                                      AS Date_TTC,
        c.\`date\`                                      AS \`date\`,
        SUM(CASE WHEN c.shift_id = 1 THEN COALESCE(TIME_TO_SEC(c.TimeClocked),0) ELSE 0 END) AS shift_TTC1,
        SUM(CASE WHEN c.shift_id = 2 THEN COALESCE(TIME_TO_SEC(c.TimeClocked),0) ELSE 0 END) AS shift_TTC2,
        SUM(CASE WHEN c.shift_id = 3 THEN COALESCE(TIME_TO_SEC(c.TimeClocked),0) ELSE 0 END) AS shift_TTC3,
        SUM(COALESCE(TIME_TO_SEC(c.TimeClocked),0))                                         AS TTG,
        SUM(COALESCE(TIME_TO_SEC(c.TimeClocked),0))                                         AS ttc_total
      FROM clipper c
      WHERE ${where}
      GROUP BY c.Employee_name, c.\`date\`
      ON DUPLICATE KEY UPDATE
        shift_TTC1 = VALUES(shift_TTC1),
        shift_TTC2 = VALUES(shift_TTC2),
        shift_TTC3 = VALUES(shift_TTC3),
        TTG        = VALUES(TTG),
        ttc_total  = VALUES(ttc_total),
        \`date\`    = VALUES(\`date\`),     -- mantenemos sincronizada la NOT NULL
        updated_at = CURRENT_TIMESTAMP
    `;

    db.query(upsertSql, params, (err, result) => {
      if (err) {
        console.error('❌ /api/ttc/rebuild error:', err);
        console.error('SQL:', upsertSql);
        console.error('Params:', params);
        return res.status(500).json({ error: err.sqlMessage || 'DB error (rebuild)' });
      }
      res.json({ message: 'TTC regenerado', affected: result.affectedRows });
    });
  });

  // ===========================
  // POST /api/ttc  (upsert manual)
  // ===========================
  router.post('/ttc', (req, res) => {
    // Usamos Employee_name como requerido (clave), y llenamos Employee = Employee_name
    const {
      Employee_name,
      Date_TTC,
      shift_TTC1 = 0,
      shift_TTC2 = 0,
      shift_TTC3 = 0,
    } = req.body;

    if (!Employee_name || !Date_TTC) {
      return res.status(400).json({ error: 'Employee_name y Date_TTC son obligatorios.' });
    }

    const s1 = Number(shift_TTC1) || 0;
    const s2 = Number(shift_TTC2) || 0;
    const s3 = Number(shift_TTC3) || 0;
    const TTG = s1 + s2 + s3;

    const sql = `
      INSERT INTO ttc (
        Employee,
        Employee_name,
        Date_TTC,
        \`date\`,
        shift_TTC1, shift_TTC2, shift_TTC3, TTG, ttc_total
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        shift_TTC1 = VALUES(shift_TTC1),
        shift_TTC2 = VALUES(shift_TTC2),
        shift_TTC3 = VALUES(shift_TTC3),
        TTG        = VALUES(TTG),
        ttc_total  = VALUES(ttc_total),
        \`date\`    = VALUES(\`date\`),
        updated_at = CURRENT_TIMESTAMP
    `;
    const params = [
      Employee_name,             // Employee
      Employee_name,             // Employee_name
      Date_TTC,                  // Date_TTC
      Date_TTC,                  // `date` (sincronizada)
      s1, s2, s3, TTG, TTG
    ];

    db.query(sql, params, (err, r) => {
      if (err) {
        console.error('❌ /api/ttc insert error:', err);
        return res.status(500).json({ error: err.sqlMessage || 'DB error (insert ttc)' });
      }
      res.status(201).json({ message: 'TTC guardado/actualizado', upserted: true });
    });
  });

  // ===========================
  // PUT /api/ttc/:id
  // ===========================
  router.put('/ttc/:id', (req, res) => {
    const { id } = req.params;
    const s1 = Number(req.body.shift_TTC1) || 0;
    const s2 = Number(req.body.shift_TTC2) || 0;
    const s3 = Number(req.body.shift_TTC3) || 0;
    const TTG = s1 + s2 + s3;

    const sql = `
      UPDATE ttc
      SET shift_TTC1 = ?, shift_TTC2 = ?, shift_TTC3 = ?, TTG = ?, ttc_total = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE Id_TTC = ?
    `;
    db.query(sql, [s1, s2, s3, TTG, TTG, id], (err, r) => {
      if (err) {
        console.error('❌ /api/ttc update error:', err);
        return res.status(500).json({ error: err.sqlMessage || 'DB error (update ttc)' });
      }
      if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
      res.json({ message: 'TTC actualizado' });
    });
  });

  // ===========================
  // DELETE /api/ttc/:id
  // ===========================
  router.delete('/ttc/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM ttc WHERE Id_TTC = ?', [id], (err, r) => {
      if (err) {
        console.error('❌ /api/ttc delete error:', err);
        return res.status(500).json({ error: err.sqlMessage || 'DB error (delete ttc)' });
      }
      if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
      res.json({ message: 'TTC eliminado' });
    });
  });

  return router;
};
