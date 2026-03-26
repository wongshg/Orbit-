import React, { useState, useEffect, useRef } from 'react';
import { Matter, TaskStatus, JudgmentRecord, AIAnalysisResult } from '../types';
import { Send, Clock, GitCommit, PlayCircle, PauseCircle, AlertCircle, HelpCircle, CheckCircle2, Sparkles, ChevronDown, ChevronUp, Copy, History, Tag, RefreshCw, X, ArrowLeft } from 'lucide-react';
import { analyzeJudgmentTimeline } from '../services/aiAnalysisService';

interface Props {
  matter: Matter;
  allMatters: Matter[]; // Needed for historical comparison
  onUpdate: (updatedMatter: Matter) => void;
}

const JudgmentTimeline: React.FC<Props> = ({ matter, allMatters, onUpdate }) => {
  const [content, setContent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | null>(null);
  
  // AI State
  const [isAiPanelExpanded, setIsAiPanelExpanded] = useState(true); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // History Mode State
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AIAnalysisResult | null>(null);

  useEffect(() => {
      if (matter.latestAnalysis) {
          setIsAiPanelExpanded(true);
      }
  }, [matter.latestAnalysis?.timestamp]);

  const statusOptions = [
    { value: TaskStatus.IN_PROGRESS, label: '正常推进', icon: PlayCircle, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { value: TaskStatus.BLOCKED, label: '受阻/等待', icon: PauseCircle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: TaskStatus.EXCEPTION, label: '例外情况', icon: AlertCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { value: TaskStatus.SKIPPED, label: '不适用', icon: HelpCircle, color: 'text-gray-500 bg-gray-50 border-gray-200' },
    { value: TaskStatus.COMPLETED, label: '已完成', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  ];

  const handleSubmit = () => {
    if (!content.trim()) return;

    const newRecord: JudgmentRecord = {
      id: Math.random().toString(36).substr(2, 9),
      content: content.trim(),
      status: selectedStatus || undefined,
      timestamp: Date.now()
    };

    const newTimeline = [newRecord, ...(matter.judgmentTimeline || [])];

    const updates: Partial<Matter> = {
      judgmentTimeline: newTimeline,
      lastUpdated: Date.now(),
      currentSituation: newRecord.content,
    };

    if (selectedStatus) {
      updates.overallStatus = selectedStatus;
    }

    onUpdate({ ...matter, ...updates });
    setContent('');
    setSelectedStatus(null);
  };

  const handleRunAnalysis = async () => {
    if (matter.judgmentTimeline.length === 0) {
      alert("请先添加至少一条判断记录");
      return;
    }
    setIsAiPanelExpanded(true);
    setIsAnalyzing(true);
    setIsHistoryMode(false); // Switch to latest view
    setSelectedHistoryItem(null);

    const result = await analyzeJudgmentTimeline(matter, allMatters);
    if (result) {
        const resultWithId = { ...result, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
        const newHistory = [resultWithId, ...(matter.analysisHistory || [])];
        onUpdate({ 
            ...matter, 
            latestAnalysis: resultWithId,
            analysisHistory: newHistory,
            lastUpdated: Date.now()
        });
    }
    setIsAnalyzing(false);
  };

  const getStatusBadge = (status?: TaskStatus) => {
    if (!status) return null;
    const opt = statusOptions.find(o => o.value === status) || { label: '其他', color: 'text-slate-600 bg-slate-50 border-slate-200' };
    return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${opt.color} font-medium inline-flex items-center gap-1`}>{opt.label}</span>;
  };

  const formatDate = (ts: number) => {
      return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const AnalysisResultCard = ({ result, isHistorical = false }: { result: AIAnalysisResult, isHistorical?: boolean }) => (
      <div className="space-y-4 text-sm animate-fadeIn">
          {isHistorical && (
              <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-1 rounded mb-2 border border-indigo-100 dark:border-indigo-800 inline-block">
                  历史记录: {new Date(result.timestamp).toLocaleString()}
              </div>
          )}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">当前判断摘要</h4>
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm">{result.summary}</p>
          </div>
          <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><History size={12}/> 判断演变</h4>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{result.evolution}</p>
          </div>
          {result.blockerTags.length > 0 && (
              <div className="flex flex-wrap gap-2">{result.blockerTags.map((tag, i) => (<span key={i} className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800">{tag}</span>))}</div>
          )}
          {!isHistorical && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 text-center">AI 辅助分析 • 仅供参考</div>
          )}
      </div>
  );

  return (
    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/50 md:rounded-lg h-full min-h-[calc(100vh-4rem)]">
      
      {/* Header - Sticky */}
      <div className="sticky top-0 z-10 p-4 flex items-center justify-between border-b border-slate-100/50 dark:border-slate-800/50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl transition-all">
        <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <GitCommit size={16} className="text-blue-600 dark:text-blue-400" />
            判断时间线
        </h2>
        
        {(!matter.latestAnalysis && !isAnalyzing) && (
            <button 
                onClick={handleRunAnalysis}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50`}
            >
                <Sparkles size={12} />
                AI 辅助分析
            </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 flex-1">
         
         {/* AI Panel */}
         {(matter.latestAnalysis || isAnalyzing) && (
             <div className="bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm overflow-hidden transition-all">
                 <div className="bg-indigo-50/50 dark:bg-indigo-900/20 px-4 py-2 flex items-center justify-between cursor-pointer border-b border-indigo-100 dark:border-indigo-900/50" onClick={() => setIsAiPanelExpanded(!isAiPanelExpanded)}>
                     <div className="flex items-center gap-2">
                         <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                         <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">智能归纳与对照</span>
                         {matter.latestAnalysis && !isAnalyzing && !isHistoryMode && (<span className="text-[10px] text-slate-400 ml-1">{new Date(matter.latestAnalysis.timestamp).toLocaleTimeString()}</span>)}
                     </div>
                     <div className="flex items-center gap-2">
                         {/* Toggle History Button */}
                         {matter.analysisHistory && matter.analysisHistory.length > 0 && (
                             <button 
                                 onClick={(e) => { 
                                     e.stopPropagation(); 
                                     setIsHistoryMode(!isHistoryMode); 
                                     setIsAiPanelExpanded(true); 
                                     setSelectedHistoryItem(null); 
                                 }} 
                                 className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded border transition-colors ${isHistoryMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/50 text-indigo-600 border-indigo-100 hover:bg-white'}`}
                             >
                                 <History size={10} /> {isHistoryMode ? '返回最新' : '历史记录'}
                             </button>
                         )}
                         
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleRunAnalysis(); }} 
                            disabled={isAnalyzing} 
                            className="p-1 text-indigo-500 hover:bg-indigo-100 rounded"
                            title="重新分析"
                         >
                             <RefreshCw size={12} className={isAnalyzing ? 'animate-spin' : ''}/>
                         </button>
                         <div className="text-indigo-400">{isAiPanelExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</div>
                     </div>
                 </div>
                 
                 <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAiPanelExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                     <div className="p-4">
                         {isAnalyzing ? (
                             <div className="py-6 flex flex-col items-center justify-center text-slate-400 gap-2">
                                 <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                                 <span className="text-xs">正在分析时间线数据...</span>
                             </div>
                         ) : isHistoryMode ? (
                             // HISTORY MODE VIEW
                             selectedHistoryItem ? (
                                 <div>
                                     <button onClick={() => setSelectedHistoryItem(null)} className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft size={10} /> 返回列表</button>
                                     <AnalysisResultCard result={selectedHistoryItem} isHistorical={true} />
                                 </div>
                             ) : (
                                 <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                     <div className="text-xs text-slate-400 mb-2 px-1">选择一条历史记录查看:</div>
                                     {matter.analysisHistory?.map((hist, idx) => (
                                         <div 
                                            key={hist.id || idx} 
                                            onClick={() => setSelectedHistoryItem(hist)}
                                            className="p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 rounded-lg cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors group"
                                         >
                                             <div className="flex justify-between items-start mb-1">
                                                 <span className="text-[10px] font-mono text-slate-500">{new Date(hist.timestamp).toLocaleString()}</span>
                                                 <ChevronDown size={12} className="text-slate-300 group-hover:text-indigo-400 -rotate-90" />
                                             </div>
                                             <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">{hist.summary}</p>
                                         </div>
                                     ))}
                                 </div>
                             )
                         ) : matter.latestAnalysis ? (
                             // LATEST VIEW
                             <AnalysisResultCard result={matter.latestAnalysis} />
                         ) : null}
                     </div>
                 </div>
             </div>
         )}

         {/* Input */}
         <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 transition-all focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="记录当前推进情况、卡点或决策..."
                className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder-slate-400 text-slate-700 dark:text-slate-200 min-h-[60px]"
                onKeyDown={(e) => { if(e.ctrlKey && e.key === 'Enter') handleSubmit(); }}
            />
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                {statusOptions.map(opt => (
                    <button key={opt.value} onClick={() => setSelectedStatus(selectedStatus === opt.value ? null : opt.value)} className={`shrink-0 p-1.5 rounded-full transition-all border ${selectedStatus === opt.value ? opt.color + ' ring-1 ring-offset-1 dark:ring-offset-slate-800' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`} title={opt.label}><opt.icon size={16} /></button>
                ))}
                </div>
                <button onClick={handleSubmit} disabled={!content.trim()} className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1"><Send size={12} /> 提交</button>
            </div>
         </div>

         {/* Timeline */}
         <div>
            {!matter.judgmentTimeline || matter.judgmentTimeline.length === 0 ? (
            <div className="text-center py-8 opacity-50"><div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2"><GitCommit size={20} className="text-slate-400" /></div><p className="text-xs text-slate-400">暂无记录，添加一条以开始。</p></div>
            ) : (
            <div className="space-y-0 pl-3 border-l-2 border-slate-200 dark:border-slate-700 ml-2 py-1">
                {matter.judgmentTimeline.map((record, index) => (
                <div key={record.id} className="relative pl-5 pb-6 last:pb-0 group">
                    <div className={`absolute left-[-7px] top-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${index === 0 ? 'bg-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                    <div className={`rounded-lg border p-3 transition-all ${index === 0 ? 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 shadow-sm' : 'bg-white/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700 grayscale hover:grayscale-0'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">{getStatusBadge(record.status)}{index === 0 && (<span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 px-1.5 rounded">Current</span>)}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{formatDate(record.timestamp)}</span>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{record.content}</div>
                    </div>
                </div>
                ))}
            </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default JudgmentTimeline;