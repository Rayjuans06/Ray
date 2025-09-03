import { useCallback } from 'react';

export function useProductNbApi(baseUrl = '/api') {
  // Función para procesar todos los datos
  const processAll = useCallback(
    () => fetch(`${baseUrl}/process-all`, { method: 'POST' }),
    [baseUrl]
  );

  // Función para obtener los datos de productividad con parámetros opcionales
  const fetchProductNb = useCallback(
    async ({ limit = 50, offset = 0, startDate, endDate, id_CCenter } = {}) => {
      // Crear los parámetros para la consulta
      const params = new URLSearchParams({ limit, offset });
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (id_CCenter) params.append('id_CCenter', id_CCenter);
      
      // Construir la URL para la solicitud
      const url = `${baseUrl}/productnb?` + params.toString();
      
      // Mostrar la URL en la consola para depurar
      console.log('Fetching ProductNb data from:', url);

      try {
        // Realizar la solicitud
        const response = await fetch(url);
        
        // Verificar si la respuesta es exitosa
        if (!response.ok) {
          throw new Error('Error en la respuesta de la API');
        }

        // Parsear la respuesta JSON
        const data = await response.json();

        // Verificar que la respuesta sea un array
        if (Array.isArray(data)) {
          return data;
        } else {
          console.error('Error: La respuesta no es un array válido', data);
          return [];  // Retornar un array vacío si la respuesta no es válida
        }
      } catch (error) {
        // Manejar errores de red o cualquier otro error
        console.error('Error al obtener los datos de Productividad:', error);
        return [];  // Retornar un array vacío en caso de error
      }
    },
    [baseUrl]
  );

  return { processAll, fetchProductNb };
}
