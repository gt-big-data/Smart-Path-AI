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
}

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChatId, setCurrentChatId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [qaData, setQaData] = useState<QAPair[]>([]);
  const [quizLength, setQuizLength] = useState<5 | 10 | 15>(5);
  const [shouldStartQuiz, setShouldStartQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deletingChatRef = useRef<string | null>(null); // Track which chat is being deleted
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

  const generateAIResponse = async (userMessage: string, fileType?: string) => {
    let aiResponse = '';

    // Handle file uploads
    if (fileType) {
      if (fileType.startsWith('image/')) {
        aiResponse = 'I see you\'ve shared an image. What would you like me to help you with regarding this image?';
      } else if (fileType.includes('document') || fileType.includes('pdf')) {
        aiResponse = 'I\'ve received your document. What aspects would you like me to review or analyze?';
      } else {
        aiResponse = 'I\'ve received your file. How can I help you with it?';
      }
    } else {
      // Simple response logic based on user input
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
      setGraphData(response.data);
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

        // Get current chat's graph_id if it exists
        const currentChatData = chats.find(chat => chat.id === currentChatId);
        const url = currentChatData?.graph_id 
          ? `http://localhost:4000/upload/process-pdf?graph_id=${currentChatData.graph_id}`
          : 'http://localhost:4000/upload/process-pdf';

        // Send to our backend first
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
        });

        const status = response.status;
        const contentType = response.headers.get('content-type') || '';
        console.log('[Upload] Response status:', status, 'content-type:', contentType);

        let responseData: any;
        if (contentType.includes('application/json')) {
          try {
            responseData = await response.json();
          } catch (parseErr) {
            console.error('[Upload] Failed to parse JSON', parseErr);
            const rawText = await response.text();
            console.error('[Upload] Raw non-JSON response snippet:', rawText.slice(0, 300));
            throw new Error('Upload returned malformed JSON');
          }
        } else {
          // Likely an HTML error page (hence Unexpected token '<')
          const rawText = await response.text();
          console.error('[Upload] Non-JSON response (first 300 chars):', rawText.slice(0, 300));
          throw new Error(`Unexpected non-JSON response (status ${status}).`);
        }
        console.log('[Upload] Parsed response JSON:', responseData);

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to process file');
        }

        // Create file upload message
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

        // Save file upload message to backend first
        await axios.post('http://localhost:4000/chat/message', {
          chat_id: currentChatId,
          sender: 'user',
          text: fileUploadMessage.content,
        }, { withCredentials: true });

        // Update local state with file upload message
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

        // If this is a new graph, update the chat with the graph_id
        if (responseData.graph_id) {
          await axios.post('http://localhost:4000/chat/message', {
            chat_id: currentChatId,
            graph_id: responseData.graph_id,
          }, { withCredentials: true });

          // Update local state
          setChats(prevChats => prevChats.map(chat => 
            chat.id === currentChatId
              ? { ...chat, graph_id: responseData.graph_id }
              : chat
          ));
        }

        // Fetch graph data with the graph_id
        await fetchGraphData(responseData.graph_id);
        
        // Set the trigger to show the "Start Quiz" button
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
        
        // Create and save error message
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

        // Send answer for verification
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
        
        // The backend now handles progress updates.
        // const conceptId = lastQuestion.questionData.conceptId; 
        // await updateProgress(conceptId, verificationResult.isCorrect, isRetry);

        if (verificationResult.isCorrect) {
          // Track this answer
          setUserAnswers(prev => [...prev, trimmedInput]);
          
          // If answer is correct and there are more questions, show the next one
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

            // Save both feedback and next question to backend
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
            console.log('[Quiz] Advanced to next question index', currentQuestionIndex + 1);
          } else {
            // All questions answered correctly
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

            // Save final message to backend
            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: finalMessage.content,
            }, { withCredentials: true });

            // Save quiz history to backend
            try {
              // Add the final answer to userAnswers
              const allAnswers = [...userAnswers, trimmedInput];
              
              const quizHistoryData = {
                concepts: qaData.map((_, index) => ({
                  conceptID: `concept_${currentChat?.graph_id}_${index}`,
                  name: `Question ${index + 1} Concept`
                })),
                questions: qaData.map((qa, index) => ({
                  questionText: qa.question,
                  userAnswer: allAnswers[index] || 'No answer provided',
                  correctAnswer: qa.answer,
                  explanation: `This question tests understanding of the material covered in the graph.`,
                  timestamp: new Date().toISOString()
                }))
              };

              console.log('Saving quiz history:', quizHistoryData);
              
              await axios.post('http://localhost:4000/api/quiz-history', quizHistoryData, { 
                withCredentials: true 
              });
              
              console.log('Quiz history saved successfully');
            } catch (error) {
              console.error('Error saving quiz history:', error);
            }

            setIsAnswering(false);
            console.log('[Quiz] Quiz completed successfully');
            // Allow the user to start a new quiz after finishing the previous one
            setShouldStartQuiz(true);
            setQuizCompleted(true);
          }
        } else {
          // If answer is incorrect, show feedback and follow-up
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

          // Save feedback message to backend
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

        // Save error message to backend
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
      // Regular chat message handling
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

        // Save AI response to backend
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

        // Save error message to backend
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

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const handleNewChat = useCallback(async () => {
    try {
      console.log('Creating new chat...');
  
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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    } else if (type.includes('document') || type.includes('pdf')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  // Format question text for better readability
  const formatQuestion = (text: string): React.ReactNode => {
    if (!text) return text;

    // Split by newlines first to preserve existing line breaks
    const lines = text.split('\n');
    const formattedLines: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      // Check for multiple choice patterns: A), B), C), D) or A., B., C., D.
      // Pattern: Letter followed by ) or . followed by space and text, until next letter choice or end
      const multipleChoicePattern = /\b([A-Z])[\)\.]\s+([^A-Z\)\.]+?)(?=\s+[A-Z][\)\.]|$)/g;
      let matches = Array.from(line.matchAll(multipleChoicePattern));
      
      // If no matches with space after ), try without space requirement
      if (matches.length < 2) {
        const altPattern = /\b([A-Z])[\)\.]([^A-Z\)\.]+?)(?=\s*[A-Z][\)\.]|$)/g;
        matches = Array.from(line.matchAll(altPattern));
      }
      
      if (matches.length >= 2) {
        // This is a multiple choice question
        // Extract the question part (before the first choice)
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

        // Format each choice on a new line
        matches.forEach((match, matchIndex) => {
          const choiceLetter = match[1];
          const choiceText = match[2].trim();
          const separator = match[0].includes('.') ? '.' : ')';
          formattedLines.push(
            <div key={`choice-${lineIndex}-${matchIndex}`} className="ml-4 mb-2 pl-2 border-l-2 border-gray-300">
              <span className="font-semibold text-teal-600">{choiceLetter}{separator}</span> {choiceText}
            </div>
          );
        });
      } else {
        // Check for numbered lists or other formatting
        // Regular line, preserve as is but format nicely
        if (line.trim()) {
          // Check if it's a question number line (e.g., "Question 1 of 5:")
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

    // Prevent double-deletion
    if (deletingChatRef.current === chatId) {
      console.log('⚠️ Delete already in progress for chat:', chatId);
      return;
    }

    console.log('🗑️ Delete button clicked for chat:', chatId);
    console.log('Current chats:', chats.map(c => c.id));

    // Mark as deleting immediately to prevent double-clicks
    deletingChatRef.current = chatId;

    // Delete immediately - confirmation removed for now due to dialog issues
    console.log('✅ Proceeding with delete...');
    console.log('Sending DELETE request to:', `http://localhost:4000/chat/delete/${chatId}`);

    // Optimistically update UI immediately (before server response)
    console.log('Updating local state optimistically...');
    setChats(prev => {
      const beforeCount = prev.length;
      const filtered = prev.filter(chat => chat.id !== chatId);
      console.log(`Chats: ${beforeCount} -> ${filtered.length} (removed ${beforeCount - filtered.length})`);
      return filtered;
    });
    
    // Clear current chat if it was deleted
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
      
      // Clear deletion flag
      deletingChatRef.current = null;
      
      // Only refresh if the server deletion failed (to restore state)
      // Otherwise, our optimistic update is already correct
    } catch (error: any) {
      console.error('❌ Error deleting chat on server:', error);
      
      // Clear deletion flag on error too
      deletingChatRef.current = null;
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data
      });
      
      // Restore the chat since deletion failed
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

  // ...existing code... (no local helper required)

  const ResizeHandle = ({ className = '' }) => (
    <PanelResizeHandle className={`w-2 hover:bg-teal-500/20 transition-colors duration-150 ${className}`}>
      <div className="h-full w-[2px] bg-gray-200 mx-auto" />
    </PanelResizeHandle>
  );

  const startQuiz = async () => {
    if (isGeneratingQuestions || !currentChat?.graph_id) return;
    // clear completed flag when starting a new quiz
    setQuizCompleted(false);
    
    try {
      setIsGeneratingQuestions(true);
      const qaResponse = await axios.get(
        `http://localhost:4000/api/generate-questions-with-answers?graph_id=${currentChat.graph_id}&length=${quizLength}`,
        { withCredentials: true }
      );
      const qaResponseData = qaResponse.data;
      
      if (qaResponseData.status === 'success' && qaResponseData.qa_pairs) {
        const normalizedPairs = qaResponseData.qa_pairs.map((p: QAPair) => ({
          question: p.question,
          answer: (p.answer === 'T' || p.answer === 'True') ? 'True' : (p.answer === 'F' || p.answer === 'False') ? 'False' : p.answer,
          conceptId: p.conceptId
        }));

        setQaData(normalizedPairs);
        setCurrentQuestionIndex(0);
        setIsAnswering(true);
        setUserAnswers([]); // Reset user answers for new quiz
        setShouldStartQuiz(false); // Hide the start button
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

          // Check if a quiz is already in progress for this chat
          const hasExistingQuestions = currentChat.messages.some(m => m.isQuestion);
          if (hasExistingQuestions && qaData.length === 0) {
              // If there are questions in history but not in state, it means we need to restore the quiz.
              // We can re-trigger the question generation to get back on track.
              startQuiz(); 
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
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
          <p className="text-gray-500">Loading chats...</p>
        </div>
      </div>
    );
  }

  // Only show "No chats yet" if loading is complete and there are no chats
  if (!currentChat && chats.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">No chats yet</h2>
          <p className="text-gray-500">Start a new conversation to begin chatting with your study assistant.</p>
          <button
            onClick={() => void handleNewChat()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors duration-200"
          >
            Start a New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Chat History Sidebar */}
      <div
        className={`${
          isSidebarCollapsed ? 'w-12' : 'w-64'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          {!isSidebarCollapsed && (
            <h2 className="text-lg font-semibold text-gray-800">Chat History</h2>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors duration-150"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
        
        {/* New Chat Button */}
        <button
          onClick={() => void handleNewChat()}
          className={`m-4 p-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors duration-200 flex items-center justify-center gap-2 ${
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
                  // Don't select chat if clicking on delete button
                  if ((e.target as HTMLElement).closest('button[title="Delete chat"]')) {
                    return;
                  }
                  handleChatSelect(chat.id);
                }}
                className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200 transition-colors duration-150 relative group ${
                  currentChatId === chat.id ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-teal-500" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-800 truncate">
                      {chat.title}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">{chat.lastMessage}</p>
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
                      className="opacity-70 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded transition-all duration-150 z-50 relative flex-shrink-0"
                      title="Delete chat"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {chat.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Graph Section */}
        <Panel defaultSize={40} minSize={20}>
          <div className="h-full p-6 bg-white">
            <div className="h-full rounded-lg bg-white border-2 border-gray-200">
              {isProcessingFile ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-600 text-lg">
                    Processing your file{loadingDots}
                  </p>
                </div>
              ) : (
                <GraphVisualization data={graphData} />
              )}
            </div>
          </div>
        </Panel>

        <ResizeHandle className="w-2 hover:bg-teal-500/20 transition-colors duration-150" />

        {/* Chat Section */}
        <Panel minSize={30}>
          <div className="h-full flex flex-col">
            {/* Chat Header */}
            <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center">
              <h1 className="text-xl font-semibold text-gray-800">{currentChat?.title || 'Loading...'}</h1>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Quiz length</label>
                <select
                  value={quizLength}
                  onChange={(e) => setQuizLength(Number(e.target.value) as 5 | 10 | 15)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  disabled={isAnswering}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
                <button
                  onClick={() => {
                    if (currentChat?.graph_id) {
                      navigate(`/profile?graph_id=${currentChat.graph_id}`);
                    } else {
                      // Optionally, handle the case where there is no graph yet
                      alert("Please upload a document to view progress.");
                    }
                  }}
                  className="p-2 bg-transparent text-teal-600 border border-teal-500 rounded-lg hover:bg-teal-50 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  View Profile
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="p-2 bg-transparent text-teal-600 border border-teal-500 rounded-lg hover:bg-teal-50 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  Return to Homepage
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {currentChat?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex items-start space-x-2 max-w-[80%] ${
                      message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-teal-500 text-white'
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        {message.sender === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                        <span className="text-xs text-gray-300">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
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
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Bot className="w-4 h-4" />
                      <span className="text-sm">Typing...</span>
                    </div>
                  </div>
                </div>
              )}
              {shouldStartQuiz && !isAnswering && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={startQuiz}
                    disabled={isGeneratingQuestions}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 disabled:bg-gray-400"
                  >
                    {isGeneratingQuestions ? 'Generating...' : (quizCompleted ? 'Start New Quiz' : 'Start Quiz')}
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
              {selectedFile && !isProcessingFile && (
                <div className="mb-2 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getFileIcon(selectedFile.type)}
                    <span className="text-sm text-gray-600 truncate">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-gray-600"
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
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center transition-colors duration-200"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center transition-colors duration-200"
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