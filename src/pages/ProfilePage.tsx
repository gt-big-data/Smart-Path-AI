import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, ChevronLeft, LogOut, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { STUDYING_SINCE } from '../config/profile';

const header = 'mx-auto flex h-19 w-[min(1180px,calc(100%_-_48px))] items-center border-b border-[#cfd9d7] max-[700px]:w-[calc(100%_-_32px)]';
const content = 'mx-auto w-[min(1040px,calc(100%_-_48px))] max-[700px]:w-[calc(100%_-_32px)]';
const navLink = 'text-[13px] font-medium text-[#4f5f5c] no-underline transition-colors hover:text-teal-dark';
const logoutButton =
  'inline-flex h-9 cursor-pointer items-center rounded-xs border-0 bg-[#c4474d] px-[15px] text-[13px] font-medium text-white transition-colors hover:bg-[#a9363d]';
const backButton =
  'inline-flex h-9 items-center gap-[7px] rounded-xs border border-[#b9c7c4] bg-white px-3 text-[13px] font-semibold text-[#4f5e5b] no-underline transition-colors hover:border-[#9fc7c1] hover:bg-teal-pale hover:text-teal-dark';
const statusPill =
  'inline-flex h-[26px] items-center rounded-full bg-teal px-3 text-xs font-semibold text-white';
const signOutButton =
  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-xs border border-[#c4474d] bg-white px-3.5 text-[13px] font-semibold text-[#c4474d] transition-colors hover:bg-[#fbeaec] hover:text-[#a9363d]';
const sectionTitle = 'mb-3 mt-0 text-base font-semibold text-[#172321]';

function AccountRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-14 grid-cols-[20px_150px_minmax(0,1fr)] items-center gap-3 border-b border-[#e3e9e8] text-sm text-[#263330]">
      <span className="text-teal">{icon}</span>
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center justify-between border-b border-[#e3e9e8] px-2.5 text-sm font-medium text-[#172321] no-underline transition-colors hover:bg-teal-pale hover:text-teal-dark focus-visible:bg-teal-pale focus-visible:text-teal-dark focus-visible:outline-none"
    >
      {label}
      <ArrowRight size={18} className="text-teal" aria-hidden="true" />
    </Link>
  );
}

export default function ProfilePage() {
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7f9f8] font-brand text-[#172321]">
        <p className="m-0 text-base text-muted">Please log in to view your profile.</p>
        <Link
          to="/login"
          className="inline-flex h-9 items-center rounded-xs bg-teal px-4 text-[13px] font-medium text-white no-underline transition-colors hover:bg-teal-dark"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9f8] font-brand text-[#172321]">
      <header className={header}>
        <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold text-[#172321] no-underline">
          <span className="grid h-7.5 w-7.5 place-items-center rounded-xs bg-teal text-white">
            <Brain size={17} aria-hidden="true" />
          </span>
          <span>SmartPath</span>
        </Link>
        <nav className="ml-auto flex items-center gap-6" aria-label="Account navigation">
          <Link to="/chat" className={navLink}>
            Dashboard
          </Link>
          <Link to="/progress" className={navLink}>
            Progress
          </Link>
          <button type="button" className={logoutButton} onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      <main className={`${content} pb-24 pt-14`}>
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-[30px] font-semibold tracking-[-0.02em] text-[#172321]">Profile</h1>
          <Link to="/" className={backButton}>
            <ChevronLeft size={18} aria-hidden="true" />
            Home
          </Link>
        </div>

        <section
          aria-label="Profile details"
          className="mt-6 grid min-h-[480px] grid-cols-[280px_minmax(0,1fr)] rounded-[4px] border border-[#cbd7d4] bg-[#fbfcfc] max-[700px]:grid-cols-1"
        >
          <aside aria-label="Profile summary" className="flex flex-col border-r border-[#bfd9d4] bg-teal-pale p-6 max-[700px]:border-r-0 max-[700px]:border-b">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-teal text-white">
              <User size={28} aria-hidden="true" />
            </div>
            <p className="m-0 text-[22px] font-bold tracking-[-0.02em] text-[#172321]">{userName || 'User'}</p>
            <p className="mb-0 mt-1.5 text-[13px] text-muted">SmartPathAI member</p>
            <div className="mt-auto border-t border-line pt-5">
              <span className="block text-xs text-muted">Studying since</span>
              <strong className="mt-1 block text-sm font-semibold text-[#172321]">{STUDYING_SINCE}</strong>
            </div>
          </aside>

          <div className="flex flex-col p-6 px-7">
            <section aria-labelledby="account-info-title">
              <h2 id="account-info-title" className={sectionTitle}>
                Account information
              </h2>
              <AccountRow icon={<User size={18} aria-hidden="true" />} label="Display name">
                {userName || 'Not set'}
              </AccountRow>
              <AccountRow icon={<Shield size={18} aria-hidden="true" />} label="Account status">
                <span className={statusPill}>Active</span>
              </AccountRow>
            </section>

            <section aria-labelledby="quick-links-title" className="mt-8">
              <h2 id="quick-links-title" className={sectionTitle}>
                Quick links
              </h2>
              <QuickLink to="/chat" label="Dashboard" />
              <QuickLink to="/progress" label="Progress" />
            </section>

            <footer className="mt-auto flex h-[61px] items-end justify-end border-t border-line">
              <button type="button" className={signOutButton} onClick={handleLogout}>
                <LogOut size={18} aria-hidden="true" />
                Sign out
              </button>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
