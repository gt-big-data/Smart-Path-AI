export interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  /** Marks failed and successful actions so their bubble gets a colored glow */
  tone?: 'error' | 'success';
  file?: {
    name: string;
    type: string;
    url: string;
  };
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
  folder_id?: string | null;
  graph_id?: string;
  source_file_count?: number;
  source_files?: string[];
}

export interface Folder {
  folder_id: string;
  name: string;
  date_created: string;
  parent_folder_id?: string | null;
}

export interface ConceptProgress {
  conceptId: string;
  confidenceScore: number;
  lastAttempted?: Date;
}

export interface SavedQuiz {
  completed: boolean;
  results: boolean[];
  qaData: any[];
}
