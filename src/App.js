import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { VehicleProvider } from './contexts/VehicleContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import POMonitoring from './pages/POMonitoring';
import VehicleMonitoring from './pages/VehicleMonitoring';
import History from './pages/History';
import DriverInfo from './pages/DriverInfo';

import DriverDashboard from './pages/DriverDashboard';
import CentralLogin from './pages/CentralLogin';
import './App.css';

// Component to handle root route redirection
const RootRedirect = () => {
  const { isAuthenticated, userType } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user type
  if (userType === 'admin') {
    return <Navigate to="/po-monitoring" replace />;
  } else if (userType === 'driver') {
    return <Navigate to="/driver-dashboard" replace />;
  }

  // Fallback to login
  return <Navigate to="/login" replace />;
};

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
    <AuthProvider>
      <VehicleProvider>
        <Router>
          <ErrorBoundary>
            <Routes>
              {/* Auth routes (no dashboard shell) */}
              <Route path="/login" element={<CentralLogin />} />
              <Route path="/driver-dashboard" element={
                <ProtectedRoute requiredUserType="driver">
                  <DriverDashboard />
                </ProtectedRoute>
              } />

              {/* Root route - redirects based on auth status */}
              <Route path="/" element={<RootRedirect />} />

              {/* App routes with dashboard shell - protected for admin */}
              <Route element={
                <ProtectedRoute requiredUserType="admin">
                  <ShellLayout />
                </ProtectedRoute>
              }>
                <Route path="/po-monitoring" element={<POMonitoring />} />
                <Route path="/vehicle-monitoring" element={<VehicleMonitoring />} />
                <Route path="/history" element={<History />} />
                <Route path="/driver-info" element={<DriverInfo />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </Router>
      </VehicleProvider>
    </AuthProvider>
  );
}

export default App;
