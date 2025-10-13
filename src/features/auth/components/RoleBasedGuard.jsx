/**
 * Role-Based Navigation Guard Component
 * Prevents unauthorized access to routes based on user roles
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/config/supabaseClient';
import { 
  validateRouteAccess, 
  getUserDashboardRoute, 
  getRoleBasedNavigationRestrictions,
  TenantSecurityError 
} from '@/shared/utils/tenantSecurity.js';
import { getUserRole } from '@/shared/utils/metadata.js';

const RoleBasedGuard = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkRouteAccess();
  }, [location.pathname]);

  const checkRouteAccess = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        navigate('/login');
        return;
      }

      if (!user) {
        navigate('/login');
        return;
      }

      setUser(user);

      // Check if user has a valid role
      const userRole = getUserRole(user);
      if (!userRole) {
        navigate('/login');
        return;
      }

      // Validate route access
      const hasAccess = validateRouteAccess(location.pathname, user);
      
      if (!hasAccess) {
        // Redirect to appropriate dashboard
        const dashboardRoute = getUserDashboardRoute(user);
        navigate(dashboardRoute);
        return;
      }

      setIsAuthorized(true);
    } catch (error) {
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button 
            onClick={() => navigate(getUserDashboardRoute(user))}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default RoleBasedGuard;
