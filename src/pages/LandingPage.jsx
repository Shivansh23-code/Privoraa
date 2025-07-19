// src/pages/LandingPage.jsx

// --- Core Components ---
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import ShowcaseSection from '../components/ShowcaseSection';
import FeaturesSection from '../components/FeaturesSection';
import FaqSection from '../components/FaqSection';
import Footer from '../components/Footer';

// --- NEWLY ADDED SECTIONS ---
import AudienceSection from '../components/AudienceSection';
import TestimonialsSection from '../components/TestimonialsSection';

const LandingPage = () => {
  // This main component assembles all the sections of the page in a logical narrative.
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ShowcaseSection />
        <AudienceSection />
        <FeaturesSection />
        <TestimonialsSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;