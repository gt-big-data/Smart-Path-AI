import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';

interface IConceptProgress {
  conceptId: string;
  confidenceScore: number;
  chat_id?: string | null;
}

interface ProgressContextType {
  progress: IConceptProgress[];
  updateProgress: (chatId: string, conceptId: string, isCorrect: boolean, isRetry: boolean, attemptId: string) => Promise<void>;
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
        const response = await axios.get(`${API_BASE_URL}/api/concept-progress`, { withCredentials: true });
        setProgress(Array.isArray(response.data) ? response.data : []);
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

  const updateProgress = async (chatId: string, conceptId: string, isCorrect: boolean, isRetry: boolean, attemptId: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/progress/update`, {
        chat_id: chatId,
        concept_id: conceptId,
        isCorrect,
        isRetry,
        attempt_id: attemptId,
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
