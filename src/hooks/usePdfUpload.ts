import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { generateMessageId } from '../lib/messageId';
import { isPlaceholderGraph } from '../lib/graphPlaceholder';
import { readPdfProcessStream } from '../lib/pdfUploadStream';
import type { Chat, Message } from '../types/chat';
import type { SetChats } from './useChatList';

interface UsePdfUploadOptions {
  currentChatId: string;
  setChats: SetChats;
  showErrorToast: (message: string) => void;
  appendErrorMessage: (chatId: string, content: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  showGraph: (payload: any, graphId: string | undefined, chatId?: string) => void;
  fetchGraphData: (graphId?: string, expectedChatId?: string) => Promise<void>;
  clearGraphData: () => void;
}

/** PDF upload for the open chat: streams progress, attaches the file message, and shows the resulting graph */
export function usePdfUpload({
  currentChatId,
  setChats,
  showErrorToast,
  appendErrorMessage,
  showGraph,
  fetchGraphData,
  clearGraphData,
}: UsePdfUploadOptions) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const uploadAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const removeSelectedFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showErrorToast('Please upload a PDF file');
      return;
    }

    setSelectedFile(file);
    clearGraphData();
    try {
      setIsProcessingFile(true);
      const formData = new FormData();
      formData.append('file', file);

      setUploadProgress(0);
      setProgressMessage('Uploading PDF...');

      const abortController = new AbortController();
      uploadAbortRef.current = abortController;

      const response = await fetch(`${API_BASE_URL}/upload/process-pdf`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: abortController.signal,
      });

      const responseData = await readPdfProcessStream(response, (percent, message) => {
        setUploadProgress(percent);
        setProgressMessage(message);
      });

      const fileUploadMessage: Message = {
        id: generateMessageId(),
        content: `Uploaded file: ${file.name}`,
        sender: 'user',
        tone: 'success',
        timestamp: new Date(),
        file: {
          name: file.name,
          type: file.type,
          url: URL.createObjectURL(file),
        },
      };

      await axios.post(
        `${API_BASE_URL}/chat/message`,
        { chat_id: currentChatId, sender: 'user', text: fileUploadMessage.content },
        { withCredentials: true },
      );

      setChats((prev) =>
        prev.map((c): Chat =>
          c.id === currentChatId
            ? {
                ...c,
                timestamp: new Date(),
                messages: [...c.messages, fileUploadMessage],
                source_files: [...(c.source_files || []), file.name],
              }
            : c,
        ),
      );

      if (responseData.graph_id) {
        await axios.post(
          `${API_BASE_URL}/chat/message`,
          { chat_id: currentChatId, graph_id: responseData.graph_id },
          { withCredentials: true },
        );

        setChats((prev) =>
          prev.map((c) => (c.id === currentChatId ? { ...c, graph_id: responseData.graph_id } : c)),
        );
      }

      const uploadIncludesGraph = responseData.graph && !isPlaceholderGraph(responseData);
      if (uploadIncludesGraph) {
        showGraph(responseData, responseData.graph_id, currentChatId);
      } else {
        await fetchGraphData(responseData.graph_id, currentChatId);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      appendErrorMessage(currentChatId, `Error processing PDF: ${message}`);
    } finally {
      uploadAbortRef.current = null;
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessingFile(false);
      setUploadProgress(0);
      setProgressMessage('');
    }
  };

  const handleCancelUpload = async () => {
    uploadAbortRef.current?.abort();
    try {
      await fetch(`${API_BASE_URL}/upload/cancel-processing`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Best-effort
    }
    setIsProcessingFile(false);
    setSelectedFile(null);
    setUploadProgress(0);
    setProgressMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return {
    selectedFile,
    isProcessingFile,
    uploadProgress,
    progressMessage,
    fileInputRef,
    openFilePicker,
    removeSelectedFile,
    handleFileSelect,
    handleCancelUpload,
  };
}
