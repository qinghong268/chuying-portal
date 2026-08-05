import { Router } from "express";
import { deepseekChat } from "../lib/deepseek";
import { getDb } from "../connection";
import { requireAuth, requireRole } from "../middleware/auth";

export const kbChatRouter = Router();

// Simple keyword-based retrieval from kb_documents
export function retrieveRelevantDocs(query: string): string[] {
  const docs = getDb()
    .prepare("SELECT title, content FROM kb_documents")
    .all() as Array<{ title: string; content: string }>;
  if (docs.length === 0) return [];

  // Simple keyword matching: check which docs contain any word from the query.
  // Chinese text has no spaces, so split on whitespace only would yield a
  // single unusable token; also extract CJK character bigrams as keywords.
  function keywordTokens(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (/[一-鿿]/.test(text)) {
      const stripped = text.replace(/\s+/g, "");
      for (let i = 0; i < stripped.length - 1; i++) {
        const bigram = stripped.slice(i, i + 2);
        if (/[一-鿿]/.test(bigram)) words.push(bigram);
      }
    }
    return words;
  }

  const queryWords = keywordTokens(query);
  const scored = docs.map((doc) => {
    const text = (doc.title + " " + doc.content).toLowerCase();
    const score = queryWords.filter((w) => text.includes(w)).length;
    return { doc, score };
  });

  // Return top 3 matching docs, or first 3 if no matches
  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (top.length === 0) return docs.slice(0, 3).map((d) => d.content);
  return top.map((t) => `${t.doc.title}: ${t.doc.content}`);
}

kbChatRouter.post("/", requireAuth, requireRole("eagle"), async (req, res) => {
  const { question } = req.body as { question?: unknown };
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "请输入问题" });
    return;
  }

  try {
    const relevantDocs = retrieveRelevantDocs(question);
    const contextStr =
      relevantDocs.length > 0
        ? relevantDocs.map((d, i) => `【参考资料${i + 1}】${d}`).join("\n\n")
        : "暂无相关参考资料";

    const response = await deepseekChat(
      [
        {
          role: "system",
          content: `你是雏英计划的专属AI助手。你的知识来自知识库文档。请根据以下参考资料回答用户的问题。如果问题超出你的知识范围或参考资料中没有相关信息，请诚实告知用户"知识库中没有相关信息"，并建议联系管理员。回答保持简短（100字以内），只提供有用信息，不要编造内容。回答要专业、友好，使用中文。\n\n参考资料：\n${contextStr}`,
        },
        { role: "user", content: question },
      ],
      { temperature: 0.7, maxTokens: 600 },
    );

    res.json({ answer: response });
  } catch (err) {
    console.error("AI Chat error:", err);
    res.status(500).json({ error: "AI服务暂时不可用，请稍后重试" });
  }
});
