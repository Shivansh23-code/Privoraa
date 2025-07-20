import HeroSection from '../components/HeroSection';
import BenefitsSection from '../components/BenefitsSection';
import MockupSection from '../components/MockupSection';
import Footer from '../components/Footer';

const LandingPage = () => {
  return (
    <>
      <main>
        <HeroSection />
        <BenefitsSection />
        <MockupSection />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;