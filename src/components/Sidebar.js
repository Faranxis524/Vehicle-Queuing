import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    // Apply theme to root element so CSS variables can switch
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  }, [theme]);

  const handleLogout = () => {
    // Redirect to Central Login; replace history to prevent back navigation into dashboard
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="sidebar">
      <div>
        <h2>Admin Dashboard</h2>
        <ul>
          <li><Link to="/po-monitoring">PO Monitoring</Link></li>
          <li><Link to="/vehicle-monitoring">Vehicle Monitoring</Link></li>
          <li><Link to="/history">History</Link></li>
          <li><Link to="/driver-info">Driver Info</Link></li>
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