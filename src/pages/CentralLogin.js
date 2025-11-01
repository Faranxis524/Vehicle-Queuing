import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';

const CentralLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { vehicles } = useVehicles();
  const [role, setRole] = useState('admin'); // 'admin' | 'driver'
  const [username, setUsername] = useState('');
  const [driverName, setDriverName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  }, [theme]);

  // Load authorized drivers
  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() });
      });

      // Only include the 4 authorized drivers
      const authorizedDrivers = driversData.filter(d =>
        ['Randy Maduro', 'Adrian Silao', 'Fernando Besa', 'Joseph Allan Saldivar'].includes(d.name)
      );

      setDrivers(authorizedDrivers);
    });
    return unsubscribe;
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const isValid = useMemo(() => {
    if (role === 'admin') {
      return username.trim().length > 0 && password.trim().length > 0;
    }
    return driverName.trim().length > 0 && password.trim().length > 0;
  }, [role, username, driverName, password]);

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (password !== 'password') {
      setError('Invalid credentials. Please try again.');
      return;
    }
    if (role === 'admin') {
      // Validate admin username
      if (username.trim().toLowerCase() !== 'admin') {
        setError('Invalid admin username.');
        return;
      }
      // Login as admin and redirect to dashboard
      login({ username: 'Admin' }, 'admin');
      navigate('/po-monitoring', { replace: true });
    } else {
      // Validate driver name against authorized list
      const name = driverName.trim();
      const driver = drivers.find(d => d.name.toLowerCase() === name.toLowerCase());
      if (!driver) {
        setError('Driver not found. Please check your name and try again.');
        return;
      }
      // Login as driver and redirect to driver dashboard
      login({ name }, 'driver');
      localStorage.setItem('loggedInDriver', name);
      navigate('/driver-dashboard', { replace: true });
    }
  };

  return (
    <div className="auth-page" data-theme={theme} style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="card auth-card" style={{ width: 360, cursor: 'default' }}>
        <div className="card-header" style={{ marginBottom: 12 }}>
          <div>
            <div className="card-title">Sign in</div>
            <div className="card-subtitle">Select role and continue</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" onClick={toggleTheme} style={{ padding: '6px 10px', fontSize: '11px' }}>
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            <div className="badge info">
              <span className="dot"></span>
              Central Login
            </div>
          </div>
        </div>

        <div className="role-toggle" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className={`btn ${role === 'admin' ? 'btn-primary' : ''}`}
            onClick={() => { setRole('admin'); setError(''); }}
          >
            Admin
          </button>
          <button
            type="button"
            className={`btn ${role === 'driver' ? 'btn-primary' : ''}`}
            onClick={() => { setRole('driver'); setError(''); }}
          >
            Driver
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          {role === 'admin' ? (
            <>
              <label className="card-meta">Admin Username</label>
              <input
                className="input"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </>
          ) : (
            <>
              <label className="card-meta">Driver Name</label>
              <input
                className="input"
                placeholder="Enter driver name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                autoFocus
              />
            </>
          )}

          <label className="card-meta">Password</label>
          <input
            className="input"
            placeholder="Enter password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div className="badge danger" role="alert">
              <span className="dot"></span>
              {error}
            </div>
          )}

          <div className="card-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={!isValid}>Continue</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CentralLogin;
