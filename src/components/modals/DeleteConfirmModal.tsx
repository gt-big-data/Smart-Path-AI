import Icon from '../common/Icon';
import { modalCardClass, modalTextClass, modalTitleClass } from './modalClasses';

interface DeleteConfirmModalProps {
  type: 'chat' | 'folder';
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({
  type,
  name,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
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
        aria-labelledby="delete-confirmation-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="x" size={18} />
        </button>
        <span className="modal-icon modal-icon-danger">
          <Icon name="trash" size={19} />
        </span>
        <h2 id="delete-confirmation-title" className={modalTitleClass}>
          Delete {type === 'chat' ? 'chat' : 'folder'}?
        </h2>
        <p className={modalTextClass}>
          This action cannot be undone.{' '}
          {type === 'folder'
            ? 'Chats inside will be moved to your library.'
            : `"${name}" and its conversation will be deleted permanently.`}
        </p>
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
            className="modal-button modal-button-danger"
            onClick={onConfirm}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
