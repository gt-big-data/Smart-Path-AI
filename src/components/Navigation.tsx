import React from 'react';
import { Brain, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navigation() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="container mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <Brain className="h-8 w-8 text-teal-500" />
          <span className="text-xl font-bold text-slate-800">SmartPathAI</span>
        </Link>
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20 inline-flex items-center gap-2 btn-lift"
          >
            Logout <LogOut className="h-5 w-5" />
          </button>
        ) : (
          <Link
            to="/login"
            className="px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20 btn-lift"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}