import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import ShowcaseSection from '../components/ShowcaseSection';
import ValuePropsSection from '../components/ValuePropsSection'; // New
import TestimonialsSection from '../components/TestimonialsSection';
import FaqSection from '../components/FaqSection';
import Footer from '../components/Footer';

const LandingPage = () => {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ShowcaseSection />
        <ValuePropsSection />
        <TestimonialsSection />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;