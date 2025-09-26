import React from 'react';
import { Link } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <h2>Admin Dashboard</h2>
      <ul>
        <li><Link to="/po-monitoring">PO Monitoring</Link></li>
        <li><Link to="/vehicle-monitoring">Vehicle Monitoring</Link></li>
        <li><Link to="/history">History</Link></li>
        <li><Link to="/driver-info">Driver Info</Link></li>
      </ul>
    </div>
  );
};

export default Sidebar;