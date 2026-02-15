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
        let progressList: any[] = [];
        try {
          console.log('[ProfilePage] Fetching progress from /api/concept-progress endpoint...');
          const progressRes = await axios.get('http://localhost:4000/api/concept-progress', { withCredentials: true });
          progressList = Array.isArray(progressRes.data) ? progressRes.data : [];
          console.log(`[ProfilePage] Received ${progressList.length} progress records from backend`);
          if (progressList.length > 0) {
            console.log('[ProfilePage] Sample progress records:', progressList.slice(0, 3));
          } else {
            console.log('[ProfilePage] No progress records received from backend');
          }
        } catch (progressError: any) {
          console.error('[ProfilePage] Error fetching progress:', progressError);
          // Continue even if progress fails - we can still show graphs
          if (progressError.response?.status === 401) {
            setError('Please log in to view your profile.');
            setLoading(false);
            return;
          }
        }

        // Fetch all graph IDs for the user
        let graphIds: string[] = [];
        try {
          const graphIdsRes = await axios.get('http://localhost:4000/chat/graph-ids', { withCredentials: true });
          graphIds = graphIdsRes.data?.graphIds || [];
          console.log('ProfilePage: Successfully fetched graph IDs:', graphIds);
        } catch (graphIdsError: any) {
          console.error('ProfilePage: Error fetching graph IDs:', {
            status: graphIdsError.response?.status,
            statusText: graphIdsError.response?.statusText,
            data: graphIdsError.response?.data,
            message: graphIdsError.message,
            code: graphIdsError.code
          });
          
          if (graphIdsError.response?.status === 401) {
            setError('Please log in to view your profile.');
            setLoading(false);
            return;
          }
          
          if (graphIdsError.response?.status === 404) {
            setError('User not found. Please log in again.');
            setLoading(false);
            return;
          }
          
          if (graphIdsError.response?.status === 500) {
            const errorMsg = graphIdsError.response?.data?.error || graphIdsError.response?.data?.message || 'Server error';
            setError(`Server error: ${errorMsg}. Please try again later.`);
            setLoading(false);
            return;
          }
          
          // Network or other errors
          if (graphIdsError.code === 'ECONNREFUSED' || graphIdsError.code === 'ETIMEDOUT') {
            setError('Unable to connect to the server. Please check if the server is running.');
            setLoading(false);
            return;
          }
          
          // If graph IDs fail, we can't continue
          const errorMessage = graphIdsError.response?.data?.message || 
                              graphIdsError.response?.data?.error || 
                              graphIdsError.message || 
                              'Failed to load your graph data. Please try again later.';
          setError(errorMessage);
          setLoading(false);
          return;
        }

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
            // Return error info instead of null so we can check error type
            return { error: err, graphId: id };
          })
        );

        const graphResponses = await Promise.all(graphPromises);

        // Check if all graph fetches failed
        const successfulFetches = graphResponses.filter(res => res && !res.error && res.data);
        if (successfulFetches.length === 0) {
          // All graph fetches failed - check error types
          const hasConnectionError = graphResponses.some((res: any) => {
            if (res && res.error) {
              const err = res.error;
              return err.code === 'ECONNREFUSED' || 
                     err.code === 'ETIMEDOUT' || 
                     err.response?.status === 503 ||
                     (err.response?.data?.error && err.response.data.error.includes('unavailable'));
            }
            return false;
          });
          
          if (hasConnectionError) {
            setError('Could not load graph data. The AI service may be unavailable. Please ensure the Python service is running on port 8000.');
          } else {
            setError('Could not load graph data. Please try again later.');
          }
          setLoading(false);
          return;
        }

        // Combine all graph data (only from successful fetches)
        const allNodes: any[] = [];
        graphResponses.forEach((graphRes: any) => {
          // Skip error responses
          if (graphRes && !graphRes.error && graphRes.data && graphRes.data.graph && graphRes.data.graph.nodes) {
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
        
        console.log(`[ProfilePage] Built nodeNameById map with ${nodeNameById.size} entries`);
        console.log(`[ProfilePage] Sample node IDs from graph:`, nodes.slice(0, 3).map((n: any) => ({
          id: n.id,
          topicID: n.properties?.topicID,
          conceptId: n.properties?.conceptId,
          name: getNodeLabel(n)
        })));

        // Normalize progress entries into the UI shape and keep the raw concept id for lookups
        console.log(`[ProfilePage] Trying to match ${progressList.length} progress records against ${nodes.length} nodes`);
        console.log(`[ProfilePage] Progress conceptIds:`, progressList.map((p: any) => p.conceptId || p.conceptID).slice(0, 5));
        console.log(`[ProfilePage] Sample node topicIDs:`, nodes.slice(0, 5).map((n: any) => n.properties?.topicID).filter(Boolean));
        
        const normalized: Array<any> = progressList.map((p: any) => {
          const conceptId = String(p.conceptId || p.conceptID || p.topicId || p.topic_id || p.id);
          // Try map lookup first. If missing, attempt to find node by id and compute a label.
          let name = nodeNameById.get(conceptId) || p.name || p.topicName;
          if (!name) {
            const found = nodes.find((n: any) => {
              const props = n.properties || {};
              return String(n.id) === conceptId ||
                     String(props.conceptId) === conceptId ||
                     String(props.topicID) === conceptId ||
                     String(props.topicId) === conceptId ||
                     String(props.topic_id) === conceptId ||
                     String(props.concept_id) === conceptId ||
                     String(props.id) === conceptId;
            });
            if (found) {
              name = getNodeLabel(found);
              console.log(`[ProfilePage] ✅ Found node for conceptId ${conceptId}: ${name}`);
            } else {
              // Log when we can't find a node for debugging
              console.warn(`[ProfilePage] ❌ Could not find node for conceptId: ${conceptId}`);
              // Show what topicIDs are actually available
              const availableTopicIDs = nodes
                .map((n: any) => n.properties?.topicID)
                .filter(Boolean)
                .slice(0, 10);
              console.warn(`[ProfilePage] Available topicIDs (first 10):`, availableTopicIDs);
              console.warn(`[ProfilePage] Does conceptId match any topicID?`, availableTopicIDs.includes(conceptId));
            }
          } else {
            console.log(`[ProfilePage] ✅ Found name via map for conceptId ${conceptId}: ${name}`);
          }
          // Better fallback display for orphaned concepts
          if (!name) {
            // Show truncated ID with ellipsis for better UX
            name = `Unknown Topic (${conceptId.slice(0, 8)}...)`;
          }
          return {
            concept_id: conceptId,
            topic_name: name,
            confidence_score: typeof p.confidenceScore === 'number' ? p.confidenceScore : (p.confidence_score ?? 0),
            last_practiced: p.lastAttempted || p.last_practiced || p.updatedAt || new Date().toISOString(),
          };
        });

        // If any items still show the raw id (no friendly name), try fetching node metadata for those ids
        const stillMissing = normalized.filter((n: any) => n.topic_name === n.concept_id).map((n: any) => n.concept_id);
        console.log(`[ProfilePage] Still missing names for ${stillMissing.length} concepts:`, stillMissing);
        
        if (stillMissing.length > 0 && graphIds.length > 0) {
          try {
            const idsParam = Array.from(new Set(stillMissing)).join(',');
            console.log(`[ProfilePage] Fetching node metadata for IDs: ${idsParam}`);

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
            let resolvedCount = 0;
            for (const item of normalized) {
              if (metaMap.has(item.concept_id)) {
                item.topic_name = metaMap.get(item.concept_id);
                resolvedCount++;
              }
            }
            console.log(`[ProfilePage] Metadata fetch resolved ${resolvedCount} out of ${stillMissing.length} missing names`);
            console.log(`[ProfilePage] Metadata map entries:`, Array.from(metaMap.entries()).slice(0, 5));
          } catch (metaErr) {
            console.warn('Failed to fetch node metadata for missing ids', metaErr);
          }
        }

        // Final fallback: Try to get topic names from quiz history
        const stillUnknown = normalized.filter((n: any) => 
          n.topic_name.startsWith('Unknown Topic') || n.topic_name === n.concept_id
        );
        if (stillUnknown.length > 0) {
          try {
            console.log(`[ProfilePage] Attempting to find topic names from quiz history for ${stillUnknown.length} concepts...`);
            const quizHistoryRes = await axios.get('http://localhost:4000/api/quiz-history', { withCredentials: true });
            const quizHistories = Array.isArray(quizHistoryRes.data?.quizHistories) 
              ? quizHistoryRes.data.quizHistories 
              : [];
            
            // Build a map of conceptId -> question text (first question we find for each conceptId)
            const conceptIdToQuestion = new Map<string, string>();
            for (const quiz of quizHistories) {
              if (quiz.concepts && quiz.questions) {
                for (let i = 0; i < Math.min(quiz.concepts.length, quiz.questions.length); i++) {
                  const conceptId = String(quiz.concepts[i]?.conceptID || '');
                  const questionText = quiz.questions[i]?.questionText || '';
                  if (conceptId && questionText && !conceptIdToQuestion.has(conceptId)) {
                    conceptIdToQuestion.set(conceptId, questionText);
                  }
                }
              }
            }
            
            // Try to extract a topic name from question text
            const extractTopicName = (questionText: string): string | null => {
              // Try to find topic mentions in the question
              // Look for patterns like "What is X?", "Which of the following best describes X?", etc.
              const patterns = [
                /(?:What|Which|Who|Where|When|How) (?:is|are|was|were|does|do|did|can|could|should|would|will) (.+?)[\?\.]/i,
                /(?:about|regarding|concerning|related to) (.+?)[\?\.]/i,
                /(?:the|a|an) (.+?) (?:is|are|was|were|refers|means|describes)/i,
              ];
              
              for (const pattern of patterns) {
                const match = questionText.match(pattern);
                if (match && match[1]) {
                  const topic = match[1].trim();
                  // Clean up the topic name
                  if (topic.length > 3 && topic.length < 50) {
                    return topic;
                  }
                }
              }
              
              // Fallback: use first few words of the question
              const words = questionText.split(/\s+/).slice(0, 5).join(' ');
              if (words.length > 10 && words.length < 60) {
                return words + '...';
              }
              
              return null;
            };
            
            // Update normalized entries with question-based names
            let questionBasedCount = 0;
            for (const item of stillUnknown) {
              const questionText = conceptIdToQuestion.get(item.concept_id);
              if (questionText) {
                const extractedName = extractTopicName(questionText);
                if (extractedName) {
                  item.topic_name = extractedName;
                  questionBasedCount++;
                  console.log(`[ProfilePage] ✅ Extracted topic name from question for ${item.concept_id}: ${extractedName}`);
                }
              }
            }
            
            if (questionBasedCount > 0) {
              console.log(`[ProfilePage] ✅ Extracted ${questionBasedCount} topic names from quiz history questions`);
            }
          } catch (quizHistoryErr) {
            console.warn('[ProfilePage] Failed to fetch quiz history for topic name extraction:', quizHistoryErr);
          }
        }

        // Don't filter out orphaned concepts - show them with fallback names
        // They might be from deleted graphs or graphs that haven't loaded yet
        const validConcepts = normalized; // Keep all concepts, even if we can't find the node name
        
        const orphanedCount = normalized.filter(i => i.topic_name.startsWith('Unknown Topic')).length;
        if (orphanedCount > 0) {
          console.log(`[ProfilePage] ${orphanedCount} concepts have unknown names (may be from deleted/changed graphs)`);
        }
        
        // Topics to review: simple threshold (confidence < 0.75), sorted ascending
        const topics_to_review = validConcepts.filter(i => i.confidence_score < 0.75).sort((a, b) => a.confidence_score - b.confidence_score);

        // Full progress: sort by most recently practiced
        const full_progress = validConcepts.sort((a, b) => new Date(b.last_practiced).getTime() - new Date(a.last_practiced).getTime());

        console.log('[ProfilePage] Setting profile data:');
        console.log(`  - Full progress: ${full_progress.length} items`);
        console.log(`  - Topics to review: ${topics_to_review.length} items`);
        if (full_progress.length > 0) {
          console.log('  - Sample full_progress items:', full_progress.slice(0, 3));
        }
        
        setProfileData({ full_progress, topics_to_review });
      } catch (err: any) {
        console.error('Error fetching profile data:', err);
        if (err.response) {
          console.error('Server Response Data:', err.response.data);
          const errorMessage = err.response.data?.error || err.response.data?.message || 'Failed to load profile data. The server returned an unexpected response.';
          
          // Check for specific error types
          if (err.response.status === 401) {
            setError('Please log in to view your profile.');
          } else if (err.response.status === 503 || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
            setError('The AI service is currently unavailable. Please try again later.');
          } else {
            setError(errorMessage);
          }
        } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          setError('Unable to connect to the server. Please check if the server is running.');
        } else {
          setError(err.message || 'Failed to load profile data. Please try again.');
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

