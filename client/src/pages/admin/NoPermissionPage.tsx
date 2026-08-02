import { Link } from "react-router-dom";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

export function NoPermissionPage() {
  return (
    <div className={styles.noPermission}>
      <div className={styles.noPermissionIcon} aria-hidden>
        ⛔
      </div>
      <h2>您没有访问该页面的权限</h2>
      <p className={shared.muted}>如需开通，请联系超级管理员分配权限包。</p>
      <Link to="/admin" className={shared.btnPrimary}>
        返回控制台
      </Link>
    </div>
  );
}
