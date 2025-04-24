import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './index.css';
import AnaliseForm from './components/AnaliseForm';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PlanosPage from './pages/PlanosPage';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function App() {
  return (
    <Router>
      <div className="App">
        <header className="bg-blue-600 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <Link to="/" className="text-xl font-bold">Assistente Comercial IA</Link>
            <nav>
              <ul className="flex space-x-4">
                <li><Link to="/" className="hover:text-blue-200">Home</Link></li>
                <li><Link to="/analise" className="hover:text-blue-200">Analisar Reunião</Link></li>
                <li><Link to="/planos" className="hover:text-blue-200">Planos</Link></li>
                <li><Link to="/login" className="hover:text-blue-200">Login</Link></li>
              </ul>
            </nav>
          </div>
        </header>
        
        <main className="container mx-auto py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/analise" element={<AnaliseForm />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/planos" element={<PlanosPage />} />
          </Routes>
        </main>
        
        <footer className="bg-gray-100 p-6 mt-12">
          <div className="container mx-auto text-center">
            <p className="text-gray-600">© 2025 Assistente Comercial com IA. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
