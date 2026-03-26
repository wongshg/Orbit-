import React, { useEffect, useState, useRef } from 'react';
import { Task, TaskStatus, Material, StatusUpdate, AttachedFile } from '../types';
import { FileText, CheckCircle2, Circle, Trash2, Plus, X, Check, MessageSquare, Edit3, Upload, File as FileIcon, Calendar, Package, BookOpen, GripVertical, Sparkles } from 'lucide-react';
import { saveAs } from 'file-saver';
import { saveFile, getFile, deleteFile as deleteFileFromDB } from '../services/storage';
import { parseMaterialsFromText } from '../services/aiAnalysisService';

interface Props {
  task: Task;
  matterDueDate?: number;
  onUpdate: (updatedTask: Task) => void;
  onDelete: () => void;
  isTemplateMode?: boolean;
}

const TaskDetailPane: React.FC<Props> = ({ task, matterDueDate, onUpdate, onDelete, isTemplateMode = false }) => {
  const [localTitle, setLocalTitle] = useState(task.title);
  
  // Add Material State
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [addingCategory, setAddingCategory] = useState<'REFERENCE' | 'DELIVERABLE'>('DELIVERABLE');
  const [newMaterialName, setNewMaterialName] = useState('');
  const materialInputRef = useRef<HTMLInputElement>(null);

  // AI Material Import State
  const [showAIMaterialModal, setShowAIMaterialModal] = useState(false);
  const [aiMaterialText, setAiMaterialText] = useState('');
  const [isAnalyzingMaterials, setIsAnalyzingMaterials] = useState(false);

  // Status Update State
  const [newUpdateContent, setNewUpdateContent] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Custom Status Edit State
  const [isEditingCustomStatus, setIsEditingCustomStatus] = useState(false);
  const [customStatusText, setCustomStatusText] = useState(task.customStatus || '自定义状态');

  // Drag and Drop State
  const [dragActiveId, setDragActiveId] = useState<string | null>(null); // For File Drop
  const [sortDragId, setSortDragId] = useState<string | null>(null); // For Sorting Materials

  // Description auto-resize ref
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state when task changes (switching tasks)
  useEffect(() => {
    setLocalTitle(task.title);
    setIsAddingMaterial(false);
    setNewMaterialName('');
    setNewUpdateContent('');
    setIsEditingCustomStatus(false);
    setCustomStatusText(task.customStatus || '自定义状态');
    setDragActiveId(null);
    setSortDragId(null);
    setShowAIMaterialModal(false);
  }, [task.id]);

  useEffect(() => {
    if (isAddingMaterial && materialInputRef.current) {
      materialInputRef.current.focus();
    }
  }, [isAddingMaterial]);

  // Auto-resize description on load and change
  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px';
    }
  }, [task.description, task.id]);

  const handleTitleBlur = () => {
    if (localTitle !== task.title) {
      onUpdate({ ...task, title: localTitle, lastUpdated: Date.now() });
    }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    const updates: Partial<Task> = { status: newStatus, lastUpdated: Date.now() };
    
    // Auto focus logic for Blocked/Exception/Skipped
    if (newStatus === TaskStatus.BLOCKED || newStatus === TaskStatus.EXCEPTION || newStatus === TaskStatus.SKIPPED) {
       setTimeout(() => {
           noteInputRef.current?.focus();
       }, 100);
    }

    if (newStatus === TaskStatus.OTHER && !task.customStatus) {
       updates.customStatus = "自定义状态";
       setIsEditingCustomStatus(true);
       setCustomStatusText(''); 
    }

    onUpdate({ ...task, ...updates });
  };

  const saveCustomStatus = () => {
     const finalStatus = customStatusText.trim() || '自定义状态';
     onUpdate({ ...task, customStatus: finalStatus, lastUpdated: Date.now() });
     setIsEditingCustomStatus(false);
     setCustomStatusText(finalStatus);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...task, description: e.target.value, lastUpdated: Date.now() });
  };

  // --- Date Handling ---
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) {
          onUpdate({ ...task, dueDate: undefined, lastUpdated: Date.now() });
          return;
      }
      
      const ts = new Date(val).getTime();

      if (matterDueDate && ts > matterDueDate) {
          if(!confirm("该任务的截止时间晚于整个事项的截止时间，确定要设置吗？")) {
              return;
          }
      }

      onUpdate({ ...task, dueDate: ts, lastUpdated: Date.now() });
  };


  const toggleMaterial = (matId: string) => {
    const newMaterials = task.materials.map(m => 
      m.id === matId ? { ...m, isReady: !m.isReady } : m
    );
    onUpdate({ ...task, materials: newMaterials, lastUpdated: Date.now() });
  };

  const confirmAddMaterial = () => {
    if (newMaterialName.trim()) {
      const newMat: Material = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: newMaterialName.trim(), 
        category: addingCategory,
        isReady: false,
        files: []
      };
      onUpdate({ ...task, materials: [...task.materials, newMat], lastUpdated: Date.now() });
    }
    setNewMaterialName('');
    setIsAddingMaterial(false);
  };

  const deleteMaterial = async (mat: Material) => {
    onUpdate({ ...task, materials: task.materials.filter(m => m.id !== mat.id), lastUpdated: Date.now() });
  };

  // --- AI Material Analysis ---
  const handleAIAnalyzeMaterials = async () => {
      if (!aiMaterialText.trim()) return;
      setIsAnalyzingMaterials(true);
      const results = await parseMaterialsFromText(aiMaterialText);
      setIsAnalyzingMaterials(false);

      if (results && results.length > 0) {
          const newItems: Material[] = results.map(r => ({
              id: Math.random().toString(36).substr(2, 9),
              name: r.name,
              category: r.category,
              isReady: false,
              files: []
          }));
          onUpdate({ ...task, materials: [...task.materials, ...newItems], lastUpdated: Date.now() });
          setShowAIMaterialModal(false);
          setAiMaterialText('');
      } else {
          alert("未识别到有效的材料清单");
      }
  };

  // --- File Handling (Multi-file Support) ---

  const processFile = async (matId: string, file: File) => {
      const fileId = Math.random().toString(36).substr(2, 9);
      await saveFile(fileId, file);

      const attachedFile: AttachedFile = {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size,
          timestamp: Date.now()
      };

      const newMaterials = task.materials.map(m => {
          if (m.id === matId) {
              const currentFiles = m.files || [];
              return { 
                  ...m, 
                  files: [...currentFiles, attachedFile],
                  isReady: true 
              };
          }
          return m;
      });
      onUpdate({ ...task, materials: newMaterials, lastUpdated: Date.now() });
  };

  const handleFileUpload = async (matId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      
      // Process all selected files
      for (let i = 0; i < files.length; i++) {
          await processFile(matId, files[i]);
      }
      // Reset input
      e.target.value = '';
  };

  const handleFileDownload = async (fileId: string, fileName: string) => {
      const file = await getFile(fileId);
      if (file) {
          saveAs(file, fileName || 'download');
      } else {
          alert("文件丢失或无法读取");
      }
  };

  const deleteAttachedFile = async (matId: string, fileId: string) => {
      const newMaterials = task.materials.map(m => {
          if (m.id === matId) {
              const newFiles = (m.files || []).filter(f => f.id !== fileId);
              // Also check if we need to clear legacy fileId if user deletes the legacy file
              const isLegacy = m.fileId === fileId;
              return { 
                  ...m, 
                  files: newFiles,
                  // If legacy was deleted, clear it.
                  fileId: isLegacy ? undefined : m.fileId,
                  // If no files left, maybe set not ready? Optional.
                  isReady: newFiles.length > 0 || (!!m.fileId && !isLegacy)
              };
          }
          return m;
      });
      onUpdate({ ...task, materials: newMaterials, lastUpdated: Date.now() });
  };

  // --- Drag and Drop Handlers (File Upload) ---

  const handleFileDragEnter = (e: React.DragEvent, matId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (sortDragId) return; // Ignore if sorting
    setDragActiveId(matId);
  };

  const handleFileDragLeave = (e: React.DragEvent, matId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragActiveId === matId) {
        setDragActiveId(null);
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileDrop = async (e: React.DragEvent, matId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(null);

    // Check if it's a sort action
    const sortId = e.dataTransfer.getData('sortMaterialId');
    if (sortId) return; // Handled by sort drop

    if (e.dataTransfer.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
            await processFile(matId, e.dataTransfer.files[i]);
        }
    }
  };

  // --- Drag and Drop Handlers (Reorder Materials) ---
  const handleSortDragStart = (e: React.DragEvent, matId: string) => {
      e.dataTransfer.setData('sortMaterialId', matId);
      e.dataTransfer.effectAllowed = 'move';
      setSortDragId(matId);
  };

  const handleSortDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleSortDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setSortDragId(null);
      const sourceId = e.dataTransfer.getData('sortMaterialId');
      
      if (!sourceId || sourceId === targetId) return;

      const items = [...task.materials];
      const sourceIndex = items.findIndex(i => i.id === sourceId);
      const targetIndex = items.findIndex(i => i.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return;

      const [moved] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moved);

      onUpdate({ ...task, materials: items, lastUpdated: Date.now() });
  };


  // --- Status Updates ---

  const addStatusUpdate = () => {
    if (!newUpdateContent.trim()) return;

    const newUpdate: StatusUpdate = {
        id: Math.random().toString(36).substr(2, 9),
        content: newUpdateContent.trim(),
        timestamp: Date.now()
    };

    const currentUpdates = task.statusUpdates || [];
    onUpdate({
        ...task,
        statusUpdates: [newUpdate, ...currentUpdates], // Add to top
        lastUpdated: Date.now()
    });
    setNewUpdateContent('');
  };

  const deleteStatusUpdate = (updateId: string) => {
      if(!confirm("确定删除这条记录吗？")) return;
      const currentUpdates = task.statusUpdates || [];
      onUpdate({
          ...task,
          statusUpdates: currentUpdates.filter(u => u.id !== updateId),
          lastUpdated: Date.now()
      });
  };

  // Format timestamp helper
  const formatTime = (ts: number) => {
      return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Helper to determine input theme
  const getInputTheme = () => {
      switch(task.status) {
          case TaskStatus.BLOCKED: return 'bg-amber-50 border-amber-200 focus-within:ring-amber-200 focus-within:border-amber-400 dark:bg-amber-900/10 dark:border-amber-800';
          case TaskStatus.EXCEPTION: return 'bg-purple-50 border-purple-200 focus-within:ring-purple-200 focus-within:border-purple-400 dark:bg-purple-900/10 dark:border-purple-800';
          case TaskStatus.SKIPPED: return 'bg-gray-50 border-gray-200 focus-within:ring-gray-200 focus-within:border-gray-400 dark:bg-gray-800/30 dark:border-gray-700';
          default: return 'bg-slate-50 border-slate-200 focus-within:ring-blue-100 focus-within:border-blue-300 dark:bg-slate-800 dark:border-slate-700';
      }
  };

  const getPlaceholder = () => {
      switch(task.status) {
          case TaskStatus.BLOCKED: return "卡在哪里了？在等谁？预计什么时候恢复？";
          case TaskStatus.EXCEPTION: return "为什么要例外处理？依据是什么？";
          case TaskStatus.SKIPPED: return "为什么这步不需要做？";
          default: return "添加新的进展记录...";
      }
  };

  // --- Split Materials ---
  const referenceMaterials = task.materials.filter(m => m.category === 'REFERENCE');
  const deliverableMaterials = task.materials.filter(m => m.category !== 'REFERENCE');

  const renderMaterialList = (list: Material[], type: 'REFERENCE' | 'DELIVERABLE') => {
      const isRef = type === 'REFERENCE';
      
      if (list.length === 0) {
          if (isAddingMaterial && addingCategory === type) return null;
          return <div className="text-sm text-slate-300 italic py-1">暂无{isRef ? '参考文件' : '交付产物'}</div>;
      }

      return (
          <div className="space-y-2 mt-2">
            {list.map(m => {
               // Merge legacy file into files array for display if needed
               const files = m.files ? [...m.files] : [];
               if (m.fileId && !files.some(f => f.id === m.fileId)) {
                   files.push({
                       id: m.fileId,
                       name: m.fileName || 'Legacy File',
                       type: m.fileType,
                       size: m.fileSize,
                       timestamp: 0 // Unknown
                   });
               }

               return (
               <div 
                  key={m.id}
                  draggable // Enable sorting
                  onDragStart={(e) => handleSortDragStart(e, m.id)}
                  onDragOver={handleSortDragOver}
                  onDrop={(e) => {
                      if (sortDragId) handleSortDrop(e, m.id);
                      else if (!isRef || isTemplateMode) handleFileDrop(e, m.id);
                  }}
                  onDragEnter={(e) => {
                      if (sortDragId) return;
                      if (!isRef || isTemplateMode) handleFileDragEnter(e, m.id)
                  }}
                  onDragLeave={(e) => {
                      if (sortDragId) return;
                      if (!isRef || isTemplateMode) handleFileDragLeave(e, m.id)
                  }}
                  className={`group rounded-lg border transition-all relative p-2.5 ${
                      dragActiveId === m.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 border-dashed z-10' 
                      : sortDragId === m.id
                      ? 'opacity-50 border-dashed border-slate-300'
                      : 'border-slate-100 dark:border-slate-700 hover:border-blue-100 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/10'
                  }`}
               >
                  {dragActiveId === m.id && (
                     <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 rounded-lg pointer-events-none z-20">
                         <span className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2"><Upload size={16}/> 松开以上传</span>
                     </div>
                  )}

                  {/* Header Row: Grip + Icon + Name + Upload Button + Delete Button */}
                  <div className="flex items-center gap-2 mb-1">
                      {/* Drag Handle */}
                      <div className="cursor-move text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical size={14} />
                      </div>

                      {/* Status Icon / Type Icon */}
                      {isRef ? (
                          <div className="shrink-0 text-blue-500 dark:text-blue-400 opacity-80">
                              <BookOpen size={16} />
                          </div>
                      ) : (
                          <button 
                            onClick={() => toggleMaterial(m.id)}
                            className={`transition-colors shrink-0 ${m.isReady ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'}`}
                          >
                            {m.isReady ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          </button>
                      )}
                      
                      {/* Name */}
                      <div className={`text-sm font-medium flex-1 truncate ${m.isReady && !isRef ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {m.name}
                      </div>

                      {/* No Files Text (Inline) */}
                      {files.length === 0 && (!isRef || isTemplateMode) && (
                          <span className="text-[10px] text-slate-300 italic mr-2 hidden group-hover:inline">暂无文件</span>
                      )}

                      {/* Actions */}
                      {(!isRef || isTemplateMode) && (
                        <>
                            <label className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-white dark:hover:bg-slate-800" title="上传文件">
                                <Upload size={14} />
                                <input 
                                    type="file" 
                                    multiple 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(m.id, e)}
                                />
                            </label>
                            <button 
                                onClick={() => deleteMaterial(m)} 
                                className="text-slate-300 hover:text-red-400 p-1 rounded hover:bg-white dark:hover:bg-slate-800"
                                title="删除此项"
                            >
                                <Trash2 size={14} />
                            </button>
                        </>
                      )}
                  </div>

                  {/* File List */}
                  {files.length > 0 && (
                      <div className="pl-8 space-y-1 mt-1">
                          {files.map(file => (
                              <div key={file.id} className="flex items-center justify-between group/file text-xs bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1 border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                  <button 
                                      onClick={() => handleFileDownload(file.id, file.name)}
                                      className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[60%]"
                                      title={file.name}
                                  >
                                      <FileIcon size={10} /> {file.name}
                                  </button>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                      {file.timestamp > 0 && <span>{new Date(file.timestamp).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: false })}</span>}
                                      {(!isRef || isTemplateMode) && (
                                          <button 
                                              onClick={() => deleteAttachedFile(m.id, file.id)}
                                              className="hover:text-red-500 hidden group-hover/file:block"
                                              title="删除文件"
                                          >
                                              <X size={10} />
                                          </button>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
               </div>
            )})}
          </div>
      );
  }

  return (
    // Updated: Added w-full max-w-full overflow-x-hidden to prevent horizontal scrolling
    <div className="flex flex-col bg-white dark:bg-slate-900 animate-fadeIn min-h-full w-full max-w-full overflow-x-hidden relative">
      
      {/* Header Area - Sticky */}
      <div className="sticky top-0 z-20 p-4 border-b border-slate-100/50 dark:border-slate-800/50 flex flex-col shrink-0 gap-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl transition-all">
        
        {/* Row 1: Title & Actions */}
        <div className="flex justify-between items-start">
            <input 
                className="flex-1 w-full text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 border-none outline-none focus:ring-0 placeholder-slate-300 bg-transparent mr-2 md:mr-4 min-w-0"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="任务标题..."
            />
            
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                {/* Due Date Picker (Compact) */}
                <div className="relative flex items-center justify-center p-1.5 md:p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-1.5 cursor-pointer">
                        <Calendar size={18} className={`${task.dueDate ? 'text-blue-500' : 'text-slate-300 hover:text-slate-500'}`} />
                        {task.dueDate && (
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400 hidden md:inline">
                                {new Date(task.dueDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                            </span>
                        )}
                    </div>
                    <input 
                        type="date"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                        onChange={handleDateChange}
                        title={task.dueDate ? `截止: ${new Date(task.dueDate).toLocaleDateString()}` : "设置截止日期"}
                    />
                </div>

                <button 
                    onClick={() => { if(confirm('确定删除此任务吗？')) onDelete(); }}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1.5 md:p-2"
                    title="删除任务"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
        
        {/* Row 2: Status Buttons */}
        <div className="flex gap-2 flex-wrap items-center">
             {[
               TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, 
               TaskStatus.BLOCKED, TaskStatus.SKIPPED, TaskStatus.EXCEPTION, TaskStatus.OTHER
             ].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  task.status === s
                    ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-600 font-semibold shadow-sm'
                    : 'opacity-60 hover:opacity-100'
                } ${
                    s === TaskStatus.PENDING ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' :
                    s === TaskStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                    s === TaskStatus.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' :
                    s === TaskStatus.BLOCKED ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' :
                    s === TaskStatus.SKIPPED ? 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-700' : 
                    s === TaskStatus.EXCEPTION ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                }`}
              >
                {s === TaskStatus.PENDING ? '待办' :
                 s === TaskStatus.IN_PROGRESS ? '进行中' :
                 s === TaskStatus.COMPLETED ? '完成' :
                 s === TaskStatus.BLOCKED ? '受阻' :
                 s === TaskStatus.SKIPPED ? '不适用' : 
                 s === TaskStatus.EXCEPTION ? '例外' :
                 (task.customStatus || '其他')}
              </button>
            ))}
            
            {/* Custom Status Editor */}
            {task.status === TaskStatus.OTHER && (
                <div className="relative">
                   {isEditingCustomStatus ? (
                       <input 
                         autoFocus
                         value={customStatusText}
                         onChange={(e) => setCustomStatusText(e.target.value)}
                         onBlur={saveCustomStatus}
                         onKeyDown={(e) => e.key === 'Enter' && saveCustomStatus()}
                         className="text-xs px-2 py-1 rounded border border-indigo-300 outline-none w-24 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                       />
                   ) : (
                       <button onClick={() => setIsEditingCustomStatus(true)} className="p-1 text-slate-300 hover:text-indigo-600">
                           <Edit3 size={12} />
                       </button>
                   )}
                </div>
            )}
        </div>
      </div>

      {/* Content Area - Scroll flows under sticky header */}
      {/* Updated: Use calc padding to respect safe area at bottom for "transparent" effect. 
          PB-24 is added as a safe margin for the iOS toolbar when using 100vh.
      */}
      <div className="p-4 space-y-6 pb-24 md:pb-[calc(5rem+env(safe-area-inset-bottom))]">
        
        {/* Description */}
        <div className="w-full group">
           <textarea
             ref={descriptionRef}
             value={task.description || ''}
             onChange={handleDescriptionChange}
             onInput={(e) => {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
             }}
             placeholder="添加任务指引或操作说明..."
             className="w-full bg-transparent border-none outline-none text-sm text-slate-600 dark:text-slate-300 placeholder-slate-400/60 resize-none leading-relaxed overflow-hidden"
             rows={1}
           />
        </div>

        {/* Status Notes Timeline */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
           <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <MessageSquare size={14} /> 当前情况 / 备注
           </label>
           
           {/* New Input */}
           <div className={`mb-6 p-3 rounded-lg border transition-all ${getInputTheme()}`}>
              <textarea
                ref={noteInputRef}
                value={newUpdateContent}
                onChange={(e) => setNewUpdateContent(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400/70 resize-none mb-2"
                rows={3}
                onKeyDown={(e) => { if(e.ctrlKey && e.key === 'Enter') addStatusUpdate(); }}
              />
              <div className="flex justify-end">
                  <button 
                    onClick={addStatusUpdate}
                    disabled={!newUpdateContent.trim()}
                    className="bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded text-xs font-medium hover:bg-white hover:text-blue-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    添加记录
                  </button>
              </div>
           </div>

           {/* Timeline List */}
           <div className="space-y-4 pl-2 relative">
              <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
              
              {(task.statusUpdates || []).map((update) => (
                  <div key={update.id} className="relative pl-6 group">
                      <div className="absolute left-[2px] top-1.5 w-[7px] h-[7px] rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-900 ring-1 ring-slate-100 dark:ring-slate-800"></div>
                      <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 rounded">{formatTime(update.timestamp)}</span>
                          <button 
                             onClick={() => deleteStatusUpdate(update.id)}
                             className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity p-1 cursor-pointer"
                             title="删除记录"
                          >
                             <X size={12} />
                          </button>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {update.content}
                      </div>
                  </div>
              ))}

              {/* Legacy Note Support */}
              {task.statusNote && (!task.statusUpdates || task.statusUpdates.length === 0) && (
                  <div className="relative pl-6">
                      <div className="absolute left-[2px] top-1.5 w-[7px] h-[7px] rounded-full bg-slate-300 border-2 border-white ring-1 ring-slate-100"></div>
                      <div className="mb-1"><span className="text-[10px] text-slate-400 italic">历史备注</span></div>
                      <div className="text-sm text-slate-600 whitespace-pre-wrap">{task.statusNote}</div>
                  </div>
              )}
              
              {(!task.statusUpdates?.length && !task.statusNote) && (
                  <div className="text-xs text-slate-400 pl-6 italic pt-2">暂无记录</div>
              )}
           </div>
        </div>

        {/* Materials Sections */}
        <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
           
           <div className="flex justify-end">
               <button 
                   onClick={() => setShowAIMaterialModal(true)} 
                   className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 py-1 px-2 bg-indigo-50 dark:bg-indigo-900/20 rounded font-medium transition-colors"
               >
                   <Sparkles size={12} /> AI 识别材料
               </button>
           </div>

           {/* Section 1: Reference Materials */}
           {(referenceMaterials.length > 0 || isTemplateMode) && (
               <div>
                   <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={14} /> 参考资料 / 模板
                        </label>
                        {isTemplateMode && !isAddingMaterial && (
                            <button 
                                onClick={() => { setIsAddingMaterial(true); setAddingCategory('REFERENCE'); }} 
                                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 py-1 px-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            >
                                <Plus size={12} /> 添加参考文件
                            </button>
                        )}
                   </div>
                   {renderMaterialList(referenceMaterials, 'REFERENCE')}
                   {isAddingMaterial && addingCategory === 'REFERENCE' && (
                       <div className="mt-4 flex items-center gap-2 p-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-800 shadow-sm animate-fadeIn">
                          <Circle size={20} className="text-slate-300" />
                          <div className="flex-1">
                              <div className="text-[10px] text-blue-500 font-bold uppercase mb-0.5">新增参考资料</div>
                              <input
                                  ref={materialInputRef}
                                  value={newMaterialName}
                                  onChange={(e) => setNewMaterialName(e.target.value)}
                                  placeholder="输入名称 (Enter确认)"
                                  className="w-full text-sm outline-none text-slate-700 dark:text-slate-200 bg-transparent min-w-0"
                                  onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmAddMaterial();
                                  if (e.key === 'Escape') setIsAddingMaterial(false);
                                  }}
                              />
                          </div>
                          <div className="flex items-center gap-1">
                              <button onClick={confirmAddMaterial} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Check size={16}/></button>
                              <button onClick={() => setIsAddingMaterial(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={16}/></button>
                          </div>
                      </div>
                   )}
               </div>
           )}

           {/* Section 2: Deliverables */}
           <div>
               <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                        <Package size={14} /> 所需产物 / 交付物
                    </label>
                    {!isAddingMaterial && (
                        <button 
                            onClick={() => { setIsAddingMaterial(true); setAddingCategory('DELIVERABLE'); }} 
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 py-1 px-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        >
                            <Plus size={12} /> 添加产物项
                        </button>
                    )}
               </div>
               {renderMaterialList(deliverableMaterials, 'DELIVERABLE')}
               {isAddingMaterial && addingCategory === 'DELIVERABLE' && (
                  <div className="mt-4 flex items-center gap-2 p-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-800 shadow-sm animate-fadeIn">
                      <Circle size={20} className="text-slate-300" />
                      <div className="flex-1">
                          <div className="text-[10px] text-blue-500 font-bold uppercase mb-0.5">新增交付产物</div>
                          <input
                              ref={materialInputRef}
                              value={newMaterialName}
                              onChange={(e) => setNewMaterialName(e.target.value)}
                              placeholder="输入名称 (Enter确认)"
                              className="w-full text-sm outline-none text-slate-700 dark:text-slate-200 bg-transparent min-w-0"
                              onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmAddMaterial();
                              if (e.key === 'Escape') setIsAddingMaterial(false);
                              }}
                          />
                      </div>
                      <div className="flex items-center gap-1">
                          <button onClick={confirmAddMaterial} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Check size={16}/></button>
                          <button onClick={() => setIsAddingMaterial(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={16}/></button>
                      </div>
                  </div>
               )}
           </div>
        </div>

      </div>

      {/* AI Material Import Modal */}
      {showAIMaterialModal && (
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-30 p-4 backdrop-blur-sm" onClick={() => setShowAIMaterialModal(false)}>
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-4 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                          <Sparkles size={16} /> 批量提取材料
                      </h3>
                      <button onClick={() => setShowAIMaterialModal(false)}><X size={16} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                      粘贴您的工作说明、清单或邮件片段，AI 将自动识别并添加材料。
                  </p>
                  <textarea 
                      className="w-full h-32 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-3"
                      placeholder="例如：请准备公司章程复印件、股东会决议和清算报告。"
                      value={aiMaterialText}
                      onChange={(e) => setAiMaterialText(e.target.value)}
                  />
                  <button 
                      onClick={handleAIAnalyzeMaterials}
                      disabled={!aiMaterialText.trim() || isAnalyzingMaterials}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                  >
                      {isAnalyzingMaterials ? <><Sparkles size={14} className="animate-spin"/> 分析中...</> : '开始识别'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default TaskDetailPane;