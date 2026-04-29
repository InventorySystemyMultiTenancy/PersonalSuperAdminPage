import React, { useState } from "react";
import LoginPage from "./Pages/LoginPage.jsx";
import SuperAdminPage from "./Pages/SuperAdminPage.jsx";

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("superAdminToken") || "",
  );

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    setToken("");
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <SuperAdminPage token={token} onLogout={handleLogout} />;
}

export default App;
