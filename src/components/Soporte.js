import React from 'react';
import { Link } from 'react-router-dom';
import styles from './ThreeButtonsPage.module.css';

const ThreeButtonsPage = () => {
  const buttons = [
    { id: 1, name: 'Tiempo real', description: 'Estaciones en tiempo real', image: '/icon/time.png', link: '/panel' },
    { id: 4, name: 'Ver Reportes', description: 'Visualizar reportes activos', image: '/icon/Edit.png', link: '/reportsop' },
    { id: 5, name: 'Paro', description: 'Levantar un reporte', image: '/icon/paro.png', link: '/OptionsPage' },
    { id: 3, name: 'Consulta', description: 'Consultar información', image: '/icon/consult.png', link: '/C_soporte' },
  ];

  const handleButtonClick = (button) => {
    console.log(`Botón clickeado: ${button.name}`);
  };

  return (
    <div className={styles['three-buttons-container']}>
      <div className={styles['buttons-grid']}>
        {buttons.map(button =>
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
    </div>
  );
};

export default ThreeButtonsPage;
