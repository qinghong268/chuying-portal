import { deepseekChat } from "./deepseek";

export interface AiReviewResult {
  score: number; // 1-10 quality score
  relevance: number; // 1-10 relevance to activity/course
  suggestion: string; // review suggestion text
  recommendedAction: "approve" | "reject" | "review";
  suggestedPoints?: number;
  draftRejectReason?: string;
}

export async function generateAiReview(params: {
  activityTitle: string;
  activityDescription: string;
  reflection: string;
  targetPoints: number;
  applicantName: string;
}): Promise<AiReviewResult> {
  const prompt = `你是一位雏英计划积分审核专家。请根据以下信息对学员提交的心得进行审核评估：

【活动/课程名称】${params.activityTitle}
【活动/课程描述】${params.activityDescription}
【目标积分】${params.targetPoints}
【学员姓名】${params.applicantName}
【学员提交心得】${params.reflection}

评分规则（满分10分 = 三项得分之和）：
- 结构（0-4分）：是否有开头、过程、收获的完整叙述，条理是否清晰；
- 相关性（0-3分）：内容是否紧扣活动/课程主题，是否提及活动中的具体细节；
- 深度（0-3分）：是否有具体事例、真实感受与个人思考，而非泛泛而谈。

必须重点核查并在 suggestion 中明确指出以下问题：
1. 抄袭嫌疑：大段通用套话、模板化表达，或内容与活动无关却雷同；
2. 流水账：仅罗列做了什么，没有收获与思考，或篇幅过短（如不足50字）；
3. 偏题：内容与活动/课程主题基本无关。

结论指引：
- 心得结构完整、与活动描述高度相关、有具体收获 → recommendedAction 为 "approve"，suggestedPoints 在目标积分±20%范围内浮动；
- 心得含糊、过短、套话较多或部分偏题 → recommendedAction 为 "review"；
- 明显抄袭、严重偏题或存在违规内容 → recommendedAction 为 "reject"，suggestedPoints 为 0。

suggestion 与 draftRejectReason 必须结合学员心得的原文给出具体、可操作的反馈（可引用心得中的原句），禁止使用通用套话。

请仅返回以下JSON（不要输出任何其他内容、注释或Markdown代码块）：
{
  "score": 1-10整数（三项得分之和，最低1分）,
  "relevance": 1-10整数（与活动/课程主题的相关性）,
  "suggestion": "给审核员的参考小结，100字以内，指出优点与具体问题",
  "recommendedAction": "approve"或"reject"或"review",
  "suggestedPoints": 建议授予积分值（参考目标积分±20%，驳回则为0）,
  "draftRejectReason": "若建议驳回则提供可发给学员的驳回原因草稿，否则为空字符串"
}`;

  const response = await deepseekChat(
    [
      {
        role: "system",
        content: "你是一个专业的教育培训审核助手。请严格按用户评分规则评估，并始终以JSON格式返回结果。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, maxTokens: 800 },
  );

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI response");
  return JSON.parse(jsonMatch[0]) as AiReviewResult;
}
