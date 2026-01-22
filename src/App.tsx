import LightningBackground from './components/LightningBackground';
import Hero from './components/Hero';
import About from './components/About';
import VideoSection from './components/VideoSection';
import TryoutInfo from './components/TryoutInfo';
import Schedule from './components/Schedule';
import Contact from './components/Contact';
import Footer from './components/Footer';

function App() {
  return (
    <div className="relative min-h-screen">
      {/* Interactive Lightning Background */}
      <LightningBackground />

      {/* Main Content */}
      <main className="relative z-10">
        <Hero />
        <About />
        <VideoSection />
        <TryoutInfo />
        <Schedule />
        <Contact />
        <Footer />
      </main>
    </div>
  );
}

export default App;
