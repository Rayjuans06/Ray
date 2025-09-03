require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const os = require('os');
const mysql = require('mysql2/promise');

const { importClipperOnce } = require('./syncExcelToMySQL'); 
const makeShiftAssigner = require('./services/shiftAssigner');
const processingRoutes = require('./routes/processing');


const app = express();
const PORT = process.env.PORT || 5000;

// Normaliza entradas como: 0.85 | 85 | "85%" | "0.85" -> devuelve fracción (0.85) o NaN
const toFraction = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') {
    if (v <= 1) return v;            // 0.85 -> 0.85
    if (v > 1 && v <= 100) return v / 100; // 85 -> 0.85
    return v; // valores raros >100 se dejan tal cual (no usual)
  }
  if (typeof v === 'string') {
    const cleaned = v.trim().replace('%', '').replace(',', '.');
    const n = Number(cleaned);
    if (Number.isFinite(n)) {
      if (n <= 1) return n;
      if (n > 1 && n <= 100) return n / 100;
      return n;
    }
  }
  return NaN;
};

// formatea como porcentaje legible (ej. 0.85 -> "85.00%") o '—' si no es válido
const fmtPctNormalized = (v) => {
  const f = toFraction(v);
  if (!Number.isFinite(f)) return '—';
  return `${(f * 100).toFixed(2)}%`;
};

// Devuelve la clase CSS según las reglas solicitadas
const pctColorClass = (v) => {
  const f = toFraction(v);
  if (!Number.isFinite(f)) return ''; // sin clase si no hay dato
  if (f >= 0.98) return styles.tuGreen;
  if (f >= 0.75 && f <= 0.97) return styles.tuYellow;
  if (f < 0.75) return styles.tuRed;
  return '';
};



// Middleware general
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json());
app.use('/imagenes', express.static(path.join(__dirname, '../public/imagenes')));

// Multer config para subir imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/imagenes'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Endpoint para subir imagen
app.post('/upload-image', upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha seleccionado ningún archivo.' });
  }

  const imagePath = `/imagenes/${req.file.filename}`;
  const insertImageQuery = "INSERT INTO imagenes (ruta) VALUES (?)";
  db.query(insertImageQuery, [imagePath], (err, result) => {
    if (err) {
      console.error('❌ Error guardando la imagen:', err);
      return res.status(500).json({ error: "Error al guardar la imagen." });
    }
    const imageId = result.insertId;
    res.status(200).json({ imageId, imagePath, filename: req.file.filename });
  });
});

// 1) Crear conexión MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'reportes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 👉 Función IP (una vez)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}


/*/ 3) Lanzar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
}); */



//---------------------------------------------------------------------------turno-------------------------------------------------------------



//--------------------------------------------------------------------------fin turno--------------------------------------------------------

function calculateTurno(hora) {
  const parts = hora.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const totalMinutes = hours * 60 + minutes;
  
  if (totalMinutes >= 420 && totalMinutes <= 1000) {
    return '1';
  } else if ((totalMinutes >= 1001 && totalMinutes <= 1439) || (totalMinutes >= 0 && totalMinutes <= 100)) {
    return '2';
  } else if (totalMinutes >= 101 && totalMinutes <= 419) {
    return '3';
  }
  return null;
}


app.get('/usuarios', (req, res) => {
  const query = `
    SELECT 
      u.id_usuario, 
      u.nombre, 
      u.contraseña, 
      u.id_cargo, 
      c.nombre_cargo AS cargo_nombre,  
      u.numero_usuario  
    FROM usuarios u
    LEFT JOIN cargo c ON u.id_cargo = c.id_cargo
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).send('Error fetching users');
    }
    res.json(results);
  });
});

app.post('/usuarios', async (req, res) => {
  const { nombre, contraseña, id_cargo, numero_usuario } = req.body;
  if (!nombre || !contraseña || !id_cargo || !numero_usuario) {
    return res.status(400).send('Todos los campos son obligatorios');
  }
  try {
    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const query = 'INSERT INTO usuarios (nombre, contraseña, id_cargo, numero_usuario) VALUES (?, ?, ?, ?)';
    db.query(query, [nombre, hashedPassword, id_cargo, numero_usuario], (err, result) => {
      if (err) {
        console.error('Error inserting user:', err);
        return res.status(500).send('Error inserting user');
      }
      res.status(201).json({ id_usuario: result.insertId, nombre, id_cargo, numero_usuario });
    });
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
});


app.put('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, contraseña, id_cargo, numero_usuario } = req.body;
  if (!nombre || !id_cargo || !numero_usuario) {
    return res.status(400).send('Todos los campos son obligatorios');
  }
  try {
    let query;
    let params;
    if (contraseña && !contraseña.startsWith('$2')) {
      const hashedPassword = await bcrypt.hash(contraseña, 10);
      query = 'UPDATE usuarios SET nombre = ?, contraseña = ?, id_cargo = ?, numero_usuario = ? WHERE id_usuario = ?';
      params = [nombre, hashedPassword, id_cargo, numero_usuario, id];
    } else {
      query = 'UPDATE usuarios SET nombre = ?, id_cargo = ?, numero_usuario = ? WHERE id_usuario = ?';
      params = [nombre, id_cargo, numero_usuario, id];
    }
    db.query(query, params, (err) => {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).send('Error updating user');
      }
      res.status(200).send('Usuario actualizado');
    });
  } catch (error) {
    res.status(500).send('Error en el servidor');
  }
});

app.patch('/usuarios/:id/cargo', (req, res) => {
  const { id } = req.params;
  const { id_cargo } = req.body;
  if (!id_cargo) {
    return res.status(400).send('El campo id_cargo es obligatorio');
  }
  const newCargo = Number(id_cargo);
  const query = 'UPDATE usuarios SET id_cargo = ? WHERE id_usuario = ?';
  db.query(query, [newCargo, id], (err, result) => {
    if (err) {
      console.error('Error updating cargo:', err);
      return res.status(500).send('Error updating cargo');
    }
    if (result.affectedRows === 0) {
      return res.status(404).send('Usuario no encontrado');
    }
    res.status(200).send('Cargo actualizado correctamente');
  });
});

app.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM usuarios WHERE id_usuario = ?';
  db.query(query, [id], (err) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).send('Error deleting user');
    }
    res.status(200).send('Usuario eliminado correctamente');
  });
});


app.get('/cargo', (req, res) => {
  const query = 'SELECT id_cargo, nombre_cargo FROM cargo';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching cargos:', err);
      return res.status(500).send('Error fetching cargos');
    }
    res.json(results);
  });
});


app.get('/api/areas', (req, res) => {
  const query = `
    SELECT 
      a.id_area, 
      a.nombre_area, 
      a.id_zona,
      z.nombre_zona,
      a.id_imagen,
      i.ruta AS imagen_area,
      a.id_status,
      s.status,
      a.Cost_center,
      a.id_apartado,
      ap.nombre_apartado
    FROM area a
    LEFT JOIN imagenes i ON a.id_imagen = i.id
    LEFT JOIN zona z ON a.id_zona = z.id_zona
    LEFT JOIN status s ON a.id_status = s.id_status
    LEFT JOIN apartado ap ON a.id_apartado = ap.id_apartado
    WHERE a.id_status = 4 AND a.id_apartado IN (1, 3)
    ORDER BY a.nombre_area
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('❌ Error obteniendo áreas (/api):', err);
      return res.status(500).send('Error obteniendo áreas.');
    }
    res.json(results);
  });
});




app.get('/zonas', (req, res) => {
  const query = 'SELECT id_zona, nombre_zona FROM zona';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching zonas:', err);
      return res.status(500).send('Error fetching zonas');
    }
    res.json(results);
  });
});


app.post('/areas/upload/:id', upload.single('imagen'), (req, res) => {
  const areaId = req.params.id;
  const imagePath = `/imagenes/${req.file.filename}`;
  const insertImageQuery = "INSERT INTO imagenes (ruta) VALUES (?)";
  db.query(insertImageQuery, [imagePath], (err, result) => {
    if (err) {
      console.error('❌ Error guardando la imagen:', err);
      return res.status(500).json({ error: "Error guardando la imagen" });
    }
    const imageId = result.insertId;
    const updateAreaQuery = "UPDATE area SET id_imagen = ? WHERE id_area = ?";
    db.query(updateAreaQuery, [imageId, areaId], (err) => {
      if (err) {
        console.error('❌ Error actualizando el área con la imagen:', err);
        return res.status(500).json({ error: "Error actualizando el área con la imagen" });
      }
      res.status(200).json({
        message: "✅ Imagen subida y asignada correctamente",
        imageId,
        imagePath
      });
    });
  });
});


app.get('/paro', (req, res) => {
  const query = 'SELECT id_paro, descripcion FROM paro';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching paro data:', err);
      return res.status(500).send('Error fetching paro data');
    }
    res.json(results);
  });
});


app.get('/urgencia', (req, res) => {
  const query = 'SELECT id_urgencia, nombre_urgencia FROM urgencia';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching urgencia data:', err);
      return res.status(500).send('Error fetching urgencia data');
    }
    res.json(results);
  });
});


app.post('/login', (req, res) => {
  const { nombre, contraseña } = req.body;
  if (!nombre || !contraseña) {
    return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
  }
  const query = `
    SELECT u.id_usuario, u.nombre, u.contraseña, u.id_cargo, c.nombre_cargo AS cargo 
    FROM usuarios u 
    LEFT JOIN cargo c ON u.id_cargo = c.id_cargo 
    WHERE u.nombre = ?
  `;
  db.query(query, [nombre], async (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }
    const user = results[0];
    const passwordMatch = await bcrypt.compare(contraseña, user.contraseña);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }
    res.json({ 
      success: true, 
      message: 'Login exitoso', 
      id_usuario: user.id_usuario,  
      cargo: user.cargo,  
      token: 'your_jwt_token_here'
    });
  });
});


app.post('/login/duplicate', (req, res) => {
  const { nombre, contraseña } = req.body;
  if (!nombre || !contraseña) {
    return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
  }
  const query = `
    SELECT u.id_usuario, u.nombre, u.contraseña, u.id_cargo, c.nombre_cargo AS cargo 
    FROM usuarios u 
    LEFT JOIN cargo c ON u.id_cargo = c.id_cargo 
    WHERE u.nombre = ?

  `;
  db.query(query, [nombre], async (err, results) => {
    if (err) {
      console.error('Error en la consulta:', err);
      return res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }
    const user = results[0];
    const passwordMatch = await bcrypt.compare(contraseña, user.contraseña);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }
    res.json({ 
      success: true, 
      message: 'Login exitoso', 
      id_usuario: user.id_usuario,  
      cargo: user.cargo,  
      token: 'your_jwt_token_here'
    });
  });
});


app.post("/falla", (req, res) => {
  const { id_usuario, descripcion, id_paro, hora_inicio, id_urgencia, id_area, id_status } = req.body;
  
  if (!id_usuario || !descripcion || !id_paro || !hora_inicio || !id_urgencia || !id_area || !id_status) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  const fecha_actual = new Date().toISOString().split("T")[0];

  const query = "INSERT INTO falla (id_usuario, descripcion, id_paro, id_urgencia, id_area, hora_inicio, fecha_inicio, id_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  db.query(query, [id_usuario, descripcion, id_paro, id_urgencia, id_area, hora_inicio, fecha_actual, id_status], (err, result) => {
    if (err) {
      console.error("❌ Error al insertar la falla:", err);
      return res.status(500).json({ error: "Error al insertar la falla" });
    }
    res.status(200).json({ message: "✅ Falla registrada correctamente", id_falla: result.insertId });
  });
});

app.get("/falla", (req, res) => {
  const query = `
    SELECT 
      f.id_falla,
      f.descripcion AS falla_descripcion,
      p.descripcion AS paro_descripcion,
      urg.nombre_urgencia,
      u.nombre AS usuario_nombre,
      a.nombre_area,
      f.hora_inicio,
      s.status AS status_nombre,
      f.id_paro,
      f.id_urgencia,
      f.id_usuario,
      f.id_area,
      f.id_status
    FROM falla f
    LEFT JOIN paro p ON f.id_paro = p.id_paro
    LEFT JOIN urgencia urg ON f.id_urgencia = urg.id_urgencia
    LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
    LEFT JOIN area a ON f.id_area = a.id_area AND a.id_status = 4 AND a.id_apartado IN (1, 3)
    LEFT JOIN status s ON f.id_status = s.id_status
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching fallas:", err);
      return res.status(500).send("Error fetching fallas.");
    }
    res.json(results);
  });
});

app.put("/falla/:id", (req, res) => {
  const { id } = req.params;
  const { id_usuario, descripcion, id_paro, id_urgencia, id_area, hora_inicio, id_status } = req.body;
  if (!id_usuario || !descripcion || !id_paro || !id_urgencia || !id_area || !hora_inicio || !id_status) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }
  const query = `
    UPDATE falla 
    SET id_usuario = ?, descripcion = ?, id_paro = ?, id_urgencia = ?, id_area = ?, hora_inicio = ?, id_status = ?
    WHERE id_falla = ?
  `;
  db.query(query, [id_usuario, descripcion, id_paro, id_urgencia, id_area, hora_inicio, id_status, id], (err, result) => {
    if (err) {
      console.error("Error updating falla:", err);
      return res.status(500).json({ error: "Error updating falla" });
    }
    res.status(200).json({ message: "Falla actualizada correctamente" });
  });
});

app.put('/falla/:id/status', (req, res) => {
  const { id } = req.params;
  const { id_status } = req.body;
  
  if (!id_status) {
    return res.status(400).json({ error: "El id_status es requerido." });
  }
  
  const query = 'UPDATE falla SET id_status = ? WHERE id_falla = ?';
  db.query(query, [id_status, id], (err, result) => {
    if (err) {
      console.error("Error al actualizar el status de la falla:", err);
      return res.status(500).json({ error: "Error al actualizar el status de la falla" });
    }
    res.status(200).json({ message: "Status de la falla actualizado correctamente" });
  });
});


app.post('/reporte', (req, res) => {
  const { 
    id_usuario, 
    id_usuario_solucionador, 
    id_area, 
    id_zona, 
    id_paro, 
    id_falla, 
    hora_fin,      // viene como "YYYY-MM-DD HH:MM:SS"
    tiempo_paro, 
    accion_correctiva, 
    hora_inicio,
    descripcion
  } = req.body;

  if (
    !id_usuario ||
    !id_usuario_solucionador ||
    !id_area ||
    !id_zona ||
    !id_paro ||
    !id_falla ||
    !hora_fin ||
    !tiempo_paro ||
    !hora_inicio ||
    !descripcion
  ) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

    // 1) Convertimos hora_fin en Date para trabajar con ella
  const [datePart, timePart] = hora_fin.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  const fechaHoraFin = new Date(year, month - 1, day, hour, minute, second);

  // 2) Función interna para formatear YYYY-MM-DD en local
  function formatoLocalYMD(date) {
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  // 3) Lógica para restar un día si es madrugada (00:00–06:59)
  let fecha;
  if (fechaHoraFin.getHours() < 7) {
    const anterior = new Date(fechaHoraFin);
    anterior.setDate(anterior.getDate() - 1);
    fecha = formatoLocalYMD(anterior);
  } else {
    fecha = formatoLocalYMD(fechaHoraFin);
  }

  /*
  let fecha;
  if ((fechaHoraFin.getHours() === 0 && fechaHoraFin.getMinutes() >= 1) || (fechaHoraFin.getHours() > 0 && fechaHoraFin.getHours() < 7)) {
    const fechaAnterior = new Date(fechaHoraFin);
    fechaAnterior.setDate(fechaAnterior.getDate() - 1);
    fecha = fechaAnterior.toISOString().split('T')[0];
  } else {
    fecha = fechaHoraFin.toISOString().split('T')[0];
  }
*/
   // 4) Calculamos turno como ya lo tenías
  const id_turno = calculateTurno(hora_inicio);

  // 5) Ahora sí armamos el INSERT, usando la variable `fecha`
  const query = `
    INSERT INTO reporte 
      (id_usuario, id_usuario_solucionador, id_area, id_zona, id_paro, id_falla,
       hora_fin, fecha, tiempo_paro, accion_correctiva, hora_inicio, descripcion, id_turno)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const values = [
    id_usuario, id_usuario_solucionador, id_area, id_zona, id_paro, id_falla,
    hora_fin,      // la fecha/hora completa
    fecha,         // la fecha ajustada (YYYY-MM-DD)
    tiempo_paro, accion_correctiva, hora_inicio, descripcion, id_turno
  ];


   db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error al insertar el reporte:', err);
      return res.status(500).json({ error: 'Error al insertar el reporte' });
    }
    res.status(201).json({ message: 'Reporte registrado exitosamente', id_reporte: result.insertId });
  });
});

app.get("/reportes", (req, res) => {
  let query = `
    SELECT 
      r.id_reporte, 
      r.id_usuario, 
      u.nombre AS usuario_nombre, 
      r.id_usuario_solucionador, 
      s.nombre AS soporte_nombre, 
      r.id_area,  
      a.nombre_area,  
      r.id_zona, 
      z.nombre_zona,
      r.id_paro,  
      p.descripcion AS tipo_paro,  
      r.id_falla, 
      r.hora_fin, 
      r.tiempo_paro, 
      r.accion_correctiva,
      r.descripcion AS descripcion,
      f.descripcion AS falla_descripcion,
      r.hora_inicio,
      r.fecha
    FROM reporte r
    LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
    LEFT JOIN usuarios s ON r.id_usuario_solucionador = s.id_usuario
    LEFT JOIN falla f ON r.id_falla = f.id_falla
    LEFT JOIN zona z ON r.id_zona = z.id_zona
    LEFT JOIN paro p ON r.id_paro = p.id_paro
    LEFT JOIN area a ON r.id_area = a.id_area AND a.id_status = 4 AND a.id_apartado IN (1, 3)
  `;
  const conditions = [];
  const params = [];

  if(req.query.id_reporte) {
    conditions.push("r.id_reporte = ?");
    params.push(req.query.id_reporte);
  }
  if(req.query.id_usuario) {
    conditions.push("r.id_usuario = ?");
    params.push(req.query.id_usuario);
  }
  if(req.query.id_area) {
    conditions.push("r.id_area = ?");
    params.push(req.query.id_area);
  }
  if(req.query.id_paro) {
    conditions.push("r.id_paro = ?");
    params.push(req.query.id_paro);
  }
  if(req.query.id_usuario_solucionador) {
    conditions.push("r.id_usuario_solucionador = ?");
    params.push(req.query.id_usuario_solucionador);
  }
  if(req.query.fecha) {
    conditions.push("r.fecha = ?");
    params.push(req.query.fecha);
  }
  if(req.query.hora_inicio) {
    conditions.push("r.hora_inicio = ?");
    params.push(req.query.hora_inicio);
  }
  if(req.query.tiempo_paro) {
    conditions.push("r.tiempo_paro LIKE ?");
    params.push("%" + req.query.tiempo_paro + "%");
  }

  if(conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ Error obteniendo reportes:", err);
      return res.status(500).send("Error obteniendo reportes.");
    }
    res.json(results);
  });
});

app.delete("/reportes/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM reporte WHERE id_reporte = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error al eliminar el reporte:", err);
      return res.status(500).json({ error: "Error al eliminar el reporte" });
    }
    res.status(200).json({ message: "Reporte eliminado exitosamente" });
  });
});

app.get("/fallas/activas", (req, res) => {
  const query = `
    SELECT f.id_falla, f.id_paro, f.id_area,
           TIME_FORMAT(f.hora_inicio, '%H:%i:%s') AS hora_inicio,
           f.fecha_inicio
    FROM falla f
    LEFT JOIN area a ON f.id_area = a.id_area
    WHERE f.id_status = 5
      AND a.id_status = 4
      AND a.id_apartado IN (1, 3)
  `;
  db.query(query, (err, results) => {
      if (err) {
          console.error("Error al obtener fallas activas:", err);
          return res.status(500).json({ error: "Error al obtener fallas activas" });
      }
      res.json(results);
  });
});


app.put('/reportes/:id', (req, res) => {
  const { id } = req.params;
  const {
    id_usuario,
    id_usuario_solucionador,
    id_area,
    id_paro,
    falla_descripcion,     
    hora_inicio,
    hora_fin,
    tiempo_paro,
    accion_correctiva
  } = req.body;

 
  if (
    !id_usuario ||
    !id_usuario_solucionador ||
    !id_area ||
    !id_paro ||
    falla_descripcion == null ||   
    !hora_inicio ||
    !hora_fin ||
    !tiempo_paro ||
    !accion_correctiva
  ) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }


  const id_turno = calculateTurno(hora_inicio);

  const query = `
    UPDATE reporte
    SET 
      id_usuario               = ?,
      id_usuario_solucionador  = ?,
      id_area                  = ?,
      id_paro                  = ?,
      hora_inicio              = ?,
      hora_fin                 = ?,
      tiempo_paro              = ?,
      accion_correctiva        = ?,
      descripcion              = ?,  -- aquí mapeamos falla_descripcion
      id_turno                 = ?
    WHERE id_reporte = ?
  `;

  const values = [
    id_usuario,
    id_usuario_solucionador,
    id_area,
    id_paro,
    hora_inicio,
    hora_fin,
    tiempo_paro,
    accion_correctiva,
    falla_descripcion,  
    id_turno,
    id
  ];

   db.query(query, values, (err) => {
    if (err) {
      console.error('❌ Error updating reporte:', err);
      return res.status(500).json({ error: 'Error al actualizar el reporte.' });
    }
    res.json({ message: 'Reporte actualizado correctamente' });
  });
});



/*app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
}); */


app.put('/api/reporte', (req, res) => {
  const { id_reporte, tiempo_paro } = req.body;
  if (!id_reporte || tiempo_paro == null) {
    return res.status(400).json({ error: 'Se requieren id_reporte y tiempo_paro.' });
  }
  const query = `
    UPDATE reporte
    SET tiempo_paro = ?
    WHERE id_reporte = ?
  `;
  db.query(query, [tiempo_paro, id_reporte], (err, result) => {
    if (err) {
      console.error('❌ Error actualizando tiempo_paro:', err);
      return res.status(500).json({ error: 'Error al actualizar tiempo_paro.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado.' });
    }
    res.json({ message: 'tiempo_paro actualizado correctamente' });
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});





app.delete('/areas/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM area WHERE id_area = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('❌ Error al borrar área:', err);
      return res.status(500).json({ error: 'Error interno al borrar área.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Área no encontrada.' });
    }
    res.json({ message: 'Área borrada correctamente' });
  });
});


app.put('/areas/:id', (req, res) => {
  const { id } = req.params;
  const { nombre_area, id_zona } = req.body;
  if (!nombre_area || !id_zona) {
    return res.status(400).json({ error: 'nombre_area e id_zona son obligatorios.' });
  }
  const query = 'UPDATE area SET nombre_area = ?, id_zona = ? WHERE id_area = ?';
  db.query(query, [nombre_area, id_zona, id], (err, result) => {
    if (err) {
      console.error('❌ Error al actualizar área:', err);
      return res.status(500).json({ error: 'Error interno al actualizar área.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Área no encontrada.' });
    }
   
    db.query(
      'SELECT id_area, nombre_area, id_zona FROM area WHERE id_area = ?',
      [id],
      (err2, rows) => {
        if (err2) {
          console.error('❌ Error al obtener área actualizada:', err2);
          return res.status(500).json({ error: 'Error al recuperar área actualizada.' });
        }
        res.json(rows[0]);
      }
    );
  });
});

app.post('/api/assign-shifts', (req, res) => {
  const { assignShifts } = makeShiftAssigner(db);
  assignShifts()
    .then(() => {
      console.log('ShiftAssigner: manual completada');
      res.status(200).json({ message: 'Asignación de turnos ejecutada' });
    })
    .catch(err => {
      console.error('ShiftAssigner error manual:', err);
      res.status(500).json({ error: 'Error al asignar turnos' });
    });
});





/*app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://${localIP}:${PORT}`);
});*/


/* app.listen(PORT, '0.0.0.0', () => {
  console.log(`    Servidor corriendo en http://${localIP}:${PORT}`);
}); */


app.post('/areas', (req, res) => {
  const { nombre_area, id_zona, id_imagen } = req.body;

  if (!nombre_area || !id_zona || !id_imagen) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const query = 'INSERT INTO area (nombre_area, id_zona, id_imagen) VALUES (?, ?, ?)';
  db.query(query, [nombre_area, id_zona, id_imagen], (err, result) => {
    if (err) {
      console.error("Error al insertar el área:", err);
      return res.status(500).json({ error: 'Error al insertar el área.' });
    }
    res.status(201).json({ 
      id_area: result.insertId, 
      nombre_area, 
      id_zona, 
      id_imagen 
    });
  });
});


app.post('/zonas', (req, res) => {
  const { nombre_zona } = req.body;
  if (!nombre_zona) {
    return res.status(400).json({ error: 'El nombre de la zona es obligatorio.' });
  }
  const query = 'INSERT INTO zona (nombre_zona) VALUES (?)';
  db.query(query, [nombre_zona], (err, result) => {
    if (err) {
      console.error('Error al insertar zona:', err);
      return res.status(500).json({ error: 'Error al insertar la zona.' });
    }
    res.status(201).json({ id_zona: result.insertId, nombre_zona });
  });
});


//----------------------------------Excel-------------------------------------

// Inicia la tarea de sincronización Excel → MySQL
// require('./syncExcelToMySQL');
// ***********************
// 1) Endpoint para Clipper (solo registros de 2025)
// ***********************
app.get('/api/clipper', (req, res) => {
  const query = `
    SELECT
      id,
      user_id,
      cost_center,
      clock_in,
      job,
      job_designation,
      drawing,
      \`rank\`,
      product_rank,
      rank_designation,
      phase,
      phase_designation,
      section,
      job_unit_price,
      customer,
      planned_machine_time,
      planned_hr_time,
      planned_setup_time,
      execution_time,
      forecast_rate,
      \`date\`,
      product_number,
      start_time,
      end_time,
      timeclocked
    FROM clipper
    WHERE YEAR(\`date\`) = 2025
    ORDER BY \`date\`
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener datos de Clipper' });
    res.json(results);
  });
});



// Este endpoint arranca la sincronización en background
// Endpoint para sincronizar Clipper y asignar turnos en cuanto termine:
// ***********************
// 2) Endpoint para sincronizar Clipper y asignar turnos
// ***********************
app.post('/api/sync-clipper', async (req, res) => {
  try {
    // 1) Importación masiva Excel → MySQL
    await importClipperOnce();
    console.log('✅ Sincronización Clipper completada');

    // 2) Asignación de turnos
    const { assignShifts } = makeShiftAssigner(db);
    await assignShifts();
    console.log('✅ Asignación de turnos completada');

    // 3) Respuesta al cliente
    res.status(200).json({ message: 'Sincronización y asignación de turnos completadas' });
  } catch (err) {
    console.error('❌ Error en sync-clipper:', err);
    res.status(500).json({ error: err.message });
  }
});

// =================================
// ***********************
// SCM plan – obtención de datos
// ***********************
app.get('/api/scm', (req, res) => {
  // Por defecto traemos sólo el año 2025, pero puedes pasar ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
  let query = `
    SELECT *
    FROM scm
    WHERE YEAR(fecha_scm) = ?
  `;
  const params = [ req.query.year || 2025 ];

  if (req.query.desde) {
    query += ' AND fecha_scm >= ?';
    params.push(req.query.desde);
  }
  if (req.query.hasta) {
    query += ' AND fecha_scm <= ?';
    params.push(req.query.hasta);
  }

  query += ' ORDER BY fecha_scm';

  db.query(query, params, (err, rows) => {
    if (err) {
      console.error('❌ Error fetching SCM:', err);
      return res.status(500).json({ error: 'Error al obtener datos SCM' });
    }
    res.json(rows);
  });
});

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------


//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// Inserta un nuevo registro en SCM, calculando campos compuestos automáticamente
app.post('/api/scm', (req, res) => {
  try {
    // 1) Obtenemos todos los datos del body (todos vienen como strings)
    const body = req.body;

    // 1.a) Helper para convertir a número
    const toNum = v => Number(v) || 0;

    // 2) Desglosamos cada campo relevante, convirtiéndolo
    const Cutting_scm       = toNum(body.Cutting_scm ?? body.CUTTING_scm);
    const Bending_scm       = toNum(body.Bending_scm);
    const AICON_scm         = toNum(body.AICON_scm);
    const MARTR_scm         = toNum(body.MARTR_scm);
    const VAPOR_scm         = toNum(body.VAPOR_scm);

    const Permas_scm        = toNum(body.Permas_scm);
    const Wiggins_scm       = toNum(body.Wiggins_scm);
    const Harrison_scm      = toNum(body.Harrison_scm);
    const Pressure_test_scm = toNum(body.Pressure_test_scm);
    const ABOC_scm          = toNum(body.ABOC_scm);
    const ABOC2_scm         = toNum(body.ABOC2_scm);
    const Reborde_scm       = toNum(body.Reborde_scm);
    const Manual_Bending_scm= toNum(body.Manual_Bending_scm);
    const SOLDA_scm         = toNum(body.SOLDA_scm);
    const HORNO_scm         = toNum(body.HORNO_scm);
    const AJUST_scm         = toNum(body.AJUST_scm);
    const EXPAN_scm         = toNum(body.EXPAN_scm);
    const SWAGE_scm         = toNum(body.SWAGE_scm);
    const ROLAD_scm         = toNum(body.ROLAD_scm);
    const TGS_scm           = toNum(body.TGS_scm);

    const MASK_scm          = toNum(body.MASK_scm);
    const Painting_scm      = toNum(body.Painting_scm);
    const DMASK_scm         = toNum(body.DMASK_scm);
    const Alodine_scm       = toNum(body.Alodine_scm);
    const Manual_Alodine_scm= toNum(body.Manual_Alodine_scm);

    const DI                = toNum(body.DI);
    const Packaging_scm     = toNum(body.Packaging_scm);
    const Rwk_scm           = toNum(body.Rwk_scm);

    const CTRLI_scm         = toNum(body.CTRLI_scm);
    const CTRFL_scm         = toNum(body.CTRFL_scm);
    const AAFAI_scm         = toNum(body.AAFAI_scm);
    const Kitting_scm       = toNum(body.Kitting_scm);

    // 3) Calculamos totales por zona (incluimos Cutting_scm en workzone_1)
    const workzone_1_scm    = Cutting_scm + Bending_scm + AICON_scm + MARTR_scm + VAPOR_scm;
    const workzone_2_scm    = Permas_scm + Wiggins_scm + Harrison_scm + Pressure_test_scm + ABOC_scm + ABOC2_scm + Reborde_scm + Manual_Bending_scm + SOLDA_scm + HORNO_scm + AJUST_scm + EXPAN_scm + SWAGE_scm + ROLAD_scm + TGS_scm;
    const workzone_3_scm    = MASK_scm + Painting_scm + DMASK_scm + Alodine_scm + Manual_Alodine_scm;
    const workzone_4_scm    = DI + Packaging_scm + Rwk_scm;
    const plant_level_scm   = CTRLI_scm + CTRFL_scm + AAFAI_scm + Kitting_scm;

    // 4) Preparamos el objeto final, preservando todas las columnas individuales más los totales
    const bodyWithComputed = {
      ...body,
      workzone_1_scm,
      workzone_2_scm,
      workzone_3_scm,
      workzone_4_scm,
      plant_level_scm,
    };

    // 5) Construimos dinámicamente el INSERT
    const fields       = Object.keys(bodyWithComputed);
    const values       = fields.map(f => bodyWithComputed[f]);
    const columnsSQL   = fields.map(f => `\`${f}\``).join(', ');
    const placeholders = fields.map(() => '?').join(', ');
    const sql          = `INSERT INTO scm (${columnsSQL}) VALUES (${placeholders})`;

    // 6) Ejecutamos el INSERT
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('❌ Error insert SCM:', err);
        return res.status(500).json({ error: 'Error al insertar SCM' });
      }
      res.status(201).json({ id_scm: result.insertId });
    });
  } catch (error) {
    console.error('❌ Error procesando request SCM:', error);
    res.status(500).json({ error: 'Error interno al preparar SCM' });
  }
});
//-------------------------------------------------------------------------------------------------------------------------------------------------------------

// ==============================
// scmproducty – lectura con JOIN a area
// ==============================
app.get('/api/scmproducty', (req, res) => {
  // Filtros opcionales y paginación
  let { limit = 500, offset = 0, date_from, date_to, id_area, cost_center } = req.query;
  limit = Number(limit) || 500;
  offset = Number(offset) || 0;

  const params = [];
  let where = '1=1';

  // Rango de fechas
  if (date_from) { where += ' AND sp.scm_fecha >= ?'; params.push(date_from); }
  if (date_to)   { where += ' AND sp.scm_fecha <= ?'; params.push(date_to); }

  // Filtro por id_area o por cost_center (nombre)
  if (id_area) {
    where += ' AND sp.id_area = ?';
    params.push(Number(id_area));
  }
  if (cost_center) {
    // Si tu collation te ha dado problemas en otras consultas, puedes forzar:
    // where += ' AND a.Cost_center COLLATE utf8mb4_general_ci = ?';
    where += ' AND a.Cost_center = ?';
    params.push(cost_center);
  }

  // Consulta principal
  const sql = `
    SELECT
      sp.scm_fecha,
      a.Cost_center AS area_name,       -- <- nombre en vez de id
      sp.scmN,
      sp.Sturnos,
      sp.Sturnos1,
      sp.Sturnos2,
      sp.Sturnos3,
      sp.producti,
      sp.producti1,
      sp.producti2,
      sp.producti3
    FROM scmproducty sp
    INNER JOIN area a ON a.id_area = sp.id_area
    WHERE ${where}
    ORDER BY sp.scm_fecha DESC, sp.id_scmProducty DESC
    LIMIT ? OFFSET ?;
  `;

  // (Opcional) Conteo total para paginación
  const countSql = `
    SELECT COUNT(*) AS total
    FROM scmproducty sp
    INNER JOIN area a ON a.id_area = sp.id_area
    WHERE ${where};
  `;

  // Ejecutamos el conteo primero (para enviar X-Total-Count)
  db.query(countSql, params, (err, countRows) => {
    if (err) {
      console.error('❌ Error count scmproducty:', err);
      return res.status(500).json({ error: err.sqlMessage || 'DB error (count)' });
    }

    const total = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;

    // Ejecutamos la consulta principal (agregando limit/offset al final)
    db.query(sql, [...params, limit, offset], (err2, rows) => {
      if (err2) {
        console.error('❌ Error query scmproducty:', err2);
        return res.status(500).json({ error: err2.sqlMessage || 'DB error' });
      }
      // Enviamos total en header para la paginación del frontend
      res.set('X-Total-Count', String(total));
      res.json(rows);
    });
  });
});

//____________________------------------------------------------------------------------

// ================================
// PRODUCTNB: listado con filtros
// ================================
app.get('/api/productnb', (req, res) => {
  const {
    limit = '50',
    offset = '0',
    id_area,
    date_from,
    date_to
  } = req.query;

  let where = '1=1';
  const params = [];

  if (id_area) {
    where += ' AND pn.id_area = ?';
    params.push(id_area);
  }
  if (date_from) {
    where += ' AND pn.date >= ?';
    params.push(date_from);
  }
  if (date_to) {
    where += ' AND pn.date <= ?';
    params.push(date_to);
  }

  const countSql = `SELECT COUNT(*) AS total
                    FROM productnb pn
                    WHERE ${where}`;

  const dataSql = `
    SELECT
      pn.Id_ProductNb,
      pn.date,
      pn.SumaTurno1,
      pn.SumaTurno2,
      pn.SumaTurno3,
      pn.SumaTurnos,
      pn.id_area,
      a.Cost_center,
      a.nombre_area
    FROM productnb pn
    LEFT JOIN area a ON a.id_area = pn.id_area
    WHERE ${where}
    ORDER BY pn.date DESC, pn.Id_ProductNb DESC
    LIMIT ? OFFSET ?
  `;

  // 1) total
  db.query(countSql, params, (err, countRows) => {
    if (err) {
      console.error('❌ Error contando productnb:', err);
      return res.status(500).json({ error: 'Error al contar productnb' });
    }
    const total = countRows[0]?.total || 0;

    // 2) datos paginados
    db.query(dataSql, [...params, Number(limit), Number(offset)], (err2, rows) => {
      if (err2) {
        console.error('❌ Error listando productnb:', err2);
        return res.status(500).json({ error: 'Error al listar productnb' });
      }
      res.set('X-Total-Count', String(total));
      res.json(rows);
    });
  });
});


//-------------------------------------------------------------------------------------------------------------------------------------------------------------

// En server.js, cerca del final, deja solo esto:


app.get('/api/clipper/filter', (req, res) => {
  const { cost_center, date, id_area } = req.query;
  if (!date || (!cost_center && !id_area)) {
    return res.status(400).json({ error: 'Faltan parámetros: date y (cost_center o id_area) son requeridos' });
  }

  let query;
  const params = [date];

  if (id_area) {
    // Filtrar por id_area (recomendado)
    query = `
      SELECT c.date, c.product_number, c.start_time, c.end_time, TIMEDIFF(c.end_time, c.start_time) AS TimeClocked,
             a.id_area, a.Cost_center, a.nombre_area
      FROM clipper c
      INNER JOIN area a ON a.Cost_center = c.cost_center
      WHERE a.id_area = ? AND c.date = ?
      ORDER BY c.start_time
    `;
    params.unshift(id_area); // params: [id_area, date]
  } else {
    // Filtrar por cost_center legacy
    query = `
      SELECT date, product_number, start_time, end_time, TIMEDIFF(end_time, start_time) AS TimeClocked
      FROM clipper
      WHERE cost_center = ? AND date = ?
      ORDER BY start_time
    `;
    params.unshift(cost_center); // params: [cost_center, date]
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Error al filtrar clipper:', err);
      return res.status(500).json({ error: 'Error al obtener los datos de Clipper' });
    }
    res.json(results);
  });
});



db.connect(err => {
  if (err) {
    console.error('❌ Error al conectar a la BD:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a la BD.');

  // Turnos automáticos
  const { assignShifts } = makeShiftAssigner(db);
  assignShifts().then(() => console.log('ShiftAssigner: inicial completada'))
                .catch(err => console.error('ShiftAssigner error inicial:', err));

  setInterval(() => {
    assignShifts().then(() => console.log('ShiftAssigner: periódica completada'))
                  .catch(err => console.error('ShiftAssigner error periódico:', err));
  }, 1000 * 60 * 60);

  // Endpoint manual + rutas /api
  app.post('/api/assign-shifts', (req, res) => {
    assignShifts()
      .then(() => res.json({ message: 'Asignación de turnos ejecutada' }))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  app.use('/api', processingRoutes(db));

  // 👇 ARRANCAR AQUÍ (y solo aquí)
  const localIP = getLocalIP();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://${localIP}:${PORT}`);
  });
});

// server.js (fragmento)
const makeTtcProcessingService = require('./services/ttc-processing-service');
const makeTtcRoutes = require('./routes/ttc-processing.routes');

// ... crea tu conexión db (mysql / mariadb) como siempre
const ttcService = makeTtcProcessingService(db);
app.use(makeTtcRoutes(ttcService));

//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// =====================
// TTC: Listado y filtros
// =====================
// arriba de la función
// GET /api/ttc
app.get('/api/ttc', (req, res) => {
  let {
    date_from, date_to,
    employee, area, cost_center,
    limit = '200', offset = '0',
    from: from_q, to: to_q
  } = req.query;

  // aceptar ambos nombres
  date_from = date_from || from_q;
  date_to   = date_to   || to_q;

  const params = [];
  let where = '1=1';

  if (date_from) { where += ' AND t.Date_TTC >= ?'; params.push(date_from); }
  if (date_to)   { where += ' AND t.Date_TTC <= ?'; params.push(date_to); }
  if (employee)  { where += ' AND t.Employee = ?'; params.push(employee); }
  
  // Filtro por área/cost_center se hace vía CLIPPER (join por Employee y fecha)
  let joinClip = '';
  if (area || cost_center) {
    joinClip = `
      INNER JOIN clipper c
        ON c.Employee = t.Employee
       AND c.date     = t.Date_TTC
    `;

    if (area) {
      where += ' AND c.id_area = ?';
      params.push(Number(area));
    }
    if (cost_center) {
      where += ' AND c.cost_center = ?';
      params.push(cost_center);
    }
  }

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ttc t
    ${joinClip}
    WHERE ${where}
  `;

 const dataSql = `
  SELECT
    t.Id_TTC,
    t.Employee,
    t.Employee_name,
    t.Date_TTC,
    t.identificacion_TTC,      -- <--- aquí
    t.shift_TTC1, t.shift_TTC2, t.shift_TTC3, t.TTG,
    t.TU_uti1, t.TU_uti2, t.TU_uti3,
    t.PU_uti1, t.PU_uti2, t.PU_uti3,
    t.ttc_NP,
    SEC_TO_TIME(t.shift_TTC1) AS shift1_hms,
    SEC_TO_TIME(t.shift_TTC2) AS shift2_hms,
    SEC_TO_TIME(t.shift_TTC3) AS shift3_hms,
    SEC_TO_TIME(t.TTG)        AS total_hms
  FROM ttc t
  ${joinClip}
  WHERE ${where}
  ORDER BY t.Date_TTC DESC, t.Employee ASC
  LIMIT ? OFFSET ?
`;


  db.query(countSql, params, (err, countRows) => {
    if (err) return res.status(500).json({ error: err.sqlMessage || 'DB error (count)' });
    const total = countRows?.[0]?.total || 0;

    db.query(dataSql, [...params, Number(limit), Number(offset)], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.sqlMessage || 'DB error' });
      res.set('X-Total-Count', String(total));
      res.json(rows);
    });
  });
});


// ==========================================
// TTC: Rebuild por rango desde CLIPPER (UPSERT)
// ==========================================
app.post('/api/ttc/rebuild', (req, res) => {
  const { date_from, date_to, id_area, cost_center } = req.body;
  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from y date_to son obligatorios (YYYY-MM-DD).' });
  }

  let where = 'c.`date` BETWEEN ? AND ?';
  const params = [date_from, date_to];
  if (id_area) { where += ' AND c.id_area = ?'; params.push(Number(id_area)); }
  if (cost_center) { where += ' AND c.cost_center = ?'; params.push(cost_center); }

  const upsertSql = `
    INSERT INTO ttc (Employee, Employee_name, Date_TTC, shift_TTC1, shift_TTC2, shift_TTC3, TTG)
    SELECT 
      c.Employee,
      COALESCE(c.Employee_name, c.Employee) AS Employee_name,
      c.\`date\`                              AS Date_TTC,
      SUM(CASE WHEN c.shift_id = 1 THEN TIME_TO_SEC(c.TimeClocked) ELSE 0 END) AS shift_TTC1,
      SUM(CASE WHEN c.shift_id = 2 THEN TIME_TO_SEC(c.TimeClocked) ELSE 0 END) AS shift_TTC2,
      SUM(CASE WHEN c.shift_id = 3 THEN TIME_TO_SEC(c.TimeClocked) ELSE 0 END) AS shift_TTC3,
      SUM(TIME_TO_SEC(c.TimeClocked)) AS TTG
    FROM clipper c
    WHERE ${where}
    GROUP BY c.Employee, COALESCE(c.Employee_name, c.Employee), c.\`date\`
    ON DUPLICATE KEY UPDATE
      shift_TTC1 = VALUES(shift_TTC1),
      shift_TTC2 = VALUES(shift_TTC2),
      shift_TTC3 = VALUES(shift_TTC3),
      TTG        = VALUES(TTG)
  `;

  db.query(upsertSql, params, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage || 'DB error (rebuild)' });

    // Recalculo TU/PU
    let recalcSql = `
      UPDATE ttc
      SET
        TU_uti1 = CASE WHEN shift_TTC1 > 0 THEN shift_TTC1 / NULLIF(TTG,0) ELSE NULL END,
        TU_uti2 = CASE WHEN shift_TTC2 > 0 THEN shift_TTC2 / NULLIF(TTG,0) ELSE NULL END,
        TU_uti3 = CASE WHEN shift_TTC3 > 0 THEN shift_TTC3 / NULLIF(TTG,0) ELSE NULL END,
        PU_uti1 = CASE WHEN shift_TTC1 > 0 THEN shift_TTC1 / NULLIF(TTG,0) ELSE NULL END,
        PU_uti2 = CASE WHEN shift_TTC2 > 0 THEN shift_TTC2 / NULLIF(TTG,0) ELSE NULL END,
        PU_uti3 = CASE WHEN shift_TTC3 > 0 THEN shift_TTC3 / NULLIF(TTG,0) ELSE NULL END
      WHERE Date_TTC BETWEEN ? AND ?
    `;
    const recalcParams = [date_from, date_to];
    if (id_area) { recalcSql += ' AND id_area = ?'; recalcParams.push(Number(id_area)); }
    if (cost_center) { recalcSql += ' AND cost_center = ?'; recalcParams.push(cost_center); }

    db.query(recalcSql, recalcParams, (err2) => {
      if (err2) console.error('Error recalculando TU/PU:', err2.sqlMessage);
      res.json({ message: 'TTC regenerado y TU/PU recalculados', affected: result.affectedRows });
    });
  });


// ========================
// TTC: CRUD directo (opcional)
// ========================
app.post('/api/ttc', (req, res) => {
  const { Employee, Employee_name, Date_TTC, shift_TTC1 = 0, shift_TTC2 = 0, shift_TTC3 = 0 } = req.body;
  if (!Employee || !Employee_name || !Date_TTC) {
    return res.status(400).json({ error: 'Employee, Employee_name y Date_TTC son obligatorios.' });
  }
  const TTG = Number(shift_TTC1) + Number(shift_TTC2) + Number(shift_TTC3);
  const sql = `
    INSERT INTO ttc (Employee, Employee_name, Date_TTC, shift_TTC1, shift_TTC2, shift_TTC3, TTG)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      Employee_name = VALUES(Employee_name),
      shift_TTC1    = VALUES(shift_TTC1),
      shift_TTC2    = VALUES(shift_TTC2),
      shift_TTC3    = VALUES(shift_TTC3),
      TTG           = VALUES(TTG)
  `;
  db.query(sql, [Employee, Employee_name, Date_TTC, shift_TTC1, shift_TTC2, shift_TTC3, TTG], (err, r) => {
    if (err) return res.status(500).json({ error: err.sqlMessage || 'DB error (insert ttc)' });
    res.status(201).json({ message: 'TTC guardado', upserted: true });
  });
});

app.put('/api/ttc/:id', (req, res) => {
  const { id } = req.params;
  const { shift_TTC1 = 0, shift_TTC2 = 0, shift_TTC3 = 0 } = req.body;
  const TTG = Number(shift_TTC1) + Number(shift_TTC2) + Number(shift_TTC3);
  const sql = `
    UPDATE ttc
    SET shift_TTC1 = ?, shift_TTC2 = ?, shift_TTC3 = ?, TTG = ?
    WHERE Id_TTC = ?
  `;
  db.query(sql, [shift_TTC1, shift_TTC2, shift_TTC3, TTG, id], (err, r) => {
    if (err) return res.status(500).json({ error: err.sqlMessage || 'DB error (update ttc)' });
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'TTC actualizado' });
  });
});

app.delete('/api/ttc/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM ttc WHERE Id_TTC = ?', [id], (err, r) => {
    if (err) return res.status(500).json({ error: err.sqlMessage || 'DB error (delete ttc)' });
    if (r.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ message: 'TTC eliminado' });
  });
});
});

// ==========================================
// TTC: Rebuild por rango desde CLIPPER (UPSERT + recalculo TU/PU)
// ==========================================
app.post('/api/ttc/rebuild', (req, res) => {
  const { date_from, date_to, id_area, cost_center } = req.body;

  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from y date_to son obligatorios (YYYY-MM-DD).' });
  }

  // Condiciones WHERE
  let where = 'c.`date` BETWEEN ? AND ?';
  const params = [date_from, date_to];

  if (id_area) {
    where += ' AND c.id_area = ?';
    params.push(Number(id_area));
  }
  if (cost_center) {
    where += ' AND c.cost_center = ?';
    params.push(cost_center);
  }

  // UPSERT de TTC desde clipper
  const upsertSql = `
    INSERT INTO ttc (
      Employee, Employee_name, Date_TTC,
      shift_TTC1, shift_TTC2, shift_TTC3, TTG
    )
    SELECT 
      c.Employee,
      COALESCE(c.Employee_name, c.Employee) AS Employee_name,
      c.\`date\`                              AS Date_TTC,
      SUM(CASE WHEN c.shift_id = 1 THEN TIME_TO_SEC(c.TimeClocked) ELSE 0 END) AS shift_TTC1,
      SUM(CASE WHEN c.shift_id = 2 THEN TIME_TO_SEC(c.TimeClocked) ELSE 0 END) AS shift_TTC2,
      SUM(CASE WHEN c.shift_id = 3 THEN TIME_TO_SEC(c.TimeClocked) ELSE 0 END) AS shift_TTC3,
      SUM(TIME_TO_SEC(c.TimeClocked)) AS TTG
    FROM clipper c
    WHERE ${where}
    GROUP BY c.Employee, COALESCE(c.Employee_name, c.Employee), c.\`date\`
    ON DUPLICATE KEY UPDATE
      shift_TTC1 = VALUES(shift_TTC1),
      shift_TTC2 = VALUES(shift_TTC2),
      shift_TTC3 = VALUES(shift_TTC3),
      TTG        = VALUES(TTG)
  `;

  db.query(upsertSql, params, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage || 'DB error (rebuild)' });

    // Recalcular TU_uti1/2/3 y PU_uti1/2/3
    let recalcSql = `
      UPDATE ttc
      SET
        TU_uti1 = CASE WHEN shift_TTC1 > 0 THEN shift_TTC1 / NULLIF(TTG,0) ELSE NULL END,
        TU_uti2 = CASE WHEN shift_TTC2 > 0 THEN shift_TTC2 / NULLIF(TTG,0) ELSE NULL END,
        TU_uti3 = CASE WHEN shift_TTC3 > 0 THEN shift_TTC3 / NULLIF(TTG,0) ELSE NULL END,
        PU_uti1 = CASE WHEN shift_TTC1 > 0 THEN shift_TTC1 / NULLIF(TTG,0) ELSE NULL END,
        PU_uti2 = CASE WHEN shift_TTC2 > 0 THEN shift_TTC2 / NULLIF(TTG,0) ELSE NULL END,
        PU_uti3 = CASE WHEN shift_TTC3 > 0 THEN shift_TTC3 / NULLIF(TTG,0) ELSE NULL END
      WHERE Date_TTC BETWEEN ? AND ?
    `;
    const recalcParams = [date_from, date_to];

    if (id_area) {
      recalcSql += ' AND id_area = ?';
      recalcParams.push(Number(id_area));
    }
    if (cost_center) {
      recalcSql += ' AND cost_center = ?';
      recalcParams.push(cost_center);
    }

    db.query(recalcSql, recalcParams, (err2) => {
      if (err2) console.error('Error recalculando TU/PU:', err2.sqlMessage);

      res.json({
        message: 'TTC regenerado y TU/PU recalculados',
        affected: result.affectedRows
      });
    });
  });
});
