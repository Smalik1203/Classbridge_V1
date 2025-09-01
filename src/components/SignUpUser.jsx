import React, { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import {useAuth} from "../AuthProvider"
import {Navigate} from "react-router-dom";


const SignUpUser = () => {
  const {user} = useAuth();
  if(user) return <Navigate to="/dashboard"/>
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [full_name, setFullName] = useState('');
  const [phone_number, setPhonenumber] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('cb_admin');
  const [cb_admin_code, setCbAdminCode] = useState('CB');
  const handleSignUp = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name,
            phone: phone_number, 
            role: role,
            cb_admin_code: cb_admin_code,
          },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      } else {
        setMessage('Signup successful! Please check your email to confirm your account.');
        setEmail('');
        setPassword('');
        setFullName('');
        setPhonenumber('');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }

    // Note: This code runs after signup but before email confirmation
    // The user might not be immediately available
    try {
      const {data: userData, error: userError} = await supabase.auth.getUser();
      if (userData?.user) {
        console.log('User data after signup:', userData);
        
        // insert this user into cb admin table
        const {error: insertError} = await supabase.from('cb_admin').insert({
          id: userData.user.id,
          email: userData.user.email,
          full_name: userData.user.user_metadata?.full_name,
          phone: userData.user.user_metadata?.phone,
          role: userData.user.user_metadata?.role,
          cb_admin_code: userData.user.user_metadata?.cb_admin_code,
        });
        
        if (insertError) {
          console.error('Error inserting into cb_admin:', insertError);
        }
      }
    } catch (err) {
      console.error('Error getting user data after signup:', err);
    }
  };

  return (
    <div>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignUp}>
        <div>
          <label>Full Name:</label>
          <input
            type="text"
            value={full_name}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Phone Number:</label>
          <input
            type="tel"
            value={phone_number}
            onChange={(e) => setPhonenumber(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Role:</label>  
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="cb_admin">CB Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <div>
          <label>CB AdminCode:</label>
          <input
            type="text"
            value={cb_admin_code}
            onChange={(e) => setCbAdminCode(e.target.value)}
            required
          />
        </div>
          <button type="submit" disabled={loading}>
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default SignUpUser; 