import React, { useState } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../AuthProvider';
import { Navigate } from 'react-router-dom';

const ModernLogin = () => {
  const { user } = useAuth();
  
  // Redirect if already logged in
  if (user) return <Navigate to="/dashboard" />;

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }}></div>

      {/* Login Card */}
      <div className="cb-card cb-card-elevated" style={{ 
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="cb-card-body cb-card-body-lg">
          {/* Header */}
          <div className="cb-text-center cb-mb-8">
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-2xl)',
              background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              fontSize: 'var(--text-3xl)',
              boxShadow: 'var(--shadow-lg)'
            }}>
              🎓
            </div>
            <h1 className="cb-heading-2 cb-mb-2">
              Welcome Back
            </h1>
            <p className="cb-text-caption">
              Sign in to your ClassBridge account to continue
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="cb-form-group">
              <label className="cb-label cb-label-required">Email Address</label>
              <div className="cb-input-group">
                <span className="cb-input-icon">📧</span>
                <input
                  type="email"
                  name="email"
                  className="cb-input cb-input-with-icon"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="cb-form-group">
              <label className="cb-label cb-label-required">Password</label>
              <div className="cb-input-group">
                <span className="cb-input-icon">🔒</span>
                <input
                  type="password"
                  name="password"
                  className="cb-input cb-input-with-icon"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="cb-alert cb-alert-error cb-mb-4">
                <div className="cb-alert-icon">⚠️</div>
                <div className="cb-alert-content">
                  <div className="cb-alert-title">Sign In Failed</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="cb-button cb-button-primary cb-button-lg"
              disabled={loading}
              style={{ width: '100%', marginBottom: 'var(--space-6)' }}
            >
              {loading ? (
                <>
                  <div className="cb-spinner"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="cb-text-center">
            <p className="cb-text-caption-sm">
              Don't have an account?{' '}
              <span style={{ 
                color: 'var(--color-primary-600)', 
                fontWeight: 'var(--font-medium)' 
              }}>
                Contact your administrator
              </span>
            </p>
            <div className="cb-mt-4">
              <p className="cb-text-caption-sm" style={{ color: 'var(--color-text-quaternary)' }}>
                🔒 Secure login powered by ClassBridge
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernLogin;