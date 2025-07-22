import React from 'react';
import LandingPage from './pages/LandingPage';
import Footer from './components/Footer';
import { Analytics } from '@vercel/analytics/react'; 
import './index.css';


function App() {
  return (
    <>
      <LandingPage />
      <Footer />
      <Analytics />
    </>
  );
}

export default App;