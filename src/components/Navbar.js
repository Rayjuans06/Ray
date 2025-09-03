import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import styles from "./Navbar.module.css"; 

const Navbar = () => {
  const { user, cargo, idUsuario, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const getNavButtons = () => {
    if (cargo === "Administrador") {
      return (
        <>
          <button onClick={() => navigate("/userm")}>Usuarios</button>
          <button onClick={() => navigate("/reportsop")}>Reportes</button>
          <button onClick={() => navigate("/consult")}>Consultar</button>
          <button onClick={() => navigate("/panel")}>Panel</button>
          <button onClick={() => navigate("/consulta")}>Consulta</button>
        </>
      );
    } else if (
      ["Almacen", "Calidad", "Mantenimiento", "Metodos", "Supervisor"].includes(cargo)
    ) {
      return (
        <>
          <button onClick={() => navigate("/soporte")}>Soporte</button>
          <button onClick={() => navigate("/panel")}>Panel</button>
          <button onClick={() => navigate("/reportsop")}>Reportes Soporte</button>
        </>
      );
    }
    return null;
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles["logo-container"]}>
        <img src="/Lauak_logo.jpg" alt="Logo" className={styles.logo} />
      </div>

      <div className={styles["user-info"]}>
        {user && (
          <button className={styles["dropdown-btn"]} onClick={toggleDropdown}>
            {`Bienvenido, ${user}`}
            <i className={`${styles.arrow} ${isDropdownOpen ? styles.up : styles.down}`} />
          </button>
        )}

        {isDropdownOpen && (
          <ul className={styles["dropdown-menu"]}>
            {cargo && <li>Cargo: {cargo}</li>}
            {idUsuario && <li>ID de usuario: {idUsuario}</li>}

            <div className={styles["dropdown-buttons"]}>
              {getNavButtons()}
            </div>

            <li>
              <button onClick={handleLogout} className={styles["logout-btn"]}>
                Cerrar sesión
              </button>
            </li>
          </ul>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
