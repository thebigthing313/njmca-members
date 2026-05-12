import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    background: {
      default: '#f6f8f4',
      paper: '#ffffff',
    },
    primary: {
      main: '#126e74',
      dark: '#0d5960',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#e0b44c',
      contrastText: '#172026',
    },
    text: {
      primary: '#172026',
      secondary: '#4f5f60',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Roboto, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h2: {
      fontSize: 'clamp(2rem, 8vw, 4rem)',
      fontWeight: 800,
      letterSpacing: 0,
      lineHeight: 1,
    },
    button: {
      fontWeight: 700,
      letterSpacing: 0,
      textTransform: 'none',
    },
    overline: {
      letterSpacing: 0,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 6,
        },
      },
    },
  },
});
