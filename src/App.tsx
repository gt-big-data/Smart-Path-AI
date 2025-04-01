import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Navigation from './components/Navigation';
import { AuthProvider, useAuth } from './context/AuthContext';

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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <Navigation />

      {/* Show "Hello, Name" if logged in */}
      {isAuthenticated && userName && (
        <div className="container mx-auto px-6 pt-6 text-xl">
          <p>Hello, {userName}!</p>
        </div>
      )}

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Transform Your Learning with AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Personalized study assistance powered by artificial intelligence to help you learn smarter, not harder.
          </p>
          <div className="flex justify-center gap-4">
            {/* <Link
              to={isAuthenticated ? "/chat" : "/signup"}
              onClick={handleChatClick}
              className="px-8 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
            >
              {isAuthenticated ? "Start a new chat" : "Get Started"} <ArrowRight className="h-5 w-5" />
            </Link> */
            <Link
  to={isAuthenticated ? "/chat" : "/signup"}
  className="px-8 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
>
  {isAuthenticated ? "Start a new chat" : "Get Started"} <ArrowRight className="h-5 w-5" />
</Link>
            }
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <BookOpen className="h-12 w-12 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Smart Study Plans</h3>
            <p className="text-gray-600">
              AI-generated study schedules tailored to your learning style and goals.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <Sparkles className="h-12 w-12 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Intelligent Practice</h3>
            <p className="text-gray-600">
              Adaptive quizzes and exercises that evolve with your progress.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <BookOpen className="h-12 w-12 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI Tutoring</h3>
            <p className="text-gray-600">
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
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
