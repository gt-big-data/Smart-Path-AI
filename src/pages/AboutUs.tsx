import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ChevronLeft, Linkedin } from 'lucide-react';
import Navigation from '../components/Navigation';

interface TeamMember {
  name: string;
  role: string;
  description: string;
  team: string;
  major: string;
  year: string;
  semester: string; // e.g. 'Spring 2026'
  isLead?: boolean;
  photo?: string; // URL — leave undefined for placeholder avatar
  linkedin?: string; // LinkedIn profile URL
}

// Team members — add your photo URL and update description as needed.
// @ the team lead once you've added your info!
const teamMembers: TeamMember[] = [
  // ===================== Spring 2026 =====================
  // --- Leadership ---
  {
    name: 'Vinh Pham',
    role: 'Project Lead',
    team: 'Leadership',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    isLead: true,
    description: 'Overall project lead for SmartPathAI.',
    linkedin: 'https://www.linkedin.com/in/vinh-t-pham/',
    photo: '/team/vihn.png',
  },
  {
    name: 'Anvi Bejjanki',
    role: 'Project Lead',
    team: 'Leadership',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    isLead: true,
    description: 'Overall project lead for SmartPathAI.',
  },
  // --- UI ---
  {
    name: 'Melanie',
    role: 'UI Team',
    team: 'UI',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'Dashboard redesign, landing page, and color scheme improvements.',
    linkedin: 'https://linkedin.com/in/melanieychen',
    photo: '/team/melanie.jpg',
  },
  {
    name: 'Vikram',
    role: 'UI Team',
    team: 'UI',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'Landing page redesign, processing visuals, and node labeling.',
    linkedin: 'https://www.linkedin.com/in/vikram-renganathan-gt/',
  },
  // --- Deployment ---
  {
    name: 'Daniel',
    role: 'Deployment Team',
    team: 'Deployment',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'AWS services, containerization, and CI/CD pipeline.',
  },
  {
    name: 'Raghav',
    role: 'Deployment Team',
    team: 'Deployment',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'AWS deployment, backend containerization, and infrastructure.',
    linkedin: 'https://www.linkedin.com/in/raghav-garg-22b787303/',
    photo: '/team/raghav.jpg',
  },
  {
    name: 'Ian',
    role: 'Deployment Team',
    team: 'Deployment',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'AWS services research and deployment prototyping.',
  },
  {
    name: 'Bayan',
    role: 'Deployment Team',
    team: 'Deployment',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'CI/CD pipeline and deployment automation.',
  },
  // --- Image Processing ---
  {
    name: 'Akhil',
    role: 'Image Processing Lead',
    team: 'Image Processing',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    isLead: true,
    description: 'OCR integration, handwritten note processing, and subteam lead.',
    linkedin: 'https://www.linkedin.com/in/akhil-bejjanki-9b5628366/',
    photo: '/team/akhil.png',
  },
  {
    name: 'Abhiram',
    role: 'Image Processing Team',
    team: 'Image Processing',
    major: 'Computer Science',
    year: 'Freshman',
    semester: 'Spring 2026',
    description: 'OCR tools research and image-to-text pipeline development.',
    linkedin: 'https://www.linkedin.com/in/abhiram-raju-t/',
  },
  {
    name: 'Raiyan',
    role: 'Image Processing Team',
    team: 'Image Processing',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'Handwritten notes detection and image processing testing.',
  },
  // --- Parallel / Processing ---
  {
    name: 'Amodh',
    role: 'Processing Lead',
    team: 'Processing',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    isLead: true,
    description: 'Pipeline optimization, bottleneck analysis, and subteam lead.',
    linkedin: 'https://www.linkedin.com/in/amodh-naik/',
    photo: '/team/amod.jpeg',
  },
  {
    name: 'Kareena',
    role: 'Processing Team',
    team: 'Processing',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'Processing pipeline optimization and performance improvements.',
    photo: '/team/kareena.png',
  },
  // --- Node Simplification ---
  {
    name: 'John',
    role: 'Node Simplification Lead',
    team: 'Node Simplification',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    isLead: true,
    description: 'Knowledge graph restructuring, center-based layout, and subteam lead.',
    linkedin: 'https://www.linkedin.com/in/john-doan-67a303248/',
    photo: '/team/john.jpg',
  },
  {
    name: 'Panda',
    role: 'Node Simplification Team',
    team: 'Node Simplification',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'Node deduplication and graph structure improvements.',
  },
  {
    name: 'Jayan',
    role: 'Node Simplification Team',
    team: 'Node Simplification',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Spring 2026',
    description: 'Node size properties and knowledge graph optimization.',
    linkedin: 'https://www.linkedin.com/in/jayan-sirikonda/',
    photo: '/team/jayan.png',
  },
  // ===================== Fall 2026 =====================
  // Add Fall 2026 members here when the new semester starts.
  // Previous semester members above will still be visible under their semester heading.
];

const teamColors: Record<string, { bg: string; border: string; text: string; accent: string; gradient: string }> = {
  UI: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', accent: 'bg-teal-500', gradient: 'from-teal-500 to-emerald-500' },
  Deployment: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500', gradient: 'from-blue-500 to-indigo-500' },
  'Image Processing': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-500', gradient: 'from-amber-500 to-orange-500' },
  Processing: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', accent: 'bg-violet-500', gradient: 'from-violet-500 to-purple-500' },
  'Node Simplification': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', accent: 'bg-rose-500', gradient: 'from-rose-500 to-pink-500' },
};

// Reusable avatar bubble
function Avatar({ member, size = 'md' }: { member: TeamMember; size?: 'lg' | 'md' | 'sm' }) {
  const dims = size === 'lg' ? 'w-52 h-52 text-6xl' : size === 'md' ? 'w-44 h-44 text-5xl' : 'w-40 h-40 text-4xl';
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (member.photo) {
    return (
      <img
        src={member.photo}
        alt={member.name}
        className={`${dims} rounded-full object-cover shadow-lg flex-shrink-0`} style={{ objectPosition: '50% 20%' }}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}
    >
      {initials}
    </div>
  );
}

const AboutUs: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
      <Navigation />

      <main className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">About SmartPathAI</h1>
              <p className="text-slate-500 mt-1">Learn more about the project and the team</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200/60 rounded-lg hover:bg-white transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
              Home
            </button>
          </div>

          {/* Project Description */}
          <section className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm p-8 mb-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-teal-50">
                <Brain className="w-7 h-7 text-teal-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">What is SmartPathAI?</h2>
                <p className="text-sm text-slate-400">AI-powered learning companion</p>
              </div>
            </div>

            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-800">SmartPathAI</strong> is an intelligent learning
                platform that transforms the way students study. Upload any PDF document and our AI
                instantly builds an interactive knowledge graph, identifying key concepts and the
                connections between them.
              </p>
              <p>
                The platform features an AI-powered chat interface for asking questions about your
                material, adaptive quizzes that adjust to your knowledge level, and a comprehensive
                progress tracking system that helps you identify topics that need review.
              </p>
              <p>
                Our goal is to make studying more efficient and personalized — helping every learner
                find the smartest path through their material.
              </p>
            </div>

            {/* Key Features */}
            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              <div className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                <h3 className="font-semibold text-teal-800 mb-1">Knowledge Graphs</h3>
                <p className="text-sm text-teal-600">
                  Interactive visual maps of concepts extracted from your documents.
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-800 mb-1">Adaptive Quizzes</h3>
                <p className="text-sm text-blue-600">
                  AI-generated questions that evolve with your understanding.
                </p>
              </div>
              <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                <h3 className="font-semibold text-violet-800 mb-1">Progress Tracking</h3>
                <p className="text-sm text-violet-600">
                  Confidence scores and trend analysis to guide your study plan.
                </p>
              </div>
            </div>
          </section>

          {/* Team Section */}
          {(() => {
            const semesters: string[] = [];
            for (const m of teamMembers) {
              if (!semesters.includes(m.semester)) semesters.push(m.semester);
            }

            return semesters.map((semester) => {
              const semesterMembers = teamMembers.filter((m) => m.semester === semester);
              const leader = semesterMembers.find((m) => m.team === 'Leadership');
              const subTeamOrder = ['UI', 'Deployment', 'Image Processing', 'Processing', 'Node Simplification'];
              const subTeams = subTeamOrder
                .map((t) => {
                  const members = semesterMembers.filter((m) => m.team === t);
                  const lead = members.find((m) => m.isLead);
                  const rest = members.filter((m) => !m.isLead);
                  return { team: t, lead, members: rest, colors: teamColors[t] };
                })
                .filter((g) => g.members.length > 0 || g.lead);

              return (
                <section key={semester} className="mb-16">
                  {/* Semester header */}
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-800">Meet the Team</h2>
                    <p className="text-slate-400 mt-2">{semester}</p>
                  </div>

                  {/* Project Lead — centered hero */}
                  {leader && (
                    <div className="flex flex-col items-center mb-16">
                      <div className="relative">
                        <Avatar member={leader} size="lg" />
                        {/* Teal ring accent */}
                        <div className="absolute -inset-1 rounded-full border-2 border-teal-300/40 -z-10" />
                      </div>
                      <h3 className="mt-5 text-2xl font-bold text-slate-800">{leader.name}</h3>
                      <p className="text-teal-600 font-semibold text-sm uppercase tracking-wider mt-1">{leader.role}</p>
                      <p className="text-slate-400 text-sm mt-2">{leader.major} · {leader.year}</p>
                      {leader.linkedin && (
                        <a
                          href={leader.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-700 transition-colors text-sm"
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                      {/* Divider */}
                      <div className="mt-8 w-16 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
                    </div>
                  )}

                  {/* Sub-teams */}
                  <div className="space-y-14">
                    {subTeams.map((st) => {
                      const allMembers = [st.lead, ...st.members].filter(Boolean) as TeamMember[];
                      return (
                        <div key={st.team}>
                          {/* Sub-team label */}
                          <div className="flex items-center gap-3 mb-8">
                            <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${st.colors.gradient}`} />
                            <div>
                              <h3 className="text-xl font-bold text-slate-700">{st.team}</h3>
                              <p className="text-xs text-slate-400 uppercase tracking-wider">
                                {allMembers.length} member{allMembers.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Members grid — clean, no cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-10">
                            {allMembers.map((m) => (
                              <div key={m.name} className="flex flex-col items-center text-center group">
                                {/* Avatar with hover scale */}
                                <div className="relative transition-transform duration-200 group-hover:scale-105">
                                  <Avatar member={m} size="sm" />
                                  {m.isLead && (
                                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${st.colors.accent} shadow-sm whitespace-nowrap`}>
                                      Lead
                                    </div>
                                  )}
                                </div>

                                <h4 className={`font-semibold text-slate-800 text-base ${m.isLead ? 'mt-5' : 'mt-3'}`}>{m.name}</h4>
                                <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">{m.major}</p>
                                <p className="text-slate-400 text-xs">{m.year}</p>
                                {m.linkedin && (
                                  <a
                                    href={m.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center text-blue-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Linkedin className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Call-to-action */}
                  <div className="mt-16 p-6 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl border border-teal-100 text-center">
                    <p className="text-slate-700 font-medium mb-1">Interested in joining the team?</p>
                    <p className="text-sm text-slate-500">
                      SmartPathAI is an ongoing project. Reach out to the team lead to learn how you
                      can contribute in future semesters.
                    </p>
                  </div>
                </section>
              );
            });
          })()}
        </div>
      </main>
    </div>
  );
};

export default AboutUs;
