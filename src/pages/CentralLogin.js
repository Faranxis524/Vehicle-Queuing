import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import logo from '../companyLogo.png';

const CentralLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState('admin'); // 'admin' | 'driver'
  const [username, setUsername] = useState('');
  const [driverName, setDriverName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [drivers, setDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate required fields are not empty
    if (role === 'admin') {
      if (!username.trim()) {
        setError('Please enter admin username.');
        setIsLoading(false);
        return;
      }
      if (!password.trim()) {
        setError('Please enter password.');
        setIsLoading(false);
        return;
      }
    } else {
      if (!driverName.trim()) {
        setError('Please enter driver name.');
        setIsLoading(false);
        return;
      }
      if (!password.trim()) {
        setError('Please enter password.');
        setIsLoading(false);
        return;
      }
    }

    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    if (password !== 'password') {
      setError('Invalid credentials. Please try again.');
      setIsLoading(false);
      return;
    }
    if (role === 'admin') {
      // Validate admin username
      if (username.trim().toLowerCase() !== 'admin') {
        setError('Invalid admin username.');
        setIsLoading(false);
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
        setIsLoading(false);
        return;
      }
      // Login as driver and redirect to driver dashboard
      login({ name }, 'driver');
      localStorage.setItem('loggedInDriver', name);
      navigate('/driver-dashboard', { replace: true });
    }
  };

  return (
    <div className="auth-page" data-theme={theme}>
      {/* Background decorative elements */}
      <div className="auth-bg-decoration">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="auth-container">
        {/* Header Section */}
        <div className="auth-header">
          <div className="logo-section">
            <img src={logo} alt="HILTAC Logo" className="login-logo" />
            <div className="logo-text">
              <h1 className="app-title">HILTAC</h1>
              <p className="app-subtitle">Manufacturing and Trading Inc.</p>
            </div>
          </div>

          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {theme === 'light' ? (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <circle cx="12" cy="12" r="5"/>
              )}
            </svg>
          </button>
        </div>

        {/* Login Card */}
        <div className="auth-card">
          <div className="card-header">
            <h2 className="card-title">Welcome Back</h2>
            <p className="card-subtitle">Please sign in to continue</p>
          </div>

          {/* Role Selection */}
          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${role === 'admin' ? 'active' : ''}`}
              onClick={() => { setRole('admin'); setError(''); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Admin
            </button>
            <button
              type="button"
              className={`role-btn ${role === 'driver' ? 'active' : ''}`}
              onClick={() => { setRole('driver'); setError(''); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 17V15C9 13.8954 9.89543 13 11 13H13C14.1046 13 15 13.8954 15 15V17M9 17H15M9 17V19C9 20.1046 9.89543 21 11 21H13C14.1046 21 15 20.1046 15 19V17M9 17H7C5.89543 17 5 16.1046 5 15V11C5 9.89543 5.89543 9 7 9H17C18.1046 9 19 9.89543 19 11V15C19 16.1046 18.1046 17 17 17H15M12 9V7M8 7V9M16 7V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Driver
            </button>
          </div>

          {/* Login Form */}
          <form className="auth-form" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">
                {role === 'admin' ? 'Admin Username' : 'Driver Name'}
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  className="form-input"
                  placeholder={role === 'admin' ? 'Enter admin username' : 'Enter driver name'}
                  value={role === 'admin' ? username : driverName}
                  onChange={(e) => role === 'admin' ? setUsername(e.target.value) : setDriverName(e.target.value)}
                  autoFocus
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="16" r="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  className="form-input"
                  placeholder="Enter password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M15 9L9 15M15 15L9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {error}
              </div>
            )}

            <button
              className={`login-btn ${isValid && !isLoading ? 'active' : ''}`}
              type="submit"
              disabled={!isValid || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 16L15 12M15 12L11 8M15 12H3M3 12H1M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>Secure access to the Vehicle Queuing System</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .auth-bg-decoration {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
        }

        .floating-shape {
          position: absolute;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(185,28,28,0.1), rgba(127,29,29,0.05));
          animation: float 6s ease-in-out infinite;
        }

        .shape-1 {
          width: 200px;
          height: 200px;
          top: 10%;
          left: 10%;
          animation-delay: 0s;
        }

        .shape-2 {
          width: 150px;
          height: 150px;
          top: 60%;
          right: 15%;
          animation-delay: 2s;
        }

        .shape-3 {
          width: 100px;
          height: 100px;
          bottom: 20%;
          left: 20%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }

        .auth-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          padding: 0 24px;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .logo-section {
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .login-logo {
          width: 80px;
          height: 80px;
        }

        .logo-text {
          text-align: center;
        }

        .app-title {
          font-size: 36px;
          font-weight: 700;
          color: #dc2626;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
          text-align: center;
        }

        .app-subtitle {
          font-size: 16px;
          color: var(--muted);
          margin: 0;
          font-weight: 500;
        }

        .theme-toggle-btn {
          position: absolute;
          top: 0;
          right: 0;
          background: var(--card-bg);
          border: var(--border);
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          transition: all 200ms ease;
          color: var(--text);
        }

        .theme-toggle-btn:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }

        .auth-card {
          background: var(--card-bg);
          border: var(--border);
          border-radius: 24px;
          box-shadow: var(--shadow);
          padding: 32px;
          backdrop-filter: blur(12px);
          overflow: hidden;
          box-sizing: border-box;
        }

        .card-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .card-title {
          font-size: 24px;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 8px 0;
        }

        .card-subtitle {
          font-size: 14px;
          color: var(--muted);
          margin: 0;
        }

        .role-selector {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
          background: rgba(0,0,0,0.04);
          border-radius: 16px;
          padding: 6px;
        }

        .role-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: var(--muted);
          font-weight: 500;
          cursor: pointer;
          transition: all 200ms ease;
        }

        .role-btn:hover {
          background: rgba(0,0,0,0.06);
          color: var(--text);
        }

        .role-btn.active {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          box-shadow: 0 4px 12px rgba(185,28,28,0.3);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          margin-left: 4px;
        }

        .input-wrapper {
          position: relative;
          width: 100%;
          overflow: hidden;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          z-index: 1;
          pointer-events: none;
        }

        .form-input {
          width: 100%;
          padding: 16px 16px 16px 52px;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 12px;
          background: rgba(0,0,0,0.04);
          color: var(--text);
          font-size: 16px;
          transition: all 200ms ease;
          outline: none;
          box-sizing: border-box;
        }

        .form-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(185,28,28,0.15);
          background: rgba(0,0,0,0.02);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.2);
          border-radius: 12px;
          color: #dc2626;
          font-size: 14px;
          font-weight: 500;
        }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 24px;
          border: none;
          border-radius: 12px;
          background: rgba(0,0,0,0.08);
          color: var(--muted);
          font-size: 16px;
          font-weight: 600;
          cursor: not-allowed;
          transition: all 200ms ease;
          margin-top: 8px;
        }

        .login-btn.active {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(185,28,28,0.3);
        }

        .login-btn.active:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(185,28,28,0.4);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid rgba(0,0,0,0.08);
        }

        .auth-footer p {
          font-size: 12px;
          color: var(--muted);
          margin: 0;
        }

        /* Responsive design */
        @media (max-width: 640px) {
          .auth-container {
            padding: 0 16px;
          }

          .auth-card {
            padding: 24px;
          }

          .app-title {
            font-size: 24px;
          }

          .login-logo {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>
    </div>
  );
};

export default CentralLogin;
