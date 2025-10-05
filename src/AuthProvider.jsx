import {createContext, useContext, useEffect, useState} from 'react'
import {supabase} from './config/supabaseClient'
import { getNormalizedUserMetadata } from './utils/metadata'

const AuthContext = createContext()


export function AuthContextProvider({children}){
    const [user, setUser] = useState(null)
    const [userMetadata, setUserMetadata] = useState(null)
    const [loading, setLoading] = useState(true)
    const [refreshInterval, setRefreshInterval] = useState(null)

    useEffect(()=>{
        
        const fetchUserProfile = async (authUser) => {
            if (!authUser) {
                setUser(null);
                setUserMetadata(null);
                setLoading(false);
                return;
            }

            // Use the auth user data directly and normalize metadata
            setUser(authUser);
            setUserMetadata(getNormalizedUserMetadata(authUser));
            setLoading(false);
        };

        // Check for existing session and refresh if needed
        const initializeAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.error('Session error:', error);
                    setLoading(false);
                    return;
                }

                if (session) {
                    // Check if token is close to expiry (within 5 minutes)
                    const now = Math.floor(Date.now() / 1000);
                    const tokenExpiry = session.expires_at;
                    const timeUntilExpiry = tokenExpiry - now;
                    
                    if (timeUntilExpiry < 300) { // 5 minutes
                        console.log('Token close to expiry, refreshing...');
                        const { error: refreshError } = await supabase.auth.refreshSession();
                        if (refreshError) {
                            console.error('Token refresh failed:', refreshError);
                        } else {
                            console.log('Token refreshed successfully');
                        }
                    }
                    
                    fetchUserProfile(session.user);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                setLoading(false);
            }
        };

        initializeAuth();

        const {data:listener} = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.id);
            
            if (event === 'SIGNED_OUT') {
                setUser(null);
                setUserMetadata(null);
                setLoading(false);
                // Clear refresh interval on logout
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    setRefreshInterval(null);
                }
            } else if (event === 'TOKEN_REFRESHED') {
                console.log('Token refreshed automatically');
                fetchUserProfile(session?.user ?? null);
            } else if (event === 'SIGNED_IN' && session) {
                fetchUserProfile(session.user);
                // Start periodic token refresh for signed-in users
                startPeriodicRefresh();
            } else {
                fetchUserProfile(session?.user ?? null);
            }
        });

        // Start periodic token refresh
        const startPeriodicRefresh = () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            
            const interval = setInterval(async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        const now = Math.floor(Date.now() / 1000);
                        const timeUntilExpiry = session.expires_at - now;
                        
                        // Refresh token if it expires within 10 minutes
                        if (timeUntilExpiry < 600) {
                            console.log('Proactive token refresh...');
                            const { error } = await supabase.auth.refreshSession();
                            if (error) {
                                console.error('Proactive refresh failed:', error);
                            } else {
                                console.log('Proactive refresh successful');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Periodic refresh error:', error);
                }
            }, 5 * 60 * 1000); // Check every 5 minutes
            
            setRefreshInterval(interval);
        };

        // Start refresh if user is already signed in
        if (user) {
            startPeriodicRefresh();
        }
        
        return () => {
            listener.subscription.unsubscribe();
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };

    },[]);

    
    return (
        <AuthContext.Provider value={{user, userMetadata, loading}}>
            {children}
        </AuthContext.Provider>
    )
}


export function useAuth(){
    return useContext(AuthContext);
}
