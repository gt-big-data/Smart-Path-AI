import React, { useState } from 'react';
import { Brain, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Single error for the login form
  const [loginError, setLoginError] = useState('');

  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(''); // Clear previous errors

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      // Handle error response from the backend
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setLoginError(errorMessage);
    }
  };

  // Simplified Google login - direct redirect
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="container mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center text-purple-400 hover:text-purple-300">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center space-x-2 mb-4">
                <Brain className="h-10 w-10 text-purple-400" />
                <span className="text-2xl font-bold text-white">SmartPathAI</span>
              </div>
              <h2 className="text-3xl font-bold text-white">Welcome back</h2>
              <p className="text-gray-300 mt-2">Please enter your details to sign in</p>
            </div>

            {/* Google Login */}
            <div className="mb-6">
              <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-700 focus:outline-offset-0"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
                Continue with Google
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email address
                </label>
                <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter your password"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                      id="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 bg-gray-800 border-gray-700 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                    Remember me
                  </label>
                </div>
                <button type="button" className="text-sm text-purple-400 hover:text-purple-300">
                  Forgot password?
                </button>
              </div>

              {/* Show an error message, if any */}
              {loginError && (
                  <p className="text-red-400 text-sm">{loginError}</p>
              )}

              <button
                  type="submit"
                  className="w-full bg-purple-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Sign in
              </button>

              <p className="text-center text-sm text-gray-400">
                Don't have an account?{' '}
                <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
  );
}
