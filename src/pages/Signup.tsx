import React, { useState } from 'react';
import { Brain, ArrowLeft, Check, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const validatePassword = (password: string): { isValid: boolean; error: string } => {
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  if (password.length > 32) {
    return { isValid: false, error: 'Password cannot be longer than 32 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*?]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character' };
  }
  return { isValid: true, error: '' };
};

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // State to hold error messages
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  // Add new state for tracking individual requirements
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  const navigate = useNavigate();
  const { signup, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Reset errors each submit
    setEmailError('');
    setPasswordError('');
    setFormError('');

    if (!email || !password || !confirmPassword || !name) {
      setFormError('All fields are required');
      return;
    }

    // Validate password
    const { isValid, error } = validatePassword(password);
    if (!isValid) {
      setPasswordError(error);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await signup(email, password, name);
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      if (errorMessage.includes('already exists')) {
        setEmailError(errorMessage);
      } else {
        setFormError(errorMessage);
      }
}
  };

  const handleGoogleSignup = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  // Add password check on input change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    // Update requirement checks
    setPasswordRequirements({
      length: newPassword.length >= 8 && newPassword.length <= 32,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    });
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50 flex flex-col">
        <div className="container mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center text-teal-600 hover:text-teal-700">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/50 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center space-x-2 mb-4">
                <Brain className="h-10 w-10 text-teal-500" />
                <span className="text-2xl font-bold text-slate-800">SmartPathAI</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-800">Create an account</h2>
              <p className="text-slate-500 mt-2">Start your learning journey today</p>
            </div>

            <div className="mb-6">
              <button
                onClick={handleGoogleSignup}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 shadow-sm"
              >
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="w-5 h-5"
                  onError={(e) => {
                    e.currentTarget.src = "https://www.gstatic.com/images/branding/product/1x/google_2015_64dp.png";
                  }}
                />
                <span className="text-gray-600 font-medium">Continue with Google</span>
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Enter your email"
                />
                {emailError && (
                    <p className="text-red-600 text-sm mt-1">{emailError}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Create a password"
                />
                <div className="mt-2 text-sm text-gray-600">
                  <p className="font-medium mb-1">Password requirements:</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">
                      {passwordRequirements.length ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className={passwordRequirements.length ? "text-green-600" : "text-gray-600"}>
                        Between 8 and 32 characters
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {passwordRequirements.uppercase ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className={passwordRequirements.uppercase ? "text-green-600" : "text-gray-600"}>
                        At least one uppercase letter
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {passwordRequirements.lowercase ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className={passwordRequirements.lowercase ? "text-green-600" : "text-gray-600"}>
                        At least one lowercase letter
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {passwordRequirements.number ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className={passwordRequirements.number ? "text-green-600" : "text-gray-600"}>
                        At least one number
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      {passwordRequirements.special ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className={passwordRequirements.special ? "text-green-600" : "text-gray-600"}>
                        At least one special character (!@#$%^&*?)
                      </span>
                    </li>
                  </ul>
                </div>
                {passwordError && (
                    <p className="text-red-600 text-sm mt-1">{passwordError}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Confirm your password"
                />
              </div>

              <div className="flex items-center">
                <input
                    id="terms"
                    type="checkbox"
                    required
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" className="text-teal-600 hover:text-teal-700">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-teal-600 hover:text-teal-700">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {formError && (
                  <p className="text-red-600 text-sm mt-1">{formError}</p>
              )}

              <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg px-4 py-2.5 font-medium hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 shadow-md shadow-teal-500/20 transition-all btn-lift"
              >
                Create Account
              </button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
  );
}
