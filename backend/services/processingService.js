// services/processing-service.js
module.exports = function makeProcessingService(db) {
  // pequeño helper para usar async/await con db.query
  function queryAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  }

  /**
   * 1) Lee clipper según filtro (all o today)
   * 2) Agrupa por date + id_area + shift_id
   * 3) Suma product_number (parseInt -> unsigned)
   */
  async function fetchAndAggregate({ onlyToday = false }) {
    const where = onlyToday ? "WHERE `date` = CURDATE()" : "";
    const sql = `
      SELECT date, id_area, shift_id,
             SUM(CAST(COALESCE(NULLIF(product_number,''), '0') AS UNSIGNED)) AS suma
      FROM clipper
      ${where}
      GROUP BY date, id_area, shift_id
    `;
    return queryAsync(sql);
  }

  /**
   * Transforma los datos para agrupar por date + id_area
   * y coloca la suma en el turno correspondiente
   */
  function reformatGroups(raw) {
    const map = new Map();

    for (const row of raw) {
      // Normalizamos valores: si id_area es NULL, lo dejamos como null en la key
      const areaId = row.id_area === null ? 'NULL' : String(row.id_area);
      const key = `${row.date}-${areaId}`;
      const existing = map.get(key) || {
        date: row.date,
        id_area: row.id_area,
        SumaTurno1: 0,
        SumaTurno2: 0,
        SumaTurno3: 0,
      };

      if (row.shift_id === 1) existing.SumaTurno1 += Number(row.suma);
      else if (row.shift_id === 2) existing.SumaTurno2 += Number(row.suma);
      else if (row.shift_id === 3) existing.SumaTurno3 += Number(row.suma);
      else {
        // si aparecen otros shift_id, los acumulamos en SumaTurnos directamente
        existing.SumaTurno3 += Number(row.suma); // opcional, o crear SumaTurnoX
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).map(item => ({
      ...item,
      SumaTurnos: item.SumaTurno1 + item.SumaTurno2 + item.SumaTurno3
    }));
  }

  /**
   * Inserta o actualiza cada fila agrupada en productnb
   * Asegúrate de que productnb tenga columnas: date, id_area, SumaTurno1, SumaTurno2, SumaTurno3, SumaTurnos
   * y un UNIQUE(date, id_area) para que ON DUPLICATE KEY funcione.
   */
  async function upsertProductNb(groups) {
    if (!groups || groups.length === 0) return;

    const sql = `
      INSERT INTO productnb
        (date, id_area, SumaTurno1, SumaTurno2, SumaTurno3, SumaTurnos)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        SumaTurno1 = VALUES(SumaTurno1),
        SumaTurno2 = VALUES(SumaTurno2),
        SumaTurno3 = VALUES(SumaTurno3),
        SumaTurnos  = VALUES(SumaTurnos)
    `;

    const promises = groups.map(g => {
      const params = [
        g.date,
        g.id_area, // puede ser NULL
        g.SumaTurno1 ?? 0,
        g.SumaTurno2 ?? 0,
        g.SumaTurno3 ?? 0,
        g.SumaTurnos ?? 0
      ];
      return queryAsync(sql, params);
    });

    await Promise.all(promises);
  }

  /**
   * Proceso completo
   */
  async function process({ onlyToday = false } = {}) {
    const rawGroups = await fetchAndAggregate({ onlyToday });
    if (!rawGroups || rawGroups.length === 0) return 0;

    const formattedGroups = reformatGroups(rawGroups);
    await upsertProductNb(formattedGroups);
    return formattedGroups.length;
  }

  return { process, fetchAndAggregate, reformatGroups, upsertProductNb };
};
