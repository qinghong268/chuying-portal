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

请从以下维度进行评估，并以JSON格式返回（不要包含其他内容）：
{
  "score": 数字1-10（心得质量综合评分：结构完整性、语言表达、深度思考）,
  "relevance": 数字1-10（与活动/课程主题的相关性）,
  "suggestion": "审核参考小结，100字以内",
  "recommendedAction": "approve"或"reject"或"review",
  "suggestedPoints": 建议授予积分值（参考目标积分浮动±20%），若建议驳回则为0,
  "draftRejectReason": "若建议驳回，提供驳回原因草稿；否则为空字符串"
}`;

  const response = await deepseekChat(
    [
      {
        role: "system",
        content: "你是一个专业的教育培训审核助手。请始终以JSON格式返回评估结果。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, maxTokens: 1000 },
  );

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI response");
  return JSON.parse(jsonMatch[0]) as AiReviewResult;
}
