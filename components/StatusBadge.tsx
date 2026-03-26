import React from 'react';
import { TaskStatus } from '../types';

interface Props {
  status: TaskStatus;
  customText?: string;
  className?: string;
}

const CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  [TaskStatus.PENDING]: { 
      label: '待办', 
      className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' 
  },
  [TaskStatus.IN_PROGRESS]: { 
      label: '进行中', 
      className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
  },
  [TaskStatus.COMPLETED]: { 
      label: '已完成', 
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' 
  },
  [TaskStatus.BLOCKED]: { 
      label: '受阻/等待', 
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' 
  },
  [TaskStatus.SKIPPED]: { 
      label: '不适用', 
      className: 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-700' 
  },
  [TaskStatus.EXCEPTION]: { 
      label: '例外处理', 
      className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' 
  },
  [TaskStatus.OTHER]: { 
      label: '其他', 
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' 
  },
};

const StatusBadge: React.FC<Props> = ({ status, customText, className = '' }) => {
  const config = CONFIG[status] || CONFIG[TaskStatus.PENDING];
  const label = (status === TaskStatus.OTHER && customText) ? customText : config.label;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}>
      {label}
    </span>
  );
};

export default StatusBadge;