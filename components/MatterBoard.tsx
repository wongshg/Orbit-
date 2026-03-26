import React, { useState, useEffect, useRef } from 'react';
import { Matter, Task, Stage, TaskStatus, Material } from '../types';
import StatusBadge from './StatusBadge';
import TaskDetailPane from './TaskDetailPane';
import JudgmentTimeline from './JudgmentTimeline';
import { 
  Plus, ArrowLeft, Edit2, Archive, 
  Trash2, LayoutTemplate, Briefcase, X, Check, Download, Save, ChevronRight, Calendar, Clock,
  Moon, Sun, Monitor, FileText, Package, LayoutDashboard, SunMoon, MoreHorizontal, GripHorizontal, GripVertical, CheckCircle2
} from 'lucide-react';
import { analyzeMatter } from '../services/geminiService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getFile } from '../services/storage';

interface Props {
  matter: Matter;
  allMatters: Matter[];
  targetTaskId?: string | null;
  onUpdate: (updatedMatter: Matter) => void;
  onBack: () => void;
  onSaveTemplate: (matter: Matter) => void;
  onDeleteMatter: (id: string) => void;
  isTemplateMode?: boolean;
  theme?: 'light' | 'dark' | 'system';
  onThemeChange?: (t: 'light' | 'dark' | 'system') => void;
}

const uuid = () => Math.random().toString(36).substr(2, 9);

const MatterBoard: React.FC<Props> = ({ 
  matter, 
  allMatters,
  targetTaskId,
  onUpdate, 
  onBack, 
  onSaveTemplate,
  onDeleteMatter,
  isTemplateMode = false,
  theme,
  onThemeChange
}) => {
  // Helper to check stage completion
  const isStageComplete = (s: Stage) => {
      return s.tasks.length > 0 && s.tasks.every(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED);
  };

  // Initialize selected stage to the first incomplete one, or the first one if all are complete/empty
  const [selectedStageId, setSelectedStageId] = useState<string | null>(() => {
      const firstIncomplete = matter.stages.find(s => !isStageComplete(s));
      return firstIncomplete ? firstIncomplete.id : (matter.stages[0]?.id || null);
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  // Resizable Columns State
  const [col1Width, setCol1Width] = useState(256); // Default 256px (w-64)
  const [col2Width, setCol2Width] = useState(320); // Default 320px (w-80)
  const [isResizingCol1, setIsResizingCol1] = useState(false);
  const [isResizingCol2, setIsResizingCol2] = useState(false);

  // Mobile Split State (Top Panel Height in vh)
  const [topPanelHeightVh, setTopPanelHeightVh] = useState(40); // Default 40vh for top panel
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isResizingMobile, setIsResizingMobile] = useState(false);

  // Title & Description Editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleVal, setEditTitleVal] = useState(matter.title);
  const [editDescVal, setEditDescVal] = useState(matter.type);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Add Stage State
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const newStageInputRef = useRef<HTMLInputElement>(null);

  // Edit Stage State
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState('');

  // Edit Task Name State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');

  // Drag and Drop State
  const [dragItem, setDragItem] = useState<{ type: 'STAGE' | 'TASK', id: string, stageId?: string } | null>(null);

  // Robust Scroll Reset
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!targetTaskId) {
      const firstIncomplete = matter.stages.find(s => !isStageComplete(s));
      setSelectedStageId(firstIncomplete ? firstIncomplete.id : (matter.stages[0]?.id || null));
      setSelectedTaskId(null);
    }
  }, [matter.id, targetTaskId]);

  // Handle Deep Linking
  useEffect(() => {
    if (targetTaskId) {
      for (const stage of matter.stages) {
        const found = stage.tasks.find(t => t.id === targetTaskId);
        if (found) {
          setSelectedStageId(stage.id);
          setSelectedTaskId(targetTaskId);
          break;
        }
      }
    }
  }, [targetTaskId, matter.id]); 

  useEffect(() => {
    setEditTitleVal(matter.title);
    setEditDescVal(matter.type);
  }, [matter.title, matter.type]);

  useEffect(() => {
    if (isAddingStage && newStageInputRef.current) {
      newStageInputRef.current.focus();
    }
  }, [isAddingStage]);

  // --- Column Resizing Logic ---
  const handleColResizeStart = (e: React.MouseEvent, col: 1 | 2) => {
      e.preventDefault();
      if (col === 1) setIsResizingCol1(true);
      if (col === 2) setIsResizingCol2(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizingCol1) {
              const newWidth = e.clientX;
              if (newWidth > 150 && newWidth < 600) setCol1Width(newWidth);
          }
          if (isResizingCol2) {
              const newWidth = e.clientX - col1Width;
              if (newWidth > 200 && newWidth < 800) setCol2Width(newWidth);
          }
      };

      const handleMouseUp = () => {
          setIsResizingCol1(false);
          setIsResizingCol2(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
      };

      if (isResizingCol1 || isResizingCol2) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizingCol1, isResizingCol2, col1Width]);


  // --- Mobile Resize Logic ---
  const handleMobileResizeStart = (e: React.TouchEvent | React.MouseEvent) => {
      setIsResizingMobile(true);
      document.body.style.userSelect = 'none';
  };

  const handleMobileResizeMove = (e: React.TouchEvent | React.MouseEvent) => {
      if (!isResizingMobile) return;
      let clientY;
      if ('touches' in e) clientY = e.touches[0].clientY;
      else clientY = e.clientY;

      const headerOffset = 64; 
      const rawHeight = clientY - headerOffset;
      const vh = (rawHeight / window.innerHeight) * 100;

      if (vh > 20 && vh < 70) {
          setTopPanelHeightVh(vh);
      }
  };

  const handleMobileResizeEnd = () => {
      setIsResizingMobile(false);
      document.body.style.userSelect = '';
  };

  useEffect(() => {
      if (isResizingMobile) {
          window.addEventListener('mousemove', handleMobileResizeMove as any);
          window.addEventListener('mouseup', handleMobileResizeEnd);
          window.addEventListener('touchmove', handleMobileResizeMove as any);
          window.addEventListener('touchend', handleMobileResizeEnd);
      } else {
          window.removeEventListener('mousemove', handleMobileResizeMove as any);
          window.removeEventListener('mouseup', handleMobileResizeEnd);
          window.removeEventListener('touchmove', handleMobileResizeMove as any);
          window.removeEventListener('touchend', handleMobileResizeEnd);
      }
      return () => {
          window.removeEventListener('mousemove', handleMobileResizeMove as any);
          window.removeEventListener('mouseup', handleMobileResizeEnd);
          window.removeEventListener('touchmove', handleMobileResizeMove as any);
          window.removeEventListener('touchend', handleMobileResizeEnd);
      }
  }, [isResizingMobile]);


  const activeStage = matter.stages.find(s => s.id === selectedStageId);
  const activeTask = activeStage?.tasks.find(t => t.id === selectedTaskId);

  const goBack = () => {
      if (isTemplateMode && isEditingTitle) {
          if (!confirm("您有未保存的标题修改，确定要退出吗？")) return;
      }
      onBack();
  };

  const saveHeaderInfo = () => {
    if (editTitleVal.trim()) {
      onUpdate({ 
          ...matter, 
          title: editTitleVal, 
          type: isTemplateMode ? editDescVal : matter.type, 
          lastUpdated: Date.now() 
      });
    } else {
      setEditTitleVal(matter.title);
    }
    setIsEditingTitle(false);
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) {
          onUpdate({ ...matter, dueDate: undefined, lastUpdated: Date.now() });
      } else {
          onUpdate({ ...matter, dueDate: new Date(val).getTime(), lastUpdated: Date.now() });
      }
  };

  // --- CRUD Operations & Handlers ---

  const handleTaskUpdate = (updatedTask: Task) => {
    const newStages = matter.stages.map(s => {
      const taskIndex = s.tasks.findIndex(t => t.id === updatedTask.id);
      if (taskIndex !== -1) {
        const newTasks = [...s.tasks];
        newTasks[taskIndex] = updatedTask;
        return { ...s, tasks: newTasks };
      }
      return s;
    });
    onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
  };

  const addTask = () => {
    if (!selectedStageId) return;
    const newTask: Task = {
      id: uuid(),
      title: '新任务',
      status: TaskStatus.PENDING,
      statusNote: '',
      statusUpdates: [],
      materials: [],
      lastUpdated: Date.now()
    };
    
    const newStages = matter.stages.map(s => {
      if (s.id === selectedStageId) {
        return { ...s, tasks: [...s.tasks, newTask] };
      }
      return s;
    });
    
    onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
    setSelectedTaskId(newTask.id);
    
    // Auto-start editing
    setTimeout(() => {
        setEditingTaskId(newTask.id);
        setEditingTaskName(newTask.title);
    }, 100);
  };

  const deleteTask = (stageId: string, taskId: string) => {
    if (!confirm('确定删除此任务吗？')) return;
    const newStages = matter.stages.map(s => {
      if (s.id === stageId) {
        return { ...s, tasks: s.tasks.filter(t => t.id !== taskId) };
      }
      return s;
    });
    onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  };

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskName(task.title);
  };

  const saveTaskName = () => {
    if (editingTaskId && editingTaskName.trim()) {
      const newStages = matter.stages.map(s => ({
        ...s,
        tasks: s.tasks.map(t => t.id === editingTaskId ? { ...t, title: editingTaskName.trim() } : t)
      }));
      onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const confirmAddStage = () => {
    if (!newStageName.trim()) {
      setIsAddingStage(false);
      return;
    }
    const newStage: Stage = {
      id: uuid(),
      title: newStageName.trim(),
      tasks: []
    };
    const newStages = [...matter.stages, newStage];
    onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
    setNewStageName('');
    setIsAddingStage(false);
    setSelectedStageId(newStage.id);
  };

  const deleteStage = (stageId: string) => {
    if (!confirm('确定删除此阶段及其所有任务吗？')) return;
    const newStages = matter.stages.filter(s => s.id !== stageId);
    onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
    if (selectedStageId === stageId) setSelectedStageId(newStages[0]?.id || null);
  };

  const startEditingStage = (stage: Stage) => {
      setEditingStageId(stage.id);
      setEditingStageName(stage.title);
  };

  const saveStageName = () => {
      if (editingStageId && editingStageName.trim()) {
          const newStages = matter.stages.map(s => s.id === editingStageId ? { ...s, title: editingStageName.trim() } : s);
          onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
      }
      setEditingStageId(null);
      setEditingStageName('');
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, type: 'STAGE' | 'TASK', id: string, stageId?: string) => {
      setDragItem({ type, id, stageId });
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, type: 'STAGE' | 'TASK', targetId: string, targetStageId?: string) => {
      e.preventDefault();
      if (!dragItem) return;

      if (dragItem.type !== type) return; // Only allow same type reordering
      if (dragItem.id === targetId) return; // Drop on self

      if (type === 'STAGE') {
          const oldIndex = matter.stages.findIndex(s => s.id === dragItem.id);
          const newIndex = matter.stages.findIndex(s => s.id === targetId);
          if (oldIndex === -1 || newIndex === -1) return;

          const newStages = [...matter.stages];
          const [moved] = newStages.splice(oldIndex, 1);
          newStages.splice(newIndex, 0, moved);
          
          onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
      } else if (type === 'TASK') {
          // Task reordering - only within active stage list for simplicity in this view
          if (dragItem.stageId !== selectedStageId || !selectedStageId) return;
          
          const stageIndex = matter.stages.findIndex(s => s.id === selectedStageId);
          if (stageIndex === -1) return;
          
          const tasks = [...matter.stages[stageIndex].tasks];
          const oldIndex = tasks.findIndex(t => t.id === dragItem.id);
          const newIndex = tasks.findIndex(t => t.id === targetId);
          
          if (oldIndex === -1 || newIndex === -1) return;

          const [moved] = tasks.splice(oldIndex, 1);
          tasks.splice(newIndex, 0, moved);

          const newStages = [...matter.stages];
          newStages[stageIndex] = { ...newStages[stageIndex], tasks };
          
          onUpdate({ ...matter, stages: newStages, lastUpdated: Date.now() });
      }
      setDragItem(null);
  };

  // Export Logic
  const exportMaterials = async (filterType: 'ALL' | 'REFERENCE' | 'DELIVERABLE') => {
      setIsExporting(true);
      setShowExportMenu(false);
      try {
          const zip = new JSZip();
          const rootFolder = zip.folder(matter.title) || zip;
          let fileCount = 0;

          // Helper to add file to zip
          const addFileToZip = async (folder: any, m: Material) => {
              // Legacy single file
              if (m.fileId) {
                  const blob = await getFile(m.fileId);
                  if (blob) {
                      try {
                          const arrayBuffer = await blob.arrayBuffer();
                          folder.file(m.fileName || m.name, arrayBuffer);
                          fileCount++;
                      } catch (err) {
                          console.warn(`Failed to read file ${m.fileId}`, err);
                      }
                  }
              }
              // New multi-files
              if (m.files && m.files.length > 0) {
                  const matFolder = m.files.length > 1 ? folder.folder(m.name) : folder;
                  for (const f of m.files) {
                      const blob = await getFile(f.id);
                      if (blob) {
                          try {
                              const arrayBuffer = await blob.arrayBuffer();
                              matFolder.file(f.name, arrayBuffer);
                              fileCount++;
                          } catch (err) {
                              console.warn(`Failed to read file ${f.id}`, err);
                          }
                      }
                  }
              }
          };

          for (const stage of matter.stages) {
              const stageFolder = rootFolder.folder(stage.title);
              if (!stageFolder) continue;

              for (const task of stage.tasks) {
                  const materialsToExport = task.materials.filter(m => {
                      if (!m.isReady) return false;
                      if (filterType === 'ALL') return true;
                      return m.category === filterType;
                  });

                  if (materialsToExport.length > 0) {
                      const taskFolder = stageFolder.folder(task.title);
                      if (taskFolder) {
                          for (const m of materialsToExport) {
                              await addFileToZip(taskFolder, m);
                          }
                      }
                  }
              }
          }

          if (fileCount === 0) {
              alert("没有找到可导出的文件");
              return;
          }

          const content = await zip.generateAsync({ type: "blob" });
          saveAs(content, `${matter.title}_${filterType}_Files.zip`);
      } catch (e) {
          console.error(e);
          alert("导出失败");
      } finally {
          setIsExporting(false);
      }
  };

  const getThemeIcon = () => {
    switch(theme) {
      case 'dark': return <Moon size={16} />;
      case 'light': return <Sun size={16} />;
      default: return <SunMoon size={16} />;
    }
  };

  const renderMobileStageSelector = () => (
      <div className="flex overflow-x-auto gap-2 p-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 scrollbar-hide shrink-0 shadow-sm">
          {matter.stages.map((stage, idx) => {
              const isSelected = selectedStageId === stage.id;
              const isEditing = editingStageId === stage.id;
              const isCompleted = isStageComplete(stage);

              if (isEditing) {
                  return (
                      <input 
                          key={stage.id}
                          autoFocus
                          value={editingStageName}
                          onChange={(e) => setEditingStageName(e.target.value)}
                          onBlur={saveStageName}
                          onKeyDown={(e) => e.key === 'Enter' && saveStageName()}
                          className="px-3 py-1.5 rounded-full text-xs font-medium border border-blue-600 bg-white text-slate-800 outline-none min-w-[100px]"
                      />
                  );
              }

              return (
                  <button
                      key={stage.id}
                      onClick={() => setSelectedStageId(stage.id)}
                      className={`
                          whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5
                          ${isSelected 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}
                      `}
                  >
                      {idx + 1}. {stage.title}
                      {isCompleted && !isSelected && (
                          <span className="text-emerald-500"><CheckCircle2 size={12} fill="currentColor" className="text-white dark:text-slate-800" /></span>
                      )}
                      {isSelected && (
                          <span 
                            onClick={(e) => {
                                e.stopPropagation();
                                startEditingStage(stage);
                            }}
                            className="bg-blue-500 rounded-full p-0.5 hover:bg-blue-400"
                          >
                             <Edit2 size={10} />
                          </span>
                      )}
                  </button>
              );
          })}
          
          {isAddingStage ? (
             <input 
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onBlur={() => {
                    if (newStageName.trim()) confirmAddStage();
                    else setIsAddingStage(false);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAddStage();
                    if (e.key === 'Escape') setIsAddingStage(false);
                }}
                placeholder="新阶段名称"
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-blue-400 bg-white outline-none min-w-[100px]"
             />
          ) : (
             <button onClick={() => setIsAddingStage(true)} className="px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500"><Plus size={14}/></button>
          )}
      </div>
  );

  return (
    <>
    {/* 
        DESKTOP LAYOUT 
    */}
    <div className="hidden md:block w-full h-screen bg-[#f8fafc] dark:bg-[#020617] overflow-hidden relative">
        
        {/* Absolute Header - Overlaps Content */}
        <header className="absolute top-0 left-0 right-0 h-16 z-50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
            <button onClick={goBack} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="h-5 w-[1px] bg-slate-300/50 dark:bg-slate-700"></div>
             
             {/* Title Rendering Logic ... */}
             {!isTemplateMode && (
                <div className="flex items-center gap-2 mr-2 shrink-0 group">
                     <div className="h-7 w-7 relative rounded-[22%] bg-black flex items-center justify-center overflow-hidden ring-1 ring-white/10">
                         <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                         <span className="text-white font-bold text-[11px] tracking-tighter z-10 relative top-[1px]">Or</span>
                     </div>
                </div>
             )}
             
             {isEditingTitle ? (
                <div className="flex flex-col w-full max-w-lg">
                    <input 
                      autoFocus
                      className="font-bold text-base text-slate-800 dark:text-slate-100 border-b border-blue-500 bg-transparent outline-none w-full"
                      value={editTitleVal}
                      onChange={(e) => setEditTitleVal(e.target.value)}
                      onBlur={() => { if(!isTemplateMode) saveHeaderInfo() }} 
                      onKeyDown={(e) => e.key === 'Enter' && saveHeaderInfo()}
                      placeholder="事项/模板标题"
                    />
                    {isTemplateMode && (
                         <input 
                           className="text-xs text-slate-500 dark:text-slate-400 bg-transparent outline-none mt-1 border-b border-slate-200 dark:border-slate-700 placeholder-slate-300 focus:border-blue-400"
                           value={editDescVal}
                           onChange={(e) => setEditDescVal(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && saveHeaderInfo()}
                           placeholder="输入模板适用说明..."
                        />
                    )}
                </div>
              ) : (
                <div className="flex flex-col overflow-hidden">
                  <h1 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base cursor-pointer" onClick={() => setIsEditingTitle(true)}>{matter.title}</h1>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      {isTemplateMode ? (
                          <span className="text-slate-500 cursor-pointer" onClick={() => setIsEditingTitle(true)}>{matter.type || "点击编辑适用说明"}</span>
                      ) : (
                          <div className="relative group flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 px-1.5 py-0.5 rounded -ml-1.5 transition-colors cursor-pointer">
                              <Clock size={10} />
                              <span>{matter.dueDate ? `截止: ${new Date(matter.dueDate).toLocaleDateString()}` : '设置截止时间'}</span>
                              <input 
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                value={matter.dueDate ? new Date(matter.dueDate).toISOString().split('T')[0] : ''}
                                onChange={handleDueDateChange}
                              />
                          </div>
                      )}
                  </div>
                </div>
              )}
          </div>

          <div className="flex items-center gap-2">
             <button onClick={() => onThemeChange && onThemeChange(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                {getThemeIcon()}
            </button>
            
             {isTemplateMode && isEditingTitle && (
                <button 
                  onClick={saveHeaderInfo}
                  className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200"
                >
                    <Check size={16} />
                </button>
             )}

             {!isTemplateMode && (
                <div className="hidden md:block relative z-50">
                    <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-md">
                        <Download size={14} /> 下载
                    </button>
                    {showExportMenu && (
                        <div className="absolute right-0 top-10 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-100 dark:border-slate-700 z-50 flex flex-col py-1 animate-fadeIn">
                             <button onClick={() => exportMaterials('ALL')} className="text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">全部下载</button>
                             <div className="h-[1px] bg-slate-100 dark:bg-slate-700 mx-2"></div>
                             <button onClick={() => exportMaterials('REFERENCE')} className="text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">仅参考模板</button>
                             <button onClick={() => exportMaterials('DELIVERABLE')} className="text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">仅交付产物</button>
                        </div>
                    )}
                </div>
            )}
            
            {isTemplateMode ? (
                <button 
                  onClick={() => onSaveTemplate(matter)} 
                  className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm transition-colors"
                >
                    <Save size={14} /> 保存修改
                </button>
            ) : (
                <button onClick={() => onSaveTemplate(matter)} className="hidden md:block text-xs font-medium text-slate-600 dark:text-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md">
                    另存模板
                </button>
            )}
            
            {!isTemplateMode && (
                <>
                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                    <button 
                        onClick={() => {
                        const isArchived = !matter.archived;
                        onUpdate({...matter, archived: isArchived});
                        if(isArchived) onBack();
                        }}
                        className={`p-1.5 rounded-md transition-colors hidden md:block ${matter.archived ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title={matter.archived ? "已归档" : "归档"}
                    >
                        <Archive size={18} />
                    </button>
                </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="flex w-full h-full pt-0 relative">
            
            {/* Col 1: Stages */}
            <div style={{ width: col1Width }} className="bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
                <div className="h-full overflow-y-auto pt-16">
                    <div className="sticky top-0 z-10 h-14 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur px-4 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50">
                        <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">阶段</span>
                        <button onClick={() => setIsAddingStage(true)}><Plus size={16}/></button>
                    </div>
                    <div className="px-2 space-y-1 pb-10 mt-2">
                        {matter.stages.map((stage, idx) => {
                            const isEditing = editingStageId === stage.id;
                            const isCompleted = isStageComplete(stage);

                            return (
                                <div 
                                    key={stage.id} 
                                    draggable={!isEditing}
                                    onDragStart={(e) => handleDragStart(e, 'STAGE', stage.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, 'STAGE', stage.id)}
                                    onClick={() => { setSelectedStageId(stage.id); setSelectedTaskId(null); }} 
                                    className={`group p-2.5 rounded cursor-pointer text-sm font-medium relative flex items-center justify-between transition-all border
                                        ${selectedStageId === stage.id ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 border-transparent' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
                                        ${dragItem?.id === stage.id ? 'opacity-50 border-dashed border-blue-400' : ''}
                                    `}
                                >
                                    <div className="flex-1 min-w-0 truncate flex items-center gap-2">
                                        <GripVertical size={12} className="text-slate-300 dark:text-slate-600 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="opacity-50 text-xs">{idx + 1}.</span>
                                        {isEditing ? (
                                            <input 
                                                autoFocus
                                                className="w-full bg-white dark:bg-slate-700 border border-blue-400 rounded px-1 py-0.5 outline-none text-slate-800 dark:text-slate-100"
                                                value={editingStageName}
                                                onChange={(e) => setEditingStageName(e.target.value)}
                                                onBlur={saveStageName}
                                                onKeyDown={(e) => e.key === 'Enter' && saveStageName()}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span onDoubleClick={(e) => { e.stopPropagation(); startEditingStage(stage); }} className="truncate">
                                                {stage.title}
                                            </span>
                                        )}
                                        {isCompleted && !isEditing && (
                                            <div className="ml-auto pr-1">
                                                <CheckCircle2 size={14} className="text-emerald-500 fill-emerald-100 dark:fill-emerald-900" />
                                            </div>
                                        )}
                                    </div>
                                    {!isEditing && (
                                        <div className="hidden group-hover:flex items-center gap-1 bg-inherit">
                                            <button onClick={(e) => { e.stopPropagation(); startEditingStage(stage); }} className="p-1 hover:text-blue-500"><Edit2 size={12}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteStage(stage.id); }} className="p-1 hover:text-red-500"><Trash2 size={12}/></button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {isAddingStage && (
                            <div className="p-2">
                                <input 
                                    ref={newStageInputRef}
                                    className="w-full bg-white dark:bg-slate-800 border border-blue-400 rounded px-2 py-1 text-sm outline-none"
                                    placeholder="输入阶段名称"
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    onKeyDown={(e) => { if(e.key === 'Enter') confirmAddStage(); if(e.key === 'Escape') setIsAddingStage(false); }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Resizer 1 */}
            <div 
                className="w-1 cursor-col-resize bg-transparent hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors z-20 shrink-0"
                onMouseDown={(e) => handleColResizeStart(e, 1)}
            />

            {/* Col 2: Tasks */}
            <div style={{ width: col2Width }} className="bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full overflow-hidden shrink-0">
                <div className="h-full overflow-y-auto pt-16">
                    <div className="h-14 px-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur z-10">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{activeStage?.title}</span>
                        <button onClick={addTask} disabled={!selectedStageId} className="text-xs bg-slate-900 text-white px-2 py-1 rounded"><Plus size={12}/></button>
                    </div>
                    <div className="pb-10">
                        {activeStage?.tasks.map((task, idx) => {
                            const isEditing = editingTaskId === task.id;
                            return (
                                <div 
                                    key={task.id} 
                                    draggable={!isEditing}
                                    onDragStart={(e) => handleDragStart(e, 'TASK', task.id, activeStage.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, 'TASK', task.id, activeStage.id)}
                                    onClick={() => setSelectedTaskId(task.id)} 
                                    className={`group p-4 border-b border-slate-50 dark:border-slate-700 cursor-pointer relative transition-all flex items-start gap-2
                                        ${selectedTaskId === task.id ? 'bg-blue-50/50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : 'hover:bg-slate-50 dark:hover:bg-slate-700 border-l-4 border-l-transparent'}
                                        ${dragItem?.id === task.id ? 'opacity-50 bg-blue-50' : ''}
                                    `}
                                >
                                    <div className="mt-1 shrink-0">
                                        <GripVertical size={12} className="text-slate-300 dark:text-slate-600 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <StatusBadge status={task.status} />
                                            {!isEditing && (
                                                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                                                    <button onClick={(e) => { e.stopPropagation(); startEditingTask(task); }} className="p-1 hover:text-blue-500"><Edit2 size={12}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteTask(activeStage!.id, task.id); }} className="p-1 hover:text-red-500"><Trash2 size={12}/></button>
                                                </div>
                                            )}
                                        </div>
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className="w-full bg-white dark:bg-slate-700 border border-blue-400 rounded px-1 py-0.5 outline-none text-slate-800 dark:text-slate-100 text-sm font-medium"
                                                value={editingTaskName}
                                                onChange={(e) => setEditingTaskName(e.target.value)}
                                                onBlur={saveTaskName}
                                                onKeyDown={(e) => e.key === 'Enter' && saveTaskName()}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200" onDoubleClick={(e) => { e.stopPropagation(); startEditingTask(task); }}>
                                                {task.title}
                                            </div>
                                        )}
                                        {task.description && (
                                            <div className="text-xs text-slate-400 truncate mt-0.5">{task.description}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Resizer 2 */}
            <div 
                className="w-1 cursor-col-resize bg-transparent hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors z-20 shrink-0"
                onMouseDown={(e) => handleColResizeStart(e, 2)}
            />

            {/* Col 3: Details / Timeline */}
            <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden min-w-[300px]">
                <div className="h-full overflow-y-auto pt-16">
                    {activeTask ? (
                        <div className="min-h-full">
                            <TaskDetailPane task={activeTask} matterDueDate={matter.dueDate} onUpdate={handleTaskUpdate} onDelete={() => deleteTask(activeStage!.id, activeTask.id)} isTemplateMode={isTemplateMode} />
                        </div>
                    ) : (
                        <div className="h-full">
                            <JudgmentTimeline matter={matter} allMatters={allMatters} onUpdate={onUpdate} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>

    {/* MOBILE LAYOUT ... (Existing Mobile Layout) */}
    <div className="md:hidden w-full h-screen flex flex-col bg-white dark:bg-slate-950 overflow-hidden fixed inset-0">
        {/* ... Header ... */}
        <header className="shrink-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 flex items-center justify-between z-50">
            {/* Same as desktop header mostly, omitted for brevity as change is focused on logic */}
            <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
            <button onClick={goBack} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="h-5 w-[1px] bg-slate-300/50 dark:bg-slate-700"></div>
             
             {/* ... */}
             
             {isEditingTitle ? (
                <input 
                  autoFocus
                  className="font-bold text-base text-slate-800 dark:text-slate-100 border-b border-blue-500 bg-transparent outline-none w-full"
                  value={editTitleVal}
                  onChange={(e) => setEditTitleVal(e.target.value)}
                  onBlur={saveHeaderInfo}
                  onKeyDown={(e) => e.key === 'Enter' && saveHeaderInfo()}
                />
              ) : (
                <div className="flex flex-col overflow-hidden">
                  <h1 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base cursor-pointer" onClick={() => setIsEditingTitle(true)}>{matter.title}</h1>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      {isTemplateMode ? (
                          <span className="text-blue-500 font-medium">模板编辑模式</span>
                      ) : (
                          <div className="relative group flex items-center gap-1">
                              <Clock size={10} />
                              <span>{matter.dueDate ? `截止: ${new Date(matter.dueDate).toLocaleDateString()}` : '设置截止时间'}</span>
                              <input 
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                value={matter.dueDate ? new Date(matter.dueDate).toISOString().split('T')[0] : ''}
                                onChange={handleDueDateChange}
                              />
                          </div>
                      )}
                  </div>
                </div>
              )}
          </div>

          <div className="flex items-center gap-2">
             <button onClick={() => onThemeChange && onThemeChange(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                {getThemeIcon()}
            </button>
            
            {isTemplateMode ? (
                <button 
                  onClick={() => onSaveTemplate(matter)} 
                  className="p-2 text-blue-600 dark:text-blue-400 font-bold text-xs bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                >
                    <Save size={18} />
                </button>
            ) : (
                <button onClick={() => onSaveTemplate(matter)} className="hidden md:block text-xs font-medium text-slate-600 dark:text-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md">
                    另存模板
                </button>
            )}
          </div>
        </header>

        {/* Top Panel (Stages + Tasks) */}
        <div 
            className="shrink-0 bg-white/95 dark:bg-slate-950/95 shadow-sm overflow-y-auto flex flex-col"
            style={{ height: `${topPanelHeightVh}vh` }}
        >
                {renderMobileStageSelector()}
                
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {activeStage ? `${activeStage.tasks.length} 个任务` : '请选择阶段'}
                    </span>
                    <button onClick={addTask} disabled={!selectedStageId} className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                        <Plus size={12} /> 任务
                    </button>
                </div>

                <div className="p-2 space-y-2 bg-slate-50/30 dark:bg-slate-900 flex-1">
                    {activeStage?.tasks.length === 0 && <div className="text-center py-8 text-slate-400 text-xs">暂无任务</div>}
                    {activeStage?.tasks.map((task) => (
                        <div 
                            key={task.id} 
                            onClick={() => setSelectedTaskId(task.id)}
                            className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm flex items-start gap-3 active:scale-[0.98] transition-transform"
                        >
                            <div className={`w-1 self-stretch rounded-full ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-400' : task.status === TaskStatus.BLOCKED ? 'bg-amber-400' : 'bg-blue-400'}`}></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{task.title}</div>
                                    <StatusBadge status={task.status} className="scale-90 origin-right" />
                                </div>
                                <div className="text-xs text-slate-400 truncate">{task.description || '无描述'}</div>
                            </div>
                        </div>
                    ))}
                </div>
        </div>

        {/* Resize Handle */}
        <div 
            ref={resizeRef}
            className="shrink-0 z-40 h-5 bg-slate-50 dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-row-resize touch-none shadow-sm"
            onMouseDown={handleMobileResizeStart}
            onTouchStart={handleMobileResizeStart}
        >
            <GripHorizontal size={16} className="text-slate-400" />
        </div>

        {/* Bottom Panel (Timeline) */}
        <div className="flex-1 overflow-y-auto bg-transparent relative z-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
             <JudgmentTimeline matter={matter} allMatters={allMatters} onUpdate={onUpdate} />
        </div>

        {/* TASK DETAIL OVERLAY */}
        {selectedTaskId && activeTask && (
            <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-950 flex flex-col animate-slideUp w-full h-[100vh] overflow-hidden">
                <div className="h-14 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur shrink-0 pt-[env(safe-area-inset-top)]">
                    <button onClick={() => setSelectedTaskId(null)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <span className="ml-2 font-bold text-slate-800 dark:text-white truncate flex-1">任务详情</span>
                </div>
                <div className="flex-1 overflow-y-auto touch-auto pb-[env(safe-area-inset-bottom)]">
                    <TaskDetailPane 
                        task={activeTask} 
                        matterDueDate={matter.dueDate} 
                        onUpdate={handleTaskUpdate} 
                         onDelete={() => deleteTask(activeStage!.id, activeTask.id)} 
                        isTemplateMode={isTemplateMode} 
                    />
                </div>
            </div>
        )}
    </div>
    </>
  );
};

export default MatterBoard;