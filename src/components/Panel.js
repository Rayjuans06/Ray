import React, { useState, useEffect } from "react";
import styles from "./Panel.module.css";
import { API_URL } from "./config";

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return width;
}

export async function fetchJSON(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(options.headers || {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} – ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}
const Panel = () => {
  const [areas, setAreas] = useState([]);
  const [zones, setZones] = useState([]);
  const [fallasActivas, setFallasActivas] = useState([]);
  const [fallaUrgencia, setFallaUrgencia] = useState(null);
  const [descripcionUrgencia, setDescripcionUrgencia] = useState("");
  const [cronometros, setCronometros] = useState({});
  const [fallaSeleccionada, setFallaSeleccionada] = useState(null);
  const [paros, setParos] = useState([]);
  const [fechasInicioFallas, setFechasInicioFallas] = useState({});
  const [infoBoxStyle, setInfoBoxStyle] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showLegend, setShowLegend] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const windowWidth = useWindowWidth();
    const EXCLUDED_ZONE = 8;

  const formatDate = (date) => {
    return date.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);


  const loadAreas = async () => {
     try {
       const res = await fetch(`${API_URL}/api/areas`, { headers: { Accept: "application/json" } });
       if (!res.ok) {
         const txt = await res.text();
         throw new Error(`HTTP ${res.status} – ${txt.slice(0,200)}`);
       }
       const data = await res.json();
       // ❗️Quedarnos solo con áreas cuya zona != 8
       setAreas(data.filter(a => Number(a.id_zona) !== EXCLUDED_ZONE));
     } catch (err) {
       console.error("Error fetching areas:", err);
     }
   };
  useEffect(() => {
    loadAreas();
   }, []);

   

  useEffect(() => {
    const fetchZones = () => {
      fetch(`${API_URL}/zonas`)
        .then((response) => response.json())
        .then((data) => {
          const zonasOrdenadas = data.sort((a, b) => a.id_zona - b.id_zona);
          setZones(zonasOrdenadas);
        })
        .catch((error) => console.error("Error fetching zones:", error));
    };
    fetchZones();
    const zonesInterval = setInterval(fetchZones, 5000); 
    return () => clearInterval(zonesInterval);
  }, []);

  useEffect(() => {
   const poll = async () => {
     try {
       const [resAct, resAll] = await Promise.all([
         fetch(`${API_URL}/fallas/activas`),
         fetch(`${API_URL}/falla`)
       ]);
       const [act, all] = await Promise.all([resAct.json(), resAll.json()]);

       // Solo considerar fallas cuyas áreas estén en 'areas' (ya filtradas != zona 8)
       const visibleAreaIds = new Set(areas.map(a => a.id_area));
       const actVisible = act.filter(f => visibleAreaIds.has(f.id_area));
       setFallasActivas(actVisible);

       const urgentesVisibles = all
         .filter(f => f.id_status === 5 && visibleAreaIds.has(f.id_area));

       if (urgentesVisibles.length > 0) {
         const fallaMayorUrgencia = urgentesVisibles.reduce(
           (max, f) => (f.id_urgencia > max.id_urgencia ? f : max),
           urgentesVisibles[0]
         );
         setFallaUrgencia(fallaMayorUrgencia);
         setDescripcionUrgencia(getParoDescription(fallaMayorUrgencia.id_paro));
       } else {
         setFallaUrgencia(null);
         setDescripcionUrgencia("");
       }
     } catch (e) {
       console.error("Error polling fallas:", e);
     }
   };
   // primera carga + polling cada 5s
   poll();
   const t = setInterval(poll, 5000);
   return () => clearInterval(t);
 }, [paros, areas]);

  useEffect(() => {
    const parosInterval = setInterval(() => {
      fetch(`${API_URL}/paro`)
        .then((response) => response.json())
        .then((data) => setParos(data))
        .catch((error) => console.error("Error fetching paros:", error));
    }, 5000);
    return () => clearInterval(parosInterval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCronometros((prev) => {
        const nuevos = { ...prev };
        fallasActivas.forEach((falla) => {
          if (falla.fecha_inicio && falla.hora_inicio) {
            const fechaCompleta = `${falla.fecha_inicio.split("T")[0]}T${falla.hora_inicio}`;
            let horaInicio = new Date(fechaCompleta);
            const ahora = new Date();
            if (isNaN(horaInicio.getTime())) {
              console.error(`Error en fecha/hora para falla ID ${falla.id_falla}`, falla);
              return;
            }
            let diff = Math.floor((ahora - horaInicio) / 1000);
            if (diff < 0) diff = 0;
            nuevos[falla.id_area] = diff;
          }
        });
        return nuevos;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fallasActivas]);

  useEffect(() => {
    if (fallasActivas.length > 0) {
      const nuevasFechas = { ...fechasInicioFallas };
      fallasActivas.forEach((falla) => {
        if (!nuevasFechas[falla.id_area]) {
          let horaInicio;
          if (falla.hora_inicio.includes("-")) {
            horaInicio = new Date(falla.hora_inicio);
          } else {
            const [h, m, s] = falla.hora_inicio.split(":").map(Number);
            horaInicio = new Date();
            horaInicio.setHours(h, m, s, 0);
            if (horaInicio > new Date()) {
              horaInicio.setDate(horaInicio.getDate() - 1);
            }
          }
          nuevasFechas[falla.id_area] = horaInicio;
        }
      });
      setFechasInicioFallas(nuevasFechas);
    }
  }, [fallasActivas]);

  const formatearTiempo = (segundos) => {
    if (isNaN(segundos) || segundos < 0) return "00:00:00";
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const seg = segundos % 60;
    return `${dias > 0 ? dias + "d " : ""}${horas
      .toString()
      .padStart(2, "0")}:${minutos.toString().padStart(2, "0")}:${seg
      .toString()
      .padStart(2, "0")}`;
  };

  const fallaPorArea = {};
  fallasActivas.forEach((falla) => {
    fallaPorArea[falla.id_area] = falla;
  });

  const getAreaName = (idArea) => {
    const area = areas.find((area) => area.id_area === idArea);
    return area ? area.nombre_area : "Área no encontrada";
  };

  const getParoDescription = (idParo) => {
    const paro = paros.find((paro) => paro.id_paro === idParo);
    return paro ? paro.descripcion : "Descripción no disponible";
  };

  let bigButtonLabel = "Cargando...";
  let bigButtonTimer = "";
  if (fallaUrgencia && areas.length > 0) {
    const areaData = areas.find((area) => area.id_area === fallaUrgencia.id_area);
    bigButtonLabel = areaData ? areaData.nombre_area : "Área no encontrada";
    if (cronometros[fallaUrgencia.id_area]) {
      bigButtonTimer = formatearTiempo(cronometros[fallaUrgencia.id_area]);
    }
  } else if (!fallaUrgencia) {
    bigButtonLabel = "Sin reportes urgentes";
  }

  const areasByZone = {};
  areas.forEach((area) => {
    const zona = area.id_zona;
    if (!areasByZone[zona]) {
      areasByZone[zona] = [];
    }
    areasByZone[zona].push(area);
  });

  const columnsData = [];
  zones.forEach((zone) => {
    const areasZone = areasByZone[zone.id_zona] || [];
    for (let i = 0; i < areasZone.length; i += 5) {
      columnsData.push({
        zone,
        areas: areasZone.slice(i, i + 5),
      });
    }
  });
  const manejarMouseEnterFalla = async (falla, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const infoBoxWidth = 300; 
    const infoBoxHeight = 150;
    const horizontalOffset = -30;
    const verticalOffset = 10;
    let style = {};
    if (rect.left < window.innerWidth / 2) {
      style = {
        left: rect.right + horizontalOffset + "px",
        top: rect.top + rect.height / 2 - infoBoxHeight / 2 - verticalOffset + "px",
      };
    } else {
      style = {
        left: rect.left - infoBoxWidth - horizontalOffset + "px",
        top: rect.top + rect.height / 2 - infoBoxHeight / 2 - verticalOffset + "px",
      };
    }
    setInfoBoxStyle(style);
    try {
      const response = await fetch(`${API_URL}/falla`);
      const fallasCompletas = await response.json();
      const fallaCompleta = fallasCompletas.find((f) => f.id_falla === falla.id_falla);
      setFallaSeleccionada(fallaCompleta ? fallaCompleta : falla);
    } catch (error) {
      console.error("Error obteniendo datos completos de la falla:", error);
      setFallaSeleccionada(falla);
    }
  };

  const manejarMouseLeave = () => {
    setFallaSeleccionada(null);
  };

  const manejarMobileClick = async (falla) => {
    try {
      const response = await fetch(`${API_URL}/falla`);
      const fallasCompletas = await response.json();
      const fallaCompleta = fallasCompletas.find((f) => f.id_falla === falla.id_falla);
      setFallaSeleccionada(fallaCompleta ? fallaCompleta : falla);
    } catch (error) {
      console.error("Error obteniendo datos completos de la falla:", error);
      setFallaSeleccionada(falla);
    }
  };

  const toggleNotificationPanel = () => {
    setShowNotificationPanel(!showNotificationPanel);
  };

  return (
    <div className={styles.panelWrapper}>
      {windowWidth < 768 && (
        <div className={styles["mobile-toggle-buttons"]}>
          <button
            className={styles["legend-toggle-btn"]}
            onClick={() => setShowLegend(!showLegend)}
          >
            {showLegend ? "Ocultar Leyenda" : "Mostrar Leyenda"}
          </button>
          <button
            className={styles["legend-toggle-btn"]}
            onClick={toggleNotificationPanel}
          >
            {showNotificationPanel ? "Ocultar Panel" : "Mostrar Panel"}
          </button>
        </div>
      )}

      {(windowWidth >= 768 || showLegend) && (
        <div className={styles["global-legend"]}>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#D32F2F" }}></div>
            <span className={styles["legend-text"]}>Mantenimiento</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#FF9800" }}></div>
            <span className={styles["legend-text"]}>Metodos</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#FDD835" }}></div>
            <span className={styles["legend-text"]}>Calidad</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#00ACC1" }}></div>
            <span className={styles["legend-text"]}>Falta de material</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#757575" }}></div>
            <span className={styles["legend-text"]}>Paro programado</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#1E88E5" }}></div>
            <span className={styles["legend-text"]}>Cambio de modelo</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#7B1FA2" }}></div>
            <span className={styles["legend-text"]}>Seguridad</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#000000" }}></div>
            <span className={styles["legend-text"]}>IT</span>
          </div>
          <div className={styles["legend-item"]}>
            <div className={styles["legend-box"]} style={{ backgroundColor: "#006d36" }}></div>
            <span className={styles["legend-text"]}>Falta de personal</span>
          </div>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles["button-section"]}>
          <div className={styles["text-row"]}>
            {columnsData.map((colData, index) => {
              const showZoneName =
                index === 0 ||
                colData.zone.id_zona !== columnsData[index - 1].zone.id_zona;
              return (
                <h2 key={index} className={styles["column-title"]}>
                  {showZoneName ? colData.zone.nombre_zona : ""}
                </h2>
              );
            })}
          </div>
          <div className={styles["grid-container"]}>
            {columnsData.map(({ zone, areas: areasInColumn }, colIndex) => (
              <div className={styles["column-group"]} key={`${zone.id_zona}-${colIndex}`}>
                <div className={styles["button-column"]}>
                  {areasInColumn.map((area) => {
                    const fallaActiva = fallaPorArea[area.id_area];
                    return (
                      <button
                        key={area.id_area}
                        className={`${styles.button} ${
                          fallaActiva ? styles[`paro-${fallaActiva.id_paro}`] : ""
                        }`}
                        onClick={(e) => {
                          if (windowWidth < 768 && fallaActiva) {
                            manejarMobileClick(fallaActiva);
                          }
                        }}
                        onMouseEnter={
                          windowWidth >= 768
                            ? (e) => fallaActiva && manejarMouseEnterFalla(fallaActiva, e)
                            : undefined
                        }
                        onMouseLeave={windowWidth >= 768 ? manejarMouseLeave : undefined}
                      >
                        {area.nombre_area}
                        {fallaActiva && (
                          <div className={styles.cronometro}>
                            {formatearTiempo(cronometros[area.id_area])}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {windowWidth >= 768 && (
          <div className={styles["right-panel"]}>
            <img
              src="/Lauak_logo_encabezado.jpg"
              alt="Imagen"
              className={styles["right-panel-image"]}
            />
            <h2 className={styles["right-panel-title"]}>Prioridad</h2>
            <button
              className={`${styles["big-rectangle-button"]} ${
                fallaUrgencia && fallaUrgencia.id_paro ? styles[`paro-${fallaUrgencia.id_paro}`] : ""
              }`}
            >
              <div>{bigButtonLabel}</div>
              {bigButtonTimer && <div className={styles.cronometro}>{bigButtonTimer}</div>}
            </button>
            <p className={styles["right-panel-footer"]}>
              {descripcionUrgencia || "..."}
            </p>
            <div className={styles.clock}>
              <div className={styles.date}>{formatDate(currentDate)}</div>
              <div className={styles.time}>
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {windowWidth >= 768 && fallaSeleccionada && (
        <div className={styles["info-box"]} style={infoBoxStyle}>
          <p>
            <strong>Área:</strong> {getAreaName(fallaSeleccionada.id_area)}
          </p>
          <p>
            <strong>Tiempo transcurrido:</strong> {formatearTiempo(cronometros[fallaSeleccionada.id_area] || 0)}
          </p>
          <p>
            <strong>Tipo de Paro:</strong> {getParoDescription(fallaSeleccionada.id_paro)}
          </p>
          <p>
            <strong>Descripción:</strong>{" "}
            {fallaSeleccionada.falla_descripcion || "No disponible"}
          </p>
        </div>
      )}

      {windowWidth < 768 && fallaSeleccionada && (
        <div className={styles["info-box-mobile"]}>
          <p>
            <strong>Área:</strong> {getAreaName(fallaSeleccionada.id_area)}
          </p>
          <p>
            <strong>Tiempo transcurrido:</strong> {formatearTiempo(cronometros[fallaSeleccionada.id_area] || 0)}
          </p>
          <p>
            <strong>Tipo de Paro:</strong> {getParoDescription(fallaSeleccionada.id_paro)}
          </p>
          <p>
            <strong>Descripción:</strong> {fallaSeleccionada.falla_descripcion || "No disponible"}
          </p>
          <button
            onClick={() => setFallaSeleccionada(null)}
            className={styles["close-info-box"]}
          >
            Cerrar
          </button>
        </div>
      )}

      {windowWidth < 768 && showNotificationPanel && (
        <div className="notification-panel">
          <h2 className={styles["right-panel-title"]}>Prioridad</h2>
          <button
            className={`${styles["big-rectangle-button"]} ${
              fallaUrgencia && fallaUrgencia.id_paro ? styles[`paro-${fallaUrgencia.id_paro}`] : ""
            }`}
          >
            <div>{bigButtonLabel}</div>
            {bigButtonTimer && <div className={styles.cronometro}>{bigButtonTimer}</div>}
          </button>
          <p className={styles["right-panel-footer"]}>
            {descripcionUrgencia || "..."}
          </p>
          <div className={styles.clock}>
            <div className={styles.date}>{formatDate(currentDate)}</div>
            <div className={styles.time}>
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Panel;
