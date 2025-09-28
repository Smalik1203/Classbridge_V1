import { Navigate, useLocation } from "react-router-dom";
import {useAuth} from "../AuthProvider"
import { getUserRole } from "../routeAccess";

/**
 * PRIVATE ROUTE COMPONENT - Route Protection System
 * 
 * CHANGES MADE:
 * - Professional React component for route protection
 * - Integrated with AuthProvider for authentication state
 * - Added proper loading states and navigation handling
 * - Implemented clean redirect logic for unauthenticated users
 * 
 * BACKEND INTEGRATION NEEDED:
 * - Add role-based route protection
 * - Implement permission-based access control
 * - Add route-specific authorization checks
 * - Include audit logging for access attempts
 * - Add session validation and refresh logic
 * 
 * ENHANCED ROUTE PROTECTION:
 * - Check user permissions for specific routes
 * - Validate session expiry and refresh tokens
 * - Log unauthorized access attempts
 * - Implement graceful error handling
 * - Add loading states for better UX
 */
const PrivateRoute = ({children, allowedRoles}) => {
    const {user, loading} = useAuth();
    const location = useLocation();

    /**
     * LOADING STATE HANDLING
     * 
     * BACKEND INTEGRATION NEEDED:
     * - Add professional loading component
     * - Include progress indicators
     * - Add timeout handling for slow connections
     * - Implement skeleton loading for better UX
     */
    if(loading) return <div>Loading...</div>;
    
    /**
     * AUTHENTICATION CHECK
     * 
     * BACKEND INTEGRATION NEEDED:
     * - Add session validation
     * - Check token expiry
     * - Implement automatic token refresh
     * - Add role and permission validation
     * - Log access attempts for security
     * 
     * ENHANCED AUTHENTICATION:
     * if (!user || !isValidSession(user)) {
     *   logAccessAttempt(window.location.pathname, 'unauthorized');
     *   return <Navigate to="/login" replace />;
     * }
     * 
     * if (!hasRequiredPermissions(user, requiredPermissions)) {
     *   logAccessAttempt(window.location.pathname, 'insufficient_permissions');
     *   return <Navigate to="/unauthorized" replace />;
     * }
     */
    if(!user) return <Navigate to="/" replace state={{ from: location }} />;

    // Role-based authorization
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        const role = getUserRole(user);
        if (!role || !allowedRoles.includes(role)) {
            return <Navigate to="/unauthorized" replace state={{ from: location }} />;
        }
    }
    
    /**
     * RENDER PROTECTED CONTENT
     * 
     * BACKEND INTEGRATION NEEDED:
     * - Add user context to children components
     * - Include permission checking wrapper
     * - Add activity tracking for protected routes
     * - Implement session monitoring
     */
    return children;
}

export default PrivateRoute;