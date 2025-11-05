import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../companyLogo.png';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    // Apply theme to root element so CSS variables can switch
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  }, [theme]);

  const handleLogout = () => {
    // Logout and redirect to Central Login; replace history to prevent back navigation into dashboard
    logout();
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="sidebar">
      <div>
        <div className="sidebar-header">
          <div className="sidebar-logo-section">
            <img src={logo} alt="HILTAC Logo" className="sidebar-logo" />
            <div className="sidebar-text">
              <h1 className="sidebar-title">HILTAC</h1>
              <p className="sidebar-subtitle">Manufacturing and Trading Inc.</p>
            </div>
          </div>
          <h2 className="sidebar-dashboard-title">Admin Dashboard</h2>
        </div>
        <ul>
          <li><Link to="/po-monitoring" className={location.pathname === '/po-monitoring' ? 'active' : ''}>PO Monitoring</Link></li>
          <li><Link to="/vehicle-monitoring" className={location.pathname === '/vehicle-monitoring' ? 'active' : ''}>Vehicle Monitoring</Link></li>
          <li><Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>History</Link></li>
          <li><Link to="/driver-info" className={location.pathname === '/driver-info' ? 'active' : ''}>Driver Info</Link></li>
        </ul>
      </div>
      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
        <button className="logout-btn" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
};

export default Sidebar;
