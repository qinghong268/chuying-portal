import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type { ContentBlock } from "../api/types";
import shared from "./shared.module.css";
import styles from "./ContentDetailPage.module.css";

type LoadState = "loading" | "ready" | "notfound" | "error";

export function ContentDetailPage() {
  const { key } = useParams<{ key: string }>();
  const [block, setBlock] = useState<ContentBlock | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!key) {
      setState("notfound");
      return;
    }
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await api<{ block: ContentBlock }>(`/api/content/${key}`);
        if (cancelled) return;
        setBlock(res.block);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setBlock(null);
        setState(
          err instanceof ApiError && err.status === 404 ? "notfound" : "error",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className={shared.page}>
      <div className={styles.wrap}>
        <Link to="/" className={styles.backLink}>
          ← 返回首页
        </Link>

        {state === "loading" ? <p className={shared.muted}>加载中…</p> : null}

        {state === "notfound" ? (
          <div className={shared.empty}>
            <p>内容不存在或已下线。</p>
            <div className={shared.btnRow} style={{ justifyContent: "center" }}>
              <Link to="/" className={shared.btnPrimary}>
                返回首页
              </Link>
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <p className={shared.error}>加载失败，请稍后重试。</p>
        ) : null}

        {state === "ready" && block ? (
          <article>
            <h1 className={styles.title}>{block.title}</h1>
            {block.summary ? (
              <p className={styles.summary}>{block.summary}</p>
            ) : null}
            {block.coverUrl ? (
              <img
                src={block.coverUrl}
                alt={block.title}
                className={styles.cover}
              />
            ) : null}
            {block.body ? (
              <div
                className={shared.richContent}
                dangerouslySetInnerHTML={{ __html: block.body }}
              />
            ) : null}
            {block.linkUrl ? (
              <div className={shared.btnRow}>
                <a
                  href={block.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={shared.btnPrimary}
                >
                  {block.linkLabel || "了解更多"}
                </a>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}
