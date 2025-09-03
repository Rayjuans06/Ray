// sync-runner.js
const { importClipperOnce } = require('./syncExcelToMySQL'); // <- ajusta el nombre si tu archivo se llama distinto
const chokidar = require('chokidar');

const EXCEL_FILE_PATH = process.env.EXCEL_FILE_PATH
  || 'C:\\Users\\juan.raymundo\\LAUAK SARL\\Lean Manufacturing - 02. FY2025\\03. Lauak Efficiency Report_July_2025.xlsx';

let running = false;
let rerun   = false;

async function runSafe() {
  if (running) { rerun = true; return; }
  running = true;
  try {
    await importClipperOnce();
  } finally {
    running = false;
    if (rerun) { rerun = false; runSafe(); }
  }
}

// 1) Importación inicial
runSafe();

// 2) Reimporta cuando el archivo cambie
chokidar
  .watch(EXCEL_FILE_PATH, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 1500 } })
  .on('change', () => runSafe());
