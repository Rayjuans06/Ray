// services/ttc-processing-service.js
module.exports = function makeTtcProcessingService(db) {
  // Lista de cost_centers a excluir para ttc_NP
  const NON_PRODUCTIVE = ['EXTER','MEDIC','SINDI','JUNTA','MANTO','ORGAN','INVEN','TRAIN'];

  /**
   * Helper para ejecutar consultas SQL usando callbacks y convertirlas a promesas
   */
  function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  /**
   * Lee clipper con opcional filtro por fecha o solo hoy
   */
  async function fetchClipper({ onlyToday = false, date = null } = {}) {
    let where = '';
    const args = [];

    if (date) {
      where = 'WHERE `date` = ?';
      args.push(date);
    } else if (onlyToday) {
      where = 'WHERE `date` = CURDATE()';
    }

    const sql = `
      SELECT
        \`date\`,
        Employee_name,
        shift_id,
        TIME_TO_SEC(
          COALESCE(NULLIF(TimeClocked, ''), '00:00:00')
        ) AS seconds,
        cost_center
      FROM clipper
      ${where}
    `;
    return queryAsync(sql, args);
  }

  /**
   * Reagrupa por date + Employee_name
   */
  function aggregate(rows) {
    const byKey = new Map();

    for (const r of rows) {
      const key = `${r.date}__${r.Employee_name}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          date: r.date,
          Employee_name: r.Employee_name,
          shift_TTC1: 0,
          shift_TTC2: 0,
          shift_TTC3: 0,
          ttc_total: 0,
          ttc_NP: 0,
          _shiftCounts: {}
        });
      }
      const acc = byKey.get(key);
      const secs = Number(r.seconds || 0);
      const shift = Number(r.shift_id || 0);

      if (shift === 1) acc.shift_TTC1 += secs;
      else if (shift === 2) acc.shift_TTC2 += secs;
      else if (shift === 3) acc.shift_TTC3 += secs;

      acc.ttc_total += secs;

      if (!NON_PRODUCTIVE.includes(String(r.cost_center || '').toUpperCase())) {
        acc.ttc_NP += secs;
      }

      if (!acc._shiftCounts[shift]) acc._shiftCounts[shift] = 0;
      acc._shiftCounts[shift] += 1;
    }

    const out = [];
    for (const [, acc] of byKey) {
      let modeShift = null, maxCount = -1;
      for (const [shiftStr, count] of Object.entries(acc._shiftCounts)) {
        const s = Number(shiftStr);
        if (count > maxCount) {
          maxCount = count;
          modeShift = s;
        }
      }
      out.push({
        date: acc.date,
        Employee_name: acc.Employee_name,
        shift_id: modeShift,
        shift_TTC1: acc.shift_TTC1,
        shift_TTC2: acc.shift_TTC2,
        shift_TTC3: acc.shift_TTC3,
        ttc_total: acc.ttc_total,
        ttc_NP: acc.ttc_NP
      });
    }
    return out;
  }

  /**
   * UPSERT a ttc (UNIQUE(date, Employee_name))
   */
  async function upsertTtc(groups) {
    if (!groups || groups.length === 0) return 0;

    const sql = `
      INSERT INTO ttc
        (date, Employee_name, shift_id, shift_TTC1, shift_TTC2, shift_TTC3, ttc_total, ttc_NP)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        shift_id    = VALUES(shift_id),
        shift_TTC1  = VALUES(shift_TTC1),
        shift_TTC2  = VALUES(shift_TTC2),
        shift_TTC3  = VALUES(shift_TTC3),
        ttc_total   = VALUES(ttc_total),
        ttc_NP      = VALUES(ttc_NP)
    `;

    // Ejecuta todos los UPSERT en paralelo
    await Promise.all(groups.map(g =>
      queryAsync(sql, [
        g.date,
        g.Employee_name,
        g.shift_id ?? null,
        g.shift_TTC1 ?? 0,
        g.shift_TTC2 ?? 0,
        g.shift_TTC3 ?? 0,
        g.ttc_total ?? 0,
        g.ttc_NP ?? 0
      ])
    ));

    return groups.length;
  }

  /**
   * Procesa todo (o solo hoy, o una fecha específica)
   */
  async function process({ onlyToday = false, date = null } = {}) {
    const rows = await fetchClipper({ onlyToday, date });
    if (!rows.length) return 0;
    const groups = aggregate(rows);
    return upsertTtc(groups);
  }

  /**
   * Procesa SOLO una fecha
   */
  async function processDate(date) {
    return process({ date });
  }

  /**
   * Procesa fechas pendientes de recalc_queue
   */
  async function processPendingQueue() {
    const pend = await queryAsync(`SELECT date FROM recalc_queue WHERE pending = 1`);
    let total = 0;
    for (const r of pend) {
      total += await processDate(r.date);
      await queryAsync(`UPDATE recalc_queue SET pending = 0 WHERE date = ?`, [r.date]);
    }
    return total;
  }

  return { process, processDate, processPendingQueue, fetchClipper, upsertTtc, aggregate };
};
