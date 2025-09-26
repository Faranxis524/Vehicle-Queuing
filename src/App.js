import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import POMonitoring from './pages/POMonitoring';
import VehicleMonitoring from './pages/VehicleMonitoring';
import History from './pages/History';
import DriverInfo from './pages/DriverInfo';
import DriverLogin from './pages/DriverLogin';
import './App.css';

function AppContent() {
  const location = useLocation();
  const isDriverLogin = location.pathname === '/driver-login';

  return (
    <div className="app">
      {!isDriverLogin && <Sidebar />}
      <div className="content">
        <Routes>
          <Route path="/po-monitoring" element={<POMonitoring />} />
          <Route path="/vehicle-monitoring" element={<VehicleMonitoring />} />
          <Route path="/history" element={<History />} />
          <Route path="/driver-info" element={<DriverInfo />} />
          <Route path="/driver-login" element={<DriverLogin />} />
          <Route path="/" element={<POMonitoring />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
