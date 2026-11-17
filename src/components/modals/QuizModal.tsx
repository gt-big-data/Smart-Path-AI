import Icon from '../common/Icon';
import { modalCardClass, modalFieldClass, modalSelectClass, modalTextClass, modalTitleClass } from './modalClasses';

interface QuizModalProps {
  quizLength: 5 | 10 | 15;
  questionFormat: 'mixed' | 'mcq' | 'true-false' | 'open-ended';
  conceptCount?: number;
  onLengthChange: (length: 5 | 10 | 15) => void;
  onFormatChange: (format: 'mixed' | 'mcq' | 'true-false' | 'open-ended') => void;
  onClose: () => void;
  onGenerate: () => void;
}

export default function QuizModal({
  quizLength,
  questionFormat,
  conceptCount,
  onLengthChange,
  onFormatChange,
  onClose,
  onGenerate,
}: QuizModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={modalCardClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close quiz settings"
          onClick={onClose}
        >
          <Icon name="x" size={18} />
        </button>
        <span className="modal-icon modal-icon-teal">
          <Icon name="sparkles" size={19} />
        </span>
        <span className="modal-kicker block">QUIZ SETUP</span>
        <h2 id="quiz-settings-title" className={modalTitleClass}>Generate a quiz</h2>
        <p className={modalTextClass}>Choose how you want to practice this material.</p>

        <label className={modalFieldClass}>
          Quiz length
          <select
            className={modalSelectClass}
            value={quizLength}
            onChange={(e) => onLengthChange(Number(e.target.value) as 5 | 10 | 15)}
          >
            <option value={5}>5 questions</option>
            <option value={10}>10 questions</option>
            <option value={15}>15 questions</option>
          </select>
        </label>

        <label className={modalFieldClass}>
          Question type
          <select
            className={modalSelectClass}
            value={questionFormat}
            onChange={(e) =>
              onFormatChange(e.target.value as 'mixed' | 'mcq' | 'true-false' | 'open-ended')
            }
          >
            <option value="mixed">Mixed (Random)</option>
            <option value="mcq">Multiple Choice</option>
            <option value="true-false">True/False</option>
            <option value="open-ended">Open-Ended</option>
          </select>
        </label>

        {conceptCount !== undefined && conceptCount > 0 && (
          <div className="mb-4 mt-2 flex items-center gap-2 text-[11px] text-[#667572]">
            <Icon name="graph" size={15} />
            <span>Questions will cover {conceptCount} concepts in this graph.</span>
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-button modal-button-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-button modal-button-primary"
            onClick={onGenerate}
          >
            Generate quiz
          </button>
        </div>
      </div>
    </div>
  );
}
