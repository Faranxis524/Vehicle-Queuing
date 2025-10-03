import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { VehicleProvider } from './contexts/VehicleContext';
import POMonitoring from './pages/POMonitoring';
import VehicleMonitoring from './pages/VehicleMonitoring';
import History from './pages/History';
import DriverInfo from './pages/DriverInfo';
import DriverLogin from './pages/DriverLogin';
import DriverDashboard from './pages/DriverDashboard';
import CentralLogin from './pages/CentralLogin';
import './App.css';

function ShellLayout() {
  return (
    <div className="app">
      <Sidebar />
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  // Ensure theme is applied on initial load (even on /login where Sidebar is hidden)
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const value = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', value);
  }, []);

  return (
    <VehicleProvider>
      <Router>
        <ErrorBoundary>
          <Routes>
            {/* Auth routes (no dashboard shell) */}
            <Route path="/login" element={<CentralLogin />} />
            <Route path="/driver-login" element={<DriverLogin />} />
            <Route path="/driver-dashboard" element={<DriverDashboard />} />

            {/* App routes with dashboard shell */}
            <Route element={<ShellLayout />}>
              <Route path="/po-monitoring" element={<POMonitoring />} />
              <Route path="/vehicle-monitoring" element={<VehicleMonitoring />} />
              <Route path="/history" element={<History />} />
              <Route path="/driver-info" element={<DriverInfo />} />
              <Route path="/" element={<POMonitoring />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </Router>
    </VehicleProvider>
  );
}

export default App;
