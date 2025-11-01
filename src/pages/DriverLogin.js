import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverLogin.css';

const DriverLogin = () => {
  const { vehicles } = useVehicles();
  const [drivers, setDrivers] = useState([]);
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };


  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() });
      });

      // Derive driver entries from initialized vehicles, then merge by unique name
      // Only include the 4 authorized drivers
      const derivedFromVehicles = (vehicles || [])
        .map(v => ({
          id: `veh-${v.id}`,
          name: v.driver,
          vehicle: v.name,
          confirmed: true,
          status: v.status || 'Available'
        }))
        .filter(d => d.name && ['Randy Maduro', 'Adrian Silao', 'Fernando Besa', 'Joseph Allan Saldivar'].includes(d.name));

      const existingByName = new Set(driversData.map(d => (d.name || '').toLowerCase()));
      const merged = [
        ...driversData.filter(d => ['Randy Maduro', 'Adrian Silao', 'Fernando Besa', 'Joseph Allan Saldivar'].includes(d.name)),
        ...derivedFromVehicles.filter(d => !existingByName.has((d.name || '').toLowerCase()))
      ];

      setDrivers(merged);
    });
    return unsubscribe;
  }, [vehicles]);

  // Prefill loginName from centralized login redirect (?name=...) but don't auto-login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    if (name) setLoginName(name);
  }, []);
  const handleLogin = () => {
    if (password !== 'password') {
      alert('Invalid password');
      return;
    }

    const driver = drivers.find(d => d.name.toLowerCase() === loginName.toLowerCase());
    if (driver) {
      localStorage.setItem('loggedInDriver', driver.name);
      window.location.href = '/driver-dashboard';
    } else {
      alert('Driver not found');
    }
  };


  return (
    <div className="driver-login">
      <div className="login-header">
        <h1>Driver Login</h1>
        <button className="btn" onClick={toggleTheme}>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>
      <div className="login-form">
        <input
          placeholder="Enter Driver Name"
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
        />
        <input
          type="password"
          placeholder="Enter Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
        />
        <button className="btn btn-primary" onClick={handleLogin}>Login</button>
      </div>
    </div>
  );
};

export default DriverLogin;
