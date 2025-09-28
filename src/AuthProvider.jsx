import {createContext, useContext, useEffect, useState} from 'react'
import {supabase} from './config/supabaseClient'
import { getNormalizedUserMetadata } from './utils/metadata'

const AuthContext = createContext()


export function AuthContextProvider({children}){
    const [user, setUser] = useState(null)
    const [userMetadata, setUserMetadata] = useState(null)
    const [loading, setLoading] = useState(true)

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

        supabase.auth.getUser().then(({data:{user}}) => {
            fetchUserProfile(user);
        });

        const {data:listener} = supabase.auth.onAuthStateChange((_event, session)=>{
            fetchUserProfile(session?.user ?? null);
        });

        
        return () => listener.subscription.unsubscribe();

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
