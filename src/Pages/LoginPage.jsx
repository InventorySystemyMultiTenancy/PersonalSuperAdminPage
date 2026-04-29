import React, { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_SUPERADMIN_API_URL || "http://localhost:3001";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || "Credenciais invalidas");
      }

      const token = data.token || data.accessToken;
      if (!token) {
        throw new Error("Token nao retornado pelo servidor");
      }

      if (data.user?.role !== "SUPER_ADMIN") {
        throw new Error("Acesso restrito a Super Admins");
      }

      localStorage.setItem("superAdminToken", token);
      onLogin(token, data.user);
    } catch (err) {
      setError(err.message || "Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--sm-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "var(--sm-surface)",
          border: "1px solid var(--sm-border)",
          borderRadius: "1rem",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              background: "var(--sm-accent)",
              borderRadius: "14px",
              marginBottom: "1rem",
              fontSize: "1.25rem",
              fontWeight: "800",
              color: "#0f0f0f",
              letterSpacing: "-0.04em",
            }}
          >
            SM
          </div>
          <p
            style={{
              fontSize: "1.4rem",
              fontWeight: "700",
              color: "var(--sm-text)",
              letterSpacing: "-0.03em",
            }}
          >
            SelfMachine
          </p>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--sm-muted)",
              marginTop: "0.25rem",
            }}
          >
            Super Admin Control Center
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: "600",
                color: "var(--sm-muted)",
                marginBottom: "0.4rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@selfmachine.com"
              style={{
                width: "100%",
                background: "var(--sm-card)",
                border: "1px solid var(--sm-border)",
                borderRadius: "0.5rem",
                padding: "0.65rem 0.9rem",
                color: "var(--sm-text)",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: "600",
                color: "var(--sm-muted)",
                marginBottom: "0.4rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                background: "var(--sm-card)",
                border: "1px solid var(--sm-border)",
                borderRadius: "0.5rem",
                padding: "0.65rem 0.9rem",
                color: "var(--sm-text)",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error ? (
            <div
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: "0.5rem",
                padding: "0.65rem 0.9rem",
                marginBottom: "1rem",
                color: "#f87171",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "rgba(255,174,56,0.5)" : "var(--sm-accent)",
              color: "#0f0f0f",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.9rem",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            fontSize: "0.75rem",
            color: "var(--sm-muted)",
          }}
        >
          Acesso restrito a administradores SelfMachine
        </p>
      </div>
    </div>
  );
}
