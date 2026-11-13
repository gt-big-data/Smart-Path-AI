import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { ArrowRight, Brain, Linkedin, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const container = 'mx-auto w-[min(1180px,calc(100%_-_48px))] max-[700px]:w-[calc(100%_-_32px)]';
const landingButton = 'cursor-pointer border-0 transition-all duration-200 hover:-translate-y-px active:translate-y-0';
const accountButton = `${landingButton} bg-transparent p-0 text-[13px] font-medium text-[#4f5f5c] hover:text-teal-dark`;
const accountActionButton = `${landingButton} rounded-[2px] px-[15px] py-[9px] text-[13px] font-medium text-white`;
const navLink = 'text-[13px] font-medium text-[#4f5f5c] no-underline transition-colors hover:text-teal-dark';
const sectionEyebrow = 'text-[11px] font-bold uppercase tracking-[0.13em] text-teal';
const bubble = 'max-w-[78%] px-[13px] py-[11px] text-xs leading-[1.55]';
const memberLink =
  'inline-flex items-center gap-[5px] border border-[#91b8b3] bg-[#f4f8f7] px-[9px] py-[7px] text-xs font-semibold text-[#0f655e] no-underline transition-colors hover:border-teal hover:bg-[#e8f3f1] hover:text-[#0b5952]';
const missionTwinkles = [
  { left: '14%', top: '18%', size: 6, delay: '-0.2s', duration: '2.3s' },
  { left: '68%', top: '12%', size: 4, delay: '-1.4s', duration: '3.1s' },
  { right: '13%', top: '31%', size: 6, delay: '-0.8s', duration: '2.6s' },
  { left: '20%', bottom: '20%', size: 7, delay: '-2.1s', duration: '3.5s' },
  { right: '22%', bottom: '15%', size: 6, delay: '-1.1s', duration: '2.2s' },
  { right: '7%', bottom: '36%', size: 4, delay: '-0.4s', duration: '3.3s' },
  { left: '43%', top: '25%', size: 3, delay: '-2.5s', duration: '2.9s' },
  { left: '34%', bottom: '9%', size: 4, delay: '-1.7s', duration: '3.7s' },
  { right: '36%', top: '8%', size: 3, delay: '-0.9s', duration: '2.5s' },
  { left: '8%', top: '52%', size: 4, delay: '-2.8s', duration: '3.2s' },
] as const;

const graphLinks = 'M278 150 104 78M278 150 444 69M278 150 460 224M278 150 115 238M104 78 444 69M115 238 460 224';
const graphNodes = [
  { x: 104, y: 78, r: 36, labels: ['Glucose'], main: false },
  { x: 444, y: 69, r: 39, labels: ['ATP'], main: false },
  { x: 278, y: 150, r: 55, labels: ['Cellular', 'respiration'], main: true },
  { x: 115, y: 238, r: 39, labels: ['Pyruvate'], main: false },
  { x: 460, y: 224, r: 42, labels: ['Glycolysis'], main: false },
];

const examOptions = [
  { letter: 'A', text: 'Krebs cycle', selected: false },
  { letter: 'B', text: 'Glycolysis', selected: true },
  { letter: 'C', text: 'Electron transport', selected: false },
  { letter: 'D', text: 'Fermentation', selected: false },
];

function ChatPreview() {
  return (
    <>
      <div className="flex h-8.75 items-center border-b border-line bg-[#eef3f2] px-3.25 text-[10px] text-[#6b7d79]">
        Cell biology review
      </div>
      <div className="flex h-[calc(100%-35px)] flex-col gap-4 bg-[#f8faf9] p-9.5 max-[700px]:px-4.5 max-[700px]:py-6">
        <div className={`${bubble} rounded-[5px_13px_13px] bg-[#e8f1ef]`}>
          How does glycolysis connect to ATP production?
        </div>
        <div className={`${bubble} self-end rounded-[13px_5px_13px_13px] bg-teal text-white`}>
          Glycolysis produces a net gain of two ATP and prepares glucose for the next stage of cellular respiration.
        </div>
        <div className="mt-auto flex justify-between rounded-[3px] border border-line px-3 py-2.75 text-[11px] text-[#9aa8a5]">
          Ask a follow-up question <Send size={14} className="text-teal" />
        </div>
      </div>
    </>
  );
}

function GraphPreview() {
  return (
    <div className="h-full bg-[#f8faf9]" aria-label="Knowledge graph preview">
      <svg viewBox="0 0 560 300" role="img" className="h-full w-full">
        <path d={graphLinks} fill="none" stroke="#9ebbb7" strokeWidth={1.5} />
        {graphNodes.map((node) => (
          <g key={node.labels.join(' ')}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              className={node.main ? 'fill-teal stroke-teal-dark' : 'fill-white stroke-[#6f9e98]'}
              strokeWidth={1.5}
            />
            {node.labels.map((label, index) => (
              <text
                key={label}
                x={node.x}
                y={node.y + 4 + (index - (node.labels.length - 1) / 2) * 17}
                textAnchor="middle"
                className={`text-xs font-semibold ${node.main ? 'fill-white' : 'fill-[#36534e]'}`}
              >
                {label}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

function ExamPreview() {
  return (
    <div className="h-full bg-paper p-12 max-[700px]:px-4.5 max-[700px]:py-6">
      <div className="flex justify-between text-[11px] text-muted">
        <span>Practice exam</span>
        <strong>Question 04 / 15</strong>
      </div>
      <h3 className="mb-6 mt-10.5 max-w-127.5 text-2xl font-medium">
        Which process produces a net gain of two ATP?
      </h3>
      <div className="grid grid-cols-2 gap-2.5 text-xs max-[700px]:grid-cols-1">
        {examOptions.map((option, index) => (
          <span
            key={option.letter}
            className={`border p-3 ${option.selected ? 'border-teal bg-[#e8f3f1] text-teal-dark' : 'border-line'} ${index > 2 ? 'max-[700px]:hidden' : ''}`}
          >
            {`${option.letter}\u00a0\u00a0 ${option.text}`}
          </span>
        ))}
      </div>
      <div className="mt-9.5 h-0.75 bg-[#d7e2df]">
        <i className="block h-full w-[48%] bg-teal" />
      </div>
    </div>
  );
}

function ProgressPreview() {
  return (
    <div className="h-full bg-[#f8faf9] p-12 max-[700px]:px-4.5 max-[700px]:py-6">
      <div className="flex justify-between text-[11px] text-muted">
        <span>Concept confidence</span>
        <strong className="text-[28px] font-medium text-teal">78%</strong>
      </div>
      <svg viewBox="0 0 520 220" role="img" className="mt-6.5 h-55 w-full">
        <path d="M15 184C94 180 109 130 174 143S270 88 326 103 410 32 505 47" fill="none" stroke="#147d74" strokeWidth={3} />
        <path d="M15 190H505" fill="none" stroke="#c4d2cf" strokeWidth={1} />
      </svg>
      <p className="text-xs text-muted">12 concepts mastered this week</p>
    </div>
  );
}

const productShots = [
  { number: '01', title: 'Ask your material', content: <ChatPreview /> },
  { number: '02', title: 'See the connections', content: <GraphPreview /> },
  { number: '03', title: 'Practice with purpose', content: <ExamPreview /> },
  { number: '04', title: 'Track what is sticking', content: <ProgressPreview /> },
];

type LandingTeamMember = { name: string; linkedin?: string; portfolio?: string; photo?: string };
type LandingTeam = { name: string; members: LandingTeamMember[] };

const landingTeams: LandingTeam[] = [
  {
    name: 'Project Leads',
    members: [
      { name: 'Vinh Pham', linkedin: 'https://www.linkedin.com/in/vinh-t-pham/', photo: '/team/vihn.png' },
      { name: 'Raghav Garg', linkedin: 'https://www.linkedin.com/in/raghav-garg-22b787303/', photo: '/team/raghav.jpg' },
    ],
  },
  {
    name: 'Quiz Intelligence',
    members: [
      { name: 'Akhil Bejjanki', linkedin: 'https://www.linkedin.com/in/akhil-bejjanki-9b5628366/', photo: '/team/akhil.png' },
      { name: 'Jayan Sirikonda', linkedin: 'https://www.linkedin.com/in/jayan-sirikonda/', photo: '/team/jayan.png' },
      { name: 'Nidhi Nagumalla' },
    ],
  },
  {
    name: 'Platform',
    members: [{ name: 'Amodh Naik', linkedin: 'https://www.linkedin.com/in/amodh-naik/', photo: '/team/amod.jpeg' }],
  },
  {
    name: 'Practice Exam Generation',
    members: [{ name: 'Aarav Khatri' }, { name: 'Sohil Kadam' }, { name: 'Akshaj Dewan' }],
  },
  {
    name: 'Knowledge Graph',
    members: [{ name: 'Bayan Mardon' }, { name: 'Ronika Medegam' }, { name: 'Ben Doan' }, { name: 'Shreeja Das' }],
  },
];

function TeamRoster() {
  return (
    <section className={`${container} pb-26.25 pt-20.5`} id="team">
      <div className="grid grid-cols-[80px_1fr] border-t border-[#9fb5b1] pt-7 max-[700px]:grid-cols-[45px_1fr]">
        <span className="text-xs text-teal">03</span>
        <div>
          <p className="mb-2 mt-0 text-xs uppercase tracking-widest text-[#687875]">People behind the path</p>
          <h2 className="m-0 text-[38px] font-medium tracking-[-0.035em] max-[700px]:text-[30px]">
            Built by a team that cares about how people learn.
          </h2>
        </div>
      </div>
      <div className="mt-17.5 grid gap-21 max-[700px]:mt-11.25">
        {landingTeams.map((team) => (
          <section className="border-t border-[#c7d4d2] pt-4.5" key={team.name}>
            <div className="mb-9.5 flex items-baseline justify-between">
              <h3 className="m-0 text-[17px] font-semibold">{team.name}</h3>
              <span className="text-[10px] text-[#84928f]">{team.members.length.toString().padStart(2, '0')}</span>
            </div>
            <div className="grid grid-cols-4 gap-8.5 max-[700px]:grid-cols-2 max-[700px]:gap-y-11.25">
              {team.members.map((member, index) => (
                <article className="block" key={`${team.name}-${member.name}`}>
                  <div className="mb-5.5 grid aspect-square w-33 place-items-center overflow-hidden rounded-full bg-[#dce8e6] text-xs tracking-widest text-teal max-[700px]:w-[min(120px,100%)]">
                    {member.photo ? (
                      <img className="h-full w-full object-cover object-[50%_20%]" src={member.photo} alt={member.name} />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </div>
                  <h4 className="mb-4.5 mt-0 text-lg font-semibold">{member.name}</h4>
                  <div className="flex gap-4.5">
                    <a
                      className={memberLink}
                      href={member.linkedin ?? '#'}
                      onClick={(event) => !member.linkedin && event.preventDefault()}
                      target={member.linkedin ? '_blank' : undefined}
                      rel={member.linkedin ? 'noreferrer' : undefined}
                    >
                      <Linkedin size={12} />
                      LinkedIn
                    </a>
                    {member.portfolio ?
                      (<a className={memberLink} href="#" onClick={(event) => event.preventDefault()}>
                        Portfolio ↗
                      </a>) : 
                      <></>
                    }
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { isAuthenticated, userName, logout } = useAuth();
  const navigate = useNavigate();
  const productScroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      const scroller = productScroller.current;
      if (!scroller) return;
      const next = scroller.scrollLeft + Math.min(738, scroller.clientWidth * 0.82);
      scroller.scrollTo({
        left: next + scroller.clientWidth >= scroller.scrollWidth ? 0 : next,
        behavior: 'smooth',
      });
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f9f8] font-brand text-[#172321]">
      <header className={`relative flex h-19 items-center border-b border-[#cfd9d7] ${container}`}>
        <button
          type="button"
          className={`${landingButton} inline-flex items-center gap-2.5 bg-transparent p-0 text-lg font-bold text-[#172321]`}
          onClick={() => window.scrollTo({ top: 0 })}
        >
          <span className="grid h-7.5 w-7.5 place-items-center rounded-xs bg-teal text-white">
            <Brain size={17} />
          </span>
          <span>SmartPath</span>
        </button>
        <nav className="ml-7 flex items-center gap-6 max-[700px]:hidden" aria-label="Landing page navigation">
          <a href="#product" className={navLink} onClick={(event) => scrollToSection(event, 'product')}>Product</a>
          <a href="#team" className={navLink} onClick={(event) => scrollToSection(event, 'team')}>Team</a>
        </nav>
        <nav className="ml-auto flex items-center gap-6 max-[700px]:gap-3" aria-label="Account navigation">
          {isAuthenticated ? (
            <>
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#c5dcd8] bg-[#edf7f5] px-3.25 py-1.75 text-sm font-semibold text-[#176860] max-[700px]:hidden">
                {userName ? `Hi, ${userName}` : 'Signed in'}
              </span>
              <button type="button" className={accountButton} onClick={() => navigate('/chat')}>Dashboard</button>
              <button type="button" className={accountButton} onClick={() => navigate('/progress')}>Progress</button>
              <button type="button" className={`${accountActionButton} bg-[#c4474d] hover:bg-[#a9363d]`} onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button type="button" className={`${accountActionButton} bg-[#445250] hover:bg-teal-dark`} onClick={() => navigate('/login')}>
                Log in
              </button>
              <button type="button" className={`${accountActionButton} bg-teal hover:bg-teal-dark`} onClick={() => navigate('/signup')}>
                Sign up
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className={`${container} pb-23 pt-24 text-center max-[700px]:pb-18 max-[700px]:pt-19`}>
          <span className={sectionEyebrow}>AI-powered learning companion</span>
          <h1 className="mb-0 mt-5.5 text-[clamp(34px,4.5vw,56px)] font-medium leading-[1.12] tracking-[-0.04em]">
            Turn course material into connected knowledge you can explore, question, and practice.
          </h1>
          <button
            type="button"
            className={`${landingButton} mt-8 inline-flex items-center gap-2.25 border-x-0 border-t-0 border-b border-teal bg-transparent pb-1.5 text-[13px] font-semibold text-[#116d65]`}
            onClick={() => navigate(isAuthenticated ? '/chat' : '/login')}
          >
            Open the workspace <ArrowRight size={17} />
          </button>
        </section>

        <section className="overflow-hidden pb-26.25" id="product">
          <div className={`${container} mb-5.5 flex gap-3.5 border-t border-[#9fb5b1] pt-5 text-[11px] uppercase tracking-widest text-[#697b78]`}>
            <span>01</span>
            <p className="m-0">A clearer path through complex material</p>
          </div>
          <div
            ref={productScroller}
            className="flex snap-x snap-mandatory gap-4.5 overflow-x-auto px-[max(24px,calc((100vw-1180px)/2))] scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            {productShots.map((shot) => (
              <article className="w-[min(720px,78vw)] shrink-0 snap-center max-[700px]:w-[91vw]" key={shot.number}>
                <div className="flex h-12 items-center gap-3.5 px-0.5 text-[#1e302d]">
                  <span className="text-[10px] text-teal">{shot.number}</span>
                  <strong className="text-[13px] font-semibold">{shot.title}</strong>
                </div>
                <div className="h-97.5 overflow-hidden border border-[#aebfbc] bg-white max-[700px]:h-80">{shot.content}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#9fb5b1] pb-18 pt-14.5 max-[700px]:pb-13 max-[700px]:pt-10.5" aria-labelledby="mission-title">
          <div className={`${container} relative grid min-h-113.75 grid-cols-[1.08fr_0.92fr] overflow-hidden rounded-md bg-[#25282d] text-white max-[800px]:grid-cols-1`}>
            <span className="absolute left-6 top-5 z-10 text-[11px] font-medium text-[#8e9a98]" aria-hidden="true">
              02
            </span>
            <div className="flex flex-col items-start p-[clamp(42px,5vw,66px)] max-[700px]:px-6.25 max-[700px]:py-9">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#65b7af]">Our mission</span>
              <h2 id="mission-title" className="mb-5 mt-5.5 max-w-147.5 text-[clamp(31px,3.2vw,44px)] font-normal leading-[1.16] tracking-[-0.04em] max-[700px]:text-[32px]">
                Learning should feel like discovery, not memorization.
              </h2>
              <p className="mb-2 max-w-152.5 text-[13px] leading-[1.75] text-[#d0d6d5]">
                SmartPathAI turns course material into a web of ideas, giving every learner a patient, personal study partner that makes complex subjects clear, navigable, and genuinely exciting.
              </p>
              <a
                href="#team"
                onClick={(event) => scrollToSection(event, 'team')}
                className="mt-5.5 inline-flex min-h-10 items-center gap-2.5 bg-white px-4 text-xs font-bold text-[#26302f] no-underline transition-colors hover:text-teal-dark"
              >
                Meet the team <ArrowRight size={16} />
              </a>
            </div>
            <div className="relative flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_52%,#1b7972_0,#155e59_28%,#1f4543_62%,#263334_100%)] px-11 py-15 max-[800px]:min-h-90 max-[700px]:min-h-80 max-[700px]:px-6.25 max-[700px]:py-10.5">
              <span className="absolute left-1/2 top-16.25 -translate-x-1/2 font-serif text-[110px] leading-none text-white/10" aria-hidden="true">
                “
              </span>
              <blockquote className="relative z-10 m-0 max-w-97.5 text-center text-[clamp(24px,2.5vw,34px)] font-normal leading-[1.42] tracking-tight text-[#f5f8f7]">
                The moment something clicks is the moment learning becomes yours.
              </blockquote>
              <div className="absolute inset-0" aria-hidden="true">
                {missionTwinkles.map((twinkle, index) => (
                  <i
                    key={index}
                    className="absolute rounded-full bg-[#9fe3dc] opacity-15 shadow-[0_0_10px_rgba(159,227,220,0.85)] animate-[mission-twinkle_var(--twinkle-duration)_ease-in-out_infinite_var(--twinkle-delay)] motion-reduce:animate-none motion-reduce:opacity-65"
                    style={
                      {
                        left: 'left' in twinkle ? twinkle.left : undefined,
                        right: 'right' in twinkle ? twinkle.right : undefined,
                        top: 'top' in twinkle ? twinkle.top : undefined,
                        bottom: 'bottom' in twinkle ? twinkle.bottom : undefined,
                        width: twinkle.size,
                        height: twinkle.size,
                        '--twinkle-duration': twinkle.duration,
                        '--twinkle-delay': twinkle.delay,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <TeamRoster />
      </main>

      <footer className={`${container} grid min-h-21.5 grid-cols-3 items-center border-t border-[#cfd9d7] text-[11px] text-muted max-[700px]:grid-cols-1 max-[700px]:gap-2.5 max-[700px]:py-5 max-[700px]:text-center`}>
        <span>SmartPathAI</span>
        <a
          className="text-center font-semibold text-teal no-underline hover:underline hover:underline-offset-[3px]"
          href="https://gtbigdatabigimpact.com/"
          target="_blank"
          rel="noreferrer"
        >
          Project of BDBI @ GT
        </a>
        <span className="text-right max-[700px]:text-center">Spring 2026</span>
      </footer>
    </div>
  );
}
