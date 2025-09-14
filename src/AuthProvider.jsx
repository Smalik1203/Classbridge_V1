import {createContext, useContext, useEffect, useState} from 'react'
import {supabase} from './config/supabaseClient'

const AuthContext = createContext()


export function AuthContextProvider({children}){
    const [user, setUser ]= useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(()=>{
        
        const fetchUserProfile = async (authUser) => {
            if (!authUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                // Fetch user profile from users table
                const { data: profile, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authUser.id)
                    .single();

                if (error) {
                    console.error('Error fetching user profile:', error);
                    // If profile doesn't exist, use auth user with basic info
                    console.log('Using auth user only:', authUser);
                    setUser(authUser);
                } else {
                    // Merge auth user with profile data
                    const mergedUser = {
                        ...authUser,
                        ...profile
                    };
                    console.log('Merged user data:', mergedUser);
                    console.log('School code:', mergedUser.school_code);
                    setUser(mergedUser);
                }
            } catch (error) {
                console.error('Error in fetchUserProfile:', error);
                setUser(authUser);
            }
            
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
        <AuthContext.Provider value={{user, loading}}>
            {children}
        </AuthContext.Provider>
    )
}


export function useAuth(){
    return useContext(AuthContext);
}
