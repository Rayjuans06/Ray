import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import styles from "./LoginPage.module.css"; 
import { API_URL } from "./config";

const LoginPage = () => {
  const [nombre, setNombre] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nombre || !contraseña) {
      setError("Por favor, complete todos los campos");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/login`, {
        nombre,
        contraseña,
      });

      if (response.data.success) {
        login(nombre, response.data.cargo, response.data.id_usuario);
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("cargo", response.data.cargo);
        localStorage.setItem("id_usuario", response.data.id_usuario);

        const cargo = response.data.cargo;

        if (cargo === "Administrador") {
          navigate("/consulta");
        } else if (cargo === "Operador") {
          navigate("/OptionsPage");
        } else if (
          ["Almacen", "Calidad", "Mantenimiento", "Metodos"].includes(cargo) ||
          cargo === "Supervisor"
        ) {
          navigate("/soporte");
        }
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError("Error en el servidor. Intente de nuevo.");
    }
  };

  return (
    <div
      className={styles.container}
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/fondo.jpg)`,
        backgroundSize: "cover",
      }}
    >
      <div className={styles.loginBox}>
        <div className={styles.imageContainer}>
          <img
            src={`${process.env.PUBLIC_URL}/Lauak_logo.jpg`}
            alt="Logo"
            className={styles.loginLogo}
          />
        </div>

        <h1 className={styles.title}>Iniciar Sesión</h1>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Nombre de usuario:</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingrese su usuario"
              required
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Contraseña:</label>
            <input
              type="password"
              value={contraseña}
              onChange={(e) => setContraseña(e.target.value)}
              placeholder="Ingrese su contraseña"
              required
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.loginButton}>
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
