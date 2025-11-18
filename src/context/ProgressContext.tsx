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
        setProgress(response.data);
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
