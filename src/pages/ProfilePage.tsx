import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);

        // Fetch user progress from Mongo
        const progressRes = await axios.get('http://localhost:4000/progress', { withCredentials: true });
        const progressList: any[] = Array.isArray(progressRes.data) ? progressRes.data : [];

        // Fetch all graph IDs for the user
        const graphIdsRes = await axios.get('http://localhost:4000/chat/graph-ids', { withCredentials: true });
        const graphIds: string[] = graphIdsRes.data.graphIds || [];

        // If no graph IDs found, show message
        if (graphIds.length === 0) {
          setError('No graphs found. Please upload a document in a chat to see your progress.');
          setLoading(false);
          return;
        }

        // Fetch all graphs in parallel
        const graphPromises = graphIds.map(id =>
          axios.get('http://localhost:4000/api/view-graph', {
            params: { graph_id: id },
            withCredentials: true
          }).catch(err => {
            console.warn(`Failed to fetch graph ${id}:`, err);
            return null;
          })
        );

        const graphResponses = await Promise.all(graphPromises);

        // Combine all graph data
        const allNodes: any[] = [];
        graphResponses.forEach(graphRes => {
          if (graphRes && graphRes.data && graphRes.data.graph && graphRes.data.graph.nodes) {
            allNodes.push(...graphRes.data.graph.nodes);
          }
        });

        const graphData = { graph: { nodes: allNodes } };

        // DEBUG: log raw responses to help diagnose missing labels
        console.debug('ProfilePage: raw graph response', graphData);
        console.debug('ProfilePage: raw progress response', progressList);

        // Build a quick map from possible ids to the node's display name
        const nodeNameById = new Map<string, string>();
        const nodes = Array.isArray(graphData.graph?.nodes) ? graphData.graph.nodes : [];

        // Helper that mirrors GraphVisualization.getNodeLabel fallback logic
        const getNodeLabel = (node: any) => {
          const props = node.properties || {};
          const labels: string[] = Array.isArray(node.labels) ? node.labels : [];
          const isTopic = labels.includes('Topic') || labels.includes('Subtopic');

          if (isTopic) {
            if (props.name && String(props.name).trim()) return String(props.name);
            const content = props.text || props.description || props.illustration || props.explanation || '';
            if (content && String(content).trim()) {
              const words = String(content).split(' ');
              return words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
            }
          }

          // Generic fallback for other labels
          const content = props.text || props.description || props.illustration || props.explanation || '';
          if (content && String(content).trim()) {
            const words = String(content).split(' ');
            return words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
          }

          // Last resort: use a readable id form
          return String(node.id);
        };

        for (const node of nodes) {
          const props = node.properties || {};
          const candidates = [props.conceptId, props.topicID, props.topicId, props.topic_id, props.concept_id, node.id, props.neo4j_id, props.id]
            .filter(Boolean)
            .map(String);
          const display = getNodeLabel(node) || String(node.id);
          for (const c of candidates) {
            nodeNameById.set(String(c), display);
          }
        }

        // Normalize progress entries into the UI shape and keep the raw concept id for lookups
        const normalized: Array<any> = progressList.map((p: any) => {
          const conceptId = String(p.conceptId || p.conceptID || p.topicId || p.topic_id || p.id);
          // Try map lookup first. If missing, attempt to find node by id and compute a label.
          let name = nodeNameById.get(conceptId) || p.name || p.topicName;
          if (!name) {
            const found = nodes.find((n: any) =>
              String(n.id) === conceptId ||
              String(n.properties?.conceptId) === conceptId ||
              String(n.properties?.topicID) === conceptId ||
              String(n.properties?.topicId) === conceptId ||
              String(n.properties?.topic_id) === conceptId ||
              String(n.properties?.concept_id) === conceptId
            );
            if (found) {
              name = getNodeLabel(found);
            }
          }
          if (!name) name = conceptId;
          return {
            concept_id: conceptId,
            topic_name: name,
            confidence_score: typeof p.confidenceScore === 'number' ? p.confidenceScore : (p.confidence_score ?? 0),
            last_practiced: p.lastAttempted || p.last_practiced || p.updatedAt || new Date().toISOString(),
          };
        });

        // If any items still show the raw id (no friendly name), try fetching node metadata for those ids
        const stillMissing = normalized.filter((n: any) => n.topic_name === n.concept_id).map((n: any) => n.concept_id);
        if (stillMissing.length > 0 && graphIds.length > 0) {
          try {
            const idsParam = Array.from(new Set(stillMissing)).join(',');

            // Fetch metadata from all graphs
            const metaPromises = graphIds.map(id =>
              axios.get('http://localhost:4000/api/node-metadata', {
                params: { graph_id: id, concept_ids: idsParam },
                withCredentials: true,
              }).catch(err => {
                console.warn(`Failed to fetch metadata for graph ${id}:`, err);
                return null;
              })
            );

            const metaResponses = await Promise.all(metaPromises);
            const metaMap = new Map<string, string>();

            // Process metadata from all graphs
            metaResponses.forEach(metaRes => {
              if (metaRes && metaRes.data && metaRes.data.nodes) {
                const metaNodes: any[] = metaRes.data.nodes;
                for (const n of metaNodes) {
                  const props = n.properties || {};
                  const candidates = [props.topicID, props.topicId, props.topic_id, props.conceptId, props.concept_id, n.id]
                    .filter(Boolean)
                    .map(String);
                  const label = props.name || props.topicName || props.title || props.text || props.description || String(n.id);
                  for (const c of candidates) metaMap.set(String(c), label);
                }
              }
            });

            // Update normalized entries with any found labels
            for (const item of normalized) {
              if (metaMap.has(item.concept_id)) {
                item.topic_name = metaMap.get(item.concept_id);
              }
            }
          } catch (metaErr) {
            console.warn('Failed to fetch node metadata for missing ids', metaErr);
          }
        }

        // Topics to review: simple threshold (confidence < 0.75), sorted ascending
        const topics_to_review = normalized.filter(i => i.confidence_score < 0.75).sort((a, b) => a.confidence_score - b.confidence_score);

        // Full progress: sort by most recently practiced
        const full_progress = normalized.sort((a, b) => new Date(b.last_practiced).getTime() - new Date(a.last_practiced).getTime());

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
  }, []); // Empty dependency array - fetch on mount only

  const getScoreColor = (score: number) => {
    if (score < 0.4) return 'text-red-500';
    if (score < 0.75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const isLikelyUUID = (s: string) => {
    if (!s) return false;
    // crude UUID v4-ish check (36 chars with hyphens)
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
  };

  const friendlyTopicLabel = (s: string) => {
    if (!s) return '';
    if (isLikelyUUID(s)) {
      return `${s.slice(0, 8)}...${s.slice(-4)}`;
    }
    return s;
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
                        <span className="font-medium text-gray-700" title={item.topic_name}>
                          {friendlyTopicLabel(item.topic_name)}
                        </span>
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" title={item.topic_name}>
                            {friendlyTopicLabel(item.topic_name)}
                          </td>
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
