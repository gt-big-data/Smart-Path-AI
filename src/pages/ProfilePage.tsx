import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronLeft, Shield } from 'lucide-react';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';

const ProfilePage: React.FC = () => {
  const { isAuthenticated, userName, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center">
            <p className="text-lg text-slate-600 mb-4">Please log in to view your profile.</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20 btn-lift"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
      <Navigation />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Your Profile</h1>
              <p className="text-slate-500 mt-1">Manage your account settings</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200/60 rounded-lg hover:bg-white transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
              Home
            </button>
          </div>

          {/* Profile Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
            {/* Avatar & Name Header */}
            <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-8 py-10">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{userName || 'User'}</h2>
                  <p className="text-teal-100 text-sm mt-1">SmartPathAI Member</p>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="p-8 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Account Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Display Name</p>
                      <p className="text-slate-800 font-medium">{userName || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <Shield className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Account Status</p>
                      <p className="text-green-600 font-medium">Active</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Quick Links</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/chat')}
                    className="p-3 text-left bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-100"
                  >
                    <p className="text-sm font-medium text-teal-700">Dashboard</p>
                    <p className="text-xs text-teal-500 mt-0.5">Chat & explore</p>
                  </button>
                  <button
                    onClick={() => navigate('/progress')}
                    className="p-3 text-left bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                  >
                    <p className="text-sm font-medium text-blue-700">Progress</p>
                    <p className="text-xs text-blue-500 mt-0.5">View scores</p>
                  </button>
                </div>
              </div>

              {/* Logout */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all border border-red-100 font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;

