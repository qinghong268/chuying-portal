import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { PointLedgerEntry } from "../../api/types";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./me.module.css";

type RangeFilter = "30" | "90" | "all";

export function MePointsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>("30");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ balance: number; ledger: PointLedgerEntry[] }>("/api/me/points");
      setBalance(data.balance);
      setLedger(data.ledger);
    } catch {
      setError("积分数据加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (range === "all") return ledger;
    const days = range === "30" ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return ledger.filter((entry) => entry.createdAt >= cutoff);
  }, [ledger, range]);

  return (
    <>
      <div className={styles.pageHead}>
        <h2 className={styles.pageHeadTitle}>积分明细</h2>
      </div>

      <section className={`${shared.panel} ${styles.statCard}`}>
        <span className={styles.statLabel}>当前积分余额</span>
        {loading ? (
          <div className={styles.skeleton} style={{ width: "4rem" }} />
        ) : (
          <span className={styles.statValue}>{balance ?? "—"}</span>
        )}
        <div className={styles.statActions}>
          <Link to="/me/applications/new" className={shared.btnAccent}>
            发起积分申请
          </Link>
        </div>
      </section>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="points-range">时间范围</label>
          <select
            id="points-range"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeFilter)}
          >
            <option value="30">近 30 天</option>
            <option value="90">近 90 天</option>
            <option value="all">全部</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className={shared.btnRow}>
          <p className={shared.error}>{error}</p>
          <button type="button" className={shared.btnSecondary} onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : filtered.length === 0 ? (
        <div className={shared.empty}>
          <p>暂无积分流水</p>
          <p>通过活动心得或专项申请，审批通过后将在此展示</p>
          <div className={shared.btnRow}>
            <Link to="/me/applications/new" className={shared.btnAccent}>
              发起积分申请
            </Link>
            <Link to="/me/applications" className={shared.btnSecondary}>
              我的申请
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>变动</th>
                <th>余额快照</th>
                <th>来源说明</th>
                <th>关联申请</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</td>
                  <td>{entry.balanceAfter}</td>
                  <td>{entry.description}</td>
                  <td>
                    {entry.applicationId ? (
                      <Link to={`/me/applications/${entry.applicationId}`}>查看申请</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
