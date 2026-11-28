import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { CssBaseline, StyledEngineProvider, ThemeProvider } from "@mui/material";
import { AppProvider } from "./state/AppContext.jsx";
import { muiTheme } from "./theme.js";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <HashRouter>
          <AppProvider>
            <App />
          </AppProvider>
        </HashRouter>
      </ThemeProvider>
    </StyledEngineProvider>
  </React.StrictMode>
);
