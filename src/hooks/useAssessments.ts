import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { PROGRESS_INVALIDATED_EVENT } from '../lib/progressCache';
import type { AssessmentKind, AssessmentSummary } from '../lib/assessmentHistory';

export function useAssessments(chatId: string, kind: AssessmentKind) {
  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const limit = 20;
  const loadedKey = useRef('');
  useEffect(() => {
    if (!items.some(item => item.status === 'grading' || item.attempts?.some(attempt => attempt.status === 'grading'))) return;
    const poll = setInterval(() => setVersion(v => v + 1), 3000);
    return () => clearInterval(poll);
  }, [items]);
  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<{ chatId: string }>).detail?.chatId === chatId) setVersion(v => v + 1);
    };
    window.addEventListener(PROGRESS_INVALIDATED_EVENT, listener);
    return () => window.removeEventListener(PROGRESS_INVALIDATED_EVENT, listener);
  }, [chatId]);
  useEffect(() => {
    const controller = new AbortController();
    const key = `${chatId}:${kind}:${offset}`;
    setLoading(loadedKey.current !== key); setError('');
    axios.get(`${API_BASE_URL}/api/progress/assessments`, { withCredentials: true, signal: controller.signal,
      params: { chat_id: chatId, kind, limit, offset } }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.items)) throw new Error('Invalid assessment response');
      loadedKey.current = key;
      setItems(data.items); setTotal(data.total);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.response?.data?.error || 'Could not load assessments. Please retry.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [chatId, kind, offset, version]);
  return { items, offset, setOffset, total, limit, loading, error, retry: () => setVersion(v => v + 1) };
}
