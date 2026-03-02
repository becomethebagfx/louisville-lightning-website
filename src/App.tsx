import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import WalkUpPage from './pages/WalkUpPage';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/walkup" element={<WalkUpPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
