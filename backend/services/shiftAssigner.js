// backend/services/shiftAssigner.js
module.exports = function makeShiftAssigner(db) {
  // Convierte "HH:MM:SS" a segundos
  function hmsToSec(hms) {
    if (typeof hms !== 'string') return 0;
    const [h, m, s] = hms.split(':').map(n => parseInt(n, 10) || 0);
    return h * 3600 + m * 60 + s;
  }

  // Función principal que asigna los turnos (async/await -> compatible con db.promise())
  async function assignShifts() {
    try {
      console.log('[assignShifts] arrancando proceso (promise mode)');

      // 1) Leer los turnos activos
      const sqlTurnos = `
        SELECT id_turno, hora_entrada, hora_salida
          FROM turnos
         WHERE id_status = 4
      `;
      const [turnos] = await db.query(sqlTurnos);

      console.log(`[assignShifts] Turnos activos: ${turnos.length}`);

      // 2) Leer filas de clipper sin shift_id
      const sqlPend = 'SELECT id, start_time FROM clipper WHERE shift_id IS NULL OR shift_id = ""';
      const [rows] = await db.query(sqlPend);
      console.log(`[assignShifts] Registros pendientes: ${rows.length}`);

      const updates = [];
      for (const row of rows) {
        const secStart = hmsToSec(row.start_time || '00:00:00');
        const match = turnos.find(t => {
          const startSec = hmsToSec(t.hora_entrada || '00:00:00');
          const endSec   = hmsToSec(t.hora_salida   || '00:00:00');
          // si no cruza medianoche
          if (startSec <= endSec) {
            return secStart >= startSec && secStart <= endSec;
          }
          // si cruza medianoche
          return secStart >= startSec || secStart <= endSec;
        });
        if (match) updates.push({ id: row.id, shift_id: match.id_turno });
      }

      console.log(`[assignShifts] A actualizar: ${updates.length} registros`);
      if (!updates.length) return;

      // 3) Ejecutar los UPDATE en una sola transacción (mejor)
      // Si tu pool no soporta transacciones o no quieres, puedes hacer updates individuales.
      const conn = await db.getConnection(); // obtiene conexión del pool
      try {
        await conn.beginTransaction();
        for (const u of updates) {
          await conn.query('UPDATE clipper SET shift_id = ? WHERE id = ?', [u.shift_id, u.id]);
        }
        await conn.commit();
        console.log('[assignShifts] Actualización completada (commit)');
      } catch (err) {
        await conn.rollback();
        console.error('[assignShifts] Error durante actualización, rollback:', err);
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('[assignShifts] error:', err);
      throw err;
    }
  }

  return { assignShifts };
};
