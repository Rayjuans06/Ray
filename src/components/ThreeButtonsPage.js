import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './ThreeButtonsPage.module.css';

const buttons = [
  { id: 1, name: 'Tiempo real', description: 'Estaciones en tiempo real', image: '/icon/time.png', link: '/panel' },
  { id: 2, name: 'Áreas', description: 'Ver y agregar áreas y zonas', image: '/icon/area.png' },
  { id: 3, name: 'Consulta', description: 'Consultar información', image: '/icon/consult.png', link: '/consult' },
  { id: 4, name: 'Editar', description: 'Editar reportes', image: '/icon/edit.png', link: '/reportsop' },
  { id: 5, name: 'Usuarios', description: 'Administrar usuarios', image: '/icon/people.png', link: '/userm' },
  { id: 6, name: 'Paro', description: 'Levantar un reporte', image: '/icon/paro.png', link: '/OptionsPage' },
  { id: 7, name: 'promedio', description: '', image: '/icon/Promedio.png' },
];

const ThreeButtonsPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [showEditAreaModal, setShowEditAreaModal] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [paros, setParos] = useState([]);
  const [reportFilterLoading, setReportFilterLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedParos, setSelectedParos] = useState([]);
  const [reportResults, setReportResults] = useState([]);

  const [areas, setAreas] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [nombreArea, setNombreArea] = useState('');
  const [idZona, setIdZona] = useState('');
  const [imagenFile, setImagenFile] = useState(null);
  const [nombreZona, setNombreZona] = useState('');

  const [editArea, setEditArea] = useState(null);
  const [editNombreArea, setEditNombreArea] = useState('');
  const [editIdZona, setEditIdZona] = useState('');

  const handleButtonClick = (button) => {
    if (button.id === 2) setShowModal(true);
    if (button.id === 7) setShowReportModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setAreas([]);
    setError(null);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setStartDate('');
    setEndDate('');
    setSelectedParos([]);
    setReportResults([]);
    setReportError(null);
  };

  useEffect(() => {
    if (showModal) {
      setLoading(true);
      fetch('http://localhost:5000/areas')
        .then((response) => response.json())
        .then((data) => {
          setAreas(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching areas:', err);
          setError('Error al obtener las áreas.');
          setLoading(false);
        });
    }
  }, [showModal]);

  useEffect(() => {
    if (showModal || showAddAreaModal || showEditAreaModal) {
      fetch('http://localhost:5000/zonas')
        .then((response) => response.json())
        .then((data) => setZones(data))
        .catch((err) => console.error('Error al obtener las zonas:', err));
    }
  }, [showModal, showAddAreaModal, showEditAreaModal]);

  
useEffect(() => {
  if (showReportModal) {
    fetch('http://localhost:5000/paro')
      .then(res => res.json())
      .then(data => {
        const mapped = data.map(p => ({
          id_paro: p.id_paro,
          nombre_paro: p.descripcion,  
          descripcion: p.descripcion
        }));
        setParos(mapped);
      })
      .catch(err => console.error(err));
  }
}, [showReportModal]);



  const handleAddArea = () => setShowAddAreaModal(true);
  const closeAddAreaModal = () => {
    setShowAddAreaModal(false);
    setNombreArea('');
    setIdZona('');
    setImagenFile(null);
  };

  const handleNewAreaSubmit = async (e) => {
    e.preventDefault();
    if (!imagenFile) {
      alert('Por favor selecciona una imagen.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('imagen', imagenFile);
      const uploadRes = await fetch('http://localhost:5000/upload-image', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      const imageId = uploadData.imageId;
      const newArea = { nombre_area: nombreArea, id_zona: idZona, id_imagen: imageId };
      const response = await fetch('http://localhost:5000/areas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newArea)
      });
      if (!response.ok) throw new Error('Error al registrar el área.');
      const data = await response.json();
      setAreas((prev) => [...prev, data]);
      closeAddAreaModal();
    } catch (err) {
      console.error('Error al registrar área:', err);
      alert('Hubo un problema al registrar el área.');
    }
  };

  const handleAddZone = () => setShowAddZoneModal(true);
  const closeAddZoneModal = () => {
    setShowAddZoneModal(false);
    setNombreZona('');
  };
  const handleNewZoneSubmit = async (e) => {
    e.preventDefault();
    const newZone = { nombre_zona: nombreZona };
    try {
      const response = await fetch('http://localhost:5000/zonas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newZone)
      });
      if (!response.ok) throw new Error('Error al registrar la zona.');
      const data = await response.json();
      setZones((prev) => [...prev, data]);
      closeAddZoneModal();
    } catch (err) {
      console.error('Error al registrar zona:', err);
      alert('Hubo un problema al registrar la zona.');
    }
  };

  const handleEditArea = (area) => {
    setEditArea(area);
    setEditNombreArea(area.nombre_area);
    setEditIdZona(area.id_zona);
    setShowEditAreaModal(true);
  };
  const closeEditAreaModal = () => {
    setShowEditAreaModal(false);
    setEditArea(null);
  };
  const handleUpdateArea = async (e) => {
    e.preventDefault();
    try {
      const updated = { nombre_area: editNombreArea, id_zona: editIdZona };
      const res = await fetch(`http://localhost:5000/areas/${editArea.id_area}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error('Error al actualizar área');
      const data = await res.json();
      setAreas((prev) => prev.map((a) => (a.id_area === data.id_area ? data : a)));
      closeEditAreaModal();
    } catch (err) {
      console.error('Error al actualizar área:', err);
      alert('No se pudo actualizar el área.');
    }
  };

  const handleDeleteArea = async (id) => {
    if (!window.confirm('¿Seguro que deseas borrar esta área?')) return;
    try {
      const res = await fetch(`http://localhost:5000/areas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al borrar área');
      setAreas((prev) => prev.filter((a) => a.id_area !== id));
    } catch (err) {
      console.error('Error al borrar área:', err);
      alert('No se pudo eliminar el área.');
    }
  };

  const parseTimeToSeconds = (timeStr) => {
    const [h, m, s] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  };

  const formatSecondsToTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportFilterLoading(true);
    try {
      const res = await fetch('http://localhost:5000/reportes');
      const data = await res.json();
      const filteredByDate = data.filter(r => {
        const fecha = new Date(r.fecha).toISOString().split('T')[0];
        if (startDate && endDate) {
          return fecha >= startDate && fecha <= endDate;
        }
        if (startDate) {
          return fecha === startDate;
        }
        return true;
      });
      const finalFilter = filteredByDate.filter(r => selectedParos.includes(r.id_paro));

      const group = {};
      finalFilter.forEach(r => {
        const secs = parseTimeToSeconds(r.tiempo_paro);
        if (!group[r.id_paro]) {
          group[r.id_paro] = { total: 0, count: 0 };
        }
        group[r.id_paro].total += secs;
        group[r.id_paro].count += 1;
      });

      const results = Object.entries(group).map(([paroId, { total, count }]) => {
        const avg = Math.floor(total / count);
        const paroName = paros.find(p => p.id_paro === Number(paroId))?.nombre_paro || `Paro ${paroId}`;
        return { id_paro: Number(paroId), nombre_paro: paroName, avgTime: formatSecondsToTime(avg) };
      });

      const totalSecs = finalFilter.reduce((acc, r) => acc + parseTimeToSeconds(r.tiempo_paro), 0);
      const totalAvg = Math.floor(totalSecs / (finalFilter.length || 1));
      results.push({ id_paro: 0, nombre_paro: 'Total', avgTime: formatSecondsToTime(totalAvg) });

      setReportResults(results);
    } catch (err) {
      console.error('Error al filtrar reportes:', err);
      setReportError('No se pudo procesar los reportes.');
    } finally {
      setReportFilterLoading(false);
    }
  };

  return (
    <div className={styles['three-buttons-container']}>
      <div className={styles['buttons-grid']}>
        {buttons.map((button) =>
          button.link ? (
            <Link to={button.link} key={button.id} className={styles['button-card']}>
              <img src={button.image} alt={button.name} className={styles['button-image']} />
              <h3>{button.name}</h3>
              <p>{button.description}</p>
            </Link>
          ) : (
            <div key={button.id} className={styles['button-card']} onClick={() => handleButtonClick(button)}>
              <img src={button.image} alt={button.name} className={styles['button-image']} />
              <h3>{button.name}</h3>
              <p>{button.description}</p>
            </div>
          )
        )}
      </div>

      {showModal && (
        <div className={styles['overlay']}>
          <div className={styles['modal']}>
            <button className={styles['close-button']} onClick={closeModal}>X</button>
            <div className={styles['modal-content']}>
              <div className={styles['modal-left']}>
                <h2>Datos de las Áreas</h2>
                <button className={styles['add-area-button']} onClick={handleAddArea}>Agregar Área...</button>
                <button className={styles['add-area-button']} onClick={handleAddZone} style={{ marginLeft: '10px' }}>Agregar Zona...</button>
                {loading && <p>Cargando áreas...</p>}
                {error && <p className={styles['error']}>{error}</p>}
                {!loading && !error && (
                  areas.length > 0 ? (
                    <table className={styles['areas-table']}>
                      <thead>
                        <tr>
                          <th>ID Área</th>
                          <th>Nombre Área</th>
                          <th>ID Zona</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areas.map((area) => (
                          <tr key={area.id_area}>
                            <td>{area.id_area}</td>
                            <td>{area.nombre_area}</td>
                            <td>{area.id_zona}</td>
                            <td>
                              <button className={styles['action-button']} onClick={() => handleEditArea(area)}>Editar</button>
                              <button className={styles['action-button']} onClick={() => handleDeleteArea(area.id_area)}>Borrar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No hay áreas registradas.</p>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className={styles['overlay']}>
          <div className={styles['modal']}>
            <button className={styles['close-button']} onClick={closeReportModal}>X</button>
            <div className={styles['modal-content']}>
              <h2>Filtrar Reportes</h2>
              <form onSubmit={handleReportSubmit}>
                <div className={styles['form-group']}>
                  <label>Fecha inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className={styles['form-group']}>
                  <label>Fecha fin</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className={styles['form-group']}>
                  <label>Tipos de Paro</label>
                  <select multiple value={selectedParos} onChange={(e) => setSelectedParos([...e.target.selectedOptions].map(o => Number(o.value)))}>
                    {paros.map((p) => (
                      <option key={p.id_paro} value={p.id_paro}>{p.nombre_paro}</option>
                    ))}
                  </select>
                </div>
                <button type="submit">Generar Reportes</button>
              </form>

              {reportFilterLoading && <p>Cargando reportes...</p>}
              {reportError && <p className={styles['error']}>{reportError}</p>}

              {reportResults.length > 0 && (
                <table className={styles['areas-table']}>
                  <thead>
                    <tr>
                      <th>Paro</th>
                      <th>Tiempo Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportResults.map((r) => (
                      <tr key={r.id_paro}>
                        <td>{r.nombre_paro}</td>
                        <td>{r.avgTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddAreaModal && (
        <div className={styles['overlay']}>
          <div className={styles['modal']}>
            <button className={styles['close-button']} onClick={closeAddAreaModal}>X</button>
            <div className={styles['modal-content']}>
              <h2>Regístrate Área Nueva</h2>
              <form onSubmit={handleNewAreaSubmit}>
                <div className={styles['form-group']}>
                  <label>Nombre del Área</label>
                  <input type="text" value={nombreArea} onChange={(e) => setNombreArea(e.target.value)} required />
                </div>
                <div className={styles['form-group']}>
                  <label>ID Zona</label>
                  <select value={idZona} onChange={(e) => setIdZona(e.target.value)} required>
                    <option value="">Seleccione zona</option>
                    {zones.map((zone) => (
                      <option key={zone.id_zona} value={zone.id_zona}>{zone.nombre_zona}</option>
                    ))}
                  </select>
                </div>
                <div className={styles['form-group']}>
                  <label>Imagen del Área</label>
                  <input type="file" accept="image/*" onChange={(e) => setImagenFile(e.target.files[0])} required />
                </div>
                <p>La imagen se guardará automáticamente en la carpeta <code>/public/imagenes</code></p>
                <button type="submit">Registrar Área</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditAreaModal && editArea && (
        <div className={styles['overlay']}>
          <div className={styles['modal']}>
            <button className={styles['close-button']} onClick={closeEditAreaModal}>X</button>
            <div className={styles['modal-content']}>
              <h2>Editar Área</h2>
              <form onSubmit={handleUpdateArea}>
                <div className={styles['form-group']}>
                  <label>Nombre del Área</label>
                  <input
                    type="text"
                    value={editNombreArea}
                    onChange={(e) => setEditNombreArea(e.target.value)}
                    required
                  />
                </div>
                <div className={styles['form-group']}>
                  <label>ID Zona</label>
                  <select value={editIdZona} onChange={(e) => setEditIdZona(e.target.value)} required>
                    <option value="">Seleccione zona</option>
                    {zones.map((z) => (
                      <option key={z.id_zona} value={z.id_zona}>{z.nombre_zona}</option>
                    ))}
                  </select>
                </div>
                <button type="submit">Guardar Cambios</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddZoneModal && (
        <div className={styles['overlay']}>
          <div className={styles['modal']}>
            <button className={styles['close-button']} onClick={closeAddZoneModal}>X</button>
            <div className={styles['modal-content']}>
              <h2>Registrar Zona Nueva</h2>
              <form onSubmit={handleNewZoneSubmit}>
                <div className={styles['form-group']}>
                  <label>Nombre de la Zona</label>
                  <input type="text" value={nombreZona} onChange={(e) => setNombreZona(e.target.value)} required />
                </div>
                <button type="submit">Registrar Zona</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeButtonsPage;
