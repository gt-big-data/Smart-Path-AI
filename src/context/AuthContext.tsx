import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userName: string | null;
  isLoading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  setIsAuthenticated: (auth: boolean) => void;
  setUserName: (name: string | null) => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkAuth = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:4000/auth/check-auth', {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (response.ok && data.authenticated) {
        setIsAuthenticated(true);
        setUserName(data.user.displayName || data.user.name || data.user.email);
      } else {
        setIsAuthenticated(false);
        setUserName(null);
      }
    } catch (err) {
      console.error('Check auth error:', err);
      setIsAuthenticated(false);
      setUserName(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Check auth status when the app loads
  useEffect(() => {
    checkAuth();
  }, []);

  const signup = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('http://localhost:4000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include', // This is important for cookies/session
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }
      
      // Make sure we're setting the auth state after successful signup
      const nameFromServer = data.user.displayName || data.user.name || data.user.email;
      setIsAuthenticated(true);
      setUserName(nameFromServer);
    } catch (err) {
      console.error('Signup error:', err);
      setIsAuthenticated(false);
      setUserName(null);
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const nameFromServer = data.user?.displayName || data.user?.name || data.user?.email || 'Unknown User';
      setIsAuthenticated(true);
      setUserName(nameFromServer);
    } catch (err) {
      console.error('Login error:', err);
      setIsAuthenticated(false);
      setUserName(null);
      throw err; // Re-throw the error to be caught by the component
    }
  };

  const loginWithGoogle = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  const logout = async () => {
    try {
      const response = await fetch('http://localhost:4000/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      
      setIsAuthenticated(false);
      setUserName(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Still clear the local state even if the server request fails
      setIsAuthenticated(false);
      setUserName(null);
      throw err;
    }
  };

  const value = {
    isAuthenticated,
    userName,
    isLoading,
    signup,
    login,
    logout,
    loginWithGoogle,
    setIsAuthenticated,
    setUserName,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
