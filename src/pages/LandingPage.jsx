// src/pages/LandingPage.jsx
import React from 'react';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import MockupSection from '../components/MockupSection';
import WaitlistSection from '../components/WaitlistSection';


const LandingPage = () => {
  return (
    <div>
      <Header />
      <HeroSection />
      <FeaturesSection />
      <MockupSection />
      <WaitlistSection />
    </div>
  );
};

export default LandingPage;
