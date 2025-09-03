require('dotenv').config();
const fs = require('fs');
const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
const path = require('path');

const {
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
  EXCEL_FILE_PATH: EXCEL_FROM_ENV,
  CLIPPER_SHEET
} = process.env;

// Si no quieres depender del .env, deja el fallback local:
const EXCEL_FILE_PATH = EXCEL_FROM_ENV || 'C:\\Users\\rayju\\Ando\\backend\\03. Lauak Efficiency Report_March_2025_V2.xlsx';
const SHEET_NAME = CLIPPER_SHEET || 'Clipper export';

const pool = mysql.createPool({
  host: DB_HOST || 'localhost',
  port: Number(DB_PORT) || 3306,
  user: DB_USER || 'root',
  password: DB_PASSWORD || '',
  database: DB_NAME || 'reportes',
  waitForConnections: true,
  connectionLimit: 6,   // 2–8 está bien; sube/baja según carga
  queueLimit: 0,
  enableKeepAlive: true,
});

// Mapa columnas Excel -> BD
const columnMap = {
  user_id: 'User ID',
  cost_center: 'C.Center',
  clock_in: 'Clock in',
  job: 'Job',
  job_designation: 'Job designation',
  drawing: 'Drawing',
  rank: 'Rank',
  product_rank: 'Product rank',
  rank_designation: 'Rank designation',
  phase: 'Phase',
  phase_designation: 'Phase designation',
  section: 'Section',
  job_unit_price: 'Job U.Price',
  customer: 'Customer',
  planned_machine_time: 'PMT: planned machine time',
  planned_hr_time: 'PHRT : planned H.R. time',
  planned_setup_time: 'PPT : planned preparation time',
  execution_time: 'Execution',
  forecast_rate: 'Previsionnel rate',
  date: 'Date',
  product_number: 'Product Nb',
  start_time: 'Start time',
  end_time: 'End of work time',
  timeclocked: 'Timeclocked',

  // NUEVOS:
  employee: 'Employee',             // Columna AC del Excel
  employee_name: 'Employee name',   // Columna AD del Excel
};

// Helpers de formato (fecha y hora)
function asDateYMD(v) {
  if (v == null && v !== 0) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// Excel puede tener horas como Date, número (fracción del día) o string
function asTimeHHMMSS(v) {
  if (v == null || v === '') return null;

  if (v instanceof Date) {
    const h = String(v.getHours()).padStart(2, '0');
    const m = String(v.getMinutes()).padStart(2, '0');
    const s = String(v.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  if (typeof v === 'number') {
    const total = Math.round(v * 24 * 3600);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const hh = String(m[1]).padStart(2, '0');
      const mm = m[2];
      const ss = String(m[3] || '00').padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
    const d = new Date(v);
    if (!isNaN(d)) return asTimeHHMMSS(d);
    return v; // último recurso
  }
  return null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Genera el SQL multi-VALUES con uniq_hash calculado en SQL
function buildInsertSQL(rowsCount) {
  // 26 columnas de datos + 1 columna calculada (uniq_hash)
  const baseCols = [
    'user_id','cost_center','clock_in','job','job_designation','drawing',
    'rank','product_rank','rank_designation','phase','phase_designation','section',
    'job_unit_price','customer','planned_machine_time','planned_hr_time','planned_setup_time',
    'execution_time','forecast_rate','date','product_number','start_time','end_time','timeclocked',
    'Employee','Employee_name', // nuevas columnas
    'uniq_hash'
  ];

  const rowPlace =
    '(' +
    Array(26).fill('?').join(', ') +
    ', SHA1(CONCAT_WS(\'|\', ?,?,?,?,?,?,?,?))' + // uniq_hash
    ')';

  const all = Array(rowsCount).fill(rowPlace).join(',\n');

  return `
INSERT INTO clipper (
  ${baseCols.join(', ')}
) VALUES
${all}
ON DUPLICATE KEY UPDATE
  timeclocked = VALUES(timeclocked),
  execution_time = VALUES(execution_time),
  job_unit_price = VALUES(job_unit_price),
  forecast_rate  = VALUES(forecast_rate);
`.trim();
}

// Construye el array de parámetros por fila (26 datos + 8 para el hash)
function buildRowParams(r) {
  const get = (k) => r[columnMap[k]] ?? null;

  const date = asDateYMD(get('date'));
  const start = asTimeHHMMSS(get('start_time'));
  const end = asTimeHHMMSS(get('end_time'));

  const params26 = [
    get('user_id'),
    get('cost_center'),
    get('clock_in'),
    get('job'),
    get('job_designation'),
    get('drawing'),
    get('rank'),
    get('product_rank'),
    get('rank_designation'),
    get('phase'),
    get('phase_designation'),
    get('section'),
    get('job_unit_price'),
    get('customer'),
    get('planned_machine_time'),
    get('planned_hr_time'),
    get('planned_setup_time'),
    get('execution_time'),
    get('forecast_rate'),
    date,
    get('product_number'),
    start,
    end,
    get('timeclocked'),

    // Nuevos (en el mismo orden que baseCols)
    get('employee'),
    get('employee_name'),
  ];

  // Los 8 del hash en el mismo orden que en la BD:
  const hashArgs = [
    date,
    get('product_number'),
    start,
    end,
    get('cost_center'),
    get('user_id'),
    get('job'),
    get('phase'),
  ];

  return [...params26, ...hashArgs];
}

const BATCH_SIZE = 200; // 200–500 va bien; súbelo si el server aguanta

async function importClipperOnce() {
  const abs = path.isAbsolute(EXCEL_FILE_PATH)
    ? EXCEL_FILE_PATH
    : path.resolve(process.cwd(), EXCEL_FILE_PATH);

  if (!fs.existsSync(abs)) {
    console.error('❌ Excel no encontrado:', abs);
    return;
  }

  const wb = xlsx.readFile(abs, { cellDates: true });
  const sheetName = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

  if (!rows.length) {
    console.log('No hay filas en la hoja.');
    return;
  }

  // Filtra filas sin Product Nb
  const filtered = rows.filter(r => {
    const pn = r[columnMap.product_number];
    return pn != null && String(pn).trim() !== '';
  });

  const parts = chunk(filtered, BATCH_SIZE);
  let processed = 0;

  const conn = await pool.getConnection();
  try {
    for (const part of parts) {
      const sql = buildInsertSQL(part.length);
      const params = [];
      for (const r of part) params.push(...buildRowParams(r));
      await conn.query(sql, params);
      processed += part.length;
    }
    console.log(`✅ Importación completada. Filas procesadas (ins/upd): ${processed}`);
  } catch (e) {
    console.error('❌ Error importando:', e.message);
  } finally {
    conn.release();
  }
}

module.exports = { importClipperOnce };
