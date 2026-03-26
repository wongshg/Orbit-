import { Matter, AIAnalysisResult, AIWorkStatusResult, TaskStatus, Template } from "../types";

const SETTINGS_KEY = 'opus_settings_v1';
const DEFAULT_API_HOST = "https://api.chatanywhere.tech";

// Helper to get settings
const getSettings = () => {
    let apiKey = process.env.API_KEY;
    let apiHost = DEFAULT_API_HOST;
    try {
        const settingsStr = localStorage.getItem(SETTINGS_KEY);
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.apiKey) apiKey = settings.apiKey;
            if (settings.apiHost) apiHost = settings.apiHost;
        }
    } catch (e) {
        console.warn("Failed to read settings", e);
    }
    return { apiKey, apiHost };
};

// Helper to sanitize data: Remove tasks, stages, files. Only keep Judgment Timeline.
const extractTimelineData = (matter: Matter) => {
  return {
    id: matter.id,
    title: matter.title,
    timeline: matter.judgmentTimeline.map(r => ({
      date: new Date(r.timestamp).toISOString().split('T')[0],
      status: r.status,
      content: r.content
    }))
  };
};

export const analyzeJudgmentTimeline = async (
  currentMatter: Matter, 
  allMatters: Matter[]
): Promise<AIAnalysisResult | null> => {
  
  const { apiKey, apiHost } = getSettings();

  if (!apiKey) {
    alert("请在设置中配置 API Key 以使用 AI 分析功能。");
    return null;
  }

  // 2. Prepare Data
  const historyMatters = allMatters
    .filter(m => m.id !== currentMatter.id && m.judgmentTimeline && m.judgmentTimeline.length > 0)
    .map(extractTimelineData);

  const currentData = extractTimelineData(currentMatter);

  // 3. Construct Prompt
  const systemPrompt = `
    你是一个客观的法务运营分析助手。你的任务是对用户提供的【当前事项判断时间线】及【历史事项判断时间线】进行归纳与对照分析。
    
    你需要严格遵守以下原则：
    1. 仅分析已有的判断记录，**绝不生成新的判断结论，绝不提供行动建议**。
    2. 严格基于事实数据，保持客观、中立。
    3. 输出必须为标准的 JSON 格式，不要包含 Markdown 代码块标记。

    你的输出需要包含以下四个字段：
    
    1. **summary** (string): 当前判断摘要。基于当前事项的记录，用 3-5 行文字概括整体推进态势、主要卡点（如有）及是否可控。
    2. **evolution** (string): 判断演变概览。简述“判断状态”和“关键描述”是如何随着时间演变到当前状态的。
    3. **blockerTags** (string array): 高频卡点归纳。输出 1-3 个短语标签（例如：“外部决策等待”、“内部审批节奏”），仅做分类。
    4. **similarCases** (array): 相似事项对照。在历史事项中查找判断模式相似的事项（若无相似则返回空数组）。每个对象包含：
       - "matterName": 事项名称
       - "similarity": 1-2句话说明相似点（如：都在同一阶段受阻）
       - "facts": 事实型信息（如：当时平均等待时长、最终结果），不包含建议。

    输入数据格式：
    {
      "current": { title, timeline: [{date, status, content}] },
      "history": [ { title, timeline: [...] } ]
    }
  `;

  const userPayload = {
    current: currentData,
    history: historyMatters
  };

  try {
    const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
    const response = await fetch(`${cleanHost}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as AIAnalysisResult;

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    alert("AI 分析失败，请检查 API Key 或网络连接。");
    return null;
  }
};

export const analyzeWorkStatus = async (matters: Matter[]): Promise<AIWorkStatusResult | null> => {
    const { apiKey, apiHost } = getSettings();
    if (!apiKey) {
        alert("请先在设置中配置 API Key 以使用工作态势速览功能。");
        return null;
    }

    // Filter Input: Active Matters with extended context for Action Plan
    const activeMatters = matters.filter(m => !m.archived).map(m => {
        // Find latest judgment
        const latestJ = m.judgmentTimeline.length > 0 ? m.judgmentTimeline[0] : null;
        
        // Find tasks with updates in last 7 days or upcoming due dates
        const relevantTasks = [];
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        m.stages.forEach(s => {
            s.tasks.forEach(t => {
                if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED) return;
                
                const hasRecentUpdate = t.statusUpdates && t.statusUpdates.some(u => (now - u.timestamp) < oneWeek);
                const isDueSoon = t.dueDate && (t.dueDate - now) < oneWeek;
                const isBlocked = t.status === TaskStatus.BLOCKED;

                if (hasRecentUpdate || isDueSoon || isBlocked) {
                    relevantTasks.push({
                        title: t.title,
                        status: t.status,
                        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
                        recentUpdate: t.statusUpdates?.[0]?.content || null
                    });
                }
            });
        });

        return {
            id: m.id,
            title: m.title,
            currentStatus: m.overallStatus || TaskStatus.PENDING,
            lastJudgmentContent: latestJ?.content || "暂无判断记录",
            lastJudgmentTime: latestJ ? new Date(latestJ.timestamp).toISOString().split('T')[0] : "无",
            activeTasks: relevantTasks
        };
    });

    if (activeMatters.length === 0) return null;

    const todayStr = new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `
      你是一个法务运营工作台的态势感知 AI。你的任务是根据所有进行中事项的状态、判断记录及具体任务进展，生成一份【工作态势速览】。
      
      当前日期是：${todayStr}。请根据这个日期准确计算“明天”、“下周”、“3天后”等相对时间，并在输出中转换为具体日期（如 10月25日）。

      ### 必须遵守的原则
      1. **仅描述事实与态势**：归纳“现在是什么情况”。
      2. **输出格式**：纯 JSON，无 Markdown 标记。

      ### 输出字段要求
      1. **overview** (string): 整体工作态势概览。用一句话描述分布（如：X个进行中，Y个受阻，Z个完成）。
      2. **blockerTypes** (array): 主要受阻类型归纳。分析状态为 BLOCKED 或包含受阻描述的事项，归纳出 1-3 个卡点类型标签。
         格式: [{ "tag": "外部审批等待", "count": 2 }]
      3. **updateRhythm** (string): 判断更新节奏提示。基于 lastJudgmentTime，客观指出是否存在长时间（如超过7天）未更新判断的事项。
      4. **workload** (string): (可选) 工作负荷感知。
      5. **actionPlan** (string): [重要] 建议工作计划。
         - 请分析所有事项的 'lastJudgmentContent' 和 'activeTasks' 中的 'recentUpdate'。
         - 敏锐捕捉文本中提到的时间节点（如“下周一”、“3天后”、“预计15号”）、截止日期或明确的下一步动作。
         - 将这些分散的信息整理成一个简洁的、无序列表形式的纯文本计划（用换行符分隔，不要Markdown列表符号）。
         - **关键要求**：每条计划的开头必须用方括号标注所属事项名称，格式为 "[事项名称] 具体计划内容(包含具体日期)"。
         - 示例格式：“[金坛项目] 跟进外部审批结果 (预计10月28日)\n[漳浦项目] 提交公示材料”

      ### 输入数据示例
      [ { title, currentStatus, lastJudgmentContent, activeTasks: [{title, status, recentUpdate, dueDate}] } ... ]
    `;

    try {
        const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
        const response = await fetch(`${cleanHost}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify(activeMatters) }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        
        return {
            ...result,
            timestamp: Date.now()
        } as AIWorkStatusResult;

    } catch (error) {
        console.error("Dashboard AI Analysis Failed:", error);
        alert("AI 分析失败 (Error " + error + ")。请检查 API Key 配置或网络。");
        return null;
    }
};

export const generateTemplateFromText = async (text: string): Promise<Template | null> => {
    const { apiKey, apiHost } = getSettings();
    if (!apiKey) {
        alert("请先配置 API Key。");
        return null;
    }

    const systemPrompt = `
      你是一个流程专家。用户的输入是一段工作说明、总结或流程描述。
      你需要根据这段文本，提取并生成一个结构化的工作模板。
      
      输出必须是符合以下 TypeScript 接口的 JSON 数据（不要 Markdown）：
      
      interface Template {
        name: string; // 模板名称，简短有力
        description: string; // 适用场景说明
        stages: {
          id: string; // 使用随机字符串，如 "s1"
          title: string; // 阶段名称
          tasks: {
             id: string; // 使用随机字符串，如 "t1"
             title: string; // 任务名称
             description?: string; // 任务描述或指引
             status: "PENDING";
             statusNote: "";
             lastUpdated: number; // 当前时间戳
             materials: { // 如果文本中提到了需要的文件或产物
                id: string;
                name: string;
                isReady: false;
                category: "DELIVERABLE"; // 默认为产物
             }[];
          }[];
        }[];
      }
      
      注意：
      1. 自动推断合理的阶段划分。
      2. 任务名要具体。
      3. status 固定为 "PENDING"。
      4. 如果提到具体文件，加入 materials。
    `;

    try {
        const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
        const response = await fetch(`${cleanHost}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.5
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson) as Template;

    } catch (e) {
        console.error("Template Generation Failed:", e);
        alert("模板生成失败");
        return null;
    }
};

export const parseMaterialsFromText = async (text: string): Promise<{ name: string, category: 'REFERENCE' | 'DELIVERABLE' }[] | null> => {
    const { apiKey, apiHost } = getSettings();
    if (!apiKey) {
        alert("请先配置 API Key。");
        return null;
    }

    const systemPrompt = `
      你是一个行政或法务助手。用户会输入一段工作描述、邮件内容或清单。
      你需要从中提取出所有的“文件”、“材料”或“证照”名称。
      
      请根据上下文判断该文件是：
      - 'REFERENCE': 用户需要参考的资料、模板、法律法规等。
      - 'DELIVERABLE': 用户需要产出、签署或获取的最终交付文件（如申请书、决议、批复）。
      
      输出纯 JSON 数组，格式如下 (不要 Markdown)：
      [
        { "name": "公司章程", "category": "REFERENCE" },
        { "name": "股东会决议", "category": "DELIVERABLE" }
      ]
    `;

    try {
        const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
        const response = await fetch(`${cleanHost}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (e) {
        console.error("Material Parsing Failed:", e);
        alert("识别失败");
        return null;
    }
};

export const generateMatterFromText = async (text: string, isSimpleMode: boolean = false): Promise<{
    title: string;
    dueDate: string | null;
    stages: { title: string; tasks: { title: string }[] }[]
} | null> => {
    const { apiKey, apiHost } = getSettings();
    if (!apiKey) {
        alert("请先配置 API Key。");
        return null;
    }

    const todayStr = new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `
      你是一个智能工作助理。用户会输入一段关于新工作的描述（可能包含截止时间、任务内容等）。
      你需要分析这段文本，并生成一个结构化的事项数据。
      
      **重要上下文信息：**
      今天是 ${todayStr}。
      请务必基于“今天”准确计算用户输入中提到的相对时间（如“下周五”、“明天”、“后天”）所对应的具体日期，并输出为 YYYY-MM-DD 格式。例如，如果今天是周五，用户说“下周一”，你应该算出下周一的具体日期。

      **模式要求：**
      ${isSimpleMode 
        ? '用户选择了【简单任务模式】。请生成一个名为“待办清单”的单一阶段。将用户描述拆解为若干个具体的子任务。如果未提及明确截止日期，默认设置为一周后。' 
        : '用户选择了【复杂项目模式】。请根据工作逻辑，将其拆分为合理的多个阶段（Stage），每个阶段包含若干任务。如果未提及明确截止日期，提取最晚的时间点。'}

      输出必须是符合以下 JSON 格式（不要 Markdown）：
      {
        "title": "事项标题（简短概括，如'XXX协议审核'）",
        "dueDate": "YYYY-MM-DD" (计算出的准确日期),
        "stages": [
           {
             "title": "阶段名称（如'一、起草阶段'，如果没分阶段则叫'默认阶段'）",
             "tasks": [
                { "title": "任务名称" }
             ]
           }
        ]
      }
    `;

    try {
        const cleanHost = apiHost.endsWith('/') ? apiHost.slice(0, -1) : apiHost;
        const response = await fetch(`${cleanHost}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.5
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (e) {
        console.error("Matter Generation Failed:", e);
        alert("识别失败");
        return null;
    }
};
