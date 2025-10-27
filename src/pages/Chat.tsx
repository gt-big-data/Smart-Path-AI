import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Send, Bot, User, MessageSquare, ChevronLeft, ChevronRight, Plus, Paperclip, X, FileText, Image, File } from 'lucide-react';
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
}

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChatId, setCurrentChatId] = useState('3');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [qaData, setQaData] = useState<QAPair[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingDots, setLoadingDots] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);

  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([
    {
      id: '3',
      title: 'New Chat',
      lastMessage: 'Hello! How can I help you today?',
      timestamp: new Date(),
      messages: [
        {
          id: '3-1',
          content: 'Hello! How can I help you today? Feel free to ask me anything!',
          sender: 'ai',
          timestamp: new Date(),
        },
      ],
    },
  ]);

  const currentChat = chats.find(chat => chat.id === currentChatId)!;
  const [input, setInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat.messages]);

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
      id: Date.now().toString(),
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


  //load all of user's old chats:
  useEffect(() => {
    const fetchUserChats = async () => {
      try {
        const resUser = await axios.get('/chat/user');
        const userId = resUser.data;
        console.log("Fetched userId:", userId);
  
        const resChats = await axios.get(`/chat/${userId}/chats`);
        const userChats = resChats.data;
        console.log("Fetched chats from DB:", resChats.data);
  
        if (userChats.length > 0) {
          const formattedChats = userChats.map((chat: { chat_id: any; messages: { (): any; new(): any; text: any; }[]; date_created: string | number | Date; graph_id: string; }) => ({
            id: chat.chat_id,
            title: 'Chat',
            lastMessage: chat.messages.at(-1)?.text || 'No messages yet',
            timestamp: new Date(chat.date_created),
            messages: chat.messages.map((msg: any, index: number) => ({
              id: `${chat.chat_id}-${index}`,
              content: msg.text,
              sender: msg.sender,
              timestamp: new Date(msg.timestamp),
            })),
            graph_id: chat.graph_id
          }));
  
          setChats(formattedChats);
          setCurrentChatId(formattedChats[0].id); // auto-load latest chat
        }
  
      } catch (err) {
        console.error('Error fetching chats:', err);
      }
    };
    fetchUserChats();
  }, []);
  

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

        console.log('Response status:', response.status);
        const responseData = await response.json();
        console.log('Response data:', responseData);

        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to process file');
        }

        // Create file upload message
        const fileUploadMessage: Message = {
          id: Date.now().toString(),
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
        
        // Fetch QA data
        try {
          const qaResponse = await fetch(`http://localhost:4000/api/generate-questions-with-answers?graph_id=${responseData.graph_id}`);
          const qaResponseData = await qaResponse.json();
          if (qaResponseData.status === 'success' && qaResponseData.qa_pairs) {
            // Normalize TF answers: server may return 'T'/'F' for true/false
            const normalizedPairs = qaResponseData.qa_pairs.map((p: QAPair) => ({
              question: p.question,
              answer: (p.answer === 'T' || p.answer === 'True') ? 'True' : (p.answer === 'F' || p.answer === 'False') ? 'False' : p.answer
            }));

            setQaData(normalizedPairs);
            setCurrentQuestionIndex(0);
            setIsAnswering(true);

            // Show the first question
            const firstQuestionMessage: Message = {
              id: Date.now().toString(),
              content: `Let's test your understanding. I'll ask you questions one by one.\n\nQuestion 1 of ${normalizedPairs.length}:\n\n${normalizedPairs[0].question}`,
              sender: 'ai',
              timestamp: new Date(),
              isQuestion: true,
              questionData: {
                question: normalizedPairs[0].question,
                correctAnswer: normalizedPairs[0].answer,
                questionIndex: 0,
                totalQuestions: normalizedPairs.length
              }
            };

            setChats(prevChats => prevChats.map(chat =>
              chat.id === currentChatId
                ? {
                    ...chat,
                    messages: [...chat.messages, firstQuestionMessage],
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
        }

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
          id: Date.now().toString(),
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
    
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: 'user',
      timestamp: new Date(),
    };

    // Clear input immediately
    setInput('');

    // Always add user message immediately
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId
        ? {
            ...chat,
            lastMessage: input,
            timestamp: new Date(),
            messages: [...chat.messages, userMessage],
          }
        : chat
    ));

    // Save user message to backend
    try {
      await axios.post('http://localhost:4000/chat/message', {
        chat_id: currentChatId,
        sender: 'user',
        text: input,
      }, { withCredentials: true });
  
      console.log('Message saved to backend');
    } catch (error) {
      console.error('Error saving message:', error);
    }

    // Find the last question message
    const lastQuestion = [...currentChat.messages].reverse().find(m => m.isQuestion);

    if (lastQuestion?.questionData && isAnswering) {
      try {
        setIsTyping(true);
        // Send answer for verification
        const response = await axios.post('http://localhost:4000/api/verify-answer', {
          question: lastQuestion.questionData.question,
          userAnswer: input,
          correctAnswer: lastQuestion.questionData.correctAnswer
        });

        const verificationResult = response.data;
        
        if (verificationResult.isCorrect) {
          // Track this answer
          setUserAnswers(prev => [...prev, input]);
          
          // If answer is correct and there are more questions, show the next one
          if (qaData.length > currentQuestionIndex + 1) {
            const nextQuestionMessage: Message = {
              id: Date.now().toString(),
              content: `Correct! Let's move on to the next question:\n\n${qaData[currentQuestionIndex + 1].question}`,
              sender: 'ai',
              timestamp: new Date(),
              isQuestion: true,
              questionData: {
                question: qaData[currentQuestionIndex + 1].question,
                correctAnswer: qaData[currentQuestionIndex + 1].answer,
                questionIndex: currentQuestionIndex + 1,
                totalQuestions: qaData.length
              }
            };

            const feedbackMessage: Message = {
              id: Date.now().toString(),
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
          } else {
            // All questions answered correctly
            const finalMessage: Message = {
              id: Date.now().toString(),
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
              const allAnswers = [...userAnswers, input];
              
              const quizHistoryData = {
                concepts: qaData.map((qa, index) => ({
                  conceptID: `concept_${currentChat.graph_id}_${index}`,
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
          }
        } else {
          // If answer is incorrect, show feedback and follow-up
          const feedbackMessage: Message = {
            id: Date.now().toString(),
            content: `${verificationResult.feedback}\n\n${verificationResult.followUpQuestion}\n\nTry answering the original question again:`,
            sender: 'ai',
            timestamp: new Date(),
            isQuestion: true,
            questionData: lastQuestion.questionData
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
          id: Date.now().toString(),
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
          id: Date.now().toString(),
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

  const handleNewChat = async () => {
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
  
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);

      const welcomeMessage = 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.';

      await axios.post('http://localhost:4000/chat/message', {
        chat_id: newChat.id,
        sender: 'ai',
        text: welcomeMessage,
      }, { withCredentials: true });
  
      console.log('New chat added successfully! Current chats:', [...chats, newChat]);
  
    } catch (error: any) {
      console.error('Error creating new chat:', error);
      if (error.response) {
        console.error('Backend error response:', error.response.data);
      }
      alert('Failed to create a new chat.');
    }
  };
  
  

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    } else if (type.includes('document') || type.includes('pdf')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  // ...existing code... (no local helper required)

  const ResizeHandle = ({ className = '' }) => (
    <PanelResizeHandle className={`w-2 hover:bg-teal-500/20 transition-colors duration-150 ${className}`}>
      <div className="h-full w-[2px] bg-gray-200 mx-auto" />
    </PanelResizeHandle>
  );

  // Add useEffect to load graph and questions when chat changes
  useEffect(() => {
    let isMounted = true;
    const currentChat = chats.find(chat => chat.id === currentChatId);

    const fetchQA = async () => {
      if (isGeneratingQuestions || !currentChat?.graph_id) return;
      
      try {
        setIsGeneratingQuestions(true);
        const qaResponse = await fetch(`http://localhost:4000/api/generate-questions-with-answers?graph_id=${currentChat.graph_id}`);
        const qaResponseData = await qaResponse.json();
        
        // Check if component is still mounted and chat ID hasn't changed
        if (!isMounted || currentChatId !== currentChat.id) return;

        if (qaResponseData.status === 'success' && qaResponseData.qa_pairs) {
          const normalizedPairs = qaResponseData.qa_pairs.map((p: QAPair) => ({
            question: p.question,
            answer: (p.answer === 'T' || p.answer === 'True') ? 'True' : (p.answer === 'F' || p.answer === 'False') ? 'False' : p.answer
          }));

          setQaData(normalizedPairs);
          setCurrentQuestionIndex(0);
          setIsAnswering(true);
          setUserAnswers([]); // Reset user answers for new quiz

          const firstQuestionMessage: Message = {
            id: Date.now().toString(),
            content: `Let's test your understanding. I'll ask you questions one by one.\n\nQuestion 1 of ${normalizedPairs.length}:\n\n${normalizedPairs[0].question}`,
            sender: 'ai',
            timestamp: new Date(),
            isQuestion: true,
            questionData: {
              question: normalizedPairs[0].question,
              correctAnswer: normalizedPairs[0].answer,
              questionIndex: 0,
              totalQuestions: normalizedPairs.length
            }
          };

          if (isMounted && currentChatId === currentChat.id) {
            setChats(prevChats => prevChats.map(chat =>
              chat.id === currentChatId
                ? {
                    ...chat,
                    messages: [...chat.messages, firstQuestionMessage],
                  }
                : chat
            ));

            await axios.post('http://localhost:4000/chat/message', {
              chat_id: currentChatId,
              sender: 'ai',
              text: firstQuestionMessage.content,
            }, { withCredentials: true });
          }
        }
      } catch (error) {
        console.error('Error fetching QA data:', error);
      } finally {
        if (isMounted) {
          setIsGeneratingQuestions(false);
        }
      }
    };

    if (currentChat?.graph_id) {
      fetchGraphData(currentChat.graph_id);
      fetchQA();
    } else {
      setGraphData(null);
      setQaData([]);
      setIsAnswering(false);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      setIsGeneratingQuestions(false);
    };
  }, [currentChatId]);

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
          onClick={handleNewChat}
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
                onClick={() => handleChatSelect(chat.id)}
                className={`p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200 transition-colors duration-150 ${
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
              <h1 className="text-xl font-semibold text-gray-800">{currentChat.title}</h1>
              <button
                onClick={() => navigate('/')}
                className="p-2 bg-transparent text-teal-600 border border-teal-500 rounded-lg hover:bg-teal-50 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                Return to Homepage
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {currentChat.messages.map((message) => (
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
                      <p className="text-sm">{message.content}</p>
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