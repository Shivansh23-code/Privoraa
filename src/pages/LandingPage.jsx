import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import ShowcaseSection from '../components/ShowcaseSection';
import ValuePropsSection from '../components/ValuePropsSection';
import TestimonialsSection from '../components/TestimonialsSection';
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
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;