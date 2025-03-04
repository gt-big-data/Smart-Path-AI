import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userName: string | null;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  setIsAuthenticated: (auth: boolean) => void;
  setUserName: (name: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // Check for an existing session when the component mounts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:4000/auth/me', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setIsAuthenticated(true);
            // Check both "displayName" and "name"
            setUserName(data.user.displayName || data.user.name || data.user.email || 'Unknown User');
          }
        }
      } catch (err) {
        console.error(err);
        setIsAuthenticated(false);
        setUserName(null);
      }
    })();
  }, []);

  const signup = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('http://localhost:4000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name}),
        credentials: 'include',
      });
      console.log('Signup response:', response);
      if (!(response.ok)) {
        throw new Error('Signup failed');
      }
      const data = await response.json();
      console.log('Signup response:', data);
      // Try to use "displayName", then "name", then fallback to email
      const nameFromServer = data.user.displayName || data.user.email;
      setIsAuthenticated(true);
      setUserName(nameFromServer);
    } catch (err) {
      console.error(err);
      setIsAuthenticated(false);
      setUserName(null);
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
      if (!response.ok) {
        throw new Error('Login failed');
      }
      const data = await response.json();
      const nameFromServer = data.user?.displayName || data.user?.name || data.user?.email || 'Unknown User';
      setIsAuthenticated(true);
      setUserName(nameFromServer);
    } catch (err) {
      console.error(err);
      setIsAuthenticated(false);
      setUserName(null);
    }
  };

  const loginWithGoogle = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  const logout = async () => {
    try {
      await fetch('http://localhost:4000/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error(err);
    }
    setIsAuthenticated(false);
    setUserName(null);
  };

  return (
      <AuthContext.Provider
          value={{
            isAuthenticated,
            userName,
            signup,
            login,
            loginWithGoogle,
            logout,
            setIsAuthenticated,
            setUserName,
          }}
      >
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
