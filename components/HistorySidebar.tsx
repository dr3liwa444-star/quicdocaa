
import React from 'react';
import { NoteEntry } from '../types';

interface HistorySidebarProps {
  history: NoteEntry[];
  onSelect: (note: NoteEntry) => void;
  onDelete: (id: string) => void;
  currentId?: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  history, 
  onSelect, 
  onDelete, 
  currentId,
  isOpen,
  setIsOpen 
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Recent Lectures</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-600"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {history.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-slate-400 italic">No history yet</p>
            </div>
          ) : (
            history.map((note) => (
              <div 
                key={note.id}
                onClick={() => {
                  onSelect(note);
                  setIsOpen(false);
                }}
                className={`
                  group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all
                  ${currentId === note.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}
                `}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{note.title}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">
                    {new Date(note.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
               <img src="https://picsum.photos/100/100" alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              <p className="font-bold text-slate-700 uppercase">Pro User</p>
              <p>Unlimited Processing</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default HistorySidebar;
