import { Mode, ProjectOutline, PhasePlan, ScriptStyle } from "../types";

const API_KEY = import.meta.env.VITE_API_KEY || '';
const BASE_URL = import.meta.env.VITE_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
async function openRouterRequest(model: string, systemInstruction: string, userContent: string) {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
    },
    body: JSON.stringify({
      "model": model, 
      "messages": [
        { "role": "system", "content": systemInstruction },
        { "role": "user", "content": userContent }
      ],
      "response_format": { "type": "json_object" }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw { status: response.status, message: JSON.stringify(errorData) };
  }

  const data = await response.json();
  return { text: data.choices[0].message.content };
}

async function callWithRetry(fn: () => Promise<any>, maxRetries = 4): Promise<any> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message?.toLowerCase() || "";
      const status = error?.status || (errorMessage.includes('429') ? 429 : errorMessage.includes('500') ? 500 : 0);
      const isRetryable = status === 429 || status >= 500 || errorMessage.includes('xhr') || errorMessage.includes('rpc');
      if (isRetryable) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const geminiService = {
  generateOutline: async (novelText: string, mode: Mode): Promise<ProjectOutline> => {
    return callWithRetry(async () => {
      const systemInstruction = `你是一位顶级动漫爽剧编剧专家。你的任务是基于原著产出全案大纲。

【核心创作规范】：
1. **总集数规划**：全剧严格控制在 65-80 集。
2. **黄金节奏 (1-10集)**：
   - **第一集极速建模**：前 3 句话内交代世界观，立即爆发冲突。
   - **前 3 集极致爆发**：设置全剧最强爽点与反转。
   - **前 10 集全线暴爽**：节奏极快，每一集必须有实质进展，绝不注水。
3. **阶段结构**：第一阶段固定 10 集。
4. **受众对焦**：${mode}模式。`;

      const response = await openRouterRequest("gemini-3-pro-preview", systemInstruction, `素材：\n${novelText}`);
      return JSON.parse(response.text);
    });
  },

  generatePhaseScript: async (
    novelText: string, 
    outline: string, 
    phasePlan: PhasePlan, 
    prevScriptContext: string, 
    mode: Mode,
    scriptStyle: ScriptStyle,
    layoutRef: string = "",
    styleRef: string = ""
  ): Promise<any> => {
    return callWithRetry(async () => {
      const isFirstPhase = phasePlan.phaseIndex === 1;
      const styleInstruction = scriptStyle === '情绪流' 
        ? `【流派：情绪流】极致冲突，节奏爆破，反派脑残化嚣张化，情绪拉扯拉满，爽就完事了。`
        : `【流派：非情绪流】诙谐幽默，反套路脑洞，融入热梗，对话有机锋且有趣。`;

      const continuityInstruction = isFirstPhase 
        ? `【开篇指令】：首集3句内必须进入冲突，快速建模。`
        : `【无缝衔接指令】：必须深度解析[上下文]最后一集的结尾剧情和悬念。本阶段第一集必须直接接续该悬念，不得有任何剧情跳跃或逻辑断层。`;

      const systemInstruction = `你是一位专注爆款漫剧的首席编剧。任务：生成阶段 ${phasePlan.phaseIndex} 的 ${phasePlan.episodes} 集脚本。

【核心角色保留原则】：
1. 必须深度挖掘原著中的关键道具（如判官笔、特殊法宝）、核心人物关系及标志性戏份。
2. 改编可以快节奏，但绝不能删减原著的关键设定 and 道具戏份。这些元素必须作为爽点和转折的核心频繁出现。

在改编任何原著小说时，严禁删减以下三类“非人类/非传统”角色的戏份，并将它们视为剧本的【关键功能人】：

1. 【解说与百科类实体】：如器灵（判官笔）、系统、魔法书。它们是世界观 and 逻辑链的唯一出口，严禁将其台词转化为旁白，必须以对话形式保留。
2. 【吐槽与氛围类实体】：如萌宠、损友型挂件。它们负责调节情绪流节奏，防止剧本陷入单一阴沉，必须保留其反馈戏份。
3. 【秘密见证者】：唯一知道主角真实身份或前世记忆的非人实体。

改编要求：
- 确保主角与这些实体之间的“推拉”、“吐槽”、“合作”戏份在剧本中占一定比例。
- 信息传递必须遵循“Show, don't tell”原则，通过主角与辅助实体的交互来展示，而非删除实体。

【排版规范（绝对禁止 Markdown）】：
严禁使用 #, *, **, >, -, \` 等任何 Markdown 符号。输出必须是纯净的剧本排版（即：第X集、剧名、正文）。
对齐参考：[${layoutRef || "标准剧本格式"}]

【创作金律】：
1. ${styleInstruction}
2. ${continuityInstruction}
3. 集末卡点：每集结尾必须有勾住观众的“断章”悬念。`;

      const userContent = `
        [重要上下文（紧接此剧情开始）]：\n${prevScriptContext || "无（本阶段为开篇）"}
        
        [大纲规划（本阶段目标）]：\n${outline}
        
        [原著素材]：\n${novelText}
        
        [风格文笔参考]：\n${styleRef}`;

      const response = await openRouterRequest("gemini-3-pro-preview", systemInstruction, userContent);
      return JSON.parse(response.text);
    });
  }
};
