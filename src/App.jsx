import React from 'react';
import LandingPage from './pages/LandingPage';
import { ThemeProvider } from './context/ThemeContext';

const App = () => {
  return (
    <ThemeProvider>
      <LandingPage />
    </ThemeProvider>
  );
};

export default App;
