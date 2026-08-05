import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import styles from "./ChatWidget.module.css";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: "ai",
  content: "你好！我是雏英 AI 助手。关于活动、课程、积分或计划规则的问题，都可以问我～",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, open]);

  async function send() {
    const question = input.trim();
    if (!question || typing) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setTyping(true);

    try {
      const res = await api<{ answer: string }>("/api/kb-chat", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setMessages((prev) => [...prev, { role: "ai", content: res.answer }]);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "AI 服务暂时不可用，请稍后重试";
      setMessages((prev) => [...prev, { role: "ai", content: message }]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <div className={styles.widget}>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="雏英 AI 助手">
          <div className={styles.header}>
            <span className={styles.headerTitle}>雏英 AI 助手</span>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="关闭"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? styles.msgUser : styles.msgAi}
              >
                <div
                  className={m.role === "user" ? styles.bubbleUser : styles.bubbleAi}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {typing ? (
              <div className={styles.msgAi}>
                <div className={`${styles.bubbleAi} ${styles.typingBubble}`}>
                  <span className={styles.typingDots} aria-label="正在输入">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputArea}>
            <input
              className={styles.input}
              value={input}
              placeholder="输入你的问题…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={!input.trim() || typing}
              onClick={() => void send()}
            >
              发送
            </button>
          </div>
          <div className={styles.footer}>由 DeepSeek 驱动</div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.toggleBtn}
          aria-label="打开 AI 助手"
          onClick={() => setOpen(true)}
        >
          💬
        </button>
      )}
    </div>
  );
}
