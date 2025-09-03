import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./OptionsPage.module.css";
import { API_URL } from "./config";

const EXCLUDED_ZONE = 8;

// Cliente axios consistente con el Panel
const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: { Accept: "application/json" },
});

const OptionsPage = () => {
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);

  const [paroData, setParoData] = useState([]);
  const [selectedParo, setSelectedParo] = useState(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [descripcion, setDescripcion] = useState("");

  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");

  const [loading, setLoading] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);

  // Masivos
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState("zona");
  const [selectedZoneBulk, setSelectedZoneBulk] = useState("");
  const [selectedAreasBulk, setSelectedAreasBulk] = useState([]);
  const [selectedParoBulk, setSelectedParoBulk] = useState("");
  const [descriptionBulk, setDescriptionBulk] = useState("");
  const [allParo, setAllParo] = useState([]);

  const navigate = useNavigate();

  const zoneMapping = {
    1: "Workzone 1",
    2: "Workzone 2",
    3: "Workzone 3",
    4: "Workzone 4",
  };
  const getZoneName = (id) => zoneMapping[id] || `Zona ${id}`;

  // Carga inicial (usuario, áreas sin zona 8, motivos de paro)
  useEffect(() => {
    const usuarioLogueado = localStorage.getItem("id_usuario");
    const nombreUsuario = localStorage.getItem("nombre_usuario");
    if (usuarioLogueado) setUserId(parseInt(usuarioLogueado, 10));
    if (nombreUsuario) setUserName(nombreUsuario);

    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get("/api/areas"),
      api.get("/paro")
    ])
      .then(([areasRes, paroRes]) => {
        if (cancelled) return;
        const rawAreas = Array.isArray(areasRes.data) ? areasRes.data : [];
        // 👇 Excluir zona 8 aquí
        const filtered = rawAreas.filter((a) => Number(a.id_zona) !== EXCLUDED_ZONE);
        setAreas(filtered);

        setAllParo(Array.isArray(paroRes.data) ? paroRes.data : []);
      })
      .catch((err) => {
        console.error("❌ Error en carga inicial:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAreaClick = async (area) => {
    setSelectedArea(area);
    try {
      // Si tienes endpoint específico por área, úsalo.
      // Si no, puedes reusar la lista general `allParo`.
      const res = await api.get(`/paro?area=${encodeURIComponent(area.id_area)}`);
      setParoData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching paro data:", err);
      // Fallback: usar todos los motivos si el endpoint por área falla
      setParoData(allParo);
    }
  };

  const handleParoClick = (paro) => {
    setSelectedParo(paro);
    setShowFormModal(true);
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setSelectedParo(null);
    setDescripcion("");
  };

  const handleSendReport = async () => {
    if (!userId || !descripcion.trim() || !selectedParo || !selectedArea) {
      alert("⚠️ Todos los campos son obligatorios.");
      return;
    }

    const now = new Date();
    const fechaActual = now.toISOString().split("T")[0];
    const horaActual = now.toTimeString().split(" ")[0];

    const fallaData = {
      descripcion: descripcion.trim(),
      id_paro: selectedParo.id_paro,
      id_urgencia: 2,
      id_usuario: userId,
      id_area: selectedArea.id_area,
      fecha_inicio: fechaActual,
      hora_inicio: horaActual,
      id_status: 5,
    };

    try {
      await api.post("/falla", fallaData);
      setShowAnimation(true);
      handleCloseFormModal();
      setSelectedArea(null);
      setTimeout(() => navigate("/soporte"), 1200);
    } catch (error) {
      console.error("❌ Error al enviar el reporte:", error);
      alert("❌ Hubo un error al enviar el reporte. Inténtalo de nuevo.");
    }
  };

  const handleCheckboxChange = (e) => {
    const areaId = parseInt(e.target.value, 10);
    if (e.target.checked) {
      setSelectedAreasBulk((prev) => [...prev, areaId]);
    } else {
      setSelectedAreasBulk((prev) => prev.filter((id) => id !== areaId));
    }
  };

  const handleBulkSendReport = async () => {
    if (!userId || !selectedParoBulk || !descriptionBulk.trim()) {
      alert("⚠️ Complete todos los campos obligatorios.");
      return;
    }

    let areasToReport = [];
    if (selectionMode === "zona") {
      if (!selectedZoneBulk) {
        alert("⚠️ Seleccione una zona.");
        return;
      }
      areasToReport = areas
        .filter((area) => area.id_zona === parseInt(selectedZoneBulk, 10))
        .map((area) => area.id_area);
    } else if (selectionMode === "individual") {
      if (selectedAreasBulk.length === 0) {
        alert("⚠️ Seleccione al menos un área.");
        return;
      }
      areasToReport = selectedAreasBulk;
    } else if (selectionMode === "todas") {
      // 👇 “Todas” ya NO incluye zona 8 porque 'areas' ya viene filtrado
      areasToReport = areas.map((area) => area.id_area);
    }

    const now = new Date();
    const fechaActual = now.toISOString().split("T")[0];
    const horaActual = now.toTimeString().split(" ")[0];

    try {
      await Promise.all(
        areasToReport.map((areaId) =>
          api.post("/falla", {
            descripcion: descriptionBulk.trim(),
            id_paro: parseInt(selectedParoBulk, 10),
            id_urgencia: 2,
            id_usuario: userId,
            id_area: areaId,
            fecha_inicio: fechaActual,
            hora_inicio: horaActual,
            id_status: 5,
          })
        )
      );
      alert("✅ Registros creados correctamente");
      setShowBulkModal(false);
      setSelectedZoneBulk("");
      setSelectedAreasBulk([]);
      setSelectedParoBulk("");
      setDescriptionBulk("");
    } catch (error) {
      console.error("❌ Error en registros masivos:", error);
      alert("❌ Error al registrar fallas.");
    }
  };

  // Agrupación por zona, usando la lista YA filtrada (sin zona 8)
  const groupedAreas = areas.reduce((groups, area) => {
    const zoneName = getZoneName(area.id_zona);
    if (!groups[zoneName]) groups[zoneName] = [];
    groups[zoneName].push(area);
    return groups;
  }, {});

  const getImageUrl = (ruta) => {
    if (!ruta) return "https://placehold.co/96";
    if (ruta.startsWith("http://") || ruta.startsWith("https://")) return ruta;
    return `${API_URL}${ruta}`;
  };

  if (loading) {
    return <div className={styles["loading-screen"]}>Cargando...</div>;
  }

  // Si por alguna razón no hay áreas (p. ej., backend vacío o error), mostramos un fallback amable
  if (!areas.length) {
    return (
      <div className={styles.container}>
        <p style={{ padding: 16 }}>No hay áreas disponibles para mostrar (la zona 8 está excluida).</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={() => setShowBulkModal(true)} className={styles["bulk-button"]}>
        Registro Masivo
      </button>

      {Object.keys(groupedAreas).map((zoneName) => (
        <div key={zoneName} className={styles["zone-group"]}>
          <h3>{zoneName}</h3>
          <div className={styles["area-buttons-container"]}>
            {groupedAreas[zoneName].map((area) => (
              <button
                key={area.id_area}
                className={styles["area-button"]}
                onClick={() => handleAreaClick(area)}
              >
                <img
                  src={getImageUrl(area.imagen_area)}
                  alt={area.nombre_area}
                  className={styles["area-image"]}
                />
                <span className={styles["area-name"]}>{area.nombre_area}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selectedArea && (
        <div
          className={styles.modal}
          onClick={(e) => e.target === e.currentTarget && setSelectedArea(null)}
        >
          <div className={styles["modal-content"]} onClick={(e) => e.stopPropagation()}>
            <span className={styles["close-button"]} onClick={() => setSelectedArea(null)}>
              &times;
            </span>
            <h2>{selectedArea.nombre_area}</h2>
            <div className={styles["modal-body"]}>
              <img
                src={getImageUrl(selectedArea.imagen_area)}
                alt={selectedArea.nombre_area}
                className={styles["modal-image"]}
              />
              <div className={styles["paro-buttons-container"]}>
                {(paroData.length ? paroData : allParo)
                  .filter((paro) => (paro.descripcion || "").trim() !== "Junta")
                  .map((paro) => (
                    <button
                      key={paro.id_paro}
                      className={styles["paro-button"]}
                      data-paro={(paro.descripcion || "").trim()}
                      onClick={() => handleParoClick(paro)}
                    >
                      {paro.descripcion}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <div className={styles["form-modal"]}>
          <div className={styles["form-modal-content"]}>
            <h3>Paro seleccionado: {selectedParo && selectedParo.descripcion}</h3>
            <p>Área seleccionada: {selectedArea && selectedArea.nombre_area}</p>
            <p>Usuario logueado: {userName}</p>

            <textarea
              placeholder="Escribe tu comentario..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />

            <div className={styles["form-actions"]}>
              <button onClick={handleSendReport} disabled={!descripcion.trim()}>
                Enviar
              </button>
              <button onClick={handleCloseFormModal}>Salir</button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div
          className={styles["bulk-modal"]}
          onClick={(e) => e.target === e.currentTarget && setShowBulkModal(false)}
        >
          <div className={styles["bulk-modal-content"]} onClick={(e) => e.stopPropagation()}>
            <h2>Registro Masivo de Paros</h2>

            <div className={styles["mode-selector"]}>
              <label>
                <input
                  type="radio"
                  name="selectionMode"
                  value="zona"
                  checked={selectionMode === "zona"}
                  onChange={() => {
                    setSelectionMode("zona");
                    setSelectedAreasBulk([]);
                  }}
                />
                Seleccionar por Zona
              </label>
              <label>
                <input
                  type="radio"
                  name="selectionMode"
                  value="individual"
                  checked={selectionMode === "individual"}
                  onChange={() => {
                    setSelectionMode("individual");
                    setSelectedZoneBulk("");
                  }}
                />
                Seleccionar Áreas Individualmente
              </label>
              <label>
                <input
                  type="radio"
                  name="selectionMode"
                  value="todas"
                  checked={selectionMode === "todas"}
                  onChange={() => {
                    setSelectionMode("todas");
                    setSelectedZoneBulk("");
                    setSelectedAreasBulk([]);
                  }}
                />
                Seleccionar Todas
              </label>
            </div>

            {selectionMode === "zona" && (
              <div className={styles["bulk-section"]}>
                <label>Zona:</label>
                <select
                  value={selectedZoneBulk}
                  onChange={(e) => setSelectedZoneBulk(e.target.value)}
                >
                  <option value="">Seleccione zona</option>
                  {Array.from(new Set(areas.map((a) => a.id_zona))).map((id) => (
                    <option key={id} value={id}>
                      {getZoneName(id)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectionMode === "individual" && (
              <div className={styles["bulk-section"]}>
                <p>Seleccione las áreas:</p>
                {Object.entries(
                  areas.reduce((groups, area) => {
                    const zone = getZoneName(area.id_zona);
                    if (!groups[zone]) groups[zone] = [];
                    groups[zone].push(area);
                    return groups;
                  }, {})
                ).map(([zone, zoneAreas]) => (
                  <div key={zone} className={styles["area-group"]}>
                    <h4>{zone}</h4>
                    {zoneAreas.map((area) => (
                      <div key={area.id_area}>
                        <input
                          type="checkbox"
                          id={`area-${area.id_area}`}
                          value={area.id_area}
                          onChange={handleCheckboxChange}
                          checked={selectedAreasBulk.includes(area.id_area)}
                        />
                        <label htmlFor={`area-${area.id_area}`}>{area.nombre_area}</label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className={styles["bulk-section"]}>
              <label>Motivo de Paro:</label>
              <select
                value={selectedParoBulk}
                onChange={(e) => setSelectedParoBulk(e.target.value)}
              >
                <option value="">Seleccione motivo de paro</option>
                {allParo.map((paro) => (
                  <option key={paro.id_paro} value={paro.id_paro}>
                    {paro.descripcion}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles["bulk-section"]}>
              <label>Descripción:</label>
              <textarea
                placeholder="Escribe la descripción..."
                value={descriptionBulk}
                onChange={(e) => setDescriptionBulk(e.target.value)}
              />
            </div>

            <div className={styles["bulk-buttons"]}>
              <button onClick={handleBulkSendReport} disabled={!descriptionBulk.trim()}>
                Enviar
              </button>
              <button onClick={() => setShowBulkModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showAnimation && (
        <div className={styles["animation-overlay"]}>
          <div className={styles["animation-content"]}>
            <p>Registrando falla...</p>
            <div className={styles.spinner}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionsPage;
