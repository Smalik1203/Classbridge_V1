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
      // Use the create-super-admin Edge Function for secure role assignment
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError('Not authenticated. Please log in first.');
        setLoading(false);
        return;
      }

      const response = await fetch('https://mvvzqouqxrtyzuzqbeud.supabase.co/functions/v1/create-super-admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name,
          phone: phone_number,
          school_id: null, // CB admin doesn't have a specific school
          school_name: 'ClassBridge Platform',
          school_code: 'CB',
          role,
          super_admin_code: cb_admin_code,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || `Failed to create user. Status: ${response.status}`);
        setLoading(false);
        return;
      } else {
        setMessage('User created successfully! Please check your email to confirm your account.');
        setEmail('');
        setPassword('');
        setFullName('');
        setPhonenumber('');
      }
    } catch (err) {
      setError('An unexpected error occurred: ' + err.message);
    } finally {
      setLoading(false);
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