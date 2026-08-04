import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import shared from "./shared.module.css";
import styles from "./JoinPage.module.css";

interface JoinResult {
  id: number;
  status: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidContact(value: string): boolean {
  return EMAIL.test(value);
}

export function JoinPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setContactError(null);
    setPrivacyError(null);

    const trimmedContact = contact.trim();
    let hasFieldError = false;

    if (!trimmedContact) {
      setContactError("请填写联系方式。");
      hasFieldError = true;
    } else if (!isValidContact(trimmedContact)) {
      setContactError("请输入合法的邮箱地址。");
      hasFieldError = true;
    }

    if (!agreePrivacy) {
      setPrivacyError("提交前请勾选同意隐私说明。");
      hasFieldError = true;
    }

    if (!name.trim() || !message.trim()) {
      setError("请填写姓名与申请理由。");
      return;
    }

    if (hasFieldError) {
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ application: JoinResult }>("/api/join", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          contact: trimmedContact,
          message: message.trim(),
        }),
      });
      setResult(data.application);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.role === "eagle") {
    return (
      <div className={`${shared.page} ${shared.narrow}`}>
        <h1 className={shared.pageTitle}>加入雏英计划</h1>
        <p className={shared.lead}>你已是雏英账号，可直接前往个人中心或浏览活动。</p>
        <div className={shared.btnRow}>
          <Link to="/me" className={shared.btnPrimary}>
            个人中心
          </Link>
          <Link to="/activities" className={shared.btnSecondary}>
            了解活动
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className={`${shared.page} ${shared.narrow}`}>
        <div className={`${shared.panel} ${styles.success}`}>
          <h1 className={shared.pageTitle}>申请已提交</h1>
          <p className={shared.lead}>
            当前状态：待审核（编号 #{result.id}）。请耐心等待管理员处理。
          </p>
          <p className={shared.muted}>审核结果通知渠道待运营补充。</p>
          <div className={shared.btnRow}>
            <Link to="/" className={shared.btnSecondary}>
              返回首页
            </Link>
            <Link to="/activities" className={shared.btnPrimary}>
              去了解活动
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shared.page} ${shared.narrow}`}>
      <h1 className={shared.pageTitle}>加入雏英计划</h1>
      <p className={shared.lead}>
        填写以下信息提交申请，审核通过后即可报名活动并累计积分。
      </p>

      <div className={`${shared.panel} ${styles.notice}`}>
        <ul>
          <li>提交后状态为「待审核」，请耐心等待管理员处理</li>
          <li>通过后可使用雏英身份登录前台个人中心</li>
        </ul>
      </div>

      <form className={shared.formStack} onSubmit={(e) => void onSubmit(e)} noValidate>
        <div className={shared.field}>
          <label htmlFor="join-name">姓名 *</label>
          <input
            id="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="join-contact">联系方式（邮箱）*</label>
          <input
            id="join-contact"
            type="email"
            value={contact}
            onChange={(e) => {
              setContact(e.target.value);
              setContactError(null);
            }}
            required
            maxLength={200}
            placeholder="例如 you@example.com"
            aria-invalid={contactError ? true : undefined}
            aria-describedby={contactError ? "join-contact-error" : undefined}
          />
          {contactError ? (
            <span id="join-contact-error" className={styles.fieldError} role="alert">
              {contactError}
            </span>
          ) : null}
        </div>
        <div className={shared.field}>
          <label htmlFor="join-message">申请理由 *</label>
          <textarea
            id="join-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={2000}
            placeholder="简要说明加入动机与背景（建议 20 字以上）"
          />
          <span className={shared.muted}>已输入 {message.length} 字</span>
        </div>

        <div className={shared.field}>
          <div className={styles.privacyRow}>
            <input
              id="join-privacy"
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => {
                setAgreePrivacy(e.target.checked);
                setPrivacyError(null);
              }}
              aria-invalid={privacyError ? true : undefined}
              aria-describedby={privacyError ? "join-privacy-error" : undefined}
            />
            <label htmlFor="join-privacy">我已阅读并同意隐私说明</label>
          </div>
          {privacyError ? (
            <span id="join-privacy-error" className={styles.fieldError} role="alert">
              {privacyError}
            </span>
          ) : null}
        </div>

        {error ? <p className={shared.error}>{error}</p> : null}

        <button type="submit" className={shared.btnAccent} disabled={submitting}>
          {submitting ? "提交中…" : "提交申请"}
        </button>
      </form>
    </div>
  );
}
