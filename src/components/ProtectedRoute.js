import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredUserType = null }) => {
  const { isAuthenticated, userType } = useAuth();
  const location = useLocation();

  // If not authenticated, redirect to central login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If specific user type is required and doesn't match, redirect appropriately
  if (requiredUserType && userType !== requiredUserType) {
    if (requiredUserType === 'admin') {
      return <Navigate to="/login" state={{ from: location }} replace />;
    } else if (requiredUserType === 'driver') {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
