//Chat.tsx
import React, { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { Send, Bot, User, MessageSquare, ChevronLeft, ChevronRight, Plus, Paperclip, X, FileText, Image, File, Trash2 } from 'lucide-react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import GraphVisualization from '../components/GraphVisualization';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  file?: {
    name: string;
    type: string;
    url: string;
  };
  isQuestion?: boolean;
  questionData?: {
    question: string;
    correctAnswer: string;
    conceptId: string;
    questionIndex?: number;
    totalQuestions?: number;
  };
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
  graph_id?: string;
}

interface QAPair {
  question: string;
  answer: string;
  conceptId: string;
  concept_id?: string; // Alternative field name from Python AI server
  topicId?: string; // Alternative field name
  topic_id?: string; // Alternative field name
  id?: string; // Generic ID field (used as fallback if conceptId is empty)
}

// Add interface for concept progress
interface ConceptProgress {
  conceptId: string;
  confidenceScore: number;
  lastAttempted?: Date;
}

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChatId, setCurrentChatId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [qaData, setQaData] = useState<QAPair[]>([]);
  const [conceptProgress, setConceptProgress] = useState<ConceptProgress[]>([]); // Add state for concept progress
  const [quizLength, setQuizLength] = useState<5 | 10 | 15>(5);
  const [questionFormat, setQuestionFormat] = useState<'mixed' | 'mcq' | 'true-false' | 'open-ended'>('mixed');
  const [shouldStartQuiz, setShouldStartQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deletingChatRef = useRef<string | null>(null);
  const [loadingDots, setLoadingDots] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);

  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  const currentChat = chats.find(chat => chat.id === currentChatId) ?? null;
  const [input, setInput] = useState('');

  // Generate robust unique IDs to avoid duplicate keys when multiple messages are created in the same millisecond
  const generateMessageId = () => {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as any).randomUUID();
      }
    } catch (_) {
      // ignore and fallback
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  // Local persistence helpers for quiz state per chat
  const quizStateKey = (chatId: string) => `quizState:${chatId}`;

  const saveQuizState = (chatId: string, state: any) => {
    try {
      localStorage.setItem(quizStateKey(chatId), JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save quiz state', err);
    }
  };

  const loadQuizState = (chatId: string) => {
    try {
      const raw = localStorage.getItem(quizStateKey(chatId));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Failed to load quiz state', err);
      return null;
    }
  };

  const clearQuizState = (chatId: string) => {
    try {
      localStorage.removeItem(quizStateKey(chatId));
    } catch (err) {
      console.warn('Failed to clear quiz state', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentChat) {
      scrollToBottom();
    }
  }, [currentChat]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessingFile) {
      interval = setInterval(() => {
        setLoadingDots(dots => dots.length >= 3 ? '' : dots + '.');
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isProcessingFile]);

  // Add function to fetch concept progress
  const fetchConceptProgress = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/concept-progress', {
        withCredentials: true
      });
      setConceptProgress(response.data);
      console.log('Fetched concept progress:', response.data);
    } catch (error) {
      console.error('Error fetching concept progress:', error);
      // Set empty array on error to avoid breaking the UI
      setConceptProgress([]);
    }
  }, []);

  const generateAIResponse = async (userMessage: string, fileType?: string) => {
    let aiResponse = '';

    if (fileType) {
      if (fileType.startsWith('image/')) {
        aiResponse = 'I see you\'ve shared an image. What would you like me to help you with regarding this image?';
      } else if (fileType.includes('document') || fileType.includes('pdf')) {
        aiResponse = 'I\'ve received your document. What aspects would you like me to review or analyze?';
      } else {
        aiResponse = 'I\'ve received your file. How can I help you with it?';
      }
    } else {
      const lowerMessage = userMessage.toLowerCase();
      if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        aiResponse = 'Hello! It\'s great to meet you. How can I assist you today?';
      } else if (lowerMessage.includes('help')) {
        aiResponse = 'I\'d be happy to help! Could you please provide more details about what you need assistance with?';
      } else if (lowerMessage.includes('thank')) {
        aiResponse = 'You\'re welcome! Is there anything else you\'d like to know?';
      } else if (lowerMessage.includes('bye')) {
        aiResponse = 'Goodbye! Feel free to return if you have more questions!';
      } else {
        aiResponse = 'That\'s an interesting point! Could you tell me more about what you\'re thinking?';
      }
    }

    return {
      id: generateMessageId(),
      content: aiResponse,
      sender: 'ai' as const,
      timestamp: new Date(),
    };
  };

  const fetchGraphData = async (graphId?: string) => {
    if (!graphId) return;
    try {
      const response = await axios.get(`http://localhost:4000/api/view-graph?graph_id=${graphId}`);
      console.log('Graph data response:', response.data);
      // Add graph_id to the response data so search can use it
      setGraphData({ ...response.data, graph_id: graphId });
      
      // Fetch concept progress after loading graph
      await fetchConceptProgress();
    } catch (error) {
      console.error('Error fetching graph:', error);
      setGraphData({ error: 'Failed to load graph data' });
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file');
        return;
      }

      setSelectedFile(file);
      setGraphData(null);
      setQaData([]);
      try {
        setIsProcessingFile(true);
        const formData = new FormData();
        formData.append('file', file);

        console.log('Uploading file:', {
          name: file.name,
          type: file.type,
          size: file.size
        });

        const currentChatData = chats.find(chat => chat.id === currentChatId);
        const url = currentChatData?.graph_id 
          ? `http://localhost:4000/upload/process-pdf?graph_id=${currentChatData.graph_id}`
          : 'http://localhost:4000/upload/process-pdf';

        setUploadProgress(0);
        setProgressMessage('Uploading PDF...');

        const response = await fetch(url, {
          method: 'POST',
          body: formData,
        });

        // Read the SSE stream for progress updates
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let responseData: any = null;
        let buffer = '';

        if (!reader) {
          throw new Error('Failed to read response stream');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'progress') {
                  setUploadProgress(event.percent);
                  setProgressMessage(event.message);
                } else if (event.type === 'complete') {
                  responseData = event.data;
                  setUploadProgress(100);
                  setProgressMessage('Processing complete!');
                } else if (event.type === 'error') {
                  throw new Error(event.error || 'Failed to process file');
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) {
                  console.warn('[Upload] Skipping malformed SSE line:', line);
                } else {
                  throw parseErr;
                }
              }
            }
          }
        }

        console.log('[Upload] Parsed response data:', responseData);

        if (!responseData) {
          throw new Error('No response data received from server');
        }

        const fileUploadMessage: Message = {
          id: generateMessageId(),
          content: `Uploaded file: ${file.name}`,
          sender: 'user',
          timestamp: new Date(),
          file: {
            name: file.name,
            type: file.type,
            url: URL.createObjectURL(file)
          }
        };

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'user',
          text: fileUploadMessage.content,
        }, { withCredentials: true });

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                lastMessage: fileUploadMessage.content,
                timestamp: new Date(),
                messages: [...chat.messages, fileUploadMessage],
              }
            : chat
        ));

        if (responseData.graph_id) {
          await axios.post('http://localhost:4000/chat/message', {
            chat_id: currentChatId,
            graph_id: responseData.graph_id,
          }, { withCredentials: true });

          setChats(prevChats => prevChats.map(chat => 
            chat.id === currentChatId
              ? { ...chat, graph_id: responseData.graph_id }
              : chat
          ));
        }

        await fetchGraphData(responseData.graph_id);
        
        // Show the "Start Quiz" button after document upload
        // User can now choose quiz settings before starting
        setShouldStartQuiz(true);

      } catch (error) {
        console.error('Detailed upload error:', error);
        let errorMessage = 'Failed to upload file. Please try again.';
        
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack
          });
          errorMessage = error.message;
        }
        
        const errorMsg: Message = {
          id: generateMessageId(),
          content: errorMessage,
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                lastMessage: errorMessage,
                timestamp: new Date(),
                messages: [...chat.messages, errorMsg],
              }
            : chat
        ));

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: errorMessage,
        }, { withCredentials: true });
        
        alert(errorMessage);
      } finally {
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setIsProcessingFile(false);
        setUploadProgress(0);
        setProgressMessage('');
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // --- Start of Fix ---

  // 1. Capture current messages BEFORE updating the chat state.
  // `currentChat` is from the current render, so its `messages` array is what's currently displayed.
  const currentMessages = currentChat?.messages ?? [];

    // 2. Create the user message object.
    const userMessage: Message = {
      id: generateMessageId(),
      content: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
    };

    // 3. Clear the input field.
    setInput('');

    // 4. Update the chat state with the new user message.
    // This is asynchronous, but that's okay because we've already captured the last question.
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId
        ? {
            ...chat,
            lastMessage: trimmedInput,
            timestamp: new Date(),
            messages: [...chat.messages, userMessage],
          }
        : chat
    ));

    // 5. Save the user message to the backend.
    try {
      await axios.post('http://localhost:4000/chat/message', {
        chat_id: currentChatId,
        sender: 'user',
        text: trimmedInput,
      }, { withCredentials: true });
    } catch (error) {
      console.error('Error saving message:', error);
    }

    // 6. Now, decide what to do based on whether we are in a quiz.
    // --- End of Fix ---

    // Prefer authoritative quiz state over inferring from chat history
    const currentQA = qaData[currentQuestionIndex];
    if (isAnswering && currentQA) {
      try {
        setIsTyping(true);
        console.log('[Quiz] Submitting answer', {
          isAnswering,
          currentQuestionIndex,
          totalQuestions: qaData.length,
          question: currentQA.question,
          expectedAnswer: currentQA.answer,
          userAnswer: trimmedInput
        });
        // Simple retry detection: count how many times this question appears as a question message
        const isRetry = currentMessages.filter(m => m.isQuestion && m.questionData?.question === currentQA.question).length > 1;

        console.log('Submitting answer for conceptId:', currentQA.conceptId);
        
        const response = await axios.post('http://localhost:4000/api/verify-answer', {
          question: currentQA.question,
          userAnswer: trimmedInput,
          correctAnswer: currentQA.answer,
          conceptId: currentQA.conceptId,
          isRetry: isRetry,
          graph_id: currentChat?.graph_id
        }, { withCredentials: true });

        const verificationResult = response.data;
        console.log('[Quiz] Verification raw result:', verificationResult);

        // Defensive shape check
        const hasIsCorrect = typeof verificationResult?.isCorrect === 'boolean';
        const hasFeedback = typeof verificationResult?.feedback === 'string' && verificationResult.feedback.length > 0;
        if (!hasIsCorrect || !hasFeedback) {
          const diagnosticContent = `Verification response missing expected keys.\nExpected: { isCorrect: boolean, feedback: string, followUpQuestion?: string }\nReceived: ${JSON.stringify(verificationResult, null, 2)}`;
          const diagnosticMessage: Message = {
            id: generateMessageId(),
            content: diagnosticContent,
            sender: 'ai',
            timestamp: new Date()
          };
          setChats(prevChats => prevChats.map(chat =>
            chat.id === currentChatId
              ? { ...chat, messages: [...chat.messages, diagnosticMessage] }
              : chat
          ));
          try {
            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: diagnosticMessage.content,
            }, { withCredentials: true });
          } catch (persistErr) {
            console.error('[Quiz] Failed to persist diagnostic message', persistErr);
          }
          return; // Abort normal flow
        }
        
        console.log('Verification result:', verificationResult);
        
        // Refresh concept progress after answering
        await fetchConceptProgress();

        if (verificationResult.isCorrect) {
          // Track this answer
          setUserAnswers(prev => [...prev, trimmedInput]);
          // Persist updated answers
          if (currentChatId) {
            const existing = loadQuizState(currentChatId) || {};
            const updated = {
              ...(existing || {}),
              userAnswers: [...(existing.userAnswers || []), trimmedInput],
            };
            saveQuizState(currentChatId, updated);
          }
          
          if (qaData.length > currentQuestionIndex + 1) {
            const nextQuestionMessage: Message = {
              id: generateMessageId(),
              content: `Correct! Let's move on to the next question:\n\n${qaData[currentQuestionIndex + 1].question}`,
              sender: 'ai',
              timestamp: new Date(),
              isQuestion: true,
              questionData: {
                question: qaData[currentQuestionIndex + 1].question,
                correctAnswer: qaData[currentQuestionIndex + 1].answer,
                conceptId: qaData[currentQuestionIndex + 1].conceptId,
                questionIndex: currentQuestionIndex + 1,
                totalQuestions: qaData.length
              }
            };

            const feedbackMessage: Message = {
              id: generateMessageId(),
              content: verificationResult.feedback,
              sender: 'ai',
              timestamp: new Date(),
            };

            setChats(prevChats => prevChats.map(chat =>
              chat.id === currentChatId
                ? {
                    ...chat,
                    messages: [...chat.messages, feedbackMessage, nextQuestionMessage],
                  }
                : chat
            ));

            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: feedbackMessage.content,
            }, { withCredentials: true });

            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: nextQuestionMessage.content,
            }, { withCredentials: true });

            setCurrentQuestionIndex(prev => prev + 1);
            // update persisted index
            if (currentChatId) {
              const existing = loadQuizState(currentChatId) || {};
              existing.currentQuestionIndex = (existing.currentQuestionIndex || 0) + 1;
              saveQuizState(currentChatId, existing);
            }
            console.log('[Quiz] Advanced to next question index', currentQuestionIndex + 1);
          } else {
            const finalMessage: Message = {
              id: generateMessageId(),
              content: `${verificationResult.feedback}\n\nCongratulations! You've successfully answered all the questions. You have a good understanding of the material.`,
              sender: 'ai',
              timestamp: new Date(),
            };

            setChats(prevChats => prevChats.map(chat =>
              chat.id === currentChatId
                ? {
                    ...chat,
                    messages: [...chat.messages, finalMessage],
                  }
                : chat
            ));

            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: finalMessage.content,
            }, { withCredentials: true });

            try {
              // Add the final answer to userAnswers
              const allAnswers = [...userAnswers, trimmedInput];
              
              // Filter out questions with empty conceptIds
              const validQaData = qaData.filter((qa, index) => {
                const hasConceptId = qa.conceptId && qa.conceptId.trim() !== '';
                if (!hasConceptId) {
                  console.warn(`⚠️ Skipping question ${index + 1} - empty conceptId:`, qa);
                }
                return hasConceptId;
              });

              if (validQaData.length === 0) {
                console.error('❌ Cannot save quiz history: All questions have empty conceptIds!');
                console.error('Raw qaData:', qaData);
              } else {
                const quizHistoryData = {
                concepts: validQaData.map((qa, idx) => ({
                  conceptID: qa.conceptId, // Use the actual conceptId from the question
                  name: `Question ${idx + 1} Concept`
                })),
                  questions: validQaData.map((qa, index) => {
                    const originalIndex = qaData.indexOf(qa);
                    return {
                      questionText: qa.question,
                      userAnswer: allAnswers[originalIndex] || 'No answer provided',
                      correctAnswer: qa.answer,
                      explanation: `This question tests understanding of the material covered in the graph.`,
                      timestamp: new Date().toISOString()
                    };
                  })
                };

                console.log('💾 Saving quiz history with conceptIds:', validQaData.map(qa => qa.conceptId));
                console.log(`📊 Valid questions: ${validQaData.length}/${qaData.length}`);
                
                try {
                  const response = await axios.post('http://localhost:4000/api/quiz-history', quizHistoryData, { 
                    withCredentials: true 
                  });
                  
                  console.log('✅ Quiz history saved successfully:', response.data);
                  console.log(`✅ Progress records created: ${response.data.progressRecordsCreated || 0}`);
                } catch (error: any) {
                  console.error('❌ Error saving quiz history:', error);
                  console.error('Error details:', {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data
                  });
                }
              }
            } catch (error) {
              console.error('❌ Error in quiz completion:', error);
            }

            setIsAnswering(false);
            console.log('[Quiz] Quiz completed successfully');
            // Allow the user to start a new quiz after finishing the previous one
            setShouldStartQuiz(true);
            setQuizCompleted(true);
            // Clear persisted quiz state when finished
            if (currentChatId) clearQuizState(currentChatId);
          }
        } else {
          const feedbackMessage: Message = {
            id: generateMessageId(),
            content: `${verificationResult.feedback}\n\n${verificationResult.followUpQuestion}\n\nTry answering the original question again:`,
            sender: 'ai',
            timestamp: new Date(),
            isQuestion: true,
            questionData: {
              question: currentQA.question,
              correctAnswer: currentQA.answer,
              conceptId: currentQA.conceptId,
              questionIndex: currentQuestionIndex,
              totalQuestions: qaData.length
            }
          };

          setChats(prevChats => prevChats.map(chat =>
            chat.id === currentChatId
              ? {
                  ...chat,
                  messages: [...chat.messages, feedbackMessage],
                }
              : chat
          ));

          await axios.post('http://localhost:4000/chat/message', {
            chat_id: currentChatId,
            sender: 'ai',
            text: feedbackMessage.content,
          }, { withCredentials: true });
        }
      } catch (error) {
        console.error('Error verifying answer:', error);
        const errorMessage: Message = {
          id: generateMessageId(),
          content: "Sorry, I encountered an error while verifying your answer. Please try again.",
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, errorMessage],
              }
            : chat
        ));

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: errorMessage.content,
        }, { withCredentials: true });
      } finally {
        setIsTyping(false);
      }
    } else if (currentChat?.graph_id) {
    try {
      setIsTyping(true);
        console.log('[Conversation] Sending request', { message: trimmedInput, graph_id: currentChat.graph_id });
      const response = await axios.post(
          'http://localhost:4000/api/generate-conversation-response',
          { message: trimmedInput, graph_id: currentChat.graph_id },
        { withCredentials: true }
      );
        console.log('[Conversation] Raw response', response.data);
      const aiMessage: Message = {
          id: generateMessageId(),
          content: response.data.response || response.data.message || 'I received your message.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setChats(prevChats => prevChats.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              lastMessage: aiMessage.content,
              timestamp: new Date(),
              messages: [...chat.messages, aiMessage],
            }
          : chat
      ));

      // Save AI response to backend
      await axios.post('http://localhost:4000/chat/message', {
        chat_id: currentChatId,
        sender: 'ai',
        text: aiMessage.content,
      }, { withCredentials: true });
    } catch (error) {
        console.error('Error generating conversation response:', error);
        const errorMessage: Message = {
          id: generateMessageId(),
          content: 'Sorry, I could not generate a response. Please retry or rephrase.',
          sender: 'ai',
          timestamp: new Date(),
        };
        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? { ...chat, messages: [...chat.messages, errorMessage] }
            : chat
        ));
        try {
          await axios.post('http://localhost:4000/chat/message', {
            chat_id: currentChatId,
            sender: 'ai',
            text: errorMessage.content,
          }, { withCredentials: true });
        } catch (persistErr) {
          console.error('Failed to persist AI error message', persistErr);
        }
    } finally {
      setIsTyping(false);
    }    
    } else {
      try {
        setIsTyping(true);
        const aiMessage = await generateAIResponse(input);
        
        setChats(prevChats => prevChats.map(chat => 
          chat.id === currentChatId
            ? {
                ...chat,
                lastMessage: aiMessage.content,
                timestamp: new Date(),
                messages: [...chat.messages, aiMessage],
              }
            : chat
        ));

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: aiMessage.content,
        }, { withCredentials: true });
      } catch (error) {
        console.error('Error generating AI response:', error);
        const errorMessage: Message = {
          id: generateMessageId(),
          content: "Sorry, I encountered an error while generating a response. Please try again.",
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, errorMessage],
              }
            : chat
        ));

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: errorMessage.content,
        }, { withCredentials: true });
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleSkip = async () => {
    const currentQA = qaData[currentQuestionIndex];
    if (!isAnswering || !currentQA) return;

    try {
      setIsTyping(true);
      console.log('[Quiz] Skipping question', {
        currentQuestionIndex,
        totalQuestions: qaData.length,
        question: currentQA.question,
        conceptId: currentQA.conceptId
      });

      // Treat skip as incorrect answer for confidence tracking
      await axios.post('http://localhost:4000/api/verify-answer', {
        question: currentQA.question,
        userAnswer: 'SKIPPED',
        correctAnswer: currentQA.answer,
        conceptId: currentQA.conceptId,
        isRetry: false,
        graph_id: currentChat?.graph_id
      }, { withCredentials: true });

      // Track skipped answer
      setUserAnswers(prev => [...prev, 'SKIPPED']);
      if (currentChatId) {
        const existing = loadQuizState(currentChatId) || {};
        const updated = {
          ...existing,
          userAnswers: [...(existing.userAnswers || []), 'SKIPPED'],
        };
        saveQuizState(currentChatId, updated);
      }

      // Refresh concept progress after skipping
      await fetchConceptProgress();

      // Add skip message
      const skipMessage: Message = {
        id: generateMessageId(),
        content: `You skipped this question. The correct answer was: ${currentQA.answer}\n\nLet's move on to the next question.`,
        sender: 'ai',
        timestamp: new Date(),
      };

      if (qaData.length > currentQuestionIndex + 1) {
        const nextQuestionMessage: Message = {
          id: generateMessageId(),
          content: `Question ${currentQuestionIndex + 2} of ${qaData.length}:\n\n${qaData[currentQuestionIndex + 1].question}`,
          sender: 'ai',
          timestamp: new Date(),
          isQuestion: true,
          questionData: {
            question: qaData[currentQuestionIndex + 1].question,
            correctAnswer: qaData[currentQuestionIndex + 1].answer,
            conceptId: qaData[currentQuestionIndex + 1].conceptId,
            questionIndex: currentQuestionIndex + 1,
            totalQuestions: qaData.length
          }
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, skipMessage, nextQuestionMessage],
              }
            : chat
        ));

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: skipMessage.content,
        }, { withCredentials: true });

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: nextQuestionMessage.content,
        }, { withCredentials: true });

        setCurrentQuestionIndex(prev => prev + 1);
        if (currentChatId) {
          const existing = loadQuizState(currentChatId) || {};
          existing.currentQuestionIndex = (existing.currentQuestionIndex || 0) + 1;
          saveQuizState(currentChatId, existing);
        }
      } else {
        // Quiz completed
        const finalMessage: Message = {
          id: generateMessageId(),
          content: `${skipMessage.content}\n\nYou've completed all the questions.`,
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, finalMessage],
              }
            : chat
        ));

        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'ai',
          text: finalMessage.content,
        }, { withCredentials: true });

        // Save quiz history
        try {
          const allAnswers = [...userAnswers, 'SKIPPED'];
          const validQaData = qaData.filter((qa) => qa.conceptId && qa.conceptId.trim() !== '');
          
          if (validQaData.length > 0) {
            const quizHistoryData = {
              concepts: validQaData.map((qa, idx) => ({
                conceptID: qa.conceptId,
                name: `Question ${idx + 1} Concept`
              })),
              questions: validQaData.map((qa, index) => {
                const originalIndex = qaData.indexOf(qa);
                return {
                  questionText: qa.question,
                  userAnswer: allAnswers[originalIndex] || 'SKIPPED',
                  correctAnswer: qa.answer,
                  explanation: `This question tests understanding of the material covered in the graph.`,
                  timestamp: new Date().toISOString()
                };
              })
            };

            await axios.post('http://localhost:4000/api/quiz-history', quizHistoryData, { 
              withCredentials: true 
            });
            console.log('✅ Quiz history saved with skipped question');
          }
        } catch (error) {
          console.error('❌ Error saving quiz history:', error);
        }

        setIsAnswering(false);
        setShouldStartQuiz(true);
        setQuizCompleted(true);
        if (currentChatId) clearQuizState(currentChatId);
      }
    } catch (error: any) {
      console.error('[Quiz] Error skipping question:', error);
      const errorMessage: Message = {
        id: generateMessageId(),
        content: 'Sorry, there was an error processing your skip. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setChats(prevChats => prevChats.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, errorMessage],
            }
          : chat
      ));

      await axios.post('http://localhost:4000/chat/message', {
        chat_id: currentChatId,
        sender: 'ai',
        text: errorMessage.content,
      }, { withCredentials: true });
    } finally {
      setIsTyping(false);
    }
  };

  const handleChatSelect = (chatId: string) => {
    // Clear graph data immediately when switching chats to prevent showing wrong graph
    setGraphData(null);
    setQaData([]);
    setIsAnswering(false);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizCompleted(false);
    setCurrentChatId(chatId);
  };

  const handleNewChat = useCallback(async () => {
    try {
      console.log('Creating new chat...');
      
      // Clear all graph and quiz state immediately when creating new chat
      setGraphData(null);
      setQaData([]);
      setIsAnswering(false);
      setCurrentQuestionIndex(0);
      setUserAnswers([]);
      setQuizCompleted(false);
      setIsGeneratingQuestions(false);
  
      const response = await axios.post('http://localhost:4000/chat/new', {}, { withCredentials: true });

      console.log('Create chat response:', response.data);
  
      const newChatFromBackend = response.data.chat;
  
      const newChat: Chat = {
        id: newChatFromBackend.chat_id,
        title: 'New Chat',
        lastMessage: 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.',
        timestamp: new Date(newChatFromBackend.date_created),
        messages: [
          {
            id: 'welcome',
            content: 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.',
            sender: 'ai',
            timestamp: new Date(),
          },
        ],
      };
  
      console.log('New chat object to add to state:', newChat);
  
      setChats(prev => [newChat, ...prev.filter(chat => chat.id !== newChat.id)]);
      setCurrentChatId(newChat.id);

      const welcomeMessage = 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.';

      await axios.post('http://localhost:4000/chat/message', {
        chat_id: newChat.id,
        sender: 'ai',
        text: welcomeMessage,
      }, { withCredentials: true });
 
      return newChat;

    } catch (error: any) {
      console.error('Error creating new chat:', error);
      if (error.response) {
        console.error('Backend error response:', error.response.data);
      }
      alert('Failed to create a new chat.');
      return undefined;
    }
  }, []);

  const fetchUserChats = useCallback(async (createIfEmpty = false) => {
    setChatsLoading(true);
    try {
      const resUser = await axios.get('http://localhost:4000/chat/user', {
        withCredentials: true
      });
      const userId = resUser.data;

      if (!userId) {
        console.warn('No user ID returned while fetching chats');
        setChatsLoading(false);
        return;
      }

      const resChats = await axios.get(`http://localhost:4000/chat/${userId}/chats`, {
        withCredentials: true
      });
      const userChats = Array.isArray(resChats.data) ? resChats.data : [];

      if (userChats.length === 0) {
        if (createIfEmpty) {
          await handleNewChat();
        } else {
          setChats([]);
          setCurrentChatId('');
        }
        setChatsLoading(false);
        return;
      }

      const formattedChats: Chat[] = userChats.map((chat: any) => ({
        id: chat.chat_id,
        title: chat.title || 'Chat',
        lastMessage: chat.messages?.at?.(-1)?.text || 'No messages yet',
        timestamp: new Date(chat.date_created),
        messages: (chat.messages || []).map((msg: any, index: number) => ({
          id: `${chat.chat_id}-${index}`,
          content: msg.text,
          sender: msg.sender,
          timestamp: new Date(msg.timestamp),
        })),
        graph_id: chat.graph_id,
      }));

      setChats(formattedChats);
      setCurrentChatId(prevId => {
        if (prevId && formattedChats.some(chat => chat.id === prevId)) {
          return prevId;
        }
        return formattedChats[0]?.id ?? prevId;
      });
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      setChatsLoading(false);
    }
  }, [handleNewChat]);

  useEffect(() => {
    fetchUserChats(true);
  }, [fetchUserChats]);

  useEffect(() => {
    if (!currentChatId && chats.length > 0) {
      setCurrentChatId(chats[0].id);
    }
  }, [chats, currentChatId]);

  // DEBUG: Log when isAnswering changes
  useEffect(() => {
    console.log('🟢 isAnswering state changed:', isAnswering);
    console.log('🟢 qaData length:', qaData.length);
    console.log('🟢 Should show End Quiz button:', isAnswering);
  }, [isAnswering, qaData]);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    } else if (type.includes('document') || type.includes('pdf')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const formatQuestion = (text: string): React.ReactNode => {
    if (!text) return text;

    const lines = text.split('\n');
    const formattedLines: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      const multipleChoicePattern = /\b([A-Z])[\)\.]\s+([^A-Z\)\.]+?)(?=\s+[A-Z][\)\.]|$)/g;
      let matches = Array.from(line.matchAll(multipleChoicePattern));
      
      if (matches.length < 2) {
        const altPattern = /\b([A-Z])[\)\.]([^A-Z\)\.]+?)(?=\s*[A-Z][\)\.]|$)/g;
        matches = Array.from(line.matchAll(altPattern));
      }
      
      if (matches.length >= 2) {
        const firstMatch = matches[0];
        const firstMatchIndex = line.indexOf(firstMatch[0]);
        const questionPart = line.substring(0, firstMatchIndex).trim();
        
        if (questionPart) {
          formattedLines.push(
            <div key={`q-${lineIndex}`} className="mb-3 font-medium">
              {questionPart}
            </div>
          );
        }

        matches.forEach((match, matchIndex) => {
          const choiceLetter = match[1];
          const choiceText = match[2].trim();
          formattedLines.push(
            <div key={`choice-${lineIndex}-${matchIndex}`} className="ml-1 mb-2 px-3 py-2 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-teal-50 hover:border-teal-300 transition-all duration-150 cursor-default flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{choiceLetter}</span>
              <span className="text-sm">{choiceText}</span>
            </div>
          );
        });
      } else {
        if (line.trim()) {
          if (line.match(/Question\s+\d+\s+of\s+\d+/i)) {
            formattedLines.push(
              <div key={`q-header-${lineIndex}`} className="mb-3 font-semibold text-teal-600">
                {line}
              </div>
            );
          } else {
            formattedLines.push(
              <div key={`line-${lineIndex}`} className={lineIndex > 0 ? 'mt-2' : ''}>
                {line}
              </div>
            );
          }
        }
      }
    });

    return formattedLines.length > 0 ? <div className="space-y-1">{formattedLines}</div> : text;
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (deletingChatRef.current === chatId) {
      console.log('⚠️ Delete already in progress for chat:', chatId);
      return;
    }

    console.log('🗑️ Delete button clicked for chat:', chatId);
    console.log('Current chats:', chats.map(c => c.id));

    deletingChatRef.current = chatId;

    console.log('✅ Proceeding with delete...');
    console.log('Sending DELETE request to:', `http://localhost:4000/chat/delete/${chatId}`);

    console.log('Updating local state optimistically...');
    setChats(prev => {
      const beforeCount = prev.length;
      const filtered = prev.filter(chat => chat.id !== chatId);
      console.log(`Chats: ${beforeCount} -> ${filtered.length} (removed ${beforeCount - filtered.length})`);
      return filtered;
    });
    
    if (currentChatId === chatId) {
      console.log('Clearing current chat ID because it was deleted');
      setCurrentChatId('');
    }

    try {
      const response = await axios.delete(`http://localhost:4000/chat/delete/${chatId}`, {
        withCredentials: true,
      });

      console.log('✅ Delete response received:', response.data);
      console.log('Response status:', response.status);
      console.log('✅ Chat deleted successfully on server');
      
      deletingChatRef.current = null;
      
    } catch (error: any) {
      console.error('❌ Error deleting chat on server:', error);
      
      deletingChatRef.current = null;
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data
      });
      
      console.log('Restoring chat in UI since server deletion failed...');
      await fetchUserChats(false);
      
      if (error?.response) {
        console.error('Backend error status:', error.response.status);
        console.error('Backend error response:', error.response.data);
        alert(`Failed to delete chat: ${error.response.data?.message || error.response.statusText || 'Unknown error'}`);
      } else if (error?.request) {
        console.error('No response received from server');
        alert('Failed to delete chat: No response from server. Is the server running?');
      } else {
        console.error('Request setup error:', error.message);
        alert(`Failed to delete chat: ${error.message}`);
      }
    }
  };

  const ResizeHandle = ({ className = '' }) => (
    <PanelResizeHandle className={`w-2 hover:bg-teal-500/20 transition-colors duration-150 ${className}`}>
      <div className="h-full w-[2px] bg-gray-200 mx-auto" />
    </PanelResizeHandle>
  );

  useEffect(() => {
    const currentChat = chats.find(chat => chat.id === currentChatId);
    
    // Check if there's already quiz state for this chat (user may have ended it or is in progress)
    const existingQuizState = currentChat ? loadQuizState(currentChat.id) : null;

    if (currentChat?.graph_id) {
      fetchGraphData(currentChat.graph_id);
      
      // Check if there's an existing quiz in progress
      if (existingQuizState) {
        // Restore quiz state if it exists
        setShouldStartQuiz(false);
      } else {
        // Show start quiz button - user must manually start the quiz
        setShouldStartQuiz(true);
      }
    } else {
      setGraphData(null);
      setQaData([]);
      setIsAnswering(false);
      setShouldStartQuiz(false);
    }

    return () => {
      setIsGeneratingQuestions(false);
    };
  }, [currentChatId, chats]);

  const startQuiz = async () => {
      if (isGeneratingQuestions || !currentChat?.graph_id) return;
    // clear completed flag when starting a new quiz
    setQuizCompleted(false);
      
      try {
        setIsGeneratingQuestions(true);
      const qaResponse = await axios.get(
        `http://localhost:4000/api/generate-questions-with-answers?graph_id=${currentChat.graph_id}&length=${quizLength}&format=${questionFormat}`,
        { withCredentials: true }
      );
        const qaResponseData = qaResponse.data;

        if (qaResponseData.status === 'success' && qaResponseData.qa_pairs) {
          console.log('🔍 Raw QA Pairs from API:', qaResponseData.qa_pairs);
          console.log('🔍 First QA Pair structure:', qaResponseData.qa_pairs[0]);
          console.log('🔍 COMPLETE First QA Pair (JSON):', JSON.stringify(qaResponseData.qa_pairs[0], null, 2));
          console.log('🔍 All keys in first QA pair:', Object.keys(qaResponseData.qa_pairs[0]));
          
          const normalizedPairs = qaResponseData.qa_pairs.map((p: QAPair, idx: number) => {
            const conceptId = p.conceptId || p.concept_id || p.topicId || p.topic_id || p.id || '';
            const sourceField = p.conceptId ? 'conceptId' : 
                               p.concept_id ? 'concept_id' : 
                               p.topicId ? 'topicId' : 
                               p.topic_id ? 'topic_id' : 
                               p.id ? 'id' : 'NONE';
            
            console.log(`📝 Question ${idx + 1} - conceptId extracted from field: ${sourceField}, value: ${conceptId}`);
            
            return {
              question: p.question,
              answer: (p.answer === 'T' || p.answer === 'True') ? 'True' : (p.answer === 'F' || p.answer === 'False') ? 'False' : p.answer,
              conceptId: conceptId
            };
          });
          
          console.log('🔍 Normalized pairs with conceptIds:', normalizedPairs.map((p: QAPair) => ({ q: p.question.substring(0, 50), conceptId: p.conceptId })));

          setQaData(normalizedPairs);
          setCurrentQuestionIndex(0);
          setIsAnswering(true);
        setUserAnswers([]); // Reset user answers for new quiz
        setShouldStartQuiz(false); // Hide the start button
        // Persist quiz state so navigating away doesn't lose it
        if (currentChatId) {
          saveQuizState(currentChatId, {
            qaData: normalizedPairs,
            currentQuestionIndex: 0,
            userAnswers: [],
            isAnswering: true,
            quizCompleted: false,
          });
        }
          const firstQuestionMessage: Message = {
          id: generateMessageId(),
            content: `Let's test your understanding. I'll ask you questions one by one.\n\nQuestion 1 of ${normalizedPairs.length}:\n\n${normalizedPairs[0].question}`,
            sender: 'ai',
            timestamp: new Date(),
            isQuestion: true,
            questionData: {
              question: normalizedPairs[0].question,
              correctAnswer: normalizedPairs[0].answer,
              conceptId: normalizedPairs[0].conceptId,
              questionIndex: 0,
              totalQuestions: normalizedPairs.length
            }
          };

        // Remove any leftover question messages from previous quizzes before adding the new first question.
            setChats(prevChats => prevChats.map(chat =>
              chat.id === currentChatId
                ? {
                    ...chat,
                messages: [...chat.messages.filter(m => !m.isQuestion), firstQuestionMessage],
                  }
                : chat
            ));

            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: firstQuestionMessage.content,
            }, { withCredentials: true });
        }
      } catch (error) {
        console.error('Error fetching QA data:', error);
      } finally {
          setIsGeneratingQuestions(false);
      }
    };

  // Add useEffect to load graph when chat changes
  // Add useEffect to load graph and restore quiz state when chat changes
  useEffect(() => {
      const currentChat = chats.find(chat => chat.id === currentChatId);
    if (currentChat?.graph_id) {
      fetchGraphData(currentChat.graph_id);

          // Try to restore persisted quiz state first
          const persisted = currentChatId ? loadQuizState(currentChatId) : null;
          const hasExistingQuestions = currentChat.messages.some(m => m.isQuestion);

          if (persisted && persisted.qaData) {
            // Restore persisted state
            setQaData(persisted.qaData);
            setCurrentQuestionIndex(persisted.currentQuestionIndex || 0);
            setUserAnswers(persisted.userAnswers || []);
            setIsAnswering(!!persisted.isAnswering);
            setQuizCompleted(!!persisted.quizCompleted);
            setShouldStartQuiz(false);
          } else if (hasExistingQuestions && qaData.length === 0) {
              // Reconstruct quiz state from chat message history (do not call startQuiz which requests new questions)
              const reconstructed: QAPair[] = currentChat.messages
                .filter(m => m.isQuestion && m.questionData)
                .map(m => ({ question: m.questionData!.question, answer: m.questionData!.correctAnswer, conceptId: m.questionData!.conceptId }));

              if (reconstructed.length > 0) {
                setQaData(reconstructed);
                const lastQuestion = currentChat.messages.slice().reverse().find(m => m.isQuestion && m.questionData);
                const lastIndex = lastQuestion?.questionData?.questionIndex ?? 0;
                setCurrentQuestionIndex(lastIndex);
                setIsAnswering(true);
                setShouldStartQuiz(false);
                // Persist reconstructed state for durability
                if (currentChatId) {
                  saveQuizState(currentChatId, {
                    qaData: reconstructed,
                    currentQuestionIndex: lastIndex,
                    userAnswers: [],
                    isAnswering: true,
                    quizCompleted: false,
                  });
                }
              }
      } else if (!hasExistingQuestions) {
        // If there are no questions in history, reset the quiz state and show the Start Quiz button.
        setQaData([]);
        setIsAnswering(false);
        // If this chat has a graph, allow starting a quiz from the UI (e.g. after returning from Profile).
        if (currentChat?.graph_id) {
          setShouldStartQuiz(true);
        }
      }
    } else {
          // This is a chat without a document/graph, so reset everything.
      setGraphData(null);
      setQaData([]);
      setIsAnswering(false);
          setShouldStartQuiz(false);
      }
  }, [currentChatId, currentChat?.graph_id]); // Dependency array ensures this runs when the chat changes

  // Show loading state while fetching chats
  if (chatsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
          <p className="text-slate-500">Loading chats...</p>
        </div>
      </div>
    );
  }

  // Only show "No chats yet" if loading is complete and there are no chats
  if (!currentChat && chats.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-blue-50">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-slate-800">No chats yet</h2>
          <p className="text-slate-500">Start a new conversation to begin chatting with your study assistant.</p>
          <button
            onClick={() => void handleNewChat()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-md shadow-teal-500/20 btn-lift"
          >
            Start a New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
      <div
        className={`${
          isSidebarCollapsed ? 'w-12' : 'w-64'
        } bg-slate-900 flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
          {!isSidebarCollapsed && (
            <h2 className="text-lg font-semibold text-slate-100">Chat History</h2>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 hover:bg-slate-700/50 rounded-lg transition-colors duration-150"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
        
        <button
          onClick={() => void handleNewChat()}
          className={`m-4 p-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-teal-500/20 btn-lift ${
            isSidebarCollapsed ? 'p-2' : ''
          }`}
        >
          <Plus className="w-5 h-5" />
          {!isSidebarCollapsed && <span>New Chat</span>}
        </button>

        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {chats
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .map((chat) => (
              <div
                key={chat.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button[title="Delete chat"]')) {
                    return;
                  }
                  handleChatSelect(chat.id);
                }}
                className={`p-3 hover:bg-slate-800/70 cursor-pointer border-b border-slate-700/30 transition-colors duration-150 relative group ${
                  currentChatId === chat.id ? 'bg-slate-800 border-l-2 border-l-teal-400' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-teal-400" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-200 truncate">
                      {chat.title}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                  </div>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('Delete button onClick triggered for chat:', chat.id);
                        handleDeleteChat(chat.id, e);
                      }}
                      className="opacity-70 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded transition-all duration-150 z-50 relative flex-shrink-0"
                      title="Delete chat"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {(() => {
                    const now = new Date();
                    const diff = now.getTime() - chat.timestamp.getTime();
                    const mins = Math.floor(diff / 60000);
                    const hrs = Math.floor(diff / 3600000);
                    const days = Math.floor(diff / 86400000);
                    if (mins < 1) return 'Just now';
                    if (mins < 60) return `${mins}m ago`;
                    if (hrs < 24) return `${hrs}h ago`;
                    if (days === 1) return 'Yesterday';
                    if (days < 7) return `${days}d ago`;
                    return chat.timestamp.toLocaleDateString();
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={40} minSize={20}>
          <div className="h-full p-4 bg-transparent">
            <div className="h-full rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-sm">
              {isProcessingFile ? (
                <div className="h-full flex flex-col items-center justify-center px-8">
                  <FileText className="w-12 h-12 text-teal-500 mb-4 animate-pulse" />
                  <p className="text-gray-800 text-lg font-semibold mb-1">
                    Processing your PDF{loadingDots}
                  </p>
                  <p className="text-gray-500 text-sm mb-6">
                    {progressMessage || 'Extracting concepts and building your knowledge graph'}
                  </p>
                  <div className="w-full max-w-xs">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">{uploadProgress}%</p>
                  </div>
                </div>
              ) : (
                <GraphVisualization data={graphData} conceptProgress={conceptProgress} />
              )}
            </div>
          </div>
        </Panel>

        <ResizeHandle className="w-2 hover:bg-teal-400/20 transition-colors duration-150" />

        <Panel minSize={30}>
          <div className="h-full flex flex-col">
            <div className="bg-white/80 backdrop-blur-sm p-4 border-b border-slate-200/60 flex justify-between items-center" style={{ zIndex: 1000, position: 'relative' }}>
              <h1 className="text-xl font-semibold text-slate-800 flex-1 min-w-0 truncate">{currentChat?.title || 'Loading...'}</h1>
              <div className="flex items-center gap-4 flex-wrap max-w-full flex-shrink-0" style={{ zIndex: 100, position: 'relative' }}>
                {/* Quiz Length Control */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-600">Quiz Length:</label>
                  <select
                    value={quizLength}
                    onChange={(e) => setQuizLength(Number(e.target.value) as 5 | 10 | 15)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer bg-white hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all max-w-[9rem]"
                    style={{ zIndex: 101, position: 'relative', pointerEvents: 'auto' }}
                    disabled={isAnswering}
                  >
                    <option value={5}>5 questions</option>
                    <option value={10}>10 questions</option>
                    <option value={15}>15 questions</option>
                  </select>
                </div>
                
                {/* Question Type Control */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">Question Type:</label>
                  <select
                    value={questionFormat}
                    onChange={(e) => setQuestionFormat(e.target.value as 'mixed' | 'mcq' | 'true-false' | 'open-ended')}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer bg-white hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all max-w-[11rem]"
                    style={{ zIndex: 101, position: 'relative', pointerEvents: 'auto' }}
                    disabled={isAnswering}
                  >
                    <option value="mixed">Mixed (Random)</option>
                    <option value="mcq">Multiple Choice</option>
                    <option value="true-false">True/False</option>
                    <option value="open-ended">Open-Ended</option>
                  </select>
                </div>
                
                {/* Divider */}
                <div className="h-8 w-px bg-slate-200"></div>
                
                <button
                  onClick={() => {
                    if (currentChat?.graph_id) {
                      navigate(`/profile?graph_id=${currentChat.graph_id}`);
                    } else {
                      alert("Please upload a document to view progress.");
                    }
                  }}
                  className="px-4 py-2 bg-white text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-sm btn-lift"
                >
                  View Profile
                </button>
                
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 bg-white text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-sm btn-lift"
                >
                  Return to Homepage
                </button>
                
                {/* Start Quiz button moved to header for better placement */}
                {shouldStartQuiz && !isAnswering && currentChat?.graph_id && (
                  <button
                    onClick={startQuiz}
                    disabled={isGeneratingQuestions}
                    className={`px-4 py-2 ${isGeneratingQuestions ? 'bg-slate-200 text-slate-500' : 'bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-md shadow-teal-500/20 animate-gentle-pulse'} rounded-lg transition-all duration-200 flex items-center gap-2 font-medium btn-lift`}
                    title={isGeneratingQuestions ? 'Generating questions...' : 'Start quiz based on this document'}
                  >
                    {isGeneratingQuestions ? 'Generating...' : (quizCompleted ? 'Start New Quiz' : 'Start Quiz')}
                  </button>
                )}
                
                {/* End Quiz button - shows when quiz is active */}
                {isAnswering && (
                  <button
                    onClick={async () => {
                      console.log('🔴 END QUIZ BUTTON CLICKED!');
                      console.log('🟡 Resetting quiz state...');
                      
                      // Reset all quiz state
                      setIsAnswering(false);
                      setQaData([]);
                      setCurrentQuestionIndex(0);
                      setUserAnswers([]);
                      setQuizCompleted(false);
                      setShouldStartQuiz(true); // Show start quiz button again
                      
                      console.log('✅ Quiz state reset! isAnswering=false');
                      
                      // Clear persisted quiz state
                      if (currentChatId) {
                        clearQuizState(currentChatId);
                        console.log('✅ Cleared persisted quiz state');
                      }
                      
                      // Add a message to chat indicating quiz was ended
                      const endMessage: Message = {
                        id: generateMessageId(),
                        content: 'Quiz ended. You can start a new quiz anytime by clicking "Start Quiz".',
                        sender: 'ai',
                        timestamp: new Date(),
                      };
                      
                      setChats(prevChats => prevChats.map(chat =>
                        chat.id === currentChatId
                          ? { ...chat, messages: [...chat.messages, endMessage] }
                          : chat
                      ));

                      // Save the end message to backend (consistent with other messages)
                      try {
                        await axios.post('http://localhost:4000/chat/message', {
                          chat_id: currentChatId,
                          sender: 'ai',
                          text: endMessage.content,
                        }, { withCredentials: true });
                        console.log('✅ End quiz message saved to backend');
                      } catch (error) {
                        console.error('Error saving end quiz message:', error);
                        // Don't show error to user since quiz state is already cleared locally
                      }
                    }}
                    className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors duration-200 flex items-center gap-2 font-medium"
                    style={{ 
                      zIndex: 9999, 
                      position: 'relative', 
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                    title="End the current quiz without finishing"
                  >
                    End Quiz
                  </button>
                )}
              </div>
            </div>

            {/* Quiz progress step bar */}
            {isAnswering && qaData.length > 0 && (
              <div className="px-4 py-2.5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-600">Question {currentQuestionIndex + 1} of {qaData.length}</span>
                  <span className="text-xs text-slate-400">({Math.round(((currentQuestionIndex) / qaData.length) * 100)}% complete)</span>
                </div>
                <div className="flex gap-1">
                  {qaData.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        idx < currentQuestionIndex
                          ? 'bg-teal-500'
                          : idx === currentQuestionIndex
                          ? 'bg-teal-400 animate-pulse'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50/80 to-slate-100/50">
              {currentChat?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} ${message.sender === 'user' ? 'animate-slide-in-right' : 'animate-slide-in-left'} group/msg`}
                >
                  <div
                    className={`flex items-end gap-2 max-w-[75%] ${
                      message.sender === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-br from-teal-400 to-teal-600'
                        : 'bg-gradient-to-br from-slate-200 to-slate-300'
                    }`}>
                      {message.sender === 'user' ? (
                        <User className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    {/* Bubble */}
                    <div
                      className={`px-3.5 py-2.5 ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-2xl rounded-br-md shadow-md shadow-teal-500/15'
                          : 'bg-white text-slate-800 rounded-2xl rounded-bl-md border border-slate-200/60 shadow-sm'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.isQuestion ? formatQuestion(message.content) : message.content}
                      </div>
                      {message.file && (
                        <div className="mt-2 p-2 bg-white/10 rounded-lg">
                          <div className="flex items-center space-x-2">
                            {getFileIcon(message.file.type)}
                            <a
                              href={message.file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:text-blue-300 truncate"
                            >
                              {message.file.name}
                            </a>
                          </div>
                          {message.file.type.startsWith('image/') && (
                            <img
                              src={message.file.url}
                              alt={message.file.name}
                              className="mt-2 max-w-full h-auto rounded-lg"
                            />
                          )}
                        </div>
                      )}
                      {/* Hover timestamp */}
                      <div className={`text-[10px] mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 ${
                        message.sender === 'user' ? 'text-teal-100' : 'text-slate-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start animate-slide-in-left">
                  <div className="flex items-end gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md border border-slate-200/60 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Start Quiz button is now located in the header for improved UX */}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200/60">
              {isProcessingFile && (
                <div className="mb-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-teal-700">
                      {progressMessage || 'Processing PDF...'}
                    </span>
                    <span className="text-xs font-semibold text-teal-600">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-teal-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {selectedFile && !isProcessingFile && (
                <div className="mb-2 p-2 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200/60">
                  <div className="flex items-center space-x-2">
                    {getFileIcon(selectedFile.type)}
                    <span className="text-sm text-slate-600 truncate">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isAnswering ? "Type your answer..." : "Type your message..."}
                  className="flex-1 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder-slate-400 transition-all"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!isAnswering && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingFile}
                    className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                )}
                {isAnswering && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isTyping}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 flex items-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    title="Skip this question (counts as incorrect)"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isTyping}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-500/20 btn-lift"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;