import React, { useState, useEffect } from 'react';
import { Matter, TaskStatus, Task, Stage, AIWorkStatusResult } from '../types';
import { 
  Plus, CheckCircle, AlertOctagon, Calendar, Trash2, LayoutTemplate, 
  ArrowRight, AlertCircle, Clock, Activity, CheckSquare, X, Archive,
  Moon, Sun, SunMoon, Database, ChevronDown, ChevronUp, PieChart, EyeOff,
  BrainCircuit, RefreshCw, Sparkles, Settings, ListTodo, Circle, History, CheckCircle2, Gauge
} from 'lucide-react';
import { analyzeWorkStatus } from '../services/aiAnalysisService';

interface Props {
  matters: Matter[];
  onSelectMatter: (id: string) => void;
  onJumpToTask: (matterId: string, taskId: string) => void;
  onNewMatter: () => void;
  onOpenTemplateManager: () => void;
  onDeleteMatter: (id: string) => void;
  onUpdateMatter: (m: Matter) => void; 
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (t: 'light' | 'dark' | 'system') => void;
  notifPermission: NotificationPermission;
  onRequestNotif: () => void;
  onOpenSettings: () => void;
}

interface AttentionMatterGroup {
  matter: Matter;
  tasks: { task: Task; stage: Stage; type: 'blocked' | 'exception' }[];
  isOverdue: boolean;
  daysLeft?: number;
}

const DASHBOARD_AI_KEY = 'opus_dashboard_ai_v1';

// Reusable Matter Card Component
const MatterCard: React.FC<{
  m: Matter;
  type: 'normal' | 'completed' | 'archived';
  onSelectMatter: (id: string) => void;
  onDeleteMatter: (id: string) => void;
  hasAttention: boolean;
}> = ({ m, type, onSelectMatter, onDeleteMatter, hasAttention }) => {
  const allTasks = m.stages.flatMap(s => s.tasks);
  const completed = allTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const total = allTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const daysLeft = m.dueDate ? Math.ceil((m.dueDate - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  // Visual style based on type
  let containerClass = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 shadow-sm hover:shadow-md";
  if (type === 'completed') {
    containerClass = "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 shadow-sm";
  } else if (type === 'archived') {
    containerClass = "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all";
  }

  return (
    <div 
      onClick={() => onSelectMatter(m.id)}
      className={`
        p-5 rounded-xl border cursor-pointer group relative flex flex-col h-full transition-all duration-300
        ${containerClass}
      `}
    >
      <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
         <button 
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation(); 
              onDeleteMatter(m.id); 
            }}
            className="h-8 w-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors bg-white/80 dark:bg-slate-800/80 shadow-sm border border-slate-100 dark:border-slate-700"
            title="删除事项"
         >
            <Trash2 size={16} />
         </button>
      </div>

      <div className="flex justify-between items-start mb-3">
         <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">{m.title}</h3>
                {hasAttention && type === 'normal' && (
                    <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        <AlertCircle size={10} /> 待关注
                    </span>
                )}
                {type === 'archived' && (
                    <span className="shrink-0 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
                        已归档
                    </span>
                )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.type}</p>
         </div>
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 dark:text-slate-400">总体进度</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{progress}%</span>
        </div>
        <div className="w-full bg-slate-200/50 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div className={`h-1.5 rounded-full ${type === 'completed' ? 'bg-emerald-500' : type === 'archived' ? 'bg-slate-400' : 'bg-slate-800 dark:bg-slate-200'}`} style={{ width: `${progress}%` }}></div>
        </div>
        
        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
           <div className="flex items-center gap-1">
             <CheckCircle size={12}/> {completed}/{total} 任务
           </div>
           {m.dueDate && type !== 'archived' && (
             <div className={`flex items-center gap-1 ${daysLeft! < 0 ? 'text-red-500 font-bold' : daysLeft! <= 7 ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}>
                <Calendar size={12} /> 
                {daysLeft! < 0 ? `逾期 ${Math.abs(daysLeft!)} 天` : daysLeft === 0 ? '今天到期' : `${daysLeft} 天后`}
             </div>
           )}
        </div>
      </div>
    </div>
   );
};

const AttentionGroupCard: React.FC<{
  group: AttentionMatterGroup;
  onSelectMatter: (id: string) => void;
  onJumpToTask: (matterId: string, taskId: string) => void;
  onDismissTask: (taskId: string) => void;
}> = ({ group, onSelectMatter, onJumpToTask, onDismissTask }) => {
  return (
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900 shadow-sm flex flex-col h-full relative overflow-hidden hover:shadow-md transition-all group"
      >
         <div className="bg-amber-50/50 dark:bg-amber-900/20 p-3 border-b border-amber-100 dark:border-amber-900/50 flex justify-between items-start cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors" onClick={() => onSelectMatter(group.matter.id)}>
            <div className="pr-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">急需关注</div>
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{group.matter.title}</div>
            </div>
            {group.isOverdue && (
                <div className="flex items-center gap-1 text-red-500 text-xs font-bold bg-white dark:bg-slate-700 px-2 py-1 rounded-full shadow-sm shrink-0">
                    <Clock size={12} /> {group.daysLeft && group.daysLeft < 0 ? `逾期 ${Math.abs(group.daysLeft)} 天` : '即将到期'}
                    <button 
                         onClick={(e) => { e.stopPropagation(); onDismissTask('OVERDUE'); }}
                         className="ml-1 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                         title="忽略此临期提醒"
                    >
                         <EyeOff size={10} />
                    </button>
                </div>
            )}
         </div>
         
         <div className="p-3 space-y-2 flex-1 bg-white dark:bg-slate-800">
            {group.tasks.length > 0 ? (
                group.tasks.map((item, idx) => (
                    <div 
                        key={idx} 
                        className={`
                            p-2 rounded border flex items-center gap-2 transition-all hover:shadow-sm
                            ${item.type === 'blocked' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200'}
                        `}
                    >
                        <div 
                             className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
                             onClick={() => onJumpToTask(group.matter.id, item.task.id)}
                        >
                            {item.type === 'blocked' ? <AlertOctagon size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold truncate">{item.task.title}</div>
                                <div className="text-[10px] opacity-70 truncate">{item.stage.title}</div>
                            </div>
                        </div>
                        
                        <button 
                             onClick={(e) => { e.stopPropagation(); onDismissTask(item.task.id); }}
                             className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/5 rounded-full transition-colors shrink-0"
                             title="忽略此提醒"
                        >
                             <EyeOff size={14} />
                        </button>
                    </div>
                ))
            ) : (
                <div className="text-xs text-slate-400 italic p-2">仅因临期提醒</div>
            )}
         </div>
         
         <div 
            onClick={() => onSelectMatter(group.matter.id)}
            className="p-2 text-center bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer font-medium transition-colors"
         >
            查看详情
         </div>
      </div>
  )
};

const DetailedStatCard = ({ label, matters, icon: Icon, color, count }: any) => {
    const breakdown = matters.reduce((acc: any, m: Matter) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
    }, {});
    const sortedTypes = Object.entries(breakdown).sort((a: any, b: any) => b[1] - a[1]);

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-full">
             <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${color} bg-opacity-10 dark:bg-opacity-20`}>
                    <Icon size={18} className={color.replace('bg-', 'text-').replace('500', '600 dark:text-400')} />
                </div>
                <div className="flex-1">
                    <div className="text-2xl font-bold text-slate-800 dark:text-white leading-none">{count}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">{label}</div>
                </div>
             </div>
             
             <div className="flex-1 space-y-1.5">
                 {sortedTypes.length > 0 ? (
                     sortedTypes.map(([type, c]: any) => (
                         <div key={type} className="flex justify-between items-center text-xs">
                             <span className="text-slate-600 dark:text-slate-300 truncate pr-2 flex-1" title={type}>{type}</span>
                             <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold text-[10px] min-w-[20px] text-center">{c}</span>
                         </div>
                     ))
                 ) : (
                     <div className="text-xs text-slate-300 dark:text-slate-600 italic mt-2">暂无数据</div>
                 )}
             </div>
        </div>
    );
};

// Pressure Gauge Component for Workload
const WorkloadGauge = ({ workloadText }: { workloadText: string }) => {
    // Determine level based on keywords
    let level = 20; // Default Low
    let color = '#10b981'; // Emerald
    let label = '正常负荷';

    if (workloadText.match(/高|重|满|险|多|大|紧/)) {
        level = 85;
        color = '#ef4444'; // Red
        label = '高负荷';
    } else if (workloadText.match(/中|适|稳|常/)) {
        level = 50;
        color = '#f59e0b'; // Amber
        label = '中等负荷';
    } else {
        label = '低负荷';
    }

    // Gauge geometry
    const radius = 35;
    const stroke = 6;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const offset = circumference - (level / 100) * (circumference / 2); // Only show half circle logic roughly

    // Semi-circle SVG path (M startX startY A radius radius 0 0 1 endX endY)
    // Center at 50, 50. Radius 35. 
    // Start at 15, 50. End at 85, 50.
    
    // Simple rotation based needle approach
    const needleRotation = -90 + (level / 100) * 180;

    return (
        <div className="flex flex-col items-center justify-center h-full pt-1">
            <div className="relative w-24 h-14 overflow-hidden">
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-[8px] border-slate-100 dark:border-slate-700"></div>
                {/* Colored Arc - simulated by rotation or CSS conic gradient is easier, but here we use simple style */}
                <div 
                    className="absolute top-0 left-0 w-24 h-24 rounded-full border-[8px] border-transparent transition-all duration-1000 ease-out"
                    style={{ 
                        borderTopColor: color, 
                        borderRightColor: level > 50 ? color : 'transparent',
                        transform: `rotate(-45deg)` // Simplified visual representation
                    }}
                ></div>
                
                {/* Needle */}
                <div 
                    className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-800 dark:bg-white origin-bottom rounded-full transition-all duration-1000 ease-out shadow-sm z-10"
                    style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
                ></div>
                <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-slate-800 dark:bg-white rounded-full -translate-x-1/2 translate-y-1/2 z-20"></div>
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-300 text-center">
                <span style={{ color: color }} className="mr-1">●</span> {label}
            </div>
        </div>
    );
};

const Dashboard: React.FC<Props> = ({ 
  matters, 
  onSelectMatter, 
  onJumpToTask,
  onNewMatter, 
  onOpenTemplateManager,
  onDeleteMatter,
  onUpdateMatter,
  theme,
  onThemeChange,
  notifPermission,
  onRequestNotif,
  onOpenSettings
}) => {
  const now = Date.now();
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  // AI State
  const [aiResult, setAiResult] = useState<AIWorkStatusResult | null>(null);
  const [aiHistory, setAiHistory] = useState<AIWorkStatusResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAiExpanded, setIsAiExpanded] = useState(true);
  const [showAiHistory, setShowAiHistory] = useState(false);

  useEffect(() => {
      const saved = localStorage.getItem(DASHBOARD_AI_KEY);
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              // Handle legacy single object storage by converting to array
              if (Array.isArray(parsed)) {
                  setAiHistory(parsed);
                  if (parsed.length > 0) setAiResult(parsed[0]);
              } else {
                  setAiHistory([parsed]);
                  setAiResult(parsed);
              }
          } catch(e) { console.error(e); }
      }
  }, []);

  const activeMatters = matters.filter(m => !m.archived);
  const archivedMatters = matters.filter(m => m.archived);
  const completedActiveMatters = activeMatters.filter(m => 
    m.stages.length > 0 && m.stages.every(s => s.tasks.every(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED))
  );
  // Sort In Progress Matters: 1. Due Date (ASC, null last), 2. Last Updated (DESC)
  const inProgressMatters = activeMatters
    .filter(m => !completedActiveMatters.some(cm => cm.id === m.id))
    .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.lastUpdated - a.lastUpdated;
    });

  const groupedInProgressMatters = inProgressMatters.reduce((acc, m) => {
      const type = m.type || '未分类';
      if (!acc[type]) acc[type] = [];
      acc[type].push(m);
      return acc;
  }, {} as Record<string, Matter[]>);

  const handleAnalyze = async () => {
      if (inProgressMatters.length === 0) {
          alert("暂无进行中的事项可供分析");
          return;
      }
      setIsAnalyzing(true);
      setShowAiHistory(false);
      const res = await analyzeWorkStatus(inProgressMatters);
      if (res) {
          setAiResult(res);
          const newHistory = [res, ...aiHistory].slice(0, 20); // Keep last 20 records
          setAiHistory(newHistory);
          localStorage.setItem(DASHBOARD_AI_KEY, JSON.stringify(newHistory));
          setIsAiExpanded(true);
      }
      setIsAnalyzing(false);
  };

  const handleRestoreHistory = (record: AIWorkStatusResult) => {
      setAiResult(record);
      setShowAiHistory(false);
  };

  const handleToggleActionItem = (idx: number) => {
      if (!aiResult) return;
      const currentCompleted = aiResult.completedActionIndices || [];
      let newCompleted;
      
      if (currentCompleted.includes(idx)) {
          newCompleted = currentCompleted.filter(i => i !== idx);
      } else {
          newCompleted = [...currentCompleted, idx];
      }

      const updatedResult = { ...aiResult, completedActionIndices: newCompleted };
      
      // Update state
      setAiResult(updatedResult);
      
      // Update history and storage
      const updatedHistory = aiHistory.map(h => h.timestamp === updatedResult.timestamp ? updatedResult : h);
      setAiHistory(updatedHistory);
      localStorage.setItem(DASHBOARD_AI_KEY, JSON.stringify(updatedHistory));
  };

  const attentionGroups: AttentionMatterGroup[] = [];
  inProgressMatters.forEach(m => {
    const ignored = m.dismissedAttentionIds || [];
    const tasks: { task: Task; stage: Stage; type: 'blocked' | 'exception' }[] = [];
    let isOverdue = false;
    let daysLeft = undefined;
    if (m.dueDate) {
        daysLeft = Math.ceil((m.dueDate - now) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7 && !ignored.includes('OVERDUE')) {
            isOverdue = true;
        }
    }
    m.stages.forEach(s => {
        s.tasks.forEach(t => {
            if (ignored.includes(t.id)) return;
            if (t.status === TaskStatus.BLOCKED) tasks.push({ task: t, stage: s, type: 'blocked' });
            else if (t.status === TaskStatus.EXCEPTION) tasks.push({ task: t, stage: s, type: 'exception' });
        });
    });
    if (isOverdue || tasks.length > 0) attentionGroups.push({ matter: m, tasks, isOverdue, daysLeft });
  });

  const handleDismissTask = (matter: Matter, taskId: string) => {
     if (!confirm("确定不再提示此项吗？")) return;
     const currentIgnored = matter.dismissedAttentionIds || [];
     const newIgnored = [...currentIgnored, taskId];
     const uniqueIgnored = Array.from(new Set(newIgnored));
     onUpdateMatter({ ...matter, dismissedAttentionIds: uniqueIgnored, lastUpdated: Date.now() });
  };

  const statInProgressMatters = inProgressMatters.length;
  const statUrgentMatters = attentionGroups.length;
  const statCompletedMatters = completedActiveMatters.length;
  const statArchivedMatters = archivedMatters.length;

  const renderMiniList = (list: Matter[], type: 'completed' | 'archived') => {
      if (list.length === 0) return <div className="p-4 text-center text-xs text-slate-400">列表为空</div>;
      return (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl mt-2 border border-slate-100 dark:border-slate-800">
              {list.map(m => {
                    const allTasks = m.stages.flatMap(s => s.tasks);
                    const completed = allTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                    const total = allTasks.length;
                    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                        <div key={m.id} onClick={() => onSelectMatter(m.id)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{m.title}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{m.type}</div>
                                </div>
                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${type === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{progress}%</div>
                            </div>
                            <div className="text-xs text-slate-400 flex justify-between mt-2">
                                <span>{completed}/{total} 任务</span>
                                <span>{new Date(m.lastUpdated).toLocaleDateString()}</span>
                            </div>
                        </div>
                    )
              })}
         </div>
      );
  }

  const getThemeIcon = () => {
    switch(theme) {
      case 'dark': return <Moon size={16} />;
      case 'light': return <Sun size={16} />;
      default: return <SunMoon size={16} />;
    }
  };

  return (
    // Natural flow layout for body scroll
    <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-[#020617] flex flex-col">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 h-16 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between px-6 transition-all duration-300">
        <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 group cursor-default">
                 <div className="h-9 w-9 relative rounded-[22%] bg-gradient-to-br from-slate-700 to-black shadow-lg shadow-slate-300/50 dark:shadow-black/50 flex items-center justify-center overflow-hidden ring-1 ring-white/20 transition-transform group-hover:scale-105">
                     <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent"></div>
                     <span className="text-white font-black text-sm tracking-tighter z-10">Or</span>
                 </div>
                 <span className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Orbit</span>
             </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { if(theme === 'system') onThemeChange('light'); else if(theme === 'light') onThemeChange('dark'); else onThemeChange('system'); }} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">{getThemeIcon()}</button>
          <button onClick={onOpenSettings} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"><Settings size={16} /></button>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
          <button onClick={onOpenTemplateManager} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800 transition-colors font-medium text-xs border border-transparent hover:border-slate-200/50"><LayoutTemplate size={14} /> <span className="hidden md:inline">模板管理</span></button>
          <button onClick={onNewMatter} className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-white/90 transition-colors shadow-lg shadow-slate-200 dark:shadow-none font-medium text-sm"><Plus size={18} /> <span className="hidden md:inline">新建事项</span></button>
        </div>
      </header>
      
      {/* Content flows naturally. pb-safe ensures bottom content isn't covered by Home Indicator */}
      <div className="flex-1 max-w-7xl mx-auto p-6 w-full pb-[calc(2rem+env(safe-area-inset-bottom))]">
            
            {/* AI Module */}
            <div className="mb-6 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-indigo-50/50 to-white/50 dark:from-indigo-950/20 dark:to-slate-900/50 overflow-hidden shadow-sm transition-all hover:shadow-md">
                <div className="px-4 py-3 flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-900/50">
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={18} className="text-indigo-600 dark:text-indigo-400" />
                        <h2 className="font-bold text-slate-800 dark:text-slate-100">AI 工作态势速览</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {aiResult && !isAnalyzing && <span className="text-[10px] text-slate-400 hidden sm:inline">更新于: {new Date(aiResult.timestamp).toLocaleTimeString()}</span>}
                        {aiHistory.length > 1 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowAiHistory(!showAiHistory); setIsAiExpanded(true); }}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${showAiHistory ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white/50 text-slate-500 border-transparent hover:bg-white hover:text-indigo-600'}`}
                            >
                                <History size={12} /> <span className="hidden sm:inline">历史记录</span>
                            </button>
                        )}
                        <button onClick={handleAnalyze} disabled={isAnalyzing} className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors disabled:opacity-50"><RefreshCw size={14} className={isAnalyzing ? 'animate-spin' : ''} /></button>
                        <button onClick={() => setIsAiExpanded(!isAiExpanded)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">{isAiExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
                    </div>
                </div>
                <div className={`transition-all duration-300 ease-in-out ${isAiExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    
                    {/* History View */}
                    {showAiHistory && !isAnalyzing ? (
                        <div className="p-4 bg-white/50 dark:bg-slate-900/50">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">历史分析记录 ({aiHistory.length})</h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {aiHistory.map((hist, idx) => (
                                    <div key={hist.timestamp} 
                                         onClick={() => handleRestoreHistory(hist)}
                                         className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors flex justify-between items-center group"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{new Date(hist.timestamp).toLocaleString()}</span>
                                                {idx === 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Latest</span>}
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{hist.overview}</p>
                                        </div>
                                        <ChevronDown size={14} className="text-slate-300 group-hover:text-indigo-500 -rotate-90" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : aiResult ? (
                        <div className="p-0">
                             {/* Overview Grid - Refactored to 4 Cols Row on Large Screens */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-indigo-100 dark:divide-indigo-900/50">
                                 <div className="p-4 lg:p-5">
                                     <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">整体情况</h4>
                                     <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm font-medium">{aiResult.overview}</p>
                                 </div>
                                 <div className="p-4 lg:p-5 flex flex-col">
                                     <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">工作负荷</h4>
                                     {aiResult.workload ? (
                                         <WorkloadGauge workloadText={aiResult.workload} />
                                     ) : (
                                         <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">暂无显著负荷风险</p>
                                     )}
                                 </div>
                                 <div className="p-4 lg:p-5">
                                     <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">主要受阻</h4>
                                     {aiResult.blockerTypes.length > 0 ? (
                                         <div className="flex flex-col gap-2">{aiResult.blockerTypes.map((b, i) => (<div key={i} className="flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10 px-2 py-1.5 rounded border border-amber-100 dark:border-amber-900/30"><span className="text-amber-800 dark:text-amber-200 font-medium text-xs">{b.tag}</span><span className="text-[10px] font-bold bg-white dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full text-amber-600 dark:text-amber-400">{b.count}</span></div>))}</div>
                                     ) : (<div className="text-slate-400 italic text-sm">暂无明显受阻归类</div>)}
                                 </div>
                                 <div className="p-4 lg:p-5">
                                     <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">更新节奏</h4>
                                     <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">{aiResult.updateRhythm}</p>
                                 </div>
                             </div>
                             
                             {/* Action Plan Section - Interactive & Compact & Single Column */}
                             {aiResult.actionPlan && (
                                <div className="border-t border-indigo-100 dark:border-indigo-900 p-4 lg:px-5 bg-white/40 dark:bg-white/5">
                                    <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <ListTodo size={16}/> 建议工作任务计划 (近期)
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {aiResult.actionPlan.split('\n').filter(line => line.trim().length > 0).map((line, idx) => {
                                            const isCompleted = (aiResult.completedActionIndices || []).includes(idx);
                                            // Parse [Matter Name] if exists
                                            const match = line.match(/^\[(.*?)\](.*)/);
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => handleToggleActionItem(idx)}
                                                    className={`
                                                        flex items-start gap-3 p-2 rounded-lg transition-all cursor-pointer group border
                                                        ${isCompleted 
                                                            ? 'bg-slate-50 dark:bg-slate-800/30 border-transparent opacity-60' 
                                                            : 'bg-white dark:bg-slate-900 border-indigo-50 dark:border-indigo-900/30 hover:border-indigo-200 shadow-sm hover:shadow-md'
                                                        }
                                                    `}
                                                >
                                                    <div className={`mt-0.5 shrink-0 transition-colors ${isCompleted ? 'text-emerald-500' : 'text-indigo-300 group-hover:text-indigo-500'}`}>
                                                        {isCompleted ? <CheckCircle2 size={16} className="fill-emerald-100 dark:fill-emerald-900"/> : <Circle size={16} />}
                                                    </div>
                                                    
                                                    <div className={`text-sm leading-snug transition-all flex-1 ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {match ? (
                                                            <>
                                                                <span className="inline-block bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded px-1.5 py-0.5 text-xs font-bold mr-2 mb-1 lg:mb-0">
                                                                    {match[1]}
                                                                </span>
                                                                {match[2]}
                                                            </>
                                                        ) : (
                                                            // Remove numbering if any (e.g. 1. Task)
                                                            line.replace(/^\d+[\.|,|、]\s*/, '')
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                             )}

                             <div className="text-center py-2 bg-indigo-50/30 dark:bg-indigo-900/10 border-t border-indigo-50 dark:border-indigo-900/30">
                                 <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                                     <Sparkles size={10} /> AI 辅助分析，仅用于工作态势参考
                                 </span>
                             </div>
                        </div>
                    ) : (<div className="p-8 text-center text-slate-400 text-sm"><div className="mb-2">点击刷新按钮生成当前工作态势分析</div><div className="text-xs opacity-60">AI 将归纳所有事项状态，辅助您快速看清全局。</div></div>)}
                </div>
            </div>

            {/* Stats */}
            <div className="mb-8 mt-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 items-stretch">
                     <DetailedStatCard label="正在推进" matters={inProgressMatters} count={statInProgressMatters} icon={Activity} color="bg-blue-500" />
                     <DetailedStatCard label="急需关注" matters={attentionGroups.map(g => g.matter)} count={statUrgentMatters} icon={AlertCircle} color="bg-amber-500" />
                 </div>
                 <div className="flex flex-col gap-2">
                     <div className="bg-transparent">
                         <button onClick={() => setShowCompleted(!showCompleted)} className={`flex items-center justify-between w-full p-3 rounded-lg border transition-all text-sm ${showCompleted ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300'}`}>
                            <div className="flex items-center gap-2"><div className={`p-1 rounded-full ${showCompleted ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-slate-100 dark:bg-slate-700'}`}><CheckSquare size={14} className={showCompleted ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'} /></div><span className="font-medium">已完成事项</span><span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full text-xs font-bold">{statCompletedMatters}</span></div>
                            {showCompleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                         </button>
                         <div className={`overflow-hidden transition-all duration-300 ease-out ${showCompleted ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>{renderMiniList(completedActiveMatters, 'completed')}</div>
                     </div>
                     <div className="bg-transparent">
                         <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center justify-between w-full p-3 rounded-lg border transition-all text-sm ${showArchived ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300'}`}>
                            <div className="flex items-center gap-2"><div className={`p-1 rounded-full ${showArchived ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-100 dark:bg-slate-700'}`}><Archive size={14} className={showArchived ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'} /></div><span className="font-medium">已归档事项</span><span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full text-xs font-bold">{statArchivedMatters}</span></div>
                            {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                         </button>
                         <div className={`overflow-hidden transition-all duration-300 ease-out ${showArchived ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>{renderMiniList(archivedMatters, 'archived')}</div>
                     </div>
                 </div>
            </div>

            <div className="space-y-12">
                <section>
                    <div className="flex items-center gap-2 mb-4"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div><h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">急需关注</h2><span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">{attentionGroups.length}</span></div>
                    {attentionGroups.length === 0 ? (<div className="text-sm text-slate-400 pl-4 py-6 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-2"><CheckCircle size={16} /> 暂无受阻或临期事项，一切正常。</div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">{attentionGroups.map((group, idx) => (<AttentionGroupCard key={group.matter.id} group={group} onSelectMatter={onSelectMatter} onJumpToTask={onJumpToTask} onDismissTask={(taskId) => handleDismissTask(group.matter, taskId)} />))}</div>)}
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">进行中事项</h2>
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">{inProgressMatters.length}</span>
                    </div>
                    
                    {inProgressMatters.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                             <p className="text-slate-400 text-sm mb-2">暂无进行中的事项</p>
                             <button onClick={onNewMatter} className="text-blue-600 dark:text-blue-400 text-xs hover:underline">创建一个新事项</button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedInProgressMatters).map(([type, matters]) => (
                                <div key={type}>
                                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <div className="w-1 h-3 bg-blue-300 dark:bg-blue-700 rounded-full"></div>
                                        {type} ({matters.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {matters.map(m => {
                                            const hasAttention = attentionGroups.some(g => g.matter.id === m.id);
                                            return (
                                                <MatterCard 
                                                    key={m.id} 
                                                    m={m} 
                                                    type="normal" 
                                                    onSelectMatter={onSelectMatter} 
                                                    onDeleteMatter={onDeleteMatter}
                                                    hasAttention={hasAttention}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
      </div>
    </div>
  );
};

export default Dashboard;