import LightningBackground from '../components/LightningBackground';
import Hero from '../components/Hero';
import About from '../components/About';
import Schedule from '../components/Schedule';
import Contact from '../components/Contact';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <div className="relative pt-16">
      <LightningBackground />
      <main className="relative z-10">
        <Hero />
        <About />
        <Schedule />
        <Contact />
        <Footer />
      </main>
    </div>
  );
}
