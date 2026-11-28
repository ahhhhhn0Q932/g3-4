import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#ff9d7d", contrastText: "#ffffff" },
    secondary: { main: "#ffcf6b", contrastText: "#5d4a35" },
    background: { default: "#fff8ef", paper: "#fffdfa" },
    text: { primary: "#4f3a35", secondary: "#75666d" },
    divider: "#f0e2d6",
    success: { main: "#1f9d7d" },
    warning: { main: "#9c6a12" },
    error: { main: "#d9697a" }
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"PingFang SC","Microsoft YaHei",system-ui,-apple-system,"Segoe UI",sans-serif',
    button: { textTransform: "none", fontWeight: 800 },
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 800 }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: { root: { fontFamily: "inherit" } }
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: "inherit",
          "& input::placeholder, & textarea::placeholder": { color: "#887870", opacity: 1 }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#fffdfa",
          borderRadius: 11
        },
        notchedOutline: { borderColor: "#ecd9cd" }
      }
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 12, fontWeight: 600 } }
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 22, backgroundImage: "none" } }
    }
  }
});
