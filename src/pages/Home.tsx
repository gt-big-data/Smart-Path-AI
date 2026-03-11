import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, TrendingUp, User, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';

const featureCards = [
  {
    title: 'Dashboard',
    description: 'Upload PDFs, chat with AI, and explore interactive knowledge graphs.',
    icon: LayoutDashboard,
    to: '/chat',
    requiresAuth: true,
    color: 'teal',
  },
  {
    title: 'Progress',
    description: 'Review quiz scores, confidence levels, and learning trends.',
    icon: TrendingUp,
    to: '/progress',
    requiresAuth: true,
    color: 'blue',
  },
  {
    title: 'Profile',
    description: 'Manage your account settings and preferences.',
    icon: User,
    to: '/profile',
    requiresAuth: true,
    color: 'violet',
  },
  {
    title: 'About Us',
    description: 'Meet the team behind SmartPathAI and learn more about the project.',
    icon: Users,
    to: '/about',
    requiresAuth: false,
    color: 'amber',
  },
] as const;

const colorMap: Record<string, { icon: string; border: string; shadow: string; bg: string }> = {
  teal: {
    icon: 'text-teal-500',
    border: 'hover:border-teal-300',
    shadow: 'hover:shadow-teal-500/5',
    bg: 'bg-teal-50',
  },
  blue: {
    icon: 'text-blue-500',
    border: 'hover:border-blue-300',
    shadow: 'hover:shadow-blue-500/5',
    bg: 'bg-blue-50',
  },
  violet: {
    icon: 'text-violet-500',
    border: 'hover:border-violet-300',
    shadow: 'hover:shadow-violet-500/5',
    bg: 'bg-violet-50',
  },
  amber: {
    icon: 'text-amber-500',
    border: 'hover:border-amber-300',
    shadow: 'hover:shadow-amber-500/5',
    bg: 'bg-amber-50',
  },
};

export default function Home() {
  const { isAuthenticated, userName } = useAuth();
  const navigate = useNavigate();

  const handleCardClick = (card: (typeof featureCards)[number]) => {
    if (card.requiresAuth && !isAuthenticated) {
      navigate('/login');
    } else {
      navigate(card.to);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
      <Navigation />

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {isAuthenticated && userName ? (
            <h1 className="text-5xl font-bold text-slate-800 mb-6 animate-fade-in">
              Hello, {userName}
            </h1>
          ) : (
            <h1 className="text-5xl font-bold text-slate-800 mb-6 animate-fade-in">
              Transform Your Learning with AI
            </h1>
          )}
          <p className="text-xl text-slate-600 mb-8">
            Personalized study assistance powered by artificial intelligence to help you learn smarter, not harder.
          </p>

          {!isAuthenticated && (
            <div className="flex justify-center gap-4 mb-4">
              <Link
                to="/signup"
                className="px-8 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all inline-flex items-center gap-2 shadow-lg shadow-teal-500/25 btn-lift"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 max-w-5xl mx-auto">
          {featureCards.map((card) => {
            const colors = colorMap[card.color];
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                onClick={() => handleCardClick(card)}
                className={`group text-left p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 ${colors.border} transition-all shadow-sm hover:shadow-md ${colors.shadow} btn-lift`}
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${colors.bg} mb-4`}>
                  <Icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-slate-800 group-hover:text-slate-900">
                  {card.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {card.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-slate-400 group-hover:text-teal-500 transition-colors">
                  {card.requiresAuth && !isAuthenticated ? 'Login to access' : 'Go'}
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
