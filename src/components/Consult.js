import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from "./Consult.module.css";
import { API_URL } from './config';
import * as XLSX from 'xlsx';
import DatePicker from "react-multi-date-picker";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ChartDataLabels
);

const UserManagementPage = () => {
  const [reportes, setReportes] = useState([]);
  const [error, setError] = useState(null);
  const [showCharts, setShowCharts] = useState(false);

  const [filtros, setFiltros] = useState({
    id_reporte: '',
    id_usuario: '',
    id_area: '',
    id_paro: '',
    id_usuario_solucionador: '',
    fecha_inicio: '',
    fecha_fin: '',
    hora_inicio_desde: '',
    hora_inicio_hasta: '',
    tiempo_paro_desde: '',
    tiempo_paro_hasta: '',
    zona: ''
  });

const [filterDates, setFilterDates] = useState([]);  // aquí guardarás uno o dos valores

  const [editingReporte, setEditingReporte] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [paros, setParos] = useState([]);

  const [showTimeModal, setShowTimeModal] = useState(false);
  const [currentPareto, setCurrentPareto] = useState(1);
  const [maxParetoStep, setMaxParetoStep] = useState(1);

  const [selectedDates, setSelectedDates] = useState([]);
  const datePickerRef = useRef(null);

  const [selectedZone, setSelectedZone] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [timeChartData, setTimeChartData] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const navigate = useNavigate();

  const fetchReportes = (params = {}) => {
    axios.get(`${API_URL}/reportes`, { params })
      .then(response => {
        setReportes(response.data);
        setCurrentPage(1);
      })
      .catch(() => setError('Hubo un problema al cargar los reportes.'));
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/usuarios`)
      .then(response => setUsuarios(response.data))
      .catch(err => console.error('Error fetching usuarios:', err));

    axios.get(`${API_URL}/areas`)
      .then(response => setAreas(response.data))
      .catch(err => console.error('Error fetching areas:', err));

    axios.get(`${API_URL}/paro`)
      .then(response => setParos(response.data))
      .catch(err => console.error('Error fetching paros:', err));
  }, []);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const handleLogout = () => {
    navigate('/consulta');
  };

  const filteredReportes = useMemo(() => {
    let data = [...reportes];
    if (filtros.id_reporte) {
      data = data.filter(r => String(r.id_reporte).includes(filtros.id_reporte));
    }
    if (filtros.id_usuario) {
      data = data.filter(r => String(r.id_usuario) === filtros.id_usuario);
    }
    if (filtros.id_area) {
      data = data.filter(r => String(r.id_area) === filtros.id_area);
    }
    if (filtros.id_paro) {
      data = data.filter(r => String(r.id_paro) === filtros.id_paro);
    }
    if (filtros.id_usuario_solucionador) {
      data = data.filter(r => String(r.id_usuario_solucionador) === filtros.id_usuario_solucionador);
    }

if (filterDates.length === 1) {
  const dayStr = new Date(filterDates[0]).toDateString();
  data = data.filter(r => r.fecha && new Date(r.fecha).toDateString() === dayStr);
} else if (filterDates.length === 2) {
  const start = new Date(filterDates[0]);
  const end   = new Date(filterDates[1]);
  end.setHours(23,59,59);
  data = data.filter(r => r.fecha && new Date(r.fecha) >= start && new Date(r.fecha) <= end);
}


    if (filtros.zona) {
      data = data.filter(r => r.nombre_zona === filtros.zona);
    }
    data.sort((a, b) => b.id_reporte - a.id_reporte);
    return data;
  }, [reportes, filtros, filterDates]);

  const totalPages = Math.ceil(filteredReportes.length / pageSize);
  const paginatedReportes = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredReportes.slice(startIndex, startIndex + pageSize);
  }, [filteredReportes, currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
  };


  const handleShowAll = () => {
    setFiltros({
      id_reporte: '',
      id_usuario: '',
      id_area: '',
      id_paro: '',
      id_usuario_solucionador: '',
      fecha_inicio: '',
      fecha_fin: '',
      hora_inicio_desde: '',
      hora_inicio_hasta: '',
      tiempo_paro_desde: '',
      tiempo_paro_hasta: '',
      
      zona: ''
    });
    setFilterDates([]); 
    fetchReportes();
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredReportes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reportes");
    XLSX.writeFile(wb, "reportes.xlsx");
  };

  const handleEditReporte = (reporte) => {
    setEditingReporte({
      id_reporte: reporte.id_reporte,
      id_usuario: reporte.id_usuario || '',
      id_area: reporte.id_area || '',
      id_paro: reporte.id_paro || '',
     falla_descripcion: reporte.falla_descripcion || '',
      fecha: reporte.fecha ? new Date(reporte.fecha).toISOString().slice(0, 16) : '',
      id_usuario_solucionador: reporte.id_usuario_solucionador || '',
      hora_inicio: reporte.hora_inicio || '',
      hora_fin: reporte.hora_fin || '',
      tiempo_paro: reporte.tiempo_paro || '',
      accion_correctiva: reporte.accion_correctiva || ''
    });
  };
  

  const handleSaveReporte = () => {
    axios.put(`${API_URL}/reportes/${editingReporte.id_reporte}`, editingReporte)
      .then(() => {
        setReportes(reportes.map(r =>
          r.id_reporte === editingReporte.id_reporte ? { ...r, ...editingReporte } : r
        ));
        setEditingReporte(null);
      })
      .catch(() => setError('Error al actualizar el reporte.'));
  };

  const handleDeleteReporte = (id) => {
    axios.delete(`${API_URL}/reportes/${id}`)
      .then(() => {
        setReportes(reportes.filter(r => r.id_reporte !== id));
      })
      .catch(() => setError('Error al eliminar el reporte.'));
  };

  const timeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    let seconds = 0;
    if (parts.length === 2) {
      seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60;
    } else if (parts.length === 3) {
      seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    }
    return seconds;
  };

  const getFilteredReportesForPareto = () => {
    if (!selectedDates || selectedDates.length === 0) return reportes;
    if (Array.isArray(selectedDates) && selectedDates.length === 2) {
      const start = new Date(selectedDates[0]);
      const end = new Date(selectedDates[1]);
      end.setHours(23, 59, 59);
      return reportes.filter(r => {
        if (!r.fecha) return false;
        const reportDate = new Date(r.fecha);
        return reportDate >= start && reportDate <= end;
      });
    } else {
      const day = new Date(selectedDates[0]).toDateString();
      return reportes.filter(r => {
        if (!r.fecha) return false;
        return new Date(r.fecha).toDateString() === day;
      });
    }
  };

  const getSortedChartData = (groups, label) => {
    const sortedEntries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    return {
      labels: sortedEntries.map(entry => entry[0]),
      datasets: [{
        label,
        data: sortedEntries.map(entry => entry[1]),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    };
  };

  const handleGeneratePareto1 = () => {
    const filtered = getFilteredReportesForPareto();
    const groups = {};
    filtered.forEach(r => {
      const zone = r.nombre_zona || "No disponible";
      const hours = timeToSeconds(r.tiempo_paro) / 3600;
      groups[zone] = (groups[zone] || 0) + hours;
    });
    setTimeChartData(getSortedChartData(groups, 'Tiempo de Paro (horas)'));
    if (maxParetoStep < 2) setMaxParetoStep(2);
    if (datePickerRef.current) {
      datePickerRef.current.closeCalendar();
    }
  };

  const handleGeneratePareto2 = () => {
    const filtered = getFilteredReportesForPareto().filter(r => r.nombre_zona === selectedZone);
    const groups = {};
    filtered.forEach(r => {
      const area = r.nombre_area || "No disponible";
      const hours = timeToSeconds(r.tiempo_paro) / 3600;
      groups[area] = (groups[area] || 0) + hours;
    });
    setTimeChartData(getSortedChartData(groups, 'Tiempo de Paro (horas)'));
    if (maxParetoStep < 3) setMaxParetoStep(3);
  };

  const handleGeneratePareto3 = () => {
    const filtered = getFilteredReportesForPareto().filter(r => r.nombre_area === selectedArea);
    const groups = {};
    filtered.forEach(r => {
      const type = r.tipo_paro || "No disponible";
      const hours = timeToSeconds(r.tiempo_paro) / 3600;
      groups[type] = (groups[type] || 0) + hours;
    });
    setTimeChartData(getSortedChartData(groups, 'Tiempo de Paro (horas)'));
    if (maxParetoStep < 4) setMaxParetoStep(4);
  };

  const handleGeneratePareto4 = () => {
    const filtered = getFilteredReportesForPareto().filter(r => r.tipo_paro === selectedType);
    const groups = {};
    filtered.forEach(r => {
      const desc = r.falla_descripcion || "No disponible";
      const hours = timeToSeconds(r.tiempo_paro) / 3600;
      groups[desc] = (groups[desc] || 0) + hours;
    });
    setTimeChartData(getSortedChartData(groups, `Tiempo de Paro para ${selectedType} (horas)`));
  };

  const filteredDataForPareto = getFilteredReportesForPareto();
  const filteredZones = [...new Set(filteredDataForPareto.map(r => r.nombre_zona).filter(Boolean))];
  const filteredAreas = selectedZone 
    ? [...new Set(filteredDataForPareto.filter(r => r.nombre_zona === selectedZone).map(r => r.nombre_area).filter(Boolean))]
    : [];
  const filteredTypes = selectedArea 
    ? [...new Set(filteredDataForPareto.filter(r => r.nombre_area === selectedArea).map(r => r.tipo_paro).filter(Boolean))]
    : [];

  return (
    <div className={styles["user-management-container"]}>
      <header className={styles["user-management-header"]}>
        <img src="/icon/consult.png" alt="Logo" className={styles["header-image"]} />
        <h1>Consultar Reportes</h1>
      </header>

      {error && <div className={styles["error-message"]}><p>{error}</p></div>}

      <div className={styles["filters"]}>
        <h3>Filtrar Reportes</h3>
        <div className={styles["filter-group"]}>
          <div className={styles["filter-item"]}>
            <label>ID Reporte:</label>
            <input type="number" name="id_reporte" value={filtros.id_reporte} onChange={handleFiltroChange} />
          </div>
          <div className={styles["filter-item"]}>
            <label>Usuario:</label>
            <select name="id_usuario" value={filtros.id_usuario} onChange={handleFiltroChange}>
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div className={styles["filter-item"]}>
            <label>Área:</label>
            <select name="id_area" value={filtros.id_area} onChange={handleFiltroChange}>
              <option value="">Todas</option>
              {areas.map(a => (
                <option key={a.id_area} value={a.id_area}>{a.nombre_area}</option>
              ))}
            </select>
          </div>
          <div className={styles["filter-item"]}>
            <label>Tipo de Paro:</label>
            <select name="id_paro" value={filtros.id_paro} onChange={handleFiltroChange}>
              <option value="">Todos</option>
              {paros.map(p => (
                <option key={p.id_paro} value={p.id_paro}>{p.descripcion}</option>
              ))}
            </select>
          </div>
          <div className={styles["filter-item"]}>
            <label>Soporte:</label>
            <select name="id_usuario_solucionador" value={filtros.id_usuario_solucionador} onChange={handleFiltroChange}>
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div className={styles["filter-item"]}>
  <label>Fecha:</label>
  <DatePicker
    value={filterDates}
    onChange={setFilterDates}
    format="YYYY-MM-DD"
    range
    placeholder="Selecciona fecha o rango"
  />
</div>

          <div className={styles["filter-item"]}>
            <label>Zona:</label>
            <select name="zona" value={filtros.zona} onChange={handleFiltroChange}>
              <option value="">Todas</option>
              {[...new Set(reportes.map(r => r.nombre_zona).filter(Boolean))].map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles["filter-buttons"]}>
          <button onClick={handleShowAll}>Mostrar Todos</button>
          <button onClick={handleSearch}>Buscar Filtrado</button>
          <button onClick={handleExportExcel}>Exportar a Excel</button>
        </div>
      </div>


      <div className={styles["charts-button-container"]}>
        <button onClick={() => { 
          setShowTimeModal(true); 
          setCurrentPareto(1); 
          setMaxParetoStep(1); 
          setTimeChartData(null); 
        }}>Gráficas</button>
      </div>

      {showCharts && (
        <div className={styles["modal-overlay"]} onClick={() => setShowCharts(false)}>
          <div className={styles["modal-container"]} onClick={(e) => e.stopPropagation()}>
            <button className={styles["modal-close"]} onClick={() => setShowCharts(false)}>&times;</button>
            <h3>Gráficas</h3>
            <div className={styles["charts-grid"]}>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Usuario</h4>
                <Bar
                  data={getChartDataUsuario()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Usuario' }
                    }
                  }}
                />
              </div>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Área</h4>
                <Line
                  data={getChartDataArea()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Área' }
                    }
                  }}
                />
              </div>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Tipo de Paro</h4>
                <Bar
                  data={getChartDataTipoParo()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Tipo de Paro' }
                    }
                  }}
                />
              </div>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Soporte</h4>
                <Bar
                  data={getChartDataSoporte()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Soporte' }
                    }
                  }}
                />
              </div>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Fecha de Inicio</h4>
                <Bar
                  data={getChartDataFechaInicio()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Fecha de Inicio' }
                    }
                  }}
                />
              </div>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Hora de Inicio</h4>
                <Bar
                  data={getChartDataHoraInicio()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Hora de Inicio' }
                    }
                  }}
                />
              </div>
              <div className={styles["chart-item"]}>
                <h4>Reportes por Tiempo Paro</h4>
                <Bar
                  data={getChartDataTiempoParo()}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Reportes por Tiempo Paro' }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showTimeModal && (
        <div className={styles["modal-overlay"]} onClick={() => setShowTimeModal(false)}>
          <div className={styles["modal-container"]} onClick={(e) => e.stopPropagation()}>
            <button className={styles["modal-close"]} onClick={() => setShowTimeModal(false)}>&times;</button>
            <h3>Tiempo de Paro - Paretos</h3>
            <div className={styles["pareto-steps"]}>
              <button disabled={currentPareto === 1} onClick={() => setCurrentPareto(1)}>Pareto 1</button>
              {maxParetoStep >= 2 && (
                <button disabled={currentPareto === 2} onClick={() => setCurrentPareto(2)}>Pareto 2</button>
              )}
              {maxParetoStep >= 3 && (
                <button disabled={currentPareto === 3} onClick={() => setCurrentPareto(3)}>Pareto 3</button>
              )}
              {maxParetoStep >= 4 && (
                <button disabled={currentPareto === 4} onClick={() => setCurrentPareto(4)}>Pareto 4</button>
              )}
            </div>
            {currentPareto === 1 && (
              <div className={`${styles["pareto-section"]} ${styles["date-modal-container"]}`}>
                <h4>Pareto 1: Filtrar por Rango de Fecha</h4>
                <DatePicker
                  ref={datePickerRef}
                  value={selectedDates}
                  onChange={setSelectedDates}
                  format="YYYY-MM-DD"
                  range
                  placeholder="Seleccione un rango de fechas o un día"
                />
                <button onClick={handleGeneratePareto1}>Generar Gráfica</button>
              </div>
            )}
            {currentPareto === 2 && (
              <div className={styles["pareto-section"]}>
                <h4>Pareto 2: Seleccionar Zona</h4>
                <label>Zona:</label>
                <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
                  <option value="">Seleccione Zona</option>
                  {filteredZones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
                <button onClick={handleGeneratePareto2}>Generar Gráfica</button>
              </div>
            )}
            {currentPareto === 3 && (
              <div className={styles["pareto-section"]}>
                <h4>Pareto 3: Seleccionar Área</h4>
                <label>Área:</label>
                <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}>
                  <option value="">Seleccione Área</option>
                  {filteredAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <button onClick={handleGeneratePareto3}>Generar Gráfica</button>
              </div>
            )}
            {currentPareto === 4 && (
              <div className={styles["pareto-section"]}>
                <h4>Pareto 4: Seleccionar Tipo de Paro</h4>
                <label>Tipo de Paro:</label>
                <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                  <option value="">Seleccione Tipo de Paro</option>
                  {filteredTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button onClick={handleGeneratePareto4}>Generar Gráfica</button>
              </div>
            )}
            <div className={styles["chart-container"]}>
              {timeChartData && (
                <Bar
                  data={timeChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'Tiempo de Paro (horas)' },
                      datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: 'black',
                        font: { weight: 'bold' },
                        formatter: (value) => Number(value).toFixed(2)
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles["table-container"]}>
        <table className={styles["report-table"]}>
          <thead>
            <tr>
              <th>ID Reporte</th>
              <th>Usuario</th>
              <th>Zona</th>
              <th>Área</th>
              <th>Tipo de Paro</th>
              <th>Falla</th>
              <th>Fecha</th>
              <th>Soporte</th>
              <th>Hora Inicio</th>
              <th>Hora Fin</th>
              <th>Tiempo Paro</th>
              <th>Acción Correctiva</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedReportes.map(r => (
              <tr key={`reporte-${r.id_reporte}`}>
                <td>{r.id_reporte || "No disponible"}</td>
                <td>{r.usuario_nombre || "No disponible"}</td>
                <td>{r.nombre_zona || "No disponible"}</td>
                <td>{r.nombre_area || "No disponible"}</td>
                <td>{r.tipo_paro || "No disponible"}</td>
                <td>{r.falla_descripcion || "No disponible"}</td>
                <td>{r.fecha ? new Date(r.fecha).toLocaleDateString("es-ES") : "No disponible"}</td>
                <td>{r.soporte_nombre || "No asignado"}</td>
                <td>{r.hora_inicio || "No disponible"}</td>
                <td>{r.hora_fin || "No disponible"}</td>
                <td>{r.tiempo_paro || "No disponible"}</td>
                <td>{r.accion_correctiva || "No disponible"}</td>
                <td>
                  <div className={styles["action-buttons"]}>
                    <button onClick={() => handleEditReporte(r)}>Editar</button>
                    <button onClick={() => handleDeleteReporte(r.id_reporte)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles["pagination"]}>
        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
          Anterior
        </button>
        <span>Página {currentPage} de {totalPages}</span>
        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
          Siguiente
        </button>
      </div>

      {editingReporte && (
        <div className={styles["modal-overlay"]} onClick={() => setEditingReporte(null)}>
          <div className={styles["modal-container"]} onClick={(e) => e.stopPropagation()}>
            <button className={styles["modal-close"]} onClick={() => setEditingReporte(null)}>&times;</button>
            <h3>Editar Reporte</h3>
            <label>Usuario</label>
            <select
              name="id_usuario"
              value={editingReporte.id_usuario}
              onChange={(e) => setEditingReporte({ ...editingReporte, id_usuario: e.target.value })}
            >
              <option value="">Seleccione un usuario</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
              ))}
            </select>
            <label>Área</label>
            <select
              name="id_area"
              value={editingReporte.id_area}
              onChange={(e) => setEditingReporte({ ...editingReporte, id_area: e.target.value })}
            >
              <option value="">Seleccione un área</option>
              {areas.map(a => (
                <option key={a.id_area} value={a.id_area}>{a.nombre_area}</option>
              ))}
            </select>
            <label>Tipo de Paro</label>
            <select
              name="id_paro"
              value={editingReporte.id_paro}
              onChange={(e) => setEditingReporte({ ...editingReporte, id_paro: e.target.value })}
            >
              <option value="">Seleccione un tipo de paro</option>
              {paros.map(p => (
                <option key={p.id_paro} value={p.id_paro}>{p.descripcion}</option>
              ))}
            </select>
            <label>Descripción de Falla</label>
            + <input
   type="text"
   name="falla_descripcion"
   value={editingReporte.falla_descripcion}
   onChange={e => setEditingReporte({ ...editingReporte, falla_descripcion: e.target.value })}
/>
            <label>Fecha</label>
            <input
              type="datetime-local"
              name="fecha"
              value={editingReporte.fecha}
              onChange={(e) => setEditingReporte({ ...editingReporte, fecha: e.target.value })}
            />
            <label>Soporte</label>
            <select
              name="id_usuario_solucionador"
              value={editingReporte.id_usuario_solucionador}
              onChange={(e) => setEditingReporte({ ...editingReporte, id_usuario_solucionador: e.target.value })}
            >
              <option value="">Seleccione un soporte</option>
              {usuarios.map(u => (
                <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
              ))}
            </select>
            <label>Hora Inicio</label>
            <input
              type="time"
              name="hora_inicio"
              value={editingReporte.hora_inicio}
              onChange={(e) => setEditingReporte({ ...editingReporte, hora_inicio: e.target.value })}
            />
            <label>Hora Fin</label>
            <input
              type="time"
              name="hora_fin"
              value={editingReporte.hora_fin}
              onChange={(e) => setEditingReporte({ ...editingReporte, hora_fin: e.target.value })}
            />
            <label>Tiempo Paro</label>
            <input
              type="time"
              name="tiempo_paro"
              value={editingReporte.tiempo_paro}
              onChange={(e) => setEditingReporte({ ...editingReporte, tiempo_paro: e.target.value })}
            />
            <label>Acción Correctiva</label>
            <input
              type="text"
              name="accion_correctiva"
              value={editingReporte.accion_correctiva}
              onChange={(e) => setEditingReporte({ ...editingReporte, accion_correctiva: e.target.value })}
            />
            <button onClick={handleSaveReporte}>Guardar Cambios</button>
            <button onClick={() => setEditingReporte(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

const getChartDataUsuario = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Usuario',
      data: Object.values(groups),
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1
    }]
  };
};

const getChartDataArea = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Área',
      data: Object.values(groups),
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };
};

const getChartDataTipoParo = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Tipo de Paro',
      data: Object.values(groups),
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };
};

const getChartDataSoporte = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Soporte',
      data: Object.values(groups),
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  };
};

const getChartDataFechaInicio = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Fecha de Inicio',
      data: Object.values(groups),
      backgroundColor: 'rgba(153, 102, 255, 0.5)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1
    }]
  };
};

const getChartDataHoraInicio = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Hora de Inicio',
      data: Object.values(groups),
      backgroundColor: 'rgba(255, 206, 86, 0.5)',
      borderColor: 'rgba(255, 206, 86, 1)',
      borderWidth: 1
    }]
  };
};

const getChartDataTiempoParo = () => {
  const groups = {};
  return {
    labels: Object.keys(groups),
    datasets: [{
      label: 'Reportes por Tiempo Paro',
      data: Object.values(groups),
      backgroundColor: 'rgba(255, 159, 64, 0.5)',
      borderColor: 'rgba(255, 159, 64, 1)',
      borderWidth: 1
    }]
  };
};

export default UserManagementPage;

