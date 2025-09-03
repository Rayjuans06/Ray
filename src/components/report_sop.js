import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from "../context/AuthContext";
import styles from './report_sop.module.css';
import { API_URL } from "./config";
import { CronometroContext } from './CronometroContext';

// ================== util fecha/hora ==================
function formatoLocalYMD(date) {
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
// Resta 1 día si es 00:00 a 06:59
function calcularFecha(fechaHoraFin) {
  const hora = fechaHoraFin.getHours();
  if (hora < 7) {
    const fechaAnterior = new Date(fechaHoraFin);
    fechaAnterior.setDate(fechaAnterior.getDate() - 1);
    return formatoLocalYMD(fechaAnterior);
  }
  return formatoLocalYMD(fechaHoraFin);
}
// Sec -> "Dd HH:MM:SS"
const formatSegundos = (seg) => { 
  const dias = Math.floor(seg/86400);
  const hrs  = Math.floor((seg%86400)/3600);
  const min  = Math.floor((seg%3600)/60);
  const s    = seg % 60;
  return `${dias>0?dias+'d ':''}${hrs.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
};
// =====================================================

const EXCLUDED_ZONE = 8;

// Axios consistente
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { Accept: 'application/json' },
});

const ReportSOP = () => {
  const cronometros = useContext(CronometroContext);

  const [fallas, setFallas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [error, setError] = useState(null);

  const [editingFalla, setEditingFalla] = useState(null);
  const [paros, setParos] = useState([]);
  const [urgencias, setUrgencias] = useState([]);

  const [activarFalla, setActivarFalla] = useState(null);
  const [notification, setNotification] = useState(null);

  const [filtroParo, setFiltroParo] = useState('');
  const [filtroZona, setFiltroZona] = useState('');
  const [selectedFallaId, setSelectedFallaId] = useState(null);
  const [expandedFallaIds, setExpandedFallaIds] = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [showParosModal, setShowParosModal] = useState(false);
  const [groupedParos, setGroupedParos] = useState([]);
  const [groupToActivate, setGroupToActivate] = useState(null);
  const [groupDescription, setGroupDescription] = useState('');

  const navigate = useNavigate();
  const { idUsuario } = useContext(AuthContext);
  const nombreUsuario = "Usuario Ejemplo";

  // ======= helpers UI =======
  const getParoColor = (paroDescription) => {
    switch (paroDescription) {
      case 'Mantenimiento': return '#D32F2F';
      case 'Metodos': return '#FF9800';
      case 'Calidad': return '#FDD835';
      case 'Falta de material': return '#00ACC1';
      case 'Paro programado': return '#757575';
      case 'Cambio de modelo': return '#1E88E5';
      case 'Seguridad': return '#7B1FA2';
      case 'IT': return '#000000';
      case 'Falta de personal': return '#006d36';
      default: return 'var(--border-color)';
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ============= carga datos base =============
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);

    let cancelled = false;
    (async () => {
      try {
        const [areasRes, zonasRes, parosRes, urgenciasRes] = await Promise.all([
          api.get('/api/areas'),   // 👈 igual que en Panel
          api.get('/zonas'),
          api.get('/paro'),
          api.get('/urgencia'),
        ]);
        if (cancelled) return;

        const rawAreas = Array.isArray(areasRes.data) ? areasRes.data : [];
        const filteredAreas = rawAreas.filter(a => Number(a.id_zona) !== EXCLUDED_ZONE);
        setAreas(filteredAreas);

        const rawZonas = Array.isArray(zonasRes.data) ? zonasRes.data : [];
        const filteredZonas = rawZonas.filter(z => Number(z.id_zona) !== EXCLUDED_ZONE);
        setZonas(filteredZonas);

        setParos(Array.isArray(parosRes.data) ? parosRes.data : []);
        setUrgencias(Array.isArray(urgenciasRes.data) ? urgenciasRes.data : []);

        // Cargar fallas ya con áreas disponibles (para filtrar zona 8)
        await fetchFallas(filteredAreas);
      } catch (err) {
        console.error(err);
        setError('Hubo un problema al cargar la información inicial.');
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // ============= fallas (lectura con filtros) =============
  const fetchFallas = async (areasParam) => {
    try {
      const areasUsar = areasParam || areas;
      const allowedAreaIds = new Set(areasUsar.map(a => a.id_area)); // sin zona 8
      const { data } = await api.get('/falla');

      let fallasParo = (Array.isArray(data) ? data : []).filter(f => f.status_nombre === 'Paro');
      // Excluir TODO lo que no esté en nuestras áreas filtradas
      fallasParo = fallasParo.filter(f => allowedAreaIds.has(f.id_area));

      if (filtroParo) {
        fallasParo = fallasParo.filter(f => f.id_paro === Number(filtroParo));
      }
      if (filtroZona) {
        fallasParo = fallasParo.filter(f => {
          const area = areasUsar.find(a => a.id_area === f.id_area);
          return area && Number(area.id_zona) === Number(filtroZona);
        });
      }

      setFallas(fallasParo);
    } catch (e) {
      setError('Hubo un problema al cargar las fallas.');
    }
  };

  const handleFilter = () => fetchFallas();
  const handleResetFilters = () => {
    setFiltroParo('');
    setFiltroZona('');
    fetchFallas();
  };

  // ============= Modal "Paros" (agrupaciones) =============
  const handleOpenParos = async () => {
    try {
      const allowedAreaIds = new Set(areas.map(a => a.id_area));
      const { data } = await api.get('/falla');
      const parosRecords = (Array.isArray(data) ? data : [])
        .filter(f => f.id_status === 5 && allowedAreaIds.has(f.id_area));

      const groups = {};
      for (const record of parosRecords) {
        const key = typeof record.hora_inicio === 'string' && record.hora_inicio.includes(':')
          ? record.hora_inicio
          : null;
        if (!key) continue; // ignorar hora_inicio inválida
        if (!groups[key]) groups[key] = [];
        groups[key].push(record);
      }
      const grouped = Object.entries(groups)
        .filter(([_, records]) => records.length > 1)
        .map(([hora, records]) => ({ hora_inicio: hora, records }));

      setGroupedParos(grouped);
      setShowParosModal(true);
    } catch {
      setError('Hubo un problema al cargar los paros.');
    }
  };

  const handleOpenActivateGroup = (group) => {
    setGroupToActivate(group);
    setGroupDescription('');
  };

  const handleConfirmActivateGroup = async () => {
    if (!idUsuario) {
      setError("No se encontró información del usuario logueado.");
      return;
    }
    if (!groupToActivate) return;
    if (!groupDescription.trim()) {
      setError("La descripción es requerida para activar el grupo.");
      return;
    }

    const now = new Date();
    const fecha = calcularFecha(now);
    const timePart = now.toTimeString().split(" ")[0];
    const horaFinString = `${fecha} ${timePart}`;

    try {
      await Promise.all(
        groupToActivate.records.map(async (record) => {
          // tiempoParo por registro/área
          const segundos = cronometros[record.id_area] || 0;
          const pad = n => n.toString().padStart(2,'0');
          const hrs  = pad(Math.floor(segundos / 3600));
          const mins = pad(Math.floor((segundos % 3600) / 60));
          const secs = pad(segundos % 60);
          const tiempoParo = `${hrs}:${mins}:${secs}`;

          const areaEncontrada = areas.find(a => a.id_area === record.id_area);
          const idZona = areaEncontrada ? areaEncontrada.id_zona : null;
          if (!idZona) throw new Error("No se encontró la zona del área.");

          const turnoCalculado = calculateTurno(record.hora_inicio);
          const nuevoReporte = {
            id_usuario: record.id_usuario,
            id_usuario_solucionador: idUsuario,
            id_area: record.id_area,
            id_zona: idZona,
            id_paro: record.id_paro,
            id_falla: record.id_falla,
            hora_inicio: record.hora_inicio,
            hora_fin: horaFinString,
            tiempo_paro: tiempoParo,
            accion_correctiva: groupDescription.trim(),
            descripcion: record.falla_descripcion,
            id_turno: turnoCalculado,
          };

          await api.post('/reporte', nuevoReporte);
          await api.put(`/falla/${record.id_falla}/status`, { id_status: 4 });
        })
      );

      await fetchFallas();
      showNotification("Grupo activado exitosamente.", "success");
      await handleOpenParos(); // refresca modal
      setGroupToActivate(null);
      setGroupDescription('');
    } catch (err) {
      console.error(err);
      setError("Error al activar el grupo de fallas.");
      showNotification("Error al activar el grupo.", "error");
    }
  };

  // refresco periódico de fallas (respetando filtros)
  useEffect(() => {
    const t = setInterval(() => fetchFallas(), 5000);
    return () => clearInterval(t);
  }, [filtroParo, filtroZona, areas]);

  // Turno robusto: hora puede venir null/"" o malformada
  const calculateTurno = (hora) => {
    if (!hora || typeof hora !== 'string' || !hora.includes(':')) return '';
    const partes = hora.split(":").map(Number);
    if (partes.length < 2 || Number.isNaN(partes[0]) || Number.isNaN(partes[1])) return '';
    const [hours, minutes] = partes;
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes >= 420 && totalMinutes <= 1000) return '1';
    if ((totalMinutes >= 1001 && totalMinutes <= 1439) || (totalMinutes >= 0 && totalMinutes <= 100)) return '2';
    if (totalMinutes >= 101 && totalMinutes <= 419) return 'Tiempo extra';
    return '';
  };

  const handleEditFalla = (falla) => {
    setEditingFalla({ ...falla, descripcion: falla.falla_descripcion });
  };

  const handleSaveFalla = async () => {
    try {
      await api.put(`/falla/${editingFalla.id_falla}`, editingFalla);
      await fetchFallas();
      setEditingFalla(null);
      showNotification("Falla actualizada exitosamente.", "success");
    } catch {
      setError('Error al actualizar la falla.');
      showNotification("Error al actualizar la falla.", "error");
    }
  };

  const handleOpenActivarFalla = (falla) => {    
    setActivarFalla({ ...falla, comentario: '' });
  };

  const handleRegistrarReporte = async () => {
    if (!activarFalla?.comentario?.trim()) {
      showNotification("El comentario es obligatorio.", "error");
      return;
    }
    // segundos transcurridos para el área de esta falla
    const segundos = cronometros[activarFalla.id_area] || 0;
    const pad = n => n.toString().padStart(2,'0');
    const hrs  = pad(Math.floor(segundos / 3600));
    const mins = pad(Math.floor((segundos % 3600) / 60));
    const secs = pad(segundos % 60);
    const tiempoParo = `${hrs}:${mins}:${secs}`;

    const now = new Date();
    const fecha = calcularFecha(now);
    const timePart = now.toTimeString().split(' ')[0];
    const horaFinString = `${fecha} ${timePart}`;

    const areaEncontrada = areas.find(a => a.id_area === activarFalla.id_area);
    const idZona = areaEncontrada?.id_zona || null;
    const turnoCalculado = calculateTurno(activarFalla.hora_inicio);

    const nuevoReporte = {
      id_usuario: activarFalla.id_usuario,
      id_usuario_solucionador: idUsuario,
      id_area: activarFalla.id_area,
      id_zona: idZona,
      id_paro: activarFalla.id_paro,
      id_falla: activarFalla.id_falla,
      hora_inicio: activarFalla.hora_inicio,
      hora_fin: horaFinString,
      tiempo_paro: tiempoParo,
      accion_correctiva: activarFalla.comentario.trim(),
      descripcion: activarFalla.falla_descripcion,
      id_turno: turnoCalculado
    };

    try {
      await api.post('/reporte', nuevoReporte);
      await api.put(`/falla/${activarFalla.id_falla}/status`, { id_status: 4 });
      await fetchFallas();
      showNotification("Reporte registrado exitosamente.", "success");
      setActivarFalla(null);
    } catch (err) {
      console.error(err);
      showNotification("Error al registrar el reporte.", "error");
    }
  };

  const toggleExpand = (id) => {
    setExpandedFallaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getZonaName = (falla) => {
    const area = areas.find(a => a.id_area === falla.id_area);
    if (!area) return "";
    const zona = zonas.find(z => z.id_zona === area.id_zona);
    return zona ? zona.nombre_zona : "";
  };

  return (
    <div className={styles["page-container"]}>
      <header className={styles["page-header"]}>
        <div className={styles["header-left"]}></div>
        <div className={styles["header-center"]}>
          <img src="/icon/consult_l.png" alt="Icono" className={styles["header-icon"]} />
          <h1>Ver Fallas</h1>
        </div>
      </header>

      {notification && (
        <div className={`${styles["floating-notification"]} ${notification.type === "success" ? styles.success : styles.error}`}>
          {notification.message}
        </div>
      )}

      {error && (
        <div className={styles["error-message"]}>
          <p>{error}</p>
        </div>
      )}

      <div className={styles["filters-container"]}>
        <select value={filtroParo} onChange={(e) => setFiltroParo(e.target.value)}>
          <option value="">Filtrar por Paro</option>
          {paros.map((paro) => (
            <option key={paro.id_paro} value={paro.id_paro}>
              {paro.descripcion}
            </option>
          ))}
        </select>
        <select value={filtroZona} onChange={(e) => setFiltroZona(e.target.value)}>
          <option value="">Filtrar por Zona</option>
          {zonas
            .filter(z => Number(z.id_zona) !== EXCLUDED_ZONE) // UI sin zona 8
            .map((zona) => (
              <option key={zona.id_zona} value={zona.id_zona}>
                {zona.nombre_zona}
              </option>
          ))}
        </select>
        <div className={styles["filters-buttons"]}>
          <button onClick={handleFilter}>Filtrar</button>
          <button onClick={handleResetFilters}>Ver Todos</button>
          <button onClick={handleOpenParos}>Paros</button>
        </div>
      </div>

      {isMobile ? (
        <div className={styles["cards-container"]}>
          {fallas.map((falla) => (
            <div
              key={falla.id_falla}
              className={`${styles["falla-card"]} ${selectedFallaId === falla.id_falla ? styles.selectedRow : ''}`}
              onClick={() => setSelectedFallaId(falla.id_falla)}
              style={{ border: `2px solid ${getParoColor(falla.paro_descripcion)}` }}
            >
              <div className={styles["card-header"]}>
                <h3>{falla.nombre_area}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(falla.id_falla);
                  }}
                >
                  {expandedFallaIds.includes(falla.id_falla) ? 'Ocultar detalles' : 'Ver detalles'}
                </button>
              </div>
              {expandedFallaIds.includes(falla.id_falla) && (
                <div className={styles["card-details"]}>
                  <p><strong>Descripción:</strong> {falla.falla_descripcion}</p>
                  <p><strong>Paro:</strong> {falla.paro_descripcion}</p>
                  <p><strong>Zona:</strong> {getZonaName(falla)}</p>
                  <p><strong>Urgencia:</strong> {falla.nombre_urgencia}</p>
                  <p><strong>Usuario:</strong> {falla.usuario_nombre}</p>
                  <p><strong>Área:</strong> {falla.nombre_area}</p>
                  <p><strong>Hora Inicio:</strong> {falla.hora_inicio || '-'}</p>
                  <div className={styles["card-buttons"]}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditFalla(falla);
                      }}
                    >
                      Editar
                    </button>
                    {falla.status_nombre === 'Paro' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenActivarFalla(falla);
                        }}
                      >
                        Activar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles["table-container"]}>
          <table className={styles["report-table"]}>
            <thead>
              <tr>
                <th>ID Falla</th>
                <th>Descripción</th>
                <th>Paro</th>
                <th>Zona</th>
                <th>Urgencia</th>
                <th>Usuario</th>
                <th>Área</th>
                <th>Hora Inicio</th>
                <th>Status</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {fallas.map((falla) => (
                <tr
                  key={`falla-${falla.id_falla}`}
                  onClick={() => setSelectedFallaId(falla.id_falla)}
                  className={selectedFallaId === falla.id_falla ? styles.selectedRow : ''}
                >
                  <td>{falla.id_falla}</td>
                  <td>{falla.falla_descripcion}</td>
                  <td>{falla.paro_descripcion}</td>
                  <td>{getZonaName(falla)}</td>
                  <td>{falla.nombre_urgencia}</td>
                  <td>{falla.usuario_nombre}</td>
                  <td>{falla.nombre_area}</td>
                  <td>{falla.hora_inicio || '-'}</td>
                  <td>{falla.status_nombre}</td>
                  <td>
                    <button onClick={() => handleEditFalla(falla)}>Editar</button>
                    {falla.status_nombre === 'Paro' && (
                      <button onClick={() => handleOpenActivarFalla(falla)}>Activar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingFalla && (
        <div className={styles["modal-overlay"]}>
          <div className={styles.modal}>
            <div className={styles["modal-content"]}>
              <h3>Editar Falla</h3>
              <label>ID Falla: {editingFalla.id_falla}</label>
              <input type="text" name="descripcion" value={editingFalla.descripcion} disabled />
              <select
                name="id_paro"
                value={editingFalla.id_paro}
                onChange={(e) => setEditingFalla({ ...editingFalla, id_paro: e.target.value })}
              >
                <option value="">Seleccionar Paro</option>
                {paros.map((paro) => (
                  <option key={paro.id_paro} value={paro.id_paro}>{paro.descripcion}</option>
                ))}
              </select>
              <select
                name="id_urgencia"
                value={editingFalla.id_urgencia}
                onChange={(e) => setEditingFalla({ ...editingFalla, id_urgencia: e.target.value })}
              >
                <option value="">Seleccionar Urgencia</option>
                {urgencias.map((urgencia) => (
                  <option key={urgencia.id_urgencia} value={urgencia.id_urgencia}>{urgencia.nombre_urgencia}</option>
                ))}
              </select>
              <input type="text" name="usuario_nombre" value={editingFalla.usuario_nombre} disabled />
              <input type="text" name="nombre_area" value={editingFalla.nombre_area} disabled />
              <input type="time" name="hora_inicio" value={editingFalla.hora_inicio || ''} disabled />
              <input type="text" name="status_nombre" value={editingFalla.status_nombre} disabled />
              <button onClick={handleSaveFalla}>Guardar Cambios</button>
              <button className={styles.cancel} onClick={() => setEditingFalla(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {activarFalla && (
        <div className={styles["modal-overlay"]}>
          <div className={styles.modal}>
            <div className={styles["modal-content"]}>
              <h3>Activar Falla</h3>
              <p><strong>ID Falla:</strong> {activarFalla.id_falla}</p>
              <p><strong>Descripción:</strong> {activarFalla.falla_descripcion}</p>
              <p><strong>Área:</strong> {activarFalla.nombre_area}</p>
              <p><strong>Paro:</strong> {activarFalla.paro_descripcion}</p>
              <p><strong>Urgencia:</strong> {activarFalla.nombre_urgencia}</p>
              <p><strong>Usuario:</strong> {activarFalla.usuario_nombre}</p>
              <p><strong>Tiempo transcurrido:</strong> {formatSegundos(cronometros[activarFalla.id_area] || 0)}</p>
              <label>
                <strong>Comentario:</strong>
                <input
                  type="text"
                  required
                  value={activarFalla.comentario || ""}
                  onChange={(e) => setActivarFalla({ ...activarFalla, comentario: e.target.value })}
                />
              </label>
              <button
                onClick={handleRegistrarReporte}
                className={!activarFalla.comentario?.trim() ? styles.disabledButton : ''}
              >
                Activar
              </button>
              <button className={styles.cancel} onClick={() => setActivarFalla(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showParosModal && (
        <div className={styles["modal-overlay"]}>
          <div className={styles.modal}>
            <div className={styles["modal-content"]}>
              <h3>Paros - Registros con hora de inicio duplicada</h3>
              {groupedParos.length === 0 ? (
                <p>No se encontraron registros duplicados.</p>
              ) : (
                groupedParos.map((group) => (
                  <div key={group.hora_inicio} className={styles["group-container"]}>
                    <h4>Hora Inicio: {group.hora_inicio}</h4>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', padding: '5px' }}>
                      <ul>
                        {group.records.map((record) => (
                          <li key={record.id_falla}>ID: {record.id_falla} - {record.falla_descripcion}</li>
                        ))}
                      </ul>
                    </div>
                    <button onClick={() => handleOpenActivateGroup(group)}>Activar</button>
                  </div>
                ))
              )}
              <button onClick={() => setShowParosModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {groupToActivate && (
        <div className={styles["modal-overlay"]}>
          <div className={styles.modal}>
            <div className={styles["modal-content"]}>
              <h3>Activar Grupo - Ingresar Descripción</h3>
              <p>Hora de inicio del grupo: {groupToActivate.hora_inicio}</p>
              <label>
                Descripción del paro:
                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                />
              </label>
              <div className={styles["modal-buttons"]}>
                <button onClick={handleConfirmActivateGroup} disabled={!groupDescription.trim()}>
                  Confirmar Activación
                </button>
                <button onClick={() => setGroupToActivate(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportSOP;
