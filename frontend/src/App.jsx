import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useApp } from "./state/AppContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AppShell from "./components/AppShell.jsx";
import SuperPage from "./pages/SuperPage.jsx";

export default function App() {
  const { ready, session, configReady, appConfig } = useApp();
  const location = useLocation();

  if (!configReady || !ready) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fff8ef" }}>
        <Box sx={{ textAlign: "center", color: "#a3949a" }}>
          <CircularProgress size={28} sx={{ color: "#ff9d7d" }} />
          <Typography sx={{ mt: 1.5, fontSize: 13, fontWeight: 700 }}>正在连接班级服务器…</Typography>
        </Box>
      </Box>
    );
  }

  if (location.pathname === "/super") {
    if (appConfig.mode === "local") return <Navigate to="/home" replace />;
    return <SuperPage />;
  }

  if (!session) return <LoginPage />;
  return <AppShell />;
}
