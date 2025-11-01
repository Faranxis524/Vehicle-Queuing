import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'admin' or 'driver'

  // Check for existing session on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    const savedUserType = localStorage.getItem('userType');

    if (token && savedUser && savedUserType) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
      setUserType(savedUserType);
    }
  }, []);

  const login = (userData, type) => {
    setIsAuthenticated(true);
    setUser(userData);
    setUserType(type);

    // Store in localStorage for persistence
    localStorage.setItem('authToken', 'authenticated'); // Simple token for demo
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('userType', type);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setUserType(null);

    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
  };

  const value = {
    isAuthenticated,
    user,
    userType,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
