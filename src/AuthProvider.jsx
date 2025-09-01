import {createContext, useContext, useEffect, useState} from 'react'
import {supabase} from './config/supabaseClient'

const AuthContext = createContext()


export function AuthContextProvider({children}){
    const [user, setUser ]= useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(()=>{
        
        supabase.auth.getUser().then(({data:{user}}) => {
            setUser(user);
            setLoading(false);
        });

        const {data:listener} = supabase.auth.onAuthStateChange((_event, session)=>{
            setUser(session?.user ?? null);
            setLoading(false);
        });

        
        return () => listener.subscription.unsubscribe();

    },[]);

    
    return (
        <AuthContext.Provider value={{user, loading}}>
            {children}
        </AuthContext.Provider>
    )
}


export function useAuth(){
    return useContext(AuthContext);
}
