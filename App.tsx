
import React, { useState, useEffect, useRef } from 'react';
import { NoteEntry, ProcessingState } from './types';
import { processLectureFile, processLectureText, processLectureUrl, combineLectureSources, processBatchLectureFiles, FilePart } from './services/geminiService';
import HistorySidebar from './components/HistorySidebar';
import LoadingOverlay from './components/LoadingOverlay';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Declare html2pdf for TypeScript
declare var html2pdf: any;

type InputMode = 'media' | 'text' | 'youtube' | 'combine';

interface StagedFile {
  id: string;
  file: File;
  preview: string;
}

const App: React.FC = () => {
  const [history, setHistory] = useState<NoteEntry[]>([]);
  const [currentNote, setCurrentNote] = useState<NoteEntry | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('media');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [sessionTitle, setSessionTitle] = useState('');
  
  // Text state
  const [rawText, setRawText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  
  // Youtube state
  const [ytLink, setYtLink] = useState('');
  
  // Combine state
  const [combineSources, setCombineSources] = useState<string[]>(['', '']);
  const [combineTitle, setCombineTitle] = useState('');

  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    progress: '',
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lecture_notes_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    const handleGlobalPaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const newStaged: StagedFile[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const id = Math.random().toString(36).substr(2, 9);
            const preview = URL.createObjectURL(blob);
            newStaged.push({ id, file: blob, preview });
          }
        }
      }

      if (newStaged.length > 0) {
        setStagedFiles(prev => [...prev, ...newStaged]);
        setInputMode('media');
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  useEffect(() => {
    localStorage.setItem('lecture_notes_history', JSON.stringify(history));
  }, [history]);

  const handleProcessStaged = async () => {
    if (stagedFiles.length === 0) return;
    
    setProcessing({ isProcessing: true, progress: `Shrinking ${stagedFiles.length} files with zero data loss...` });
    
    try {
      const fileParts: FilePart[] = [];
      
      for (const staged of stagedFiles) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
        });
        reader.readAsDataURL(staged.file);
        const base64 = await base64Promise;
        
        fileParts.push({
          base64,
          mimeType: staged.file.type,
          fileName: staged.file.name
        });
      }

      const finalTitle = sessionTitle.trim() || `Session (${new Date().toLocaleTimeString()})`;
      const extractedContent = await processBatchLectureFiles(fileParts, finalTitle);

      const newNote: NoteEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: finalTitle,
        content: extractedContent,
        timestamp: Date.now(),
        fileName: `${stagedFiles.length} source files`,
      };

      setHistory(prev => [newNote, ...prev]);
      setCurrentNote(newNote);

      // Clear stage
      stagedFiles.forEach(s => URL.revokeObjectURL(s.preview));
      setStagedFiles([]);
      setSessionTitle('');
      setProcessing({ isProcessing: false, progress: '' });
    } catch (err: any) {
      setProcessing({ isProcessing: false, progress: '', error: err.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newStaged: StagedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = Math.random().toString(36).substr(2, 9);
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      newStaged.push({ id, file, preview });
    }
    setStagedFiles(prev => [...prev, ...newStaged]);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeStaged = (id: string) => {
    setStagedFiles(prev => {
      const item = prev.find(s => s.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter(s => s.id !== id);
    });
  };

  const handleTextShrink = async () => {
    if (!rawText.trim()) return;
    setProcessing({ isProcessing: true, progress: 'Shrinking text without data loss...' });
    try {
      const title = textTitle.trim() || 'Pasted Text Lecture';
      const extractedContent = await processLectureText(rawText, title);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        title: title,
        content: extractedContent,
        timestamp: Date.now(),
        fileName: 'Text Input',
      };
      setHistory(prev => [newNote, ...prev]);
      setCurrentNote(newNote);
      setRawText('');
      setTextTitle('');
      setProcessing({ isProcessing: false, progress: '' });
    } catch (err: any) {
      setProcessing({ isProcessing: false, progress: '', error: err.message });
    }
  };

  const handleYoutubeShrink = async () => {
    if (!ytLink.trim()) return;
    setProcessing({ isProcessing: true, progress: 'Mapping full video context...' });
    try {
      const extractedContent = await processLectureUrl(ytLink);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        title: 'YouTube Lecture',
        content: extractedContent,
        timestamp: Date.now(),
        fileName: ytLink,
      };
      setHistory(prev => [newNote, ...prev]);
      setCurrentNote(newNote);
      setYtLink('');
      setProcessing({ isProcessing: false, progress: '' });
    } catch (err: any) {
      setProcessing({ isProcessing: false, progress: '', error: err.message });
    }
  };

  const handleMergeShrink = async () => {
    const validSources = combineSources.filter(s => s.trim() !== '');
    if (validSources.length < 2) return;
    setProcessing({ isProcessing: true, progress: 'Merging sources exhaustively...' });
    try {
      const title = combineTitle.trim() || 'Comprehensive Combined Lecture';
      const extractedContent = await combineLectureSources(validSources, title);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        title: title,
        content: extractedContent,
        timestamp: Date.now(),
        fileName: `Merged (${validSources.length} sources)`,
      };
      setHistory(prev => [newNote, ...prev]);
      setCurrentNote(newNote);
      setCombineSources(['', '']);
      setCombineTitle('');
      setProcessing({ isProcessing: false, progress: '' });
    } catch (err: any) {
      setProcessing({ isProcessing: false, progress: '', error: err.message });
    }
  };

  const downloadPdf = () => {
    if (!contentRef.current || !currentNote) return;

    const element = document.createElement('div');
    element.className = 'pdf-export-container markdown-content mono';
    
    const title = document.createElement('h1');
    title.innerText = currentNote.title;
    title.style.fontSize = '18pt';
    title.style.marginBottom = '10mm';
    title.style.borderBottom = '1px solid #ccc';
    title.style.paddingBottom = '5mm';
    
    element.appendChild(title);
    
    const body = document.createElement('div');
    body.innerHTML = contentRef.current.innerHTML;
    element.appendChild(body);

    const opt = {
      margin: [5, 5, 5, 5], // Narrow margins: top, left, bottom, right (mm)
      filename: `${currentNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const updateCombineSource = (index: number, val: string) => {
    const next = [...combineSources];
    next[index] = val;
    setCombineSources(next);
  };

  const addCombineField = () => setCombineSources([...combineSources, '']);
  const removeCombineField = (index: number) => {
    if (combineSources.length <= 2) return;
    setCombineSources(combineSources.filter((_, i) => i !== index));
  };

  const copyToClipboard = async (text: string) => {
    if (!contentRef.current) {
      await navigator.clipboard.writeText(text);
      return;
    }

    try {
      const html = contentRef.current.innerHTML;
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      
      const data = [new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      })];
      
      await navigator.clipboard.write(data);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy rich text: ', err);
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const deleteNote = (id: string) => {
    setHistory(prev => prev.filter(n => n.id !== id));
    if (currentNote?.id === id) setCurrentNote(null);
  };

  const renderContent = (content: string) => {
    const html = marked.parse(content, { breaks: true, gfm: true }) as string;
    const cleanHtml = DOMPurify.sanitize(html);
    return { __html: cleanHtml };
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      <HistorySidebar 
        history={history} 
        onSelect={setCurrentNote} 
        onDelete={deleteNote}
        currentId={currentNote?.id}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 p-4 md:p-8 flex flex-col max-w-5xl mx-auto w-full">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-bolt-lightning text-yellow-500"></i>
              Note Shrinker
            </h1>
            <p className="text-slate-500 mt-1">Lossless extraction. High-density shorthand.</p>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900"
          >
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
        </header>

        {/* Input Switcher */}
        <div className="flex bg-slate-200 p-1 rounded-xl w-fit mb-6 self-center shadow-inner overflow-x-auto max-w-full">
          {[
            { id: 'media', icon: 'fa-microphone-lines', label: 'Media Queue' },
            { id: 'text', icon: 'fa-align-left', label: 'Shrink Text' },
            { id: 'youtube', icon: 'fa-youtube', label: 'YouTube', color: 'text-red-500' },
            { id: 'combine', icon: 'fa-layer-group', label: 'Merge Sources' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setInputMode(tab.id as InputMode)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${inputMode === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <i className={`fa-solid ${tab.id === 'youtube' ? 'fa-brands' : 'fa-solid'} ${tab.icon} mr-2 ${tab.color || ''}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="mb-8">
          {inputMode === 'media' && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
              {stagedFiles.length === 0 ? (
                <div 
                  className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-300 transition-colors group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="audio/*,video/*,image/*,application/pdf,text/plain" 
                    className="hidden"
                    multiple
                  />
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <i className="fa-solid fa-file-arrow-up text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Media Queue</h3>
                    <p className="text-slate-500 text-sm mt-1">Upload files or <span className="text-blue-600 font-bold">Paste (Ctrl+V) images</span> repeatedly.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                      Staged for Unified Response ({stagedFiles.length})
                    </h3>
                    <button 
                      onClick={() => setStagedFiles([])}
                      className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <i className="fa-solid fa-trash-can"></i> Clear All
                    </button>
                  </div>

                  <input 
                    type="text"
                    placeholder="Session Title (e.g. Immunology Part 1)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold bg-slate-50/50"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                  />
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                    {stagedFiles.map((staged) => (
                      <div key={staged.id} className="relative group aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        {staged.preview ? (
                          <img src={staged.preview} alt="staged" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <i className="fa-solid fa-file-lines text-2xl"></i>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            onClick={() => removeStaged(staged.id)}
                            className="bg-red-500 text-white w-8 h-8 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-sm px-2 py-1">
                          <p className="text-[10px] font-bold truncate text-slate-700">{staged.file.name}</p>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all"
                    >
                      <i className="fa-solid fa-plus mb-1"></i>
                      <span className="text-[10px] font-bold uppercase">Add More</span>
                    </button>
                  </div>

                  <button 
                    onClick={handleProcessStaged}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-600/20 group"
                  >
                    <i className="fa-solid fa-bolt-lightning group-hover:animate-pulse"></i>
                    Shrink All Staged Files
                  </button>
                  <p className="text-center text-[10px] text-slate-400 font-medium italic">
                    Exhaustive extraction into one high-density shorthand response.
                  </p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="audio/*,video/*,image/*,application/pdf,text/plain" 
                className="hidden"
                multiple
              />
            </section>
          )}

          {inputMode === 'text' && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
              <input 
                type="text"
                placeholder="Lecture Title (optional)"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
              <textarea 
                className="w-full min-h-[160px] p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none"
                placeholder="Paste the content here for exhaustive shorthand conversion."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              ></textarea>
              <button 
                onClick={handleTextShrink}
                disabled={!rawText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                Shrink Text Notes
              </button>
            </section>
          )}

          {inputMode === 'youtube' && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">YouTube Lecture Link</label>
                <div className="relative">
                  <i className="fa-brands fa-youtube absolute left-4 top-1/2 -translate-y-1/2 text-red-500"></i>
                  <input 
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/10 text-sm"
                    value={ytLink}
                    onChange={(e) => setYtLink(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={handleYoutubeShrink}
                disabled={!ytLink.trim()}
                className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10"
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                Shrink YouTube Lecture
              </button>
            </section>
          )}

          {inputMode === 'combine' && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                    <i className="fa-solid fa-object-group"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">Combine Multiple Sources</h3>
                    <p className="text-xs text-slate-500">Merge different recordings/notes into one lossless version.</p>
                  </div>
                </div>
                <input 
                  type="text"
                  placeholder="Lecture Title (e.g. Clinical Medicine - SpAs)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                  value={combineTitle}
                  onChange={(e) => setCombineTitle(e.target.value)}
                />
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                  {combineSources.map((source, idx) => (
                    <div key={idx} className="relative group animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="absolute -left-2 top-3 w-6 h-6 bg-slate-100 border border-slate-200 text-slate-400 rounded-full flex items-center justify-center text-[10px] font-bold z-10">
                        {idx + 1}
                      </div>
                      <textarea 
                        className="w-full min-h-[120px] p-4 pl-6 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none bg-slate-50/30 transition-shadow"
                        placeholder={`Paste source ${idx + 1} content here`}
                        value={source}
                        onChange={(e) => updateCombineSource(idx, e.target.value)}
                      ></textarea>
                      {combineSources.length > 2 && (
                        <button 
                          onClick={() => removeCombineField(idx)}
                          className="absolute right-3 top-3 text-slate-300 hover:text-red-500 transition-colors"
                          title="Remove source"
                        >
                          <i className="fa-solid fa-circle-xmark"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={addCombineField}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-200 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-plus-circle text-base"></i>
                  Add Another Source
                </button>
              </div>
              <button 
                onClick={handleMergeShrink}
                disabled={combineSources.filter(s => s.trim() !== '').length < 2}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 group"
              >
                <i className="fa-solid fa-code-merge group-hover:rotate-12 transition-transform"></i>
                Create Unified Notes
              </button>
              <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><i className="fa-solid fa-check text-green-500"></i> ZERO Omission</span>
                <span className="flex items-center gap-1"><i className="fa-solid fa-check text-green-500"></i> De-duplicated</span>
                <span className="flex items-center gap-1"><i className="fa-solid fa-check text-green-500"></i> Shorthand Symbols</span>
              </div>
            </section>
          )}
        </div>

        {/* Notes Display */}
        {currentNote ? (
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 truncate">
                  <i className="fa-solid fa-file-lines text-blue-500"></i>
                  {currentNote.title}
                </h2>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  {new Date(currentNote.timestamp).toLocaleString()} • {currentNote.fileName}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => copyToClipboard(currentNote.content)}
                  className={`p-2 rounded-lg transition-all ${copySuccess ? 'bg-green-100 text-green-600' : 'hover:bg-slate-200 text-slate-600'}`}
                  title={copySuccess ? "Copied Rich Text!" : "Copy to clipboard (Rich Text)"}
                >
                  {copySuccess ? <i className="fa-solid fa-check"></i> : <i className="fa-regular fa-copy"></i>}
                </button>
                <button 
                  onClick={downloadPdf}
                  className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-all"
                  title="Download as PDF"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white scrollbar-thin">
              <div 
                ref={contentRef}
                className="markdown-content mono text-[13px] leading-relaxed text-slate-800 overflow-x-auto"
                dangerouslySetInnerHTML={renderContent(currentNote.content)}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl py-12">
            <i className="fa-solid fa-paste text-4xl mb-4 opacity-20"></i>
            <p className="text-sm">Processed shorthand notes will appear here.</p>
            <p className="text-[10px] mt-2 opacity-60">Tip: Paste multiple images (Ctrl+V) directly anywhere to queue them!</p>
          </div>
        )}

        {processing.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-3 animate-in shake duration-500">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span className="flex-1">{processing.error}</span>
            <button 
              onClick={() => setProcessing({ ...processing, error: undefined })}
              className="p-1 hover:bg-red-100 rounded"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
      </main>

      <LoadingOverlay active={processing.isProcessing} message={processing.progress} />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default App;
