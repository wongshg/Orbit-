import { GoogleGenAI } from "@google/genai";
import { Matter, TaskStatus } from "../types";

const SETTINGS_KEY = 'opus_settings_v1';

const processTask = (t: any) => {
  return `${t.title} [${t.status}]${t.statusNote ? `: ${t.statusNote}` : ''}`;
};

export const analyzeMatter = async (matter: Matter): Promise<string> => {
  let apiKey = process.env.API_KEY;

  try {
      const settingsStr = localStorage.getItem(SETTINGS_KEY);
      if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          if (settings.apiKey) apiKey = settings.apiKey;
      }
  } catch (e) {
      console.warn("Failed to read settings from localStorage", e);
  }

  if (!apiKey) {
    return "API Key not found. Please configure it in the settings.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Construct a concise summary of the matter for the AI
  const matterContext = {
    title: matter.title,
    type: matter.type,
    stages: matter.stages.map(s => ({
      stage: s.title,
      tasks: s.tasks.map(t => ({
        title: t.title,
        status: t.status,
        note: t.statusNote,
        missingMaterials: t.materials.filter(m => !m.isReady).map(m => m.name)
      }))
    }))
  };

  const systemPrompt = `
    You are an expert Legal Operations Assistant for a corporate affairs manager.
    Your goal is to review the current status of a specific legal matter (like company deregistration) and provide a professional, concise executive summary.
    
    The user uses specific statuses to capture "Judgment" and "Context":
    - BLOCKED: Means waiting for someone/something.
    - EXCEPTION: Means a standard process was deviated from (important to note).
    - SKIPPED: Means a step was deemed unnecessary.
    
    Output Instructions:
    1. **Summary**: A 2-sentence summary of where the project stands.
    2. **Bottlenecks**: Identify what is currently blocking progress (look for BLOCKED items or missing materials).
    3. **Action Items**: Suggest the immediate next 2-3 logical steps based on the context.
    
    Tone: Professional, direct, helpful.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: [
        { role: 'user', parts: [{ text: JSON.stringify(matterContext) }] }
      ],
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text || "Unable to generate analysis.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI Assistant. Please check your API Key.";
  }
};