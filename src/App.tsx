import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Navigation from './components/Navigation';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProgressProvider } from './context/ProgressContext';
import ProfilePage from './pages/ProfilePage';

function Home() {
  // Access auth state
  const { isAuthenticated, userName } = useAuth();

  // const handleChatClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  //   if (isAuthenticated) {
  //     // Open in new tab when authenticated
  //     window.open('/chat', '_blank');
  //     e.preventDefault();
  //   }
  // };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
      <Navigation />

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {isAuthenticated && userName ? (
            <h1 className="text-5xl font-bold text-slate-800 mb-6">
              Hello, {userName}
            </h1>
          ) : (
            <h1 className="text-5xl font-bold text-slate-800 mb-6">
              Transform Your Learning with AI
            </h1>
          )}
          <p className="text-xl text-slate-600 mb-8">
            Personalized study assistance powered by artificial intelligence to help you learn smarter, not harder.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to={isAuthenticated ? "/chat" : "/signup"}
              className="px-8 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all inline-flex items-center gap-2 shadow-lg shadow-teal-500/25 btn-lift"
            >
              {isAuthenticated ? "Start a new chat" : "Get Started"}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 hover:border-teal-300 transition-all shadow-sm hover:shadow-md hover:shadow-teal-500/5">
            <BookOpen className="h-12 w-12 text-teal-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-slate-800">Smart Study Plans</h3>
            <p className="text-slate-600">
              AI-generated study schedules tailored to your learning style and goals.
            </p>
          </div>
          <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 hover:border-teal-300 transition-all shadow-sm hover:shadow-md hover:shadow-teal-500/5">
            <Sparkles className="h-12 w-12 text-teal-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-slate-800">Intelligent Practice</h3>
            <p className="text-slate-600">
              Adaptive quizzes and exercises that evolve with your progress.
            </p>
          </div>
          <div className="p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 hover:border-teal-300 transition-all shadow-sm hover:shadow-md hover:shadow-teal-500/5">
            <BookOpen className="h-12 w-12 text-teal-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-slate-800">AI Tutoring</h3>
            <p className="text-slate-600">
              24/7 AI-powered tutoring support to answer your questions instantly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const response = await fetch('/api/auth/check');
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    };
    checkAuth();
  }, []);

  return (
    <AuthProvider>
      <ProgressProvider>
        <AppContent />
      </ProgressProvider>
    </AuthProvider>
  );
}

export default App;
