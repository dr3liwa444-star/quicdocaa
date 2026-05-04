
export interface NoteEntry {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  fileName: string;
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: string;
  error?: string;
}
