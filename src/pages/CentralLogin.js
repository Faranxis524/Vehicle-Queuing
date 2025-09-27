import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CentralLogin = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('admin'); // 'admin' | 'driver'
  const [username, setUsername] = useState('');
  const [driverName, setDriverName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  }, [theme]);

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
      // Route admins to the main dashboard (PO Monitoring)
      navigate('/po-monitoring', { replace: true, state: { user: username, role: 'admin' } });
    } else {
      // Route drivers to driver login page with preselected name so it auto logs in
      const name = driverName.trim();
      navigate(`/driver-login?name=${encodeURIComponent(name)}`, { replace: true, state: { name, role: 'driver' } });
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

          <div className="card-footer" style={{ justifyContent: 'space-between' }}>
            <span className="card-meta">Hint: password is "password"</span>
            <button className="btn btn-primary" type="submit" disabled={!isValid}>Continue</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CentralLogin;