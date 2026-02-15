import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface IConceptProgress {
  conceptId: string;
  confidenceScore: number;
}

interface ProgressContextType {
  progress: IConceptProgress[];
  updateProgress: (conceptId: string, isCorrect: boolean, isRetry: boolean) => Promise<void>;
  loading: boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<IConceptProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const fetchProgress = useCallback(async () => {
    if (isAuthenticated) {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:4000/api/concept-progress', { withCredentials: true });
        const progressData = response.data;
        setProgress(progressData);
        
        // If no progress records exist, try to process existing quiz history
        if (Array.isArray(progressData) && progressData.length === 0) {
          console.log('[Progress] ⚠️ No progress records found, checking for quiz history to process...');
          try {
            // First check if there's any quiz history
            const quizHistoryResponse = await axios.get('http://localhost:4000/api/quiz-history', { withCredentials: true });
            const quizHistories = quizHistoryResponse.data?.quizHistories || [];
            console.log(`[Progress] Found ${quizHistories.length} quiz history records`);
            
            if (quizHistories.length > 0) {
              console.log('[Progress] 🔄 Processing quiz history to create progress records...');
              const processResponse = await axios.post('http://localhost:4000/api/quiz-history/process-all', {}, { withCredentials: true });
              console.log('[Progress] ✅ Processed quiz history:', processResponse.data);
              
              // Refetch progress after processing
              console.log('[Progress] 🔄 Refetching progress after processing...');
              const newResponse = await axios.get('http://localhost:4000/api/concept-progress', { withCredentials: true });
              const newProgressData = newResponse.data;
              console.log(`[Progress] ✅ Now have ${newProgressData.length} progress records`);
              setProgress(newProgressData);
            } else {
              console.log('[Progress] ℹ️ No quiz history found to process');
            }
          } catch (processError: any) {
            console.error('[Progress] ❌ Failed to process quiz history:', processError);
            console.error('[Progress] Error details:', {
              message: processError.message,
              status: processError.response?.status,
              data: processError.response?.data
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress', error);
      } finally {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const updateProgress = async (conceptId: string, isCorrect: boolean, isRetry: boolean) => {
    try {
      await axios.post('http://localhost:4000/api/progress/update', {
        conceptId,
        isCorrect,
        isRetry,
      }, { withCredentials: true });
      // Refetch progress to get the latest scores
      fetchProgress();
    } catch (error) {
      console.error('Failed to update progress', error);
    }
  };

  return (
    <ProgressContext.Provider value={{ progress, updateProgress, loading }}>
      {children}
    </ProgressContext.Provider>
  );
};
