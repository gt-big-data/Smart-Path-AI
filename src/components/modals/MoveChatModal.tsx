import { useState } from 'react';
import Icon from '../common/Icon';
import { Folder } from '../../types/chat';
import { modalCardClass, modalFieldClass, modalSelectClass, modalTextClass, modalTitleClass } from './modalClasses';

interface MoveChatModalProps {
  folders: Folder[];
  currentFolderId?: string | null;
  onClose: () => void;
  onMove: (destinationFolderId: string | null, newFolderName?: string) => void;
}

export default function MoveChatModal({
  folders,
  currentFolderId,
  onClose,
  onMove,
}: MoveChatModalProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>(currentFolderId || 'root');
  const [newFolderName, setNewFolderName] = useState('');

  const handleConfirm = () => {
    if (selectedFolder === 'new') {
      if (!newFolderName.trim()) return;
      onMove(null, newFolderName.trim());
    } else if (selectedFolder === 'root') {
      onMove(null);
    } else {
      onMove(selectedFolder);
    }
  };

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
        aria-labelledby="move-chat-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
        <span className="modal-icon bg-teal-hover text-teal">
          <Icon name="folder" size={19} />
        </span>
        <h2 id="move-chat-title" className={modalTitleClass}>Move to folder</h2>
        <p className={modalTextClass}>Choose a destination for this chat, or create a new folder.</p>

        <label className={modalFieldClass}>
          Destination
          <select
            className={modalSelectClass}
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
          >
            <option value="root">Unorganized (Library root)</option>
            {folders.map((folder) => (
              <option key={folder.folder_id} value={folder.folder_id}>
                {folder.name}
              </option>
            ))}
            <option value="new">+ Create new folder</option>
          </select>
        </label>

        {selectedFolder === 'new' && (
          <label className="mt-2.5 grid gap-1.5 text-[11px] font-semibold text-[#687875]">
            New folder name
            <input
              autoFocus
              type="text"
              placeholder="e.g. Exam prep"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </label>
        )}

        <div className="modal-actions">
          <button type="button" className="modal-button modal-button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-button modal-button-primary"
            disabled={selectedFolder === 'new' && !newFolderName.trim()}
            onClick={handleConfirm}
          >
            Move chat
          </button>
        </div>
      </div>
    </div>
  );
}
