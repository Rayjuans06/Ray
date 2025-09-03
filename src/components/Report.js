import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; 
import './Report.css';
import { API_URL } from "./config";

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ nombre: '', contraseña: '', id_cargo: '', numero_usuario: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [formVisible, setFormVisible] = useState(false);

  const [nombreFilter, setNombreFilter] = useState('');
  const [cargoFilter, setCargoFilter] = useState('');
  const [numeroUsuarioFilter, setNumeroUsuarioFilter] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_URL}/usuarios`)
      .then(response => setUsers(response.data))
      .catch(() => setError('Hubo un problema al cargar los usuarios. Verifica que el servidor esté en ejecución.'));

    axios.get(`${API_URL}/cargo`)
      .then(response => setCargos(response.data))
      .catch(() => setError('Hubo un problema al cargar los cargos.'));
  }, []);

  const handleInputChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditingUser({ ...editingUser, [e.target.name]: e.target.value });
  };

  const handleAddUser = () => {
    axios.post(`${API_URL}/usuarios`, newUser)
      .then(response => {
        setUsers([...users, response.data]);
        setNewUser({ nombre: '', contraseña: '', id_cargo: '', numero_usuario: '' });
      })
      .catch(() => setError('Error al agregar usuario. Verifica que el servidor esté funcionando correctamente.'));
  };

  const handleEditUser = () => {
    axios.put(`${API_URL}/usuarios/${editingUser.id_usuario}`, editingUser)
      .then(() => {
        setUsers(users.map(user => (user.id_usuario === editingUser.id_usuario ? editingUser : user)));
        setEditingUser(null);
      })
      .catch(() => setError('Error al actualizar usuario.'));
  };

  const handleLogout = () => {
    navigate('/consulta'); 
  };

  const filteredUsers = users.filter(user => {
    return (
      (nombreFilter ? user.nombre.toLowerCase().includes(nombreFilter.toLowerCase()) : true) &&
      (cargoFilter ? user.cargo_nombre === cargoFilter : true) &&
      (numeroUsuarioFilter ? user.numero_usuario === numeroUsuarioFilter : true)
    );
  });

  const handleShowAllUsers = () => {
    setNombreFilter('');
    setCargoFilter('');
    setNumeroUsuarioFilter('');
  };

  return (
    <div className="user-management-container">
      <header className="user-management-header">
        <img src="/icon/Edit.png" alt="Logo" className="header-image" />
        <h1>Editar reportes</h1>
        <button className="logout-button" onClick={handleLogout}>Salir</button>
      </header>

      {error && <div className="error-message"><p>{error}</p></div>}

      <button className="toggle-form-button" onClick={() => setFormVisible(!formVisible)}>
        {formVisible ? 'Ocultar Formulario' : 'Agregar Usuario'}
      </button>

      {formVisible && (
        <div className="add-user-form">
          <input type="text" name="nombre" placeholder="Nombre" value={newUser.nombre} onChange={handleInputChange} />
          <input type="password" name="contraseña" placeholder="Contraseña" value={newUser.contraseña} onChange={handleInputChange} />
          <select name="id_cargo" value={newUser.id_cargo} onChange={handleInputChange}>
            <option value="">Seleccione un cargo</option>
            {cargos.map(cargo => <option key={`cargo-${cargo.id_cargo}`} value={cargo.id_cargo}>{cargo.nombre_cargo}</option>)}
          </select>
          <input type="text" name="numero_usuario" placeholder="Número de Usuario" value={newUser.numero_usuario} onChange={handleInputChange} />
          <button onClick={handleAddUser}>Agregar Usuario</button>
        </div>
      )}

      <div className="filters">
        <h3>Filtrar Usuarios</h3>
        <input
          type="text"
          placeholder="Filtrar por nombre"
          value={nombreFilter}
          onChange={e => setNombreFilter(e.target.value)}
        />
        <select value={cargoFilter} onChange={e => setCargoFilter(e.target.value)}>
          <option value="">Filtrar por cargo</option>
          {cargos.map(cargo => <option key={cargo.id_cargo} value={cargo.nombre_cargo}>{cargo.nombre_cargo}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filtrar por número de usuario"
          value={numeroUsuarioFilter}
          onChange={e => setNumeroUsuarioFilter(e.target.value)}
        />
        <button onClick={handleShowAllUsers}>Mostrar Todos</button>
      </div>

      <table className="user-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Contraseña</th>
            <th>Cargo</th>
            <th>Número de Usuario</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map(user => (
            <tr key={`user-${user.id_usuario}`}>
              <td>{user.id_usuario}</td>
              <td>{user.nombre}</td>
              <td>{user.contraseña}</td>
              <td>{user.cargo_nombre}</td>
              <td>{user.numero_usuario}</td>
              <td>
                <button onClick={() => setEditingUser(user)}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingUser && (
        <div className="edit-user-form">
          <h3>Editar Usuario</h3>
          <input type="text" name="nombre" value={editingUser.nombre} onChange={handleEditChange} />
          <input type="password" name="contraseña" value={editingUser.contraseña} onChange={handleEditChange} />
          <select name="id_cargo" value={editingUser.id_cargo} onChange={handleEditChange}>
            {cargos.map(cargo => <option key={`cargo-${cargo.id_cargo}`} value={cargo.id_cargo}>{cargo.nombre_cargo}</option>)}
          </select>
          <input type="text" name="numero_usuario" value={editingUser.numero_usuario} onChange={handleEditChange} />
          <button onClick={handleEditUser}>Guardar Cambios</button>
          <button onClick={() => setEditingUser(null)}>Cancelar</button>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
