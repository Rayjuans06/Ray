import React, { useState, useEffect, useMemo } from 'react';
import styles from './intra.module.css';
import { useProductNbApi } from '../hooks/useProductNbApi';


import { API_URL } from './config'; // ajusta ruta si es necesario
import axios from 'axios'; 
const url = (path) => `${API_URL}${path}`; // path debe iniciar con /api

const Intra = () => {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [ccenters, setCcenters] = useState([]);
const [filteredClipper, setFilteredClipper] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [clipperData, setClipperData] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [scmData, setScmData] = useState([]);
  const [scmPage, setScmPage] = useState(1);
  const [loadingSCM, setLoadingSCM] = useState(false);
  const [formData, setFormData] = useState({});
  const [notification, setNotification] = useState('');
  const [activeTab, setActiveTab] = useState('Gráficas');
//-------------------------------------------------------------------------------------TTC
const [filterDate, setFilterDate] = useState('');
const [filterUser, setFilterUser] = useState('');
const [filterShift, setFilterShift] = useState('');

// Estados para inputs de filtro (no aplicados hasta presionar "Filtrar")
const [filterDateInput, setFilterDateInput] = useState('');
const [filterUserInput, setFilterUserInput] = useState('');
const [filterShiftInput, setFilterShiftInput] = useState('');

// Estado con los filtros que están realmente aplicados (los usa la tabla)
const [appliedFilters, setAppliedFilters] = useState({ date: '', user: '', shift: '' });

// Modal para opciones avanzadas (área, rango, rebuild)
const [showAdvanced, setShowAdvanced] = useState(false);

// Datos de la tabla TTC
const [ttcData, setTtcData] = useState([]);

  // -----------------------------
  // useEffect para cargar TTC al montar el componente
  // -----------------------------
  useEffect(() => {
    const fetchTTC = async () => {
      try {
        setTtcLoading(true);
        const res = await axios.get(`${API_URL}/ttc`); // reemplaza con tu endpoint real
        setTtcData(res.data);
        console.log('Datos TTC cargados:', res.data); // para debug
      } catch (error) {
        console.error('Error al cargar TTC:', error);
        setTtcData([]);
      } finally {
        setTtcLoading(false);
      }
    };

    fetchTTC();
  }, []); // <-- se ejecuta solo al montar el componente

  
const filteredTtcData = useMemo(() => {
  if (!Array.isArray(ttcData)) return [];

  const { date, user, shift } = appliedFilters;

  return ttcData.filter(row => {
    let ok = true;

    if (date) {
      // Compara con formato YYYY-MM-DD (formatDateOpt devuelve 'dd/mm/yyyy'), así que mejor normalizamos a ISO
      // Si Date_TTC viene como 'YYYY-MM-DD' o Date, convertimos:
      const rowDate = (() => {
        if (!row?.Date_TTC) return '';
        const d = new Date(row.Date_TTC);
        if (Number.isNaN(d.getTime())) return String(row.Date_TTC);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}`;
      })();
      ok = ok && rowDate === date;
    }

    if (user) {
      ok = ok && String(row.Employee || '')
        .toLowerCase()
        .includes(user.toLowerCase());
    }

    if (shift) {
      ok = ok && String(row.identificacion_TTC ?? row.identificacion ?? '')
        .toLowerCase()
        .includes(shift.toLowerCase());
    }

    return ok;
  });
}, [ttcData, appliedFilters]);



// --- TTC (Reporte de Utilización) ---
const [ttcFrom, setTtcFrom] = useState('');
const [ttcTo, setTtcTo] = useState('');
const [ttcArea, setTtcArea] = useState('');     // opcional, para filtrar por área
const [ttcLoading, setTtcLoading] = useState(false);
const [ttcMsg, setTtcMsg] = useState('');

// Tab activo para mostrar "Total" o "Productive Utilization"
const [reportTab, setReportTab] = useState('total');


  
  // Divide el header en dos partes: antes del primer espacio y el resto
const splitHeader = (label) => {
  if (!label || typeof label !== 'string') return label;
  const i = label.indexOf(' ');
  if (i === -1) return <span className={styles.headerTop}>{label}</span>;
  const first = label.slice(0, i);
  const rest = label.slice(i + 1);
  return (
    <>
      <span className={styles.headerTop}>{first}</span>
      <span className={styles.headerBottom}>{rest}</span>
    </>
  );
};

  
//______________________________________________________________________________________________
// ----------------- Helpers para TU / PU (pegar dentro de Intra, antes del return) -----------------
/**
 * Normaliza entradas a fracción:
 * - 0.85 => 0.85
 * - 85   => 0.85
 * - "85%"|"85" => 0.85
 * Devuelve NaN si no es convertible.
 */
const toFraction = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') {
    if (v <= 1) return v;
    if (v > 1 && v <= 100) return v / 100;
    return v;
  }
  if (typeof v === 'string') {
    const cleaned = v.trim().replace('%', '').replace(',', '.');
    const n = Number(cleaned);
    if (Number.isFinite(n)) {
      if (n <= 1) return n;
      if (n > 1 && n <= 100) return n / 100;
      return n;
    }
  }
  return NaN;
};

/** Formatea porcentaje legible o '—' si no hay dato */
const fmtPctNormalized = (v) => {
  const f = toFraction(v);
  if (!Number.isFinite(f)) return '—';
  return `${(f * 100).toFixed(2)}%`;
};

/**
 * Devuelve la clase CSS del module styles según reglas:
 * >= 0.98 -> styles.tuGreen
 * 0.75-0.97 -> styles.tuYellow
 * < 0.75 -> styles.tuRed
 * Si no hay dato válido devuelve '' (sin clase).
 */
const pctColorClass = (v) => {
  const f = toFraction(v);
  if (!Number.isFinite(f)) return '';
  if (f >= 0.98) return styles.tuGreen;
  if (f >= 0.75 && f <= 0.97) return styles.tuYellow;
  if (f < 0.75) return styles.tuRed;
  return '';
};

/** (opcional) formatea fecha segura */
const formatDateOpt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
// ---------------------------------------------------------------------------------------------------

{/* ------------------- Filtros dinámicos ------------------- */}
<div style={{ margin: '1rem 0', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
  <div>
    <label>Filtrar por fecha: </label>
    <input
      type="date"
      value={filterDate}
      onChange={(e) => setFilterDate(e.target.value)}
    />
  </div>

  <div>
    <label>Filtrar por usuario: </label>
    <input
      type="text"
      placeholder="Employee..."
      value={filterUser}
      onChange={(e) => setFilterUser(e.target.value)}
    />
  </div>

  <div>
    <label>Filtrar por turno: </label>
    <input
      type="text"
      placeholder="Identificación..."
      value={filterShift}
      onChange={(e) => setFilterShift(e.target.value)}
    />
  </div>

  {(filterDate || filterUser || filterShift) && (
    <button onClick={() => { setFilterDate(''); setFilterUser(''); setFilterShift(''); }}>
      Limpiar filtros
    </button>
  )}
</div>


// ------------------ Resumen dinámico para mini-tabla (pegar dentro de Intra, antes del return) ------------------
/**
 * findValue: busca una clave tolerando espacios, mayúsculas/minúsculas y tildes.
 * Devuelve undefined si no la encuentra.
 */
const findValue = (row, key) => {
  if (!row) return undefined;
  // prueba exacta
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];

  const normalize = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita acentos
      .toLowerCase()
      .replace(/[\s_]+/g, '');

  const target = normalize(key);

  for (const k of Object.keys(row)) {
    if (normalize(k) === target) return row[k];
  }

  // buscar en primer nivel anidado
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const nk of Object.keys(v)) {
        if (normalize(nk) === target) return v[nk];
      }
    }
  }

  return undefined;
};

/**
 * avgOfField: devuelve promedio (fracción entre 0 y 1) de una key sobre las filas válidas
 * Ignora valores no convertibles.
 */
const avgOfField = (rows, fieldKey) => {
  if (!Array.isArray(rows) || rows.length === 0) return NaN;

  // usa toFraction existente si existe, sino usa fallback local
  const _toFraction =
    typeof toFraction === 'function'
      ? toFraction
      : (v) => {
          if (v === null || v === undefined || v === '') return NaN;
          if (typeof v === 'number') {
            if (v <= 1) return v;
            if (v > 1 && v <= 100) return v / 100;
            return v;
          }
          if (typeof v === 'string') {
            const cleaned = v.trim().replace('%', '').replace(',', '.');
            const n = Number(cleaned);
            if (Number.isFinite(n)) {
              if (n <= 1) return n;
              if (n > 1 && n <= 100) return n / 100;
              return n;
            }
          }
          return NaN;
        };

  let sum = 0;
  let count = 0;
  for (const r of rows) {
    const raw = findValue(r, fieldKey);
    const f = _toFraction(raw);
    if (Number.isFinite(f)) {
      sum += f;
      count++;
    }
  }
  return count > 0 ? sum / count : NaN;
};

// visibleTtcRows: filas que actualmente se visualizan.
// Si en el futuro muestras solo una página, reemplaza ttcData por el slice visible (p.ej. ttcData.slice(...))
const visibleTtcRows = useMemo(() => {
  return Array.isArray(ttcData) ? ttcData : [];
}, [ttcData]);

// summaryUtil: promedios calculados según reportTab (total => TU_uti1/2, productive => PU_uti1/2)
const summaryUtil = useMemo(() => {
  const field1 = reportTab === 'total' ? 'TU_uti1' : 'PU_uti1';
  const field2 = reportTab === 'total' ? 'TU_uti2' : 'PU_uti2';

  const avg1 = avgOfField(visibleTtcRows, field1);
  const avg2 = avgOfField(visibleTtcRows, field2);

  let day;
  if (Number.isFinite(avg1) && Number.isFinite(avg2)) day = (avg1 + avg2) / 2;
  else if (Number.isFinite(avg1)) day = avg1;
  else if (Number.isFinite(avg2)) day = avg2;
  else day = NaN;

  return {
    avg1, // fracción
    avg2,
    day,
    count: visibleTtcRows.length
  };
}, [visibleTtcRows, reportTab]);
// -------------------------------------------------------------------------------------------------------------

//_______________________________________________________________________________________________
  // Devuelve la clase según si el valor es < 100% o >= 100%.
// OJO: producti viene como fracción (0.85 = 85%), así que comparamos con 1.0
const pctClass = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n >= 1 ? styles.pctOk : styles.pctLow;
};

  // Filtros compartidos para el tab Productivity
const [filters, setFilters] = useState({
  id_area: '',
  date_from: '',
  date_to: '',
});

// scmproducty
const [scmProducty, setScmProducty] = useState([]);
const [loadingProducty, setLoadingProducty] = useState(false);
const productyRowsPerPage = 50;
const [productyPage, setProductyPage] = useState(1);
const [productyTotal, setProductyTotal] = useState(0);

// --- PRODUCTNB (vista A) ---
const prodNbRowsPerPage = 50;
const [prodNbPage, setProdNbPage] = useState(1);
const [prodNbTotal, setProdNbTotal] = useState(0);
const [prodNbLoading, setProdNbLoading] = useState(false);
const [prodNbItems, setProdNbItems] = useState([]);


  // Hook para Productividad
  const { processAll, fetchProductNb } = useProductNbApi();
  const [prodData, setProdData] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [processingProd, setProcessingProd] = useState(false);
  const [prodOffset, setProdOffset] = useState(0); 
  
  // --- Pon esto dentro del componente, arriba del return ---
const prettyLabel = (key) => {
  if (key === 'id_scm') return 'ID';
  if (key === 'fecha_scm') return 'Fecha';
  // Quita el sufijo _scm, reemplaza guiones bajos por espacios y pone Title Case
  const cleaned = key.replace(/_scm$/i, '').replace(/_/g, ' ');
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
};

// En el orden que quieras mostrar las columnas:
const scmColumns = [
  'id_scm',
  'fecha_scm',
  'CUTTING_scm', 'Bending_scm', 'AICON_scm', 'MARTR_scm', 'VAPOR_scm',
  'workzone_1_scm',
  'Permas_scm', 'Wiggins_scm', 'Harrison_scm', 'Pressure_test_scm', 'ABOC_scm', 'ABOC2_scm',
  'Reborde_scm', 'Manual_Bending_scm', 'SOLDA_scm', 'HORNO_scm', 'AJUST_scm', 'EXPAN_scm',
  'SWAGE_scm', 'ROLAD_scm', 'TGS_scm',
  'workzone_2_scm',
  'MASK_scm', 'Painting_scm', 'DMASK_scm', 'Alodine_scm', 'Manual_Alodine_scm',
  'workzone_3_scm',
  'Packaging_scm', 'Rwk_scm',
  'workzone_4_scm',
  'CTRLI_scm', 'CTRFL_scm', 'AAFAI_scm', 'Kitting_scm', 'plant_level_scm',
  'DI',
];


  const rowsPerPage = 50;
  const rowsPerPageSCM = 50;

  const tabs = ['Gráficas', 'Productivity', 'SCM plan'];
  const buttons = [
  { id: 0, label: 'Inicio' },
  { id: 1, label: 'Productividad' },
  { id: 2, label: 'Reporte de Utilización' },
  { id: 3, label: 'Reporte de calidad' },
  { id: 4, label: 'Reporte OEE' },
  { id: 5, label: 'OEE Potential' },
  { id: 6, label: 'NQE Potential' },
  { id: 7, label: 'TE Change Potential' },
  { id: 8, label: 'Clipper' }
];
  const handleSyncClipper = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(url('/api/sync-clipper'), { method: 'POST' });
      if (!res.ok) throw new Error('Error al iniciar sincronización');
      setSyncMessage('Sincronización iniciada');

      const clipperRes = await fetch(url('/api/clipper'));
      const newData = await clipperRes.json();
      setClipperData(newData);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setSyncMessage('Error al sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDateYMD = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  
const fmtPct = (v) =>
  v === null || v === undefined || v === '' ? '—' : `${(Number(v) * 100).toFixed(2)}%`;




  const zones = {
    'Workzone 1': ['CUTTING_scm', 'Bending_scm', 'AICON_scm', 'MARTR_scm', 'VAPOR_scm'],
    'Workzone 2': ['Permas_scm', 'Wiggins_scm', 'Harrison_scm', 'Pressure_test_scm', 'ABOC_scm', 'ABOC2_scm', 'Reborde_scm', 'Manual_Bending_scm', 'SOLDA_scm', 'HORNO_scm', 'AJUST_scm', 'EXPAN_scm', 'SWAGE_scm', 'ROLAD_scm', 'TGS_scm'],
    'Workzone 3': ['MASK_scm', 'Painting_scm', 'DMASK_scm', 'Alodine_scm', 'Manual_Alodine_scm'],
    'Workzone 4': ['DI', 'Packaging_scm', 'Rwk_scm'],
    'Plant Level': ['CTRLI_scm', 'CTRFL_scm', 'AAFAI_scm', 'Kitting_scm']
  };

  const computed = useMemo(() => {
    const get = k => Number(formData[k]) || 0;
    return {
      workzone_1_scm: zones['Workzone 1'].reduce((sum, k) => sum + get(k), 0),
      workzone_2_scm: zones['Workzone 2'].reduce((sum, k) => sum + get(k), 0),
      workzone_3_scm: zones['Workzone 3'].reduce((sum, k) => sum + get(k), 0),
      workzone_4_scm: zones['Workzone 4'].reduce((sum, k) => sum + get(k), 0),
      plant_level_scm: zones['Plant Level'].reduce((sum, k) => sum + get(k), 0)
    };
  }, [formData]);


  // Filtrado CLIENTE para ProductNb (si aún no filtras en backend)
const prodDataFiltered = useMemo(() => {
  const from = filters.date_from ? new Date(filters.date_from) : null;
  const to   = filters.date_to   ? new Date(filters.date_to)   : null;

  return prodData.filter((r) => {
    // fecha
    let okDate = true;
    if (from || to) {
      const d = r.date ? new Date(r.date) : null;
      if (!d) okDate = false;
      if (from && d < from) okDate = false;
      if (to && d > to) okDate = false;
    }

    // área: comparamos por id_area si viene (ajusta si tu fila trae otra key)
    let okArea = true;
    if (filters.id_area) {
      const idAreaRow = r.id_area || r.Id_area || r.area_id || null;
      okArea = String(idAreaRow || '') === String(filters.id_area);
    }

    return okDate && okArea;
  });
}, [prodData, filters]);


  useEffect(() => {
    if (selectedReport === 8) {
      fetch('http://localhost:5000/api/clipper')
        .then(r => r.json())
        .then(d => {
          setClipperData(d);
          setCurrentPage(1);
        })
        .catch(console.error);
    }
  }, [selectedReport]);

  useEffect(() => {
    if (selectedReport === 1 && activeTab === 'SCM plan') {
      setLoadingSCM(true);
      fetch(url('/api/scm'))
        .then(r => r.json())
        .then(data => {
          const sorted = data.sort((a, b) => b.id_scm - a.id_scm);
          setScmData(sorted);
          setScmPage(1);
          if (sorted.length) {
            const init = {};
            Object.keys(sorted[0])
              .filter(k => !['id_scm', 'id_area', 'Workzone_1_scm', 'Workzone_2_scm', 'Workzone_3_scm', 'Workzone_4_scm', 'Plant_Level_scm'].includes(k))
              .forEach(k => { init[k] = ''; });
            setFormData(init);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSCM(false));
    }
  }, [selectedReport, activeTab]);



//__________________________________________________________________TTC

const fetchTtcData = async () => {
  setTtcLoading(true);
  setTtcMsg('');
  try {
    // Usa tu helper url() para que las rutas sean consistentes
    const response = await axios.get(url('/api/ttc'), {
      params: { area: ttcArea, from: ttcFrom, to: ttcTo },
    });
    // Opcional: ver en consola la forma de los datos
    console.log('fetchTtcData response sample:', response.data?.[0] ?? response.data);
    setTtcData(response.data || []);
    if (!response.data || response.data.length === 0) {
      setTtcMsg('No se encontraron registros.');
    }
  } catch (error) {
    console.error('Error fetchTtcData:', error);
    setTtcMsg('Error al cargar datos.');
    setTtcData([]);
  } finally {
    setTtcLoading(false);
  }
};


// Obtener datos TTC para mostrar en la tabla
useEffect(() => {
  const fetchInitialTTC = async () => {
    try {
      setTtcLoading(true);
      const res = await axios.get(url('/api/ttc'));
      setTtcData(res.data || []);
      console.log('Datos TTC cargados (mount):', res.data);
    } catch (e) {
      console.error('Error al cargar TTC en mount:', e);
      setTtcData([]);
    } finally {
      setTtcLoading(false);
    }
  };
  fetchInitialTTC();
}, []);


// Regenerar TTC en el backend y luego refrescar la tabla
const handleRebuildTTC = async () => {
  if (!ttcFrom || !ttcTo) {
    setTtcMsg('Selecciona rango de fechas (desde / hasta).');
    return;
  }
  setTtcLoading(true);
  setTtcMsg('');
  try {
    const body = {
      date_from: ttcFrom,
      date_to: ttcTo,
      ...(ttcArea ? { id_area: Number(ttcArea) } : {})
    };
    const res = await fetch(url('/api/ttc/rebuild'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error al regenerar TTC');

    setTtcMsg(`✅ TTC actualizado. Filas afectadas: ${data.affected ?? 0}`);
    
    // **Refrescar los datos automáticamente**
    await fetchTtcData();

  } catch (err) {
    console.error(err);
    setTtcMsg('❌ Error al regenerar TTC');
  } finally {
    setTtcLoading(false);
  }
};


//__________________________________________________________________
 // Cargar scmproducty con filtros y paginación cuando entras a Productivity o cambian filtros/página
useEffect(() => {
  if (selectedReport !== 1 || activeTab !== 'Productivity') return;

  setLoadingProducty(true);

  const params = new URLSearchParams({
    limit: String(productyRowsPerPage),
    offset: String((productyPage - 1) * productyRowsPerPage),
  });

  if (filters.id_area)   params.set('id_area', String(filters.id_area));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to)   params.set('date_to', filters.date_to);

 fetch(url(`/api/scmproducty?${params.toString()}`))
    .then(async (r) => {
      const total = r.headers.get('X-Total-Count');
      if (total) setProductyTotal(Number(total));
      return r.json();
    })
    .then(setScmProducty)
    .catch(console.error)
    .finally(() => setLoadingProducty(false));
}, [selectedReport, activeTab, productyPage, filters]);


// Cargar PRODUCTNB (tabla A) con los mismos filtros y paginación 50
useEffect(() => {
  if (selectedReport !== 1 || activeTab !== 'Productivity') return;

  setProdNbLoading(true);

  const params = new URLSearchParams({
    limit: String(prodNbRowsPerPage),
    offset: String((prodNbPage - 1) * prodNbRowsPerPage),
  });
  if (filters.id_area)   params.set('id_area', String(filters.id_area));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to)   params.set('date_to', filters.date_to);

  fetch(url(`/api/productnb?${params.toString()}`))
    .then(async (r) => {
      const total = r.headers.get('X-Total-Count');
      if (total) setProdNbTotal(Number(total));
      return r.json();
    })
    .then(setProdNbItems)
    .catch(console.error)
    .finally(() => setProdNbLoading(false));
}, [selectedReport, activeTab, prodNbPage, filters]);


useEffect(() => {
  fetch(url('/api/areas'))// <-- nuevo endpoint
    .then(r => r.json())
    .then(data => setCcenters(data))
    .catch(console.error);
}, []);



  const handleFormChange = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));

  const handleSubmitSCM = async (e) => {
    e.preventDefault();
    if (!formData.fecha_scm) {
      setNotification('La fecha es obligatoria.');
      return;
    }
    const exists = scmData.some(item => item.fecha_scm && formatDateYMD(item.fecha_scm) === formatDateYMD(formData.fecha_scm));
    if (exists) {
      setNotification('Ya existe un registro con esa fecha.');
      return;
    }
    const payload = { ...formData, ...computed };
    try {
      const res = await fetch(url('/api/scm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await (await fetch(url('/api/scm'))).json();
      const sorted = updated.sort((a, b) => b.id_scm - a.id_scm);
      setScmData(sorted);
      setScmPage(1);
      setFormData(Object.keys(formData).reduce((p, k) => ({ ...p, [k]: '' }), {}));
      setNotification('Registro agregado correctamente.');
    } catch (err) {
      console.error(err);
      setNotification('Error al agregar el registro.');
    }
  };




  const totalRecords = clipperData.length;
 // const totalPages = Math.ceil(totalRecords / rowsPerPage);
  const currentClipper = clipperData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totalSCM = scmData.length;
//  const totalPagesSCM = Math.ceil(totalSCM / rowsPerPageSCM);
  const currentSCM = scmData.slice((scmPage - 1) * rowsPerPageSCM, scmPage * rowsPerPageSCM);

return (
  <div className={`${styles.container} ${darkMode ? styles.darkModeContainer : ''}`}>
    {/* Notificación */}
    {notification && <div className={styles.notification}>{notification}</div>}

    {/* Botón hamburguesa, solo si el drawer está cerrado */}
    {!drawerOpen && (
      <button
        className={styles.hamburger}
        onClick={() => setDrawerOpen(true)}
      >
        ☰
      </button>
    )}

    {/* Overlay del drawer */}
    <div
      className={`${styles.drawerOverlay} ${drawerOpen ? styles.open : ''}`}
      onClick={() => setDrawerOpen(false)}
      aria-hidden="true"
    />

    {/* Drawer lateral */}
    <aside className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`}>
      <div className={styles.buttonList}>
        {buttons.map((b) => (
          <button
            key={b.id}
            className={styles.drawerButton}
            onClick={() => {
              setSelectedReport(b.id === 0 ? null : b.id);
              setActiveTab(b.id === 0 ? 'Gráficas' : 'Gráficas');
              setDrawerOpen(false);
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className={styles.darkToggleWrapper}>
        <button
          className={styles.darkToggleButton}
          onClick={() => setDarkMode((d) => !d)}
        >
          {darkMode ? '☀️ Claro' : '🌙 Oscuro'}
        </button>
      </div>
    </aside>

    {/* CONTENIDO PRINCIPAL */}
    <main className={styles.content}>
      {/* ------------------- Panel de Inicio ------------------- */}
      {!selectedReport && (
        <div className={styles.filterPanel}>
          <h2>Panel de Inicio</h2>

          <div className={styles.filterGroup}>
            <select
              value={formData.id_area || ''}
              onChange={(e) =>
                setFormData({ ...formData, id_area: e.target.value })
              }
            >
              <option value="">-- Selecciona un área --</option>
              {ccenters.map((c) => (
                <option key={c.id_area} value={c.id_area}>
                  {c.nombre_area}
                </option>
              ))}
            </select>

            <label>Fecha:</label>
            <input
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />

            <button
              onClick={async () => {
                if (!formData.id_area || !formData.date) {
                  setNotification('Debes seleccionar área y fecha.');
                  return;
                }
                try {
                  const url = `http://localhost:5000/api/clipper/filter?id_area=${formData.id_area}&date=${formData.date}`;
                  const res = await fetch(url);
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const data = await res.json();
                  setFilteredClipper(data);
                } catch (err) {
                  console.error('Error al obtener datos Clipper:', err);
                  setNotification('Error al obtener datos.');
                }
              }}
            >
              Buscar
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Product Number</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Tiempo Trabajado</th>
                </tr>
              </thead>
              <tbody>
                {filteredClipper.length > 0 ? (
                  filteredClipper.map((row, idx) => (
                    <tr key={idx}>
                      <td>
  {row?.date
    ? new Date(row.date).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '—'}
</td>
                      <td>{row.product_number}</td>
                      <td>{row.start_time}</td>
                      <td>{row.end_time}</td>
                      <td>{row.TimeClocked}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">Sin datos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------- Reporte Productividad ------------------- */}
      {selectedReport === 1 && (
        <div className={styles.productionReport}>
          <div className={styles.tabButtons}>
            {tabs.map((t) => (
              <button
                key={t}
                className={`${styles.tabButton} ${
                  activeTab === t ? styles.active : ''
                }`}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {/* ----- SCM plan ----- */}
            {activeTab === 'SCM plan' && (
              <>
                <form onSubmit={handleSubmitSCM} className={styles.formSCM}>
                  <div className={styles.formGroup}>
                    <label htmlFor="fecha_scm">Fecha SCM</label>
                    <input
                      id="fecha_scm"
                      type="date"
                      name="fecha_scm"
                      value={formData.fecha_scm || ''}
                      onChange={(e) =>
                        handleFormChange('fecha_scm', e.target.value)
                      }
                      required
                    />
                  </div>

                  {Object.entries(zones).map(([zoneName, keys]) => {
                    const groups = [];
                    for (let i = 0; i < keys.length; i += 5) {
                      groups.push(keys.slice(i, i + 5));
                    }
                    return groups.map((group, idx) => (
                      <fieldset
                        key={`${zoneName}-${idx}`}
                        className={styles.zoneFieldset}
                      >
                        {idx === 0 && (
                          <legend className={styles.zoneLegend}>
                            {zoneName}
                          </legend>
                        )}
                        {group.map((k) => (
                          <div key={k} className={styles.formGroup}>
                            <label>
                              {k.replace(/_/g, ' ')
                                .replace(/SCM/i, '')
                                .toUpperCase()}
                            </label>
                            <input
                              type="number"
                              value={formData[k] || ''}
                              onChange={(e) => handleFormChange(k, e.target.value)}
                            />
                          </div>
                        ))}
                      </fieldset>
                    ));
                  })}

                  <fieldset className={styles.zoneFieldset}>
                    <legend className={styles.zoneLegend}>SUMAS POR ZONA</legend>
                    {Object.entries(computed).map(([key, val]) => (
                      <div key={key} className={styles.formGroup}>
                        <label>
                          {key
                            .replace(/_/g, ' ')
                            .replace(/SCM/i, '')
                            .toUpperCase()}
                        </label>
                        <input type="number" readOnly value={val} />
                      </div>
                    ))}
                  </fieldset>

                  <button type="submit" className={styles.addButton}>
                    Agregar
                  </button>
                </form>

                <div className={styles.tableContainer}>
  <table className={styles.table}>
    <thead>
      <tr>
        {scmColumns.map((col) => (
          <th key={col}>{prettyLabel(col)}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {currentSCM.length > 0 ? (
        currentSCM.map((row, idx) => (
          <tr key={idx}>
            {scmColumns.map((col) => {
              // Formateo especial para la fecha
              if (col === 'fecha_scm') {
                const d = row[col] ? new Date(row[col]) : null;
                return (
                  <td key={col}>
                    {d
                      ? d.toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : '—'}
                  </td>
                );
              }
              // Valores numéricos/strings generales
              const val = row[col];
              return <td key={col}>{val ?? 0}</td>;
            })}
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={scmColumns.length} style={{ textAlign: 'center' }}>
            Sin datos
          </td>
        </tr>
      )}
    </tbody>
  </table>
  {/* Paginación SCM plan */}
<div className={styles.pagination}>
  <button
    onClick={() => setScmPage(p => Math.max(p - 1, 1))}
    disabled={scmPage === 1}
    className={styles.pageButton}
  >
    Anterior
  </button>

  <span className={styles.pageInfo}>Página {scmPage}</span>

  {(() => {
    const pageSize = rowsPerPageSCM;
    // Como trabajas con scmData completo y haces slice, puedes usar:
    const canGoNext = scmPage * pageSize < scmData.length;
    return (
      <button
        onClick={() => setScmPage(p => p + 1)}
        disabled={!canGoNext}
        className={styles.pageButton}
      >
        Siguiente
      </button>
    );
  })()}
</div>

</div>

              </>
            )}

            {/* ----- Productivity (ProductNb + scmproducty) ----- */}
            {activeTab === 'Productivity' && (
              <div className="p-4">
                <button
                  onClick={async () => {
                    setProcessingProd(true);
                    try {
                      await processAll();
                      setProdLoading(true);
                      const rows = await fetchProductNb();
                      setProdData(rows);
                      setCurrentPage(1);
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setProcessingProd(false);
                      setProdLoading(false);
                    }
                  }}
                  disabled={processingProd}
                  className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {processingProd ? 'Procesando…' : 'Procesar Productividad'}
                </button>

                {/* Filtros compartidos */}
                <div
                  className={styles.filterGroup}
                  style={{ marginBottom: '1rem' }}
                >
                  <select
                    value={filters.id_area}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, id_area: e.target.value }));
                      setProductyPage(1);
  setProdNbPage(1);        // <-- añade esto
  setCurrentPage(1);       // si quieres mantener la tabla vieja sincronizada
}}
                  >
                    <option value="">-- Área (todas) --</option>
                    {ccenters?.map((c) => (
                      <option key={c.id_area} value={c.id_area}>
                        {c.Cost_center} — {c.nombre_area}
                      </option>
                    ))}
                  </select>

                  <label style={{ marginLeft: 8 }}>Desde:</label>
                  <input
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, date_from: e.target.value }));
                      setProductyPage(1);
                      setProdNbPage(1);
                      setCurrentPage(1);
                    }}
                  />

                  <label style={{ marginLeft: 8 }}>Hasta:</label>
                  <input
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, date_to: e.target.value }));
                      setProductyPage(1);
                      setProdNbPage(1);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div
                  style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}
                >
                  {/* Tabla A: ProductNb */}
                 {/* --------- Tabla A: ProductNb (REAL desde backend) --------- */}





<div className={`${styles.tableContainer} ${styles.productivityWrapper}`} style={{ flex: 1 }}>
  {prodNbLoading ? (
    <p>Cargando ProductNb…</p>
  ) : (
    <>
      <table className={`${styles.table} ${styles.productivityTable}`}>
        <thead>
          <tr>
            {['Fecha', 'Área', '1° Shift', '2° Shift', '3° Shift', 'Total'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prodNbItems.length > 0 ? (
            prodNbItems.map((r, idx) => (
              <tr key={`pn-${idx}`}>
               <td>
  {r?.date
    ? new Date(r.date).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '—'}
</td>
                <td>{r.nombre_area || r.Cost_center || r.id_area || 'N/A'}</td>
                <td>{r.SumaTurno1 ?? 0}</td>
                <td>{r.SumaTurno2 ?? 0}</td>
                <td>{r.SumaTurno3 ?? 0}</td>
                <td>{r.SumaTurnos ?? 0}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>Sin datos</td>
            </tr>
          )}
        </tbody>
      </table>

     
      {/* Paginación ProductNb */}
<div className={styles.pagination}>
  <button
    onClick={() => setProdNbPage(p => Math.max(p - 1, 1))}
    disabled={prodNbPage === 1}
    className={styles.pageButton}
  >
    Anterior
  </button>

  <span className={styles.pageInfo}>Página {prodNbPage}</span>

  {(() => {
    const pageSize = prodNbRowsPerPage;
    const hasTotal = !!prodNbTotal;
    const maxPageFromTotal = hasTotal ? Math.max(1, Math.ceil(prodNbTotal / pageSize)) : null;
    const canGoNext = hasTotal ? prodNbPage < maxPageFromTotal : prodNbItems.length === pageSize;
    return (
      <button
        onClick={() => setProdNbPage(p => p + 1)}
        disabled={!canGoNext}
        className={styles.pageButton}
      >
        Siguiente
      </button>
    );
  })()}
</div>

    </>
  )}
</div>


                  {/* Tabla B: scmproducty */}
                  <div className={styles.scmWrapper} style={{ flex: 1 }}>
                    <div className={styles.tableContainer}>
                      {loadingProducty ? (
                        <p>Cargando scmproducty…</p>
                      ) : (
                        <>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Área</th>
                                <th>Capacity by line</th>
                                <th>Total Produced</th>
                                <th>Produced 1° Shift</th>
                                <th>Produced 2° Shift</th>
                                <th>Produced 3° Shift</th>
                                <th>% Productivity</th>
                                <th>% Productivity 1° Shift</th>
                                <th>% Productivity 2° Shift</th>
                                <th>% Productivity 3° Shift</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scmProducty && scmProducty.length > 0 ? (
                                scmProducty.map((r, i) => (
                                  <tr key={`sp-${i}`}>
                                   <td>
  {r?.scm_fecha
    ? new Date(r.scm_fecha).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '—'}
</td>

                                    <td>{r.area_name}</td>
                                    <td>{r.scmN ?? '—'}</td>
                                    <td>{r.Sturnos ?? '—'}</td>
                                    <td>{r.Sturnos1 ?? '—'}</td>
                                    <td>{r.Sturnos2 ?? '—'}</td>
                                    <td>{r.Sturnos3 ?? '—'}</td>
                                    <td className={pctClass(r.producti)}>{fmtPct(r.producti)}</td>
<td className={pctClass(r.producti1)}>{fmtPct(r.producti1)}</td>
<td className={pctClass(r.producti2)}>{fmtPct(r.producti2)}</td>
<td className={pctClass(r.producti3)}>{fmtPct(r.producti3)}</td>

                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={11} style={{ textAlign: 'center' }}>
                                    Sin datos
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>

                          {/* Paginación scmproducty */}
<div className={styles.pagination}>
  <button
    onClick={() => setProductyPage(p => Math.max(p - 1, 1))}
    disabled={productyPage === 1}
    className={styles.pageButton}
  >
    Anterior
  </button>

  <span className={styles.pageInfo}>Página {productyPage}</span>

  {(() => {
    const pageSize = productyRowsPerPage;
    const hasTotal = !!productyTotal;
    const maxPageFromTotal = hasTotal ? Math.max(1, Math.ceil(productyTotal / pageSize)) : null;
    const canGoNext = hasTotal ? productyPage < maxPageFromTotal : scmProducty.length === pageSize;
    return (
      <button
        onClick={() => setProductyPage(p => p + 1)}
        disabled={!canGoNext}
        className={styles.pageButton}
      >
        Siguiente
      </button>
    );
  })()}
</div>

                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
{/* ------------------- Reporte de Utilización ------------------- */}
{selectedReport === 2 && (
  <div className={styles.productionReport}>
    <h2 style={{ marginBottom: '1rem' }}>Reporte de Utilización</h2>

    {/* ------------------- FILTROS PRINCIPALES (solo: fecha, usuario, turno) ------------------- */}
    <div className={styles.filterGroup} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.85rem' }}>Fecha TTC</label>
        <input
          type="date"
          value={filterDateInput}
          onChange={(e) => setFilterDateInput(e.target.value)}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem' }}>Usuario</label>
        <input
          type="text"
          placeholder="Buscar empleado..."
          value={filterUserInput}
          onChange={(e) => setFilterUserInput(e.target.value)}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.85rem' }}>Turno</label>
        <input
          type="text"
          placeholder="Identificación..."
          value={filterShiftInput}
          onChange={(e) => setFilterShiftInput(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
        <button
          className={styles.addButton}
          onClick={() => {
            // Aplicar filtros (snapshot)
            setAppliedFilters({
              date: filterDateInput || '',
              user: filterUserInput.trim() || '',
              shift: filterShiftInput.trim() || ''
            });
          }}
        >
          Filtrar
        </button>

        <button
          className={styles.pageButton}
          onClick={() => {
            // limpiar inputs y filtros aplicados
            setFilterDateInput('');
            setFilterUserInput('');
            setFilterShiftInput('');
            setAppliedFilters({ date: '', user: '', shift: '' });
          }}
        >
          Cancelar
        </button>

        {/* Botón que abre modal para opciones avanzadas (área / rebuild) */}
        <button
          className={styles.pageButton}
          onClick={() => setShowAdvanced(true)}
          title="Opciones avanzadas: área / reconstruir TTC"
        >
          Opciones avanzadas
        </button>
      </div>
    </div>

    {ttcMsg && <div className={styles.notification} style={{ marginTop: 8 }}>{ttcMsg}</div>}

    {/* ------------------- Tabs + mini tabla resumen ------------------- */}
    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className={styles.tabButton}
          style={{ background: reportTab === 'total' ? '#333' : '#ccc', color: reportTab === 'total' ? '#fff' : '#000' }}
          onClick={() => setReportTab('total')}
        >
          Total Utilization
        </button>
        <button
          className={styles.tabButton}
          style={{ background: reportTab === 'productive' ? '#333' : '#ccc', color: reportTab === 'productive' ? '#fff' : '#000' }}
          onClick={() => setReportTab('productive')}
        >
          Productive Utilization %
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div className={styles.summaryBox} style={{ marginLeft: 'auto' }}>
        <table className={styles.summaryTable}>
          <thead>
            <tr>
              <th>{splitHeader('Utilization (1° Shift)')}</th>
              <th>{splitHeader('Utilization (2° Shift)')}</th>
              <th>{splitHeader('Day utilization')}</th>
              <th>{splitHeader('Records')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={pctColorClass(summaryUtil.avg1)}>
                <span className={styles.pctCell}>{fmtPctNormalized(summaryUtil.avg1)}</span>
              </td>
              <td className={pctColorClass(summaryUtil.avg2)}>
                <span className={styles.pctCell}>{fmtPctNormalized(summaryUtil.avg2)}</span>
              </td>
              <td className={pctColorClass(summaryUtil.day)}>
                <span className={styles.pctCell}>{fmtPctNormalized(summaryUtil.day)}</span>
              </td>
              <td>
                <span style={{ display: 'inline-block', minWidth: 40, textAlign: 'center' }}>{summaryUtil.count}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {/* ------------------- Tab Content (usar filteredTtcData) ------------------- */}
    <div style={{ marginTop: '1rem' }}>
      <p>Datos cargados: {filteredTtcData?.length ?? 0}</p>

      {reportTab === 'total' && (
        filteredTtcData?.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date TTC</th>
                <th>Employee Name</th>
                <th>Employee</th>
                <th>Identificación TTC</th>
                <th>Shift TTC1</th>
                <th>Shift TTC2</th>
                <th>Shift TTC3</th>
                <th>TTG</th>
                <th>TU_uti1</th>
                <th>TU_uti2</th>
                <th>TU_uti3</th>
              </tr>
            </thead>
            <tbody>
              {filteredTtcData.map((row, idx) => (
                <tr key={row.Id_TTC ?? row.id ?? idx}>
                  <td>{formatDateOpt(row.Date_TTC)}</td>
                  <td>{row.Employee_name}</td>
                  <td>{row.Employee}</td>
                  <td>{row.identificacion_TTC ?? row.identificacion ?? '—'}</td>
                  <td>{row.shift_TTC1}</td>
                  <td>{row.shift_TTC2}</td>
                  <td>{row.shift_TTC3}</td>
                  <td>{row.TTG}</td>

                  {/* TU coloreado y formateado */}
                  <td className={pctColorClass(row.TU_uti1)}>
                    <span className={styles.pctCell}>{fmtPctNormalized(row.TU_uti1)}</span>
                  </td>
                  <td className={pctColorClass(row.TU_uti2)}>
                    <span className={styles.pctCell}>{fmtPctNormalized(row.TU_uti2)}</span>
                  </td>
                  <td className={pctColorClass(row.TU_uti3)}>
                    <span className={styles.pctCell}>{fmtPctNormalized(row.TU_uti3)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>No hay datos disponibles para Total Utilization.</p>
      )}

      {reportTab === 'productive' && (
        filteredTtcData?.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date TTC</th>
                <th>Employee Name</th>
                <th>Employee</th>
                <th>Identificación TTC</th>
                <th>Shift TTC1</th>
                <th>Shift TTC2</th>
                <th>Shift TTC3</th>
                <th>TTG</th>
                <th>ttc_NP</th>
                <th>PU_uti1</th>
                <th>PU_uti2</th>
                <th>PU_uti3</th>
              </tr>
            </thead>
            <tbody>
              {filteredTtcData.map((row, idx) => (
                <tr key={row.Id_TTC ?? row.id ?? idx}>
                  <td>{formatDateOpt(row.Date_TTC)}</td>
                  <td>{row.Employee_name}</td>
                  <td>{row.Employee}</td>
                  <td>{row.identificacion_TTC ?? row.identificacion ?? '—'}</td>
                  <td>{row.shift_TTC1}</td>
                  <td>{row.shift_TTC2}</td>
                  <td>{row.shift_TTC3}</td>
                  <td>{row.TTG}</td>
                  <td>{row.ttc_NP ?? '—'}</td>

                  {/* PU coloreado y formateado */}
                  <td className={pctColorClass(row.PU_uti1)}>
                    <span className={styles.pctCell}>{fmtPctNormalized(row.PU_uti1)}</span>
                  </td>
                  <td className={pctColorClass(row.PU_uti2)}>
                    <span className={styles.pctCell}>{fmtPctNormalized(row.PU_uti2)}</span>
                  </td>
                  <td className={pctColorClass(row.PU_uti3)}>
                    <span className={styles.pctCell}>{fmtPctNormalized(row.PU_uti3)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>No hay datos disponibles para Productive Utilization.</p>
      )}
    </div>

    {/* ------------------- Modal: Opciones avanzadas ------------------- */}
    {showAdvanced && (
      <div className={styles.modalOverlay} onClick={() => setShowAdvanced(false)} role="dialog" aria-modal="true">
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <h3>Opciones avanzadas</h3>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 12 }}>
            <select value={ttcArea} onChange={(e) => setTtcArea(e.target.value)}>
              <option value="">-- Área (todas) --</option>
              {ccenters?.map((c) => (
                <option key={c.id_area} value={c.id_area}>
                  {c.Cost_center ?? ''} {c.Cost_center ? '— ' : ''}{c.nombre_area}
                </option>
              ))}
            </select>

            <label>Desde:</label>
            <input type="date" value={ttcFrom} onChange={(e) => setTtcFrom(e.target.value)} />

            <label>Hasta:</label>
            <input type="date" value={ttcTo} onChange={(e) => setTtcTo(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.addButton} onClick={() => { handleRebuildTTC(); /* opcional: mantener modal abierto si quieres */ }}>
              {ttcLoading ? 'Actualizando…' : 'Actualizar TTC'}
            </button>
            <button className={styles.pageButton} onClick={() => setShowAdvanced(false)}>Cerrar</button>
          </div>
        </div>
      </div>
    )}
  </div>
)}



      {/* ------------------- Clipper ------------------- */}
      {selectedReport === 8 && (
        <>
          <div className={styles.syncRow}>
            <button
              onClick={handleSyncClipper}
              disabled={isSyncing}
              className={styles.syncButton}
            >
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            {syncMessage && (
              <span
                className={styles.syncMessage}
                style={{ color: isSyncing ? 'orange' : 'green' }}
              >
                {syncMessage}
              </span>
            )}
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {clipperData?.[0] ? (
                    Object.keys(clipperData[0]).map((c) => (
                      <th key={c}>{c.replace(/_/g, ' ').toUpperCase()}</th>
                    ))
                  ) : (
                    <th>Cargando...</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentClipper.map((row, i) => (
                  <tr key={i}>
                    {Object.keys(row).map((c) => (
                      <td key={c}>{row[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  </div>
);
}; 


export default Intra;
