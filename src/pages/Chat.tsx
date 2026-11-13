import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildAskAssistantPrompt } from '../lib/quizQuestions';
import { getFolderPath } from '../lib/folderPath';
import { getSourceFileNames, getSourceFileUrl } from '../lib/sourceFiles';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/common/Icon';
import Sidebar from '../components/sidebar/Sidebar';
import WorkspaceHeader from '../components/workspace/WorkspaceHeader';
import WorkspaceDock, { type DockTab } from '../components/workspace/WorkspaceDock';
import GraphPanel from '../components/workspace/GraphPanel';
import AssistantPanel from '../components/workspace/AssistantPanel';
import DeleteConfirmModal from '../components/modals/DeleteConfirmModal';
import QuizModal from '../components/modals/QuizModal';
import Quiz from './Quiz';
import MoveChatModal from '../components/modals/MoveChatModal';
import PracticeExamPanel from '../components/PracticeExamPanel';
import PracticeExamSetupModal from '../components/modals/PracticeExamSetupModal';
import ProgressPage from './ProgressPage';
import { useErrorToast } from '../hooks/useErrorToast';
import { useHighlightedItem } from '../hooks/useHighlightedItem';
import { useSidebarResize } from '../hooks/useSidebarResize';
import { useChatList } from '../hooks/useChatList';
import { useChatGraph } from '../hooks/useChatGraph';
import { useChatFolders } from '../hooks/useChatFolders';
import { useSidebarDragDrop } from '../hooks/useSidebarDragDrop';
import { usePdfUpload } from '../hooks/usePdfUpload';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatQuiz } from '../hooks/useChatQuiz';
import '../components/workspace/workspace.css';

interface ChatPageProps {
  /** 'progress' shows the progress page in the workspace area, with the same sidebar */
  view?: 'workspace' | 'progress';
}

// Practice exam taking over the chat area
interface ExamTab {
  id: string;
  chatId: string;
  examId: string;
}

export default function ChatPage({ view = 'workspace' }: ChatPageProps) {
  const { userName, logout } = useAuth();
  const navigate = useNavigate();

  // Layout and exam state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [examTab, setExamTab] = useState<ExamTab | null>(null);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const { sidebarWidth, isResizingSidebar, handleStartSidebarResize } = useSidebarResize();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Feedback
  const { errorToast, showErrorToast, dismissErrorToast } = useErrorToast();
  const { shiningId, flashNewItem } = useHighlightedItem();

  // Chats, folders, graph, and conversation
  const chatList = useChatList({ showErrorToast, flashNewItem });
  const { chats, setChats, currentChatId, setCurrentChatId, currentChat, chatsLoading } = chatList;
  const graph = useChatGraph({ currentChatId, currentChat, setChats });
  const folderState = useChatFolders({ setChats, showErrorToast, flashNewItem });
  const { folders } = folderState;
  const dragDrop = useSidebarDragDrop({
    chats,
    moveChatToFolder: folderState.moveChatToFolder,
    moveFolderToFolder: folderState.moveFolderToFolder,
    createFolderRecord: folderState.createFolderRecord,
    onFolderCreated: folderState.revealFolder,
    showErrorToast,
  });
  const upload = usePdfUpload({
    currentChatId,
    setChats,
    showErrorToast,
    appendErrorMessage: chatList.appendErrorMessage,
    showGraph: graph.showGraph,
    fetchGraphData: graph.fetchGraphData,
    clearGraphData: graph.clearGraphData,
  });
  const messages = useChatMessages({
    currentChat,
    currentChatId,
    setChats,
    focusedConcept: graph.focusedConcept,
    appendErrorMessage: chatList.appendErrorMessage,
  });
  const quiz = useChatQuiz({ currentChatId, currentChat });

  const currentFolderPath = getFolderPath(folders, currentChat?.folder_id);
  const moveModalChat = folderState.moveModalChatId
    ? chats.find((c) => c.id === folderState.moveModalChatId)
    : undefined;

  // The exam replaces the workspace (header and dock) while it is open, and is only shown for its own chat
  const activeExam = examTab && examTab.chatId === currentChatId && currentChat ? examTab : null;

  // Side tabs in the workspace dock. Each is shown only while its chat is open.
  const dockTabs: DockTab[] = [];
  if (quiz.activeQuiz) {
    const activeQuiz = quiz.activeQuiz;
    dockTabs.push({
      id: 'tab-quiz',
      name: 'Quiz',
      sessionKey: activeQuiz.id,
      onRequestClose: () => quiz.setQuizSession(null),
      content: (
        <Quiz
          key={activeQuiz.id}
          session={activeQuiz}
          onClose={() => quiz.setQuizSession(null)}
          onAskAssistant={(question) => void messages.handleSendMessage(buildAskAssistantPrompt(question))}
        />
      ),
    });
  }

  const handleSelectChat = (cId: string) => {
    // Picking a chat from the progress page returns to the workspace
    if (view === 'progress') navigate('/chat');
    // Re-selecting the open chat keeps its graph and open tabs
    if (cId === currentChatId) return;
    graph.clearGraphData();
    quiz.setQuizSession(null);
    setExamTab(null);
    setIsExamModalOpen(false);
    setCurrentChatId(cId);
  };

  const handleStartCreateFolder = () => {
    setIsSidebarCollapsed(false);
    folderState.beginCreateFolder();
  };

  if (chatsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfaf8]">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal" />
          <p className="text-slate-500 text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="smartpath-workspace flex h-screen overflow-hidden bg-[#edf1f0] font-['Helvetica_Neue',Arial,sans-serif]">
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-200 flex max-w-sm items-start gap-3 rounded border border-red-400/40 bg-[#1c1b2d] px-4 py-3 text-sm text-red-100 shadow-xl"
        >
          <span className="flex-1">{errorToast}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={dismissErrorToast}
            className="shrink-0 p-0.5 text-red-200 hover:text-white"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Modals */}
      {(folderState.folderToDelete || chatList.chatToDelete) && (
        <DeleteConfirmModal
          type={chatList.chatToDelete ? 'chat' : 'folder'}
          name={chatList.chatToDelete ? chatList.chatToDelete.title : folderState.folderToDelete?.name || ''}
          onClose={() => {
            chatList.cancelDeleteChat();
            folderState.cancelDeleteFolder();
          }}
          onConfirm={() => {
            if (chatList.chatToDelete) void chatList.confirmDeleteChat();
            else void folderState.confirmDeleteFolder();
          }}
        />
      )}

      {isExamModalOpen && currentChat && (
        <PracticeExamSetupModal
          chatId={currentChatId}
          onClose={() => setIsExamModalOpen(false)}
          onOpenExam={(examId) => {
            setIsExamModalOpen(false);
            setExamTab({ id: String(Date.now()), chatId: currentChatId, examId });
          }}
        />
      )}

      {quiz.isQuizModalOpen && (
        <QuizModal
          quizLength={quiz.quizLength}
          questionFormat={quiz.questionFormat}
          conceptCount={graph.graphData?.graph?.nodes?.length}
          onLengthChange={quiz.setQuizLength}
          onFormatChange={quiz.setQuestionFormat}
          onClose={() => quiz.setIsQuizModalOpen(false)}
          onGenerate={() => {
            quiz.setIsQuizModalOpen(false);
            quiz.handleStartQuiz();
          }}
        />
      )}

      {moveModalChat && (
        <MoveChatModal
          folders={folders}
          currentFolderId={moveModalChat.folder_id}
          onClose={() => folderState.setMoveModalChatId(null)}
          onMove={(destFolderId, newName) => folderState.moveChatFromModal(destFolderId, newName)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        isResizing={isResizingSidebar}
        userName={userName}
        folders={folders}
        chats={chats}
        currentChatId={currentChatId}
        searchQuery={searchQuery}
        searchInputRef={searchInputRef}
        expandedFolders={folderState.expandedFolders}
        isCreatingFolder={folderState.isCreatingFolder}
        newFolderName={folderState.newFolderName}
        newFolderParentId={folderState.newFolderParentId}
        renamingFolderId={folderState.renamingFolderId}
        folderRenameValue={folderState.folderRenameValue}
        renamingChatId={chatList.renamingChatId}
        chatRenameValue={chatList.renameValue}
        dragOverFolderId={dragDrop.dragOverFolderId}
        draggedChatId={dragDrop.draggedChatId}
        draggedFolderId={dragDrop.draggedFolderId}
        inlineFolderAction={folderState.inlineFolderAction}
        inlineFolderValue={folderState.inlineFolderValue}
        inlineFolderDestination={folderState.inlineFolderDestination}
        shiningId={shiningId}
        onToggleCollapse={() => setIsSidebarCollapsed(true)}
        onOpenSidebar={() => setIsSidebarCollapsed(false)}
        onSearchChange={setSearchQuery}
        onClearSearch={() => setSearchQuery('')}
        onNewChat={() => void chatList.createChat()}
        onStartCreateFolder={handleStartCreateFolder}
        onNewFolderNameChange={folderState.setNewFolderName}
        onCreateFolderSubmit={folderState.submitCreateFolder}
        onCancelCreateFolder={folderState.cancelCreateFolder}
        onToggleExpandFolder={folderState.toggleFolderExpanded}
        onBeginRenameFolder={folderState.beginRenameFolder}
        onRenameFolderChange={folderState.setFolderRenameValue}
        onRenameFolderSave={folderState.saveFolderRename}
        onRenameFolderCancel={folderState.cancelRenameFolder}
        onRequestDeleteFolder={(folder, e) => {
          e.stopPropagation();
          folderState.requestDeleteFolder(folder);
        }}
        onOpenInlineSubfolder={folderState.openSubfolderAction}
        onCloseInlineAction={folderState.closeInlineAction}
        onInlineValueChange={folderState.setInlineFolderValue}
        onInlineDestinationChange={folderState.setInlineFolderDestination}
        onConfirmInlineAction={folderState.confirmInlineAction}
        onFolderDragStart={dragDrop.handleFolderDragStart}
        onFolderDragEnd={dragDrop.clearDrag}
        onFolderDragOver={dragDrop.handleFolderDragOver}
        onFolderDragLeave={dragDrop.clearDragOver}
        onFolderDrop={dragDrop.handleFolderDrop}
        onSelectChat={handleSelectChat}
        onBeginRenameChat={chatList.beginRenameChat}
        onRenameChatChange={chatList.setRenameValue}
        onRenameChatSave={chatList.handleRenameChat}
        onRenameChatCancel={chatList.cancelRenameChat}
        onRequestDeleteChat={(chat, e) => {
          e.stopPropagation();
          chatList.requestDeleteChat(chat);
        }}
        onToggleMoveFolder={folderState.toggleChatMoveAction}
        onChatDragStart={dragDrop.handleChatDragStart}
        onChatDragEnd={dragDrop.clearDrag}
        onChatDragOver={dragDrop.handleChatDragOver}
        onChatDragLeave={dragDrop.clearDragOver}
        onChatDrop={dragDrop.handleChatDropOnChat}
        onRootDropOver={dragDrop.handleRootDragOver}
        onRootDropLeave={dragDrop.clearDragOver}
        onRootDrop={dragDrop.handleRootDrop}
        onStartSidebarResize={handleStartSidebarResize}
        onHome={() => navigate('/')}
        onProgress={() => navigate('/progress')}
        isProgressActive={view === 'progress'}
        onSettings={() => navigate('/profile')}
        onLogout={() => void logout()}
      />

      {/* Workspace Area */}
      <div
        className={`group flex min-w-0 flex-1 flex-col bg-[#edf1f0]${isSidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}
      >
        {view === 'progress' ? (
          <ProgressPage />
        ) : activeExam && currentChat ? (
          <PracticeExamPanel
            key={activeExam.id}
            chatId={activeExam.chatId}
            examId={activeExam.examId}
            title={currentChat.title}
            onClose={() => setExamTab(null)}
          />
        ) : (
          <>
            <WorkspaceHeader
              title={currentChat?.title || 'Untitled chat'}
              breadcrumb={`Workspace${currentFolderPath.length ? ` / ${currentFolderPath.join(' / ')}` : ''}`}
              hasGraph={Boolean(currentChat?.graph_id)}
              onProgress={() =>
                currentChat?.graph_id
                  ? navigate('/progress')
                  : showErrorToast('Please upload a document to view progress.')
              }
              onRenameTitle={
                currentChat ? (title) => void chatList.saveChatTitle(currentChat.id, title) : undefined
              }
              onQuiz={() => quiz.setIsQuizModalOpen(true)}
              onExam={() => setIsExamModalOpen(true)}
              onUnavailable={() => showErrorToast('Please upload a document before starting this action.')}
            />

            <WorkspaceDock modelKey={currentChatId} tabs={dockTabs}>
              {/* Panel 0: Knowledge Graph */}
              <GraphPanel
                graphData={graph.graphData}
                conceptProgress={graph.conceptProgress}
                isGraphLoading={graph.isGraphLoading || graph.isChatSwitching}
                isProcessingFile={upload.isProcessingFile}
                uploadProgress={upload.uploadProgress}
                progressMessage={upload.progressMessage}
                focusedConcept={graph.focusedConcept}
                focusClearToken={graph.focusClearToken}
                sourceFiles={getSourceFileNames(currentChat)}
                sourceFileUrl={getSourceFileUrl(currentChat)}
                onFocusChange={graph.setFocusedConcept}
                onClearFocus={graph.clearFocus}
                onChooseFile={upload.openFilePicker}
                onCancelUpload={upload.handleCancelUpload}
              />

              {/* Panel 1: Study Assistant */}
              <AssistantPanel
                messages={currentChat?.messages || []}
                input={messages.input}
                isTyping={messages.isTyping}
                isProcessingFile={upload.isProcessingFile}
                uploadProgress={upload.uploadProgress}
                progressMessage={upload.progressMessage}
                selectedFile={upload.selectedFile}
                focusedConcept={graph.focusedConcept}
                fileInputRef={upload.fileInputRef}
                messagesEndRef={messages.messagesEndRef}
                resumeQuiz={
                  quiz.savedQuiz && !quiz.savedQuiz.completed && currentChat?.graph_id
                    ? {
                        answered: quiz.savedQuiz.results.filter(Boolean).length,
                        total: quiz.savedQuiz.qaData.length,
                      }
                    : null
                }
                onInputChange={messages.setInput}
                onSubmit={(e) => {
                  e.preventDefault();
                  void messages.handleSendMessage();
                }}
                onSendMessageText={(text) => void messages.handleSendMessage(text)}
                onAttach={upload.openFilePicker}
                onFileSelect={upload.handleFileSelect}
                onRemoveFile={upload.removeSelectedFile}
                onClearFocus={graph.clearFocus}
                onResumeQuiz={quiz.handleResumeQuiz}
                fileIcon={() => <Icon name="file" size={16} />}
              />
            </WorkspaceDock>
          </>
        )}
      </div>
    </div>
  );
}
