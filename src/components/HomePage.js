import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleButtonClick = () => {
    navigate('/options');
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <img src="/Lauak_logo.jpg" alt="Logo" className="login-logo" />
        <button type="button" onClick={handleButtonClick}>Iniciar</button>
        <Link to="/login">Iniciar Sesión</Link>
      </div>
    </div>
  );
};

export default LoginPage;
