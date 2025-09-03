import { useContext } from "react";
import { CronometroContext } from "./CronometroContext";

const CronometroDisplay = () => {
  const { tiempoTranscurrido } = useContext(CronometroContext);

  const horas = Math.floor(tiempoTranscurrido / 3600);
  const minutos = Math.floor((tiempoTranscurrido % 3600) / 60);
  const segundos = tiempoTranscurrido % 60;

  return (
    <div className="cronometro-display">
      <h3>Tiempo transcurrido</h3>
      <p>
        {horas.toString().padStart(2, "0")}:
        {minutos.toString().padStart(2, "0")}:
        {segundos.toString().padStart(2, "0")}
      </p>
    </div>
  );
};

export default CronometroDisplay;
