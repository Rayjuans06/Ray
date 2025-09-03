import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './UserManagementPage.module.css';
import { API_URL } from "./config";

const UserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ nombre: '', contraseña: '', id_cargo: '', numero_usuario: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [filterNombre, setFilterNombre] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterNumero, setFilterNumero] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ nombre: "", id: "", numero: "" });

  const [userForAlta, setUserForAlta] = useState(null);
  const [selectedCargo, setSelectedCargo] = useState("");

  const navigate = useNavigate();


  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const fetchUsers = () => {
    axios.get(`${API_URL}/usuarios`)
      .then(response => setUsers(response.data))
      .catch(() => setError('Hubo un problema al cargar los usuarios.'));
  };

  useEffect(() => {
    fetchUsers();

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
      .then(() => {
        fetchUsers();
        setNewUser({ nombre: '', contraseña: '', id_cargo: '', numero_usuario: '' });
        showNotification("Usuario agregado exitosamente.", "success");
      })
      .catch(() => setError('Error al agregar usuario.'));
  };

  const handleEditUser = () => {
    axios.put(`${API_URL}/usuarios/${editingUser.id_usuario}`, editingUser)
      .then(() => {
        fetchUsers();
        setEditingUser(null);
        showNotification("Usuario actualizado exitosamente.", "success");
      })
      .catch(() => {
        setError('Error al actualizar usuario.');
        showNotification("Error al actualizar usuario.", "error");
      });
  };

  const handleBaja = (user) => {
    axios.patch(`${API_URL}/usuarios/${user.id_usuario}/cargo`, { id_cargo: "17" })
      .then(() => {
        fetchUsers();
        showNotification("Se ha dado de baja al usuario.", "success");
      })
      .catch(() => {
        setError('Error al actualizar usuario.');
        showNotification("Error al dar de baja al usuario.", "error");
      });
  };

  const handleAlta = (user) => {
    setUserForAlta(user);
    setSelectedCargo(""); 
  };



  const handleGuardarAlta = () => {
    if (!selectedCargo) return;
    axios.patch(`${API_URL}/usuarios/${userForAlta.id_usuario}/cargo`, { id_cargo: selectedCargo })
      .then(() => {
        fetchUsers();
        setUserForAlta(null);
        showNotification("Usuario dado de alta exitosamente.", "success");
      })
      .catch(() => {
        setError('Error al actualizar usuario.');
        showNotification("Error al dar de alta al usuario.", "error");
      });
  };

  
  const filteredUsers = users.filter(user => {
    const matchesNombre = appliedFilters.nombre === "" || user.nombre.toLowerCase().includes(appliedFilters.nombre.toLowerCase());
    const matchesId = appliedFilters.id === "" || user.id_usuario.toString() === appliedFilters.id;
    const matchesNumero = appliedFilters.numero === "" || (user.numero_usuario && user.numero_usuario.toLowerCase().includes(appliedFilters.numero.toLowerCase()));
    return matchesNombre && matchesId && matchesNumero;
  });

  return (
    <div className={styles.userManagementContainer}>
      <header className={styles.userManagementHeader}>
        <img src="/icon/people.png" alt="Logo" className={styles.headerImage} />
        <h1>Gestión de Usuarios</h1>
      </header>

      {notification && (
        <div className={`${styles.floatingNotification} ${styles[notification.type]}`}>
          {notification.message}
        </div>
      )}

      {error && <div className={styles.errorMessage}><p>{error}</p></div>}

      <button
        className={styles.toggleFormButton}
        onClick={() => setFormVisible(!formVisible)}
      >
        {formVisible ? 'Ocultar Formulario' : 'Agregar Usuario'}
      </button>

      {formVisible && (
        <div className={styles.addUserForm}>
          <input
            type="text"
            name="nombre"
            placeholder="Nombre"
            value={newUser.nombre}
            onChange={handleInputChange}
          />
          <input
            type="password"
            name="contraseña"
            placeholder="Contraseña"
            value={newUser.contraseña}
            onChange={handleInputChange}
          />
          <select name="id_cargo" value={newUser.id_cargo} onChange={handleInputChange}>
            <option value="">Seleccione un cargo</option>
            {cargos.map(cargo => (
              <option key={cargo.id_cargo} value={cargo.id_cargo}>
                {cargo.nombre_cargo}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="numero_usuario"
            placeholder="Número de Usuario"
            value={newUser.numero_usuario}
            onChange={handleInputChange}
          />
          <button onClick={handleAddUser}>Agregar Usuario</button>
        </div>
      )}

      <div className={styles.filterSection}>
        <input
          type="text"
          placeholder="Filtrar por Nombre"
          value={filterNombre}
          onChange={e => setFilterNombre(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filtrar por ID"
          value={filterId}
          onChange={e => setFilterId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filtrar por Número de Usuario"
          value={filterNumero}
          onChange={e => setFilterNumero(e.target.value)}
        />
        <button onClick={() => setAppliedFilters({ nombre: filterNombre, id: filterId, numero: filterNumero })}>
          Filtrar
        </button>
        <button onClick={() => {
          setFilterNombre("");
          setFilterId("");
          setFilterNumero("");
          setAppliedFilters({ nombre: "", id: "", numero: "" });
        }}>
          Mostrar Todos
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.userTable}>
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
              <tr
                key={user.id_usuario}
                onClick={() => setSelectedUserId(user.id_usuario)}
                className={selectedUserId === user.id_usuario ? styles.selectedRow : ''}
              >
                <td>{user.id_usuario}</td>
                <td>{user.nombre}</td>
                <td>{user.contraseña}</td>
                <td>{user.cargo_nombre}</td>
                <td>{user.numero_usuario}</td>
                <td>
                  <button onClick={() => setEditingUser(user)}>Editar</button>
                  {String(user.id_cargo) === "17" ? (
                    <button onClick={() => handleAlta(user)}>Alta</button>
                  ) : (
                    <button onClick={() => handleBaja(user)}>Baja</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Editar Usuario</h3>
            <input
              type="text"
              name="nombre"
              value={editingUser.nombre}
              onChange={handleEditChange}
            />
            <input
              type="password"
              name="contraseña"
              value={editingUser.contraseña}
              onChange={handleEditChange}
            />
            <select name="id_cargo" value={editingUser.id_cargo} onChange={handleEditChange}>
              {cargos.map(cargo => (
                <option key={cargo.id_cargo} value={cargo.id_cargo}>
                  {cargo.nombre_cargo}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="numero_usuario"
              value={editingUser.numero_usuario}
              onChange={handleEditChange}
            />
            <button onClick={handleEditUser}>Guardar Cambios</button>
            <button onClick={() => setEditingUser(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {userForAlta && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Dar de Alta al Usuario</h3>
            <p>Seleccione un nuevo cargo:</p>
            <select value={selectedCargo} onChange={(e) => setSelectedCargo(e.target.value)}>
              <option value="">Seleccione un cargo</option>
              {cargos.map(cargo => (
                <option key={cargo.id_cargo} value={cargo.id_cargo}>
                  {cargo.nombre_cargo}
                </option>
              ))}
            </select>
            <button onClick={handleGuardarAlta}>Guardar Cambios</button>
            <button onClick={() => setUserForAlta(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
