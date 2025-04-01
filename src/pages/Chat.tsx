import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Send, Bot, User, MessageSquare, ChevronLeft, ChevronRight, Plus, Paperclip, X, FileText, Image, File } from 'lucide-react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { useNavigate } from 'react-router-dom';

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
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChatId, setCurrentChatId] = useState('3');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([
    {
      id: '1',
      title: 'Project Planning',
      lastMessage: 'Let\'s break down the tasks into sprints...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      messages: [
        {
          id: '1-1',
          content: 'Hi, I need help planning my project timeline.',
          sender: 'user',
          timestamp: new Date(Date.now() - 1000 * 60 * 65),
        },
        {
          id: '1-2',
          content: 'I\'d be happy to help with project planning! What kind of project are we looking at?',
          sender: 'ai',
          timestamp: new Date(Date.now() - 1000 * 60 * 64),
        },
        {
          id: '1-3',
          content: 'It\'s a web application that needs to be completed in 3 months.',
          sender: 'user',
          timestamp: new Date(Date.now() - 1000 * 60 * 63),
        },
        {
          id: '1-4',
          content: 'Let\'s break down the tasks into sprints...',
          sender: 'ai',
          timestamp: new Date(Date.now() - 1000 * 60 * 60),
        },
      ],
    },
    {
      id: '2',
      title: 'Code Review',
      lastMessage: 'The new feature implementation looks solid...',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      messages: [
        {
          id: '2-1',
          content: 'Could you review my latest pull request?',
          sender: 'user',
          timestamp: new Date(Date.now() - 1000 * 60 * 35),
        },
        {
          id: '2-2',
          content: 'Of course! I\'ll take a look at your code. Which features did you implement?',
          sender: 'ai',
          timestamp: new Date(Date.now() - 1000 * 60 * 34),
        },
        {
          id: '2-3',
          content: 'I added user authentication and profile management.',
          sender: 'user',
          timestamp: new Date(Date.now() - 1000 * 60 * 32),
        },
        {
          id: '2-4',
          content: 'The new feature implementation looks solid...',
          sender: 'ai',
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
        },
      ],
    },
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

  const generateAIResponse = async (userMessage: string, fileType?: string) => {
    setIsTyping(true);
    
    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 1000));

    let aiResponse = '';
    let newTitle = currentChat.title;

    // Handle file uploads
    if (fileType) {
      if (fileType.startsWith('image/')) {
        aiResponse = 'I see you\'ve shared an image. What would you like me to help you with regarding this image?';
        newTitle = 'Image Analysis';
      } else if (fileType.includes('document') || fileType.includes('pdf')) {
        aiResponse = 'I\'ve received your document. What aspects would you like me to review or analyze?';
        newTitle = 'Document Review';
      } else {
        aiResponse = 'I\'ve received your file. How can I help you with it?';
        newTitle = 'File Analysis';
      }
    } else {
      // Simple response logic based on user input
      const lowerMessage = userMessage.toLowerCase();
      if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        aiResponse = 'Hello! It\'s great to meet you. How can I assist you today?';
        newTitle = 'Greeting & Introduction';
      } else if (lowerMessage.includes('help')) {
        aiResponse = 'I\'d be happy to help! Could you please provide more details about what you need assistance with?';
        newTitle = 'Help Request';
      } else if (lowerMessage.includes('thank')) {
        aiResponse = 'You\'re welcome! Is there anything else you\'d like to know?';
      } else if (lowerMessage.includes('bye')) {
        aiResponse = 'Goodbye! Feel free to return if you have more questions!';
      } else {
        aiResponse = 'That\'s an interesting point! Could you tell me more about what you\'re thinking?';
        if (currentChat.title === 'New Chat') {
          newTitle = `Discussion: ${userMessage.slice(0, 20)}${userMessage.length > 20 ? '...' : ''}`;
        }
      }
    }

    setIsTyping(false);

    const aiMessage = {
      id: Date.now().toString(),
      content: aiResponse,
      sender: 'ai' as const,
      timestamp: new Date(),
    };

    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId
        ? {
            ...chat,
            title: newTitle,
            lastMessage: aiResponse,
            timestamp: new Date(),
            messages: [...chat.messages, aiMessage],
          }
        : chat
    ));

    return aiMessage;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    const fileUrl = URL.createObjectURL(selectedFile);
    const fileMessage: Message = {
      id: Date.now().toString(),
      content: `Uploaded file: ${selectedFile.name}`,
      sender: 'user',
      timestamp: new Date(),
      file: {
        name: selectedFile.name,
        type: selectedFile.type,
        url: fileUrl,
      },
    };

    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId
        ? {
            ...chat,
            lastMessage: fileMessage.content,
            timestamp: new Date(),
            messages: [...chat.messages, fileMessage],
          }
        : chat
    ));

    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    await generateAIResponse('', selectedFile.type);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFile) {
      await handleFileUpload();
      return;
    }

    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: 'user',
      timestamp: new Date(),
    };

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
    setInput('');

    await generateAIResponse(input);
  };

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      lastMessage: 'Hello! How can I help you today?',
      timestamp: new Date(),
      messages: [
        {
          id: 'welcome',
          content: 'Hello! How can I help you today? Feel free to ask me anything!',
          sender: 'ai',
          timestamp: new Date(),
        },
      ],
    };
    
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    } else if (type.includes('document') || type.includes('pdf')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const ResizeHandle = ({ className = '' }) => (
    <PanelResizeHandle className={`w-2 hover:bg-purple-500/20 transition-colors duration-150 ${className}`}>
      <div className="h-full w-[2px] bg-gray-700 mx-auto" />
    </PanelResizeHandle>
  );

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Chat History Sidebar */}
      <div
        className={`${
          isSidebarCollapsed ? 'w-12' : 'w-64'
        } bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          {!isSidebarCollapsed && (
            <h2 className="text-lg font-semibold text-white">Chat History</h2>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors duration-150"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
        
        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className={`m-4 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center justify-center gap-2 ${
            isSidebarCollapsed ? 'p-2' : ''
          }`}
        >
          <Plus className="w-5 h-5" />
          {!isSidebarCollapsed && <span>New Chat</span>}
        </button>

        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleChatSelect(chat.id)}
                className={`p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 transition-colors duration-150 ${
                  currentChatId === chat.id ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {chat.title}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
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
          <div className="h-full p-6 bg-gray-800">
            <div className="h-full rounded-lg bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
              <p className="text-gray-400 text-lg">Graph Visualization Coming Soon</p>
            </div>
          </div>
        </Panel>

        <ResizeHandle />

        {/* Chat Section */}
        <Panel minSize={30}>
          <div className="h-full flex flex-col">
            {/* Chat Header */}
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
  <h1 className="text-xl font-semibold text-white">{currentChat.title}</h1>
  <button
    onClick={() => navigate('/')}
    className="p-2 bg-transparent text-purple-400 border border-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition-colors duration-200 flex items-center justify-center gap-2"
  >
    Return to Homepage
  </button>
</div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
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
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-100'
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
                        <div className="mt-2 p-2 bg-gray-700 rounded-lg">
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
                  <div className="bg-gray-800 text-gray-100 p-3 rounded-lg">
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
            <form onSubmit={handleSubmit} className="p-4 bg-gray-800 border-t border-gray-700">
              {selectedFile && (
                <div className="mb-2 p-2 bg-gray-700 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getFileIcon(selectedFile.type)}
                    <span className="text-sm text-gray-300 truncate">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-gray-300"
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
                  className="flex-1 px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
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
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center transition-colors duration-200"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center transition-colors duration-200"
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