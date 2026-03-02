import { HashRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import WalkUpPage from './pages/WalkUpPage';

function App() {
  return (
    <HashRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/walkup" element={<WalkUpPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
