import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, TrendingDown, ChevronLeft } from 'lucide-react';

interface ProgressItem {
  topic_name: string;
  confidence_score: number;
  last_practiced: string;
}

interface ProfileData {
  full_progress: ProgressItem[];
  topics_to_review: ProgressItem[];
}

const ProfilePage: React.FC = () => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fetchProfileData = async () => {
      const graphId = searchParams.get('graph_id');
      if (!graphId) {
        setError('No graph specified. Please return to a chat and try again.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Call the backend proxy which forwards the request to the AI service.
        // The AI service returns { userId, graphId, progress, topicsToReview }
        const response = await axios.get('http://localhost:4000/api/user/profile', {
          params: { graph_id: graphId },
          withCredentials: true,
        });

        const backend = response.data || {};

        // Helper to normalize backend topic shape to the UI's expected shape
        const mapItem = (item: any) => ({
          topic_name: item.topicName || item.topic_name || item.name || 'Unknown',
          confidence_score: typeof item.confidenceScore === 'number' ? item.confidenceScore : (item.confidence_score ?? 0),
          // last_practiced may not be provided by the AI service; fallback to now
          last_practiced: item.lastPracticed || item.last_practiced || item.updatedAt || new Date().toISOString(),
        });

        const full_progress = Array.isArray(backend.progress) ? backend.progress.map(mapItem) : [];
        const topics_to_review = Array.isArray(backend.topicsToReview) ? backend.topicsToReview.map(mapItem) : [];

        setProfileData({ full_progress, topics_to_review });
      } catch (err: any) {
        console.error('Error fetching profile data:', err);
        if (err.response) {
          console.error('Server Response Data:', err.response.data);
          setError(err.response.data?.error || 'Failed to load profile data. The server returned an unexpected response.');
        } else {
          setError(err.message || 'Failed to load profile data.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [searchParams]);

  const getScoreColor = (score: number) => {
    if (score < 0.4) return 'text-red-500';
    if (score < 0.75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <p className="text-lg text-gray-600">Loading your profile...</p>
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50 text-center">
          <div>
            <p className="text-lg text-red-600">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Your Learning Profile</h1>
              <p className="text-md text-gray-600 mt-1">Track your progress and find topics to review.</p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          </header>
  
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Topics to Review */}
            <section className="lg:col-span-1 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <TrendingDown className="w-6 h-6 text-yellow-500" />
                <h2 className="text-xl font-semibold text-gray-800">Topics to Review</h2>
              </div>
              {profileData?.topics_to_review && profileData.topics_to_review.length > 0 ? (
                <ul className="space-y-4">
                  {profileData.topics_to_review.map((item) => (
                    <li key={item.topic_name} className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">{item.topic_name}</span>
                        <span className={`font-bold ${getScoreColor(item.confidence_score)}`}>
                          {Math.round(item.confidence_score * 100)}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">Great job! No priority topics to review right now.</p>
              )}
            </section>
  
            {/* Full Progress */}
            <section className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-6 h-6 text-teal-500" />
                <h2 className="text-xl font-semibold text-gray-800">All Practiced Topics</h2>
              </div>
              {profileData?.full_progress && profileData.full_progress.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Practiced</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {profileData.full_progress.map((item) => (
                        <tr key={item.topic_name}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.topic_name}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${getScoreColor(item.confidence_score)}`}>
                            {Math.round(item.confidence_score * 100)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(item.last_practiced).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">You haven't practiced any topics yet. Complete a quiz to see your progress!</p>
              )}
            </section>
          </main>
        </div>
      </div>
    );
  }

  return renderContent();
};

export default ProfilePage;
