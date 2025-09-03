import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CronometroProvider } from "./components/CronometroContext";  // Ajuste: CronometroContext está en components
import { API_URL } from "./components/config"; // Importa tu URL de la API
import PrivateRoute from "./components/PrivateRoute";
import Navbar from "./components/Navbar";

import LoginPage from "./components/LoginPage";
import OptionsPage from "./components/OptionsPage";
import Soporte from "./components/Soporte";
import Repsop from "./components/report_sop";
import ThreeButtonsPage from "./components/ThreeButtonsPage";
import Panel from "./components/Panel";
import UserManagementPage from "./components/UserManagementPage";
import Reporte from "./components/Report";
import Consul from "./components/Consult";
import Consult_soporte from "./components/Consult_soporte";
import Menu1 from "./components/menu1";
import Intra from "./components/intra"; 



// Componente principal que monta las rutas y la barra de navegación
const App = () => {
  const location = useLocation();

  // Definir rutas donde ocultar la Navbar
  const hideNavbarPaths = ["/", "/login"];
  const showNavbar = !hideNavbarPaths.includes(location.pathname);

  return (
    <div>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/reportsop"
          element={
            <PrivateRoute>
              <Repsop />
            </PrivateRoute>
          }
        />
        <Route path="/OptionsPage" element={<OptionsPage />} />
        <Route path="/soporte" element={<PrivateRoute><Soporte /></PrivateRoute>} />
        <Route path="/consulta" element={<PrivateRoute><ThreeButtonsPage /></PrivateRoute>} />
        <Route path="/C_soporte" element={<PrivateRoute><Consult_soporte /></PrivateRoute>} />
        <Route path="/panel" element={<PrivateRoute><Panel /></PrivateRoute>} />
        <Route path="/userm" element={<PrivateRoute><UserManagementPage /></PrivateRoute>} />
        <Route path="/Report" element={<PrivateRoute><Reporte /></PrivateRoute>} />
        <Route path="/Consult" element={<PrivateRoute><Consul /></PrivateRoute>} />
        <Route path="/menu1" element={<PrivateRoute><Menu1 /></PrivateRoute>} /> 
        <Route path="/intra" element={<PrivateRoute><Intra /></PrivateRoute>} />

      </Routes>
    </div>
  );
};

// Wrapper que aplica Providers y Router
export default function AppWrapper() {
  return (
    <Router>
      <AuthProvider>
        {/* Proveedor de cronómetros, comparte el API_URL */}
        <CronometroProvider API_URL={API_URL}>
          <App />
        </CronometroProvider>
      </AuthProvider>
    </Router>
  );
}
