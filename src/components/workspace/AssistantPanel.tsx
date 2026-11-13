import { ChangeEvent, FormEvent, ReactNode, RefObject } from 'react';
import Icon from '../common/Icon';
import { Message } from '../../types/chat';
import { panelLabel, panelSection } from './workspaceClasses';

interface AssistantPanelProps {
  messages: Message[];
  input: string;
  isTyping: boolean;
  isProcessingFile: boolean;
  uploadProgress: number;
  progressMessage: string;
  selectedFile: File | null;
  focusedConcept: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  resumeQuiz?: { answered: number; total: number } | null;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onAttach: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onClearFocus: () => void;
  onResumeQuiz: () => void;
  fileIcon: (type: string) => ReactNode;
  onSendMessageText?: (text: string) => void;
}

const messageRow = 'flex max-w-[88%] gap-[9px] text-[13px] leading-[1.6]';
const bubbleBot = 'rounded-[4px_12px_12px_12px] bg-[#f3f1f8] px-[13px] py-[11px] text-[#4d4755]';
const bubbleUser = 'rounded-[12px_4px_12px_12px] bg-teal px-[13px] py-2.5 text-white';
const avatar = 'grid h-[27px] w-[27px] flex-none place-items-center rounded-lg bg-teal text-white';
const timeBase = 'block mt-1.5 text-[10px] leading-none';
const suggestion =
  'rounded-[3px] border border-[#c9d6d4] bg-white px-2 py-[5px] text-[11px] font-semibold text-[#245f59] hover:border-teal hover:bg-[#eef5f4]';
const iconButton = 'grid place-items-center border-0 bg-transparent p-0 text-[#7d8b88]';
const toneClasses = { error: 'chat-bubble-error', success: 'chat-bubble-success' } as const;

function formatTime(timestamp: Date) {
  return timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function AssistantPanel({
  messages,
  input,
  isTyping,
  isProcessingFile,
  uploadProgress,
  progressMessage,
  selectedFile,
  focusedConcept,
  fileInputRef,
  messagesEndRef,
  resumeQuiz,
  onInputChange,
  onSubmit,
  onAttach,
  onFileSelect,
  onRemoveFile,
  onClearFocus,
  onResumeQuiz,
  fileIcon,
  onSendMessageText,
}: AssistantPanelProps) {
  const lastBotId = [...messages].reverse().find((message) => message.sender === 'ai')?.id;

  const handleSuggestionClick = (text: string) => {
    if (onSendMessageText) {
      onSendMessageText(text);
    } else {
      onInputChange(text);
    }
  };

  return (
    <section className={`chat-panel dock-panel-content ${panelSection}`}>
      <div className={panelLabel}>
        <span>Conversation</span>
        {/* Conversation options menu: not wired up yet, kept for future use
        <button type="button" aria-label="Conversation options" title="More options">
          <Icon name="more" size={16} />
        </button>
        */}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#f8faf9] px-[23px] py-[18px] transition-opacity ${
          isProcessingFile ? 'opacity-[0.72]' : ''
        }`}
      >
        {focusedConcept && (
          <div className="flex items-center gap-1.5 self-center rounded-full border border-[#d5e4e1] bg-[#eef5f4] px-2.5 py-1.5 text-[11px] text-[#5d6e6a]">
            <Icon name="graph" size={14} />
            <span>
              Focused on: <strong className="font-bold text-[#173e3a]">{focusedConcept}</strong>
            </span>
            <button
              type="button"
              className={iconButton}
              aria-label="Clear focused concept"
              onClick={onClearFocus}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.sender === 'user';
          return (
            <div className={`${messageRow} ${isUser ? 'self-end' : ''}`} key={message.id}>
              {!isUser && (
                <span className={avatar} aria-hidden="true">
                  <Icon name="sparkles" size={15} />
                </span>
              )}
              <div className={`${isUser ? bubbleUser : bubbleBot} ${message.tone ? toneClasses[message.tone] : ''}`}>
                <p className="m-0 whitespace-pre-wrap">{message.content}</p>
                {message.file && (
                  <a
                    className="mt-2 flex items-center gap-1.5 text-xs underline [color:inherit]"
                    href={message.file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {fileIcon(message.file.type)}
                    <span>{message.file.name}</span>
                  </a>
                )}
                <time className={`${timeBase} ${isUser ? 'text-right text-white/75' : 'text-[#8b9694]'}`}>
                  {formatTime(message.timestamp)}
                </time>
                {!isUser && message.tone !== 'error' && message.id === lastBotId && !isTyping && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className={suggestion}
                      onClick={() => handleSuggestionClick('Go into more detail')}
                    >
                      Go into more detail
                    </button>
                    <button
                      type="button"
                      className={suggestion}
                      onClick={() => handleSuggestionClick('Explain more simply')}
                    >
                      Explain more simply
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className={messageRow}>
            <span className={avatar} aria-hidden="true">
              <Icon name="sparkles" size={15} />
            </span>
            <div
              className={`${bubbleBot} flex min-h-[18px] items-center gap-1`}
              aria-label="Assistant is typing"
            >
              <i className="h-1.5 w-1.5 rounded-full bg-[#8b9694] animate-typing-bounce" />
              <i className="h-1.5 w-1.5 rounded-full bg-[#8b9694] animate-typing-bounce [animation-delay:0.15s]" />
              <i className="h-1.5 w-1.5 rounded-full bg-[#8b9694] animate-typing-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {resumeQuiz && (
        <div className="mx-[18px] flex min-h-[64px] flex-none items-center gap-2.5 rounded-t-[26px] border border-b-0 border-[#cbdad7] bg-[#eef5f4] px-3 py-2">
          <div className="mr-auto flex items-center gap-2">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[2px] bg-teal text-white">
              <Icon name="book" size={15} />
            </span>
            <div className="flex flex-col">
              <strong className="text-xs font-bold text-[#173e3a]">Quiz in progress</strong>
              <small className="text-[10px] text-[#71807d]">
                {resumeQuiz.answered} of {resumeQuiz.total} answered
              </small>
            </div>
          </div>
          <button
            type="button"
            className="h-[34px] rounded-[2px] border border-teal bg-teal px-[9px] text-[11px] font-semibold text-white"
            onClick={onResumeQuiz}
          >
            Resume quiz
          </button>
        </div>
      )}

      <form className="mx-[18px] mb-[17px] rounded-[3px] border border-[#d5dfdd] bg-white px-2.5 pb-2 pt-[9px]" onSubmit={onSubmit}>
        {isProcessingFile && (
          <div className="mb-2 mt-1 flex flex-col gap-1.5 text-xs text-[#245f59]">
            <div className="flex items-center justify-between gap-2">
              <span>{progressMessage || 'Processing PDF...'}</span>
              <strong className="font-bold">{uploadProgress}%</strong>
            </div>
            <i className="block h-1 overflow-hidden bg-[#dce5e3] not-italic">
              <span className="block h-full bg-teal" style={{ width: `${uploadProgress}%` }} />
            </i>
          </div>
        )}
        {selectedFile && !isProcessingFile && (
          <div className="mb-2 mt-1 flex items-center justify-between gap-2 border border-[#d5dfdd] bg-[#f7f9f8] px-2 py-1.5 text-xs text-[#245f59]">
            {fileIcon(selectedFile.type)}
            <span className="ml-[7px] text-[10px] text-[#8b9694]">{selectedFile.name}</span>
            <button
              type="button"
              className="border-0 bg-transparent text-[#71807d]"
              aria-label="Remove file"
              onClick={onRemoveFile}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
        <textarea
          className="block w-full resize-none border-0 bg-transparent px-[3px] py-0.5 text-[13px] text-[#263330] outline-none placeholder:text-[#9aa8a5]"
          aria-label="Message"
          rows={2}
          value={input}
          placeholder="Ask anything about your materials..."
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="mt-1 flex items-center">
          <button
            type="button"
            className="grid place-items-center rounded-[4px] border-0 bg-transparent p-1 text-[#71807d] transition-colors hover:bg-[#dde8e5] hover:text-teal disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#71807d]"
            aria-label="Attach file"
            disabled={isProcessingFile}
            onClick={onAttach}
          >
            <Icon name="paperclip" size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt"
            onChange={onFileSelect}
          />
          <span className="ml-[7px] text-[10px] text-[#8b9694]">SmartPath can make mistakes. Check important info.</span>
          <button
            type="submit"
            className="ml-auto grid h-[29px] w-[29px] place-items-center rounded-[3px] border-0 bg-teal text-white disabled:opacity-45"
            aria-label="Send message"
            disabled={isTyping || (!input.trim() && !selectedFile)}
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}
