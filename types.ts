
export enum TaskStatus {
  PENDING = 'PENDING',       // 待处理
  IN_PROGRESS = 'IN_PROGRESS', // 进行中
  COMPLETED = 'COMPLETED',   // 已完成
  BLOCKED = 'BLOCKED',       // 受阻 (Wait for external/internal)
  SKIPPED = 'SKIPPED',       // 不适用 (N/A)
  EXCEPTION = 'EXCEPTION',   // 例外处理 (Procedural deviation)
  OTHER = 'OTHER'            // 其他 (Custom)
}

export interface AttachedFile {
  id: string;
  name: string;
  type?: string;
  size?: number;
  timestamp: number;
}

export interface Material {
  id: string;
  name: string;
  category?: 'REFERENCE' | 'DELIVERABLE'; // REFERENCE: Template files; DELIVERABLE: Work outputs
  isReady: boolean;
  note?: string;
  // Legacy single file fields (deprecated but kept for compatibility)
  fileId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  // New multi-file support
  files?: AttachedFile[];
}

export interface StatusUpdate {
  id: string;
  content: string;
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string; // Additional context
  dueDate?: number; // New: Deadline for specific task
  status: TaskStatus;
  customStatus?: string; // For OTHER status
  statusNote: string; // Legacy field, kept for backward compatibility
  statusUpdates?: StatusUpdate[]; // New field for multiple records
  materials: Material[];
  lastUpdated: number;
}

export interface Stage {
  id: string;
  title: string;
  dueDate?: number; // New: Deadline for specific stage
  tasks: Task[];
}

export interface JudgmentRecord {
  id: string;
  content: string; // Natural language description of the judgment
  status?: TaskStatus; // Optional status snapshot associated with this judgment
  timestamp: number;
}

// AI Analysis Result Structure for Judgment Timeline
export interface AIAnalysisResult {
  id?: string;           // Unique ID for history tracking
  summary: string;       // 1. 当前判断摘要
  evolution: string;     // 2. 判断演变概览
  blockerTags: string[]; // 3. 高频卡点归纳
  similarCases: {        // 4. 相似事项对照
    matterName: string;
    similarity: string;
    facts: string;
  }[];
  timestamp: number;    // Added timestamp for when analysis was generated
}

export interface Matter {
  id: string;
  title: string;
  type: string; // e.g., "SPV Deregistration"
  dueDate?: number; // Optional due date for sorting
  createdAt: number;
  lastUpdated: number;
  stages: Stage[];
  archived: boolean;
  dismissedAttentionIds?: string[]; // IDs of tasks or 'OVERDUE' to ignore in attention dashboard
  
  // New Core Feature: Judgment Timeline
  judgmentTimeline: JudgmentRecord[];
  currentSituation?: string; // Derived from the latest judgment record
  overallStatus?: TaskStatus; // Derived from the latest judgment record
  
  // Persisted AI Analysis
  latestAnalysis?: AIAnalysisResult;
  analysisHistory?: AIAnalysisResult[]; // Full history
}

export interface Template {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
}

// AI Work Status Overview Result Structure
export interface AIWorkStatusResult {
  overview: string;        // 1. 整体工作态势概览
  blockerTypes: {          // 2. 主要受阻类型归纳
    tag: string;
    count: number;
  }[];
  updateRhythm: string;    // 3. 判断更新节奏提示
  workload?: string;       // 4. 工作负荷感知 (Optional)
  actionPlan: string;      // 5. [NEW] 建议工作计划
  completedActionIndices?: number[]; // 6. [NEW] Interactive state for action plan
  timestamp: number;
}
