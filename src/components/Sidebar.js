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
        <label className="theme-switch">
          <input
            type="checkbox"
            className="theme-switch__checkbox"
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          <div className="theme-switch__container">
            <div className="theme-switch__circle-container">
              <div className="theme-switch__sun-moon-container">
                <div className="theme-switch__moon">
                  <div className="theme-switch__spot"></div>
                  <div className="theme-switch__spot"></div>
                  <div className="theme-switch__spot"></div>
                </div>
              </div>
            </div>
            <div className="theme-switch__clouds">
              <div className="theme-switch__stars-container">
                <svg className="theme-switch__stars" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                  <path d="M10 40 L12 42 L10 44 L8 42 Z"/>
                  <path d="M25 30 L27 32 L25 34 L23 32 Z"/>
                  <path d="M40 35 L42 37 L40 39 L38 37 Z"/>
                  <path d="M60 25 L62 27 L60 29 L58 27 Z"/>
                  <path d="M75 40 L77 42 L75 44 L73 42 Z"/>
                </svg>
              </div>
            </div>
          </div>
        </label>
        <button className="logout-btn" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
};

export default Sidebar;
