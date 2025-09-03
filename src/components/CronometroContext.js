// CronometroContext.js
import React, { createContext, useState, useEffect } from 'react';

export const CronometroContext = createContext({});

/**
 * Este provider mantiene el objeto { [id_area]: segundosTranscurridos }
 * igualito a como lo calculas ahora en Panel.js, y lo expone.
 */
export const CronometroProvider = ({ children, API_URL }) => {
  const [fallasActivas, setFallasActivas] = useState([]);
  const [cronometros, setCronometros] = useState({});

  // 1) Polling de fallas activas (igual que en Panel.js)
  useEffect(() => {
    const fetchFallas = async () => {
      const resp = await fetch(`${API_URL}/fallas/activas`);
      setFallasActivas(await resp.json());
    };
    fetchFallas();
    const id = setInterval(fetchFallas, 5000);
    return () => clearInterval(id);
  }, [API_URL]);

  // 2) Calcular cada segundo el diff para cada falla
  useEffect(() => {
    const id = setInterval(() => {
      setCronometros(prev => {
        const next = { ...prev };
        const now = new Date();
        fallasActivas.forEach(f => {
          // parsea fecha + hora (mismo formato que tienes)
          const start = new Date(`${f.fecha_inicio.split('T')[0]}T${f.hora_inicio}`);
          let diff = Math.floor((now - start) / 1000);
          next[f.id_area] = diff < 0 ? 0 : diff;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [fallasActivas]);

  return (
    <CronometroContext.Provider value={cronometros}>
      {children}
    </CronometroContext.Provider>
  );
};
