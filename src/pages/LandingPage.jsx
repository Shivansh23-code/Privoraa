// src/pages/LandingPage.jsx
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import ShowcaseSection from '../components/ShowcaseSection';
import FeaturesSection from '../components/FeaturesSection';
import Footer from '../components/Footer';
import FaqSection from '../components/FaqSection';

const LandingPage = () => {
  const pageStyles = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%'
  };

  return (
    <div style={pageStyles}>
      <Header />
      <main style={{width: '100%'}}>
        <HeroSection />
        <ShowcaseSection />
        <FeaturesSection />
      </main>
      <FaqSection />
      <Footer />
    </div>
  );
};

export default LandingPage;