import React from 'react';
import { Brain, LogOut } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { label: 'Dashboard', to: '/chat', authRequired: true },
  { label: 'Progress', to: '/progress', authRequired: true },
  { label: 'Profile', to: '/profile', authRequired: true },
  { label: 'About Us', to: '/about', authRequired: false },
];

export default function Navigation() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const visibleLinks = navLinks.filter(
    (link) => !link.authRequired || isAuthenticated,
  );

  return (
    <nav className="container mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <Brain className="h-8 w-8 text-teal-500" />
          <span className="text-xl font-bold text-slate-800">SmartPathAI</span>
        </Link>

        <div className="flex items-center gap-1">
          {/* Navigation links */}
          {visibleLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Auth button */}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="ml-2 px-5 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20 inline-flex items-center gap-2 text-sm font-medium btn-lift"
            >
              Logout <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link
                to="/login"
                className="px-5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20 text-sm font-medium btn-lift"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}