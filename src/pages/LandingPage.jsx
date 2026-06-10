import { useEffect } from 'react';
import '../features/landing/landing.css';
import SvgDefs from '../features/landing/SvgDefs';
import Navbar from '../features/landing/Navbar';
import Hero from '../features/landing/Hero';
import TrustStrip from '../features/landing/TrustStrip';
import Promises from '../features/landing/Promises';
import HowItWorks from '../features/landing/HowItWorks';
import Vault from '../features/landing/Vault';
import Compare from '../features/landing/Compare';
import Faq from '../features/landing/Faq';
import CTASection from '../features/landing/CTASection';
import Footer from '../features/landing/Footer';

export default function LandingPage() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.landing-page .reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-page">
      <a className="skip" href="#main">
        Skip to content
      </a>

      <SvgDefs />

      <div className="atmo" aria-hidden="true">
        <div className="topline"></div>
        <div className="glow glow-a"></div>
        <div className="glow glow-b"></div>
        <div className="glow glow-c"></div>
        <div className="grain"></div>
      </div>

      <Navbar />

      <main id="main">
        <Hero />
        <TrustStrip />
        <Promises />
        <HowItWorks />
        <Vault />
        <Compare />
        <Faq />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
