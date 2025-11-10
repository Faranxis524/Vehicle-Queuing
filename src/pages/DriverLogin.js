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
