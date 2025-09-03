// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from "react";

// Crear el contexto de autenticación
export const AuthContext = createContext();

// Crear el proveedor para el contexto
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Nombre del usuario
  const [cargo, setCargo] = useState(null); // Cargo del usuario
  const [idUsuario, setIdUsuario] = useState(null); // id_usuario

  // Cargar los datos del usuario desde localStorage al iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem("nombre_usuario");
    const storedCargo = localStorage.getItem("cargo");
    const storedIdUsuario = localStorage.getItem("id_usuario"); // Cargar el id_usuario desde localStorage
    if (storedUser) setUser(storedUser);
    if (storedCargo) setCargo(storedCargo);
    if (storedIdUsuario) setIdUsuario(storedIdUsuario); // Establecer el id_usuario
  }, []);

  // Función de login que guarda nombre, cargo e id_usuario
  const login = (nombre, cargo, idUsuario) => {
    localStorage.setItem("nombre_usuario", nombre);
    localStorage.setItem("cargo", cargo);
    localStorage.setItem("id_usuario", idUsuario); // Guardar el id_usuario
    setUser(nombre);
    setCargo(cargo);
    setIdUsuario(idUsuario); // Establecer el id_usuario
  };

  // Función de logout que limpia todo
  const logout = () => {
    localStorage.removeItem("nombre_usuario");
    localStorage.removeItem("cargo");
    localStorage.removeItem("id_usuario");
    setUser(null);
    setCargo(null);
    setIdUsuario(null); // Limpiar el id_usuario
  };

  return (
    <AuthContext.Provider value={{ user, cargo, idUsuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
