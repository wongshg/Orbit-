import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, Material } from '../types';
import StatusBadge from './StatusBadge';
import { ChevronDown, ChevronUp, AlertCircle, FileText, CheckCircle2, Circle } from 'lucide-react';

interface Props {
  task: Task;
  onUpdate: (updatedTask: Task) => void;
}

const TaskCard: React.FC<Props> = ({ task, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Auto-expand if blocked or exception to show context immediately
  useEffect(() => {
    if (task.status === TaskStatus.BLOCKED || task.status === TaskStatus.EXCEPTION) {
      setIsExpanded(true);
    }
  }, []);

  const handleStatusChange = (newStatus: TaskStatus) => {
    onUpdate({ ...task, status: newStatus, lastUpdated: Date.now() });
    if (newStatus === TaskStatus.BLOCKED || newStatus === TaskStatus.EXCEPTION) {
      setIsExpanded(true);
    }
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...task, statusNote: e.target.value, lastUpdated: Date.now() });
  };

  const toggleMaterial = (matId: string) => {
    const newMaterials = task.materials.map(m => 
      m.id === matId ? { ...m, isReady: !m.isReady } : m
    );
    onUpdate({ ...task, materials: newMaterials, lastUpdated: Date.now() });
  };

  const getBorderColor = () => {
    switch (task.status) {
      case TaskStatus.BLOCKED: return 'border-amber-300 ring-1 ring-amber-100 bg-amber-50/30';
      case TaskStatus.EXCEPTION: return 'border-purple-300 ring-1 ring-purple-100 bg-purple-50/30';
      case TaskStatus.COMPLETED: return 'border-emerald-200 opacity-80';
      case TaskStatus.SKIPPED: return 'border-slate-100 opacity-60';
      default: return 'border-slate-200 hover:border-blue-300 bg-white';
    }
  };

  return (
    <div className={`border rounded-lg transition-all duration-200 ${getBorderColor()} shadow-sm group`}>
      <div 
        className="p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
             <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <StatusBadge status={task.status} />
             </div>
             <h3 className={`font-medium text-sm leading-snug text-slate-800 ${task.status === TaskStatus.COMPLETED || task.status === TaskStatus.SKIPPED ? 'text-slate-500 line-through decoration-slate-300' : ''}`}>
              {task.title}
            </h3>
          </div>
          <button className="text-slate-300 hover:text-slate-500 transition-colors">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Preview of note if collapsed but exists */}
        {task.statusNote && !isExpanded && (
            <div className="mt-2 text-xs text-slate-500 bg-white/50 p-1.5 rounded border border-slate-100 truncate">
               NOTE: {task.statusNote}
            </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 animate-fadeIn">
          <hr className="border-slate-100 mb-3" />
          
          {/* Status Buttons - Compact */}
          <div className="grid grid-cols-3 gap-1 mb-3">
            {[TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.BLOCKED, TaskStatus.SKIPPED, TaskStatus.EXCEPTION].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`text-xs py-1 rounded border transition-colors ${
                  task.status === s
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === TaskStatus.PENDING ? '待办' :
                 s === TaskStatus.IN_PROGRESS ? '进行中' :
                 s === TaskStatus.COMPLETED ? '完成' :
                 s === TaskStatus.BLOCKED ? '受阻' :
                 s === TaskStatus.SKIPPED ? '不适用' : '例外'}
              </button>
            ))}
          </div>

          {/* Description */}
          {task.description && (
            <div className="text-xs text-slate-500 mb-3 bg-slate-50 p-2 rounded border border-slate-100">
              {task.description}
            </div>
          )}

          {/* Note Input */}
          <div className="mb-3">
            <textarea
              value={task.statusNote}
              onChange={handleNoteChange}
              placeholder="记录进展、卡点或例外原因..."
              className="w-full p-2 rounded text-xs border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-white"
              rows={3}
            />
          </div>

          {/* Materials */}
          {task.materials.length > 0 && (
            <div className="bg-slate-50 rounded p-2 border border-slate-100">
              <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <FileText size={10} /> 附件/材料
              </div>
              <div className="space-y-1">
                {task.materials.map(m => (
                  <div 
                    key={m.id} 
                    className="flex items-center gap-2 cursor-pointer hover:bg-white rounded p-0.5 transition-colors"
                    onClick={() => toggleMaterial(m.id)}
                  >
                    <div className={m.isReady ? 'text-emerald-500' : 'text-slate-300'}>
                      {m.isReady ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    </div>
                    <span className={`text-xs ${m.isReady ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {m.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskCard;
