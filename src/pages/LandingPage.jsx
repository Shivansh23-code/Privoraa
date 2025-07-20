import React from 'react';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import MockupSection from '../components/MockupSection';
import WaitlistSection from '../components/WaitlistSection';
import Footer from '../components/Footer';

const LandingPage = () => {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <MockupSection />
        <WaitlistSection />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;
