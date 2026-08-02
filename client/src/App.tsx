import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { PortalLayout } from "./layouts/PortalLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route index element={<PlaceholderPage title="首页" />} />
            <Route path="about" element={<PlaceholderPage title="计划介绍" />} />
            <Route path="activities" element={<PlaceholderPage title="活动" />} />
            <Route path="courses" element={<PlaceholderPage title="课程" />} />
            <Route path="join" element={<PlaceholderPage title="加入我们" />} />
            <Route path="login" element={<PlaceholderPage title="登录" />} />
            <Route path="me" element={<PlaceholderPage title="个人中心" />} />
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<PlaceholderPage title="控制台" />} />
            <Route path="content" element={<PlaceholderPage title="内容运营" />} />
            <Route path="join" element={<PlaceholderPage title="加入审核" />} />
            <Route path="activities" element={<PlaceholderPage title="活动管理" />} />
            <Route path="point-types" element={<PlaceholderPage title="积分类型" />} />
            <Route path="point-apps" element={<PlaceholderPage title="积分审批" />} />
            <Route path="users" element={<PlaceholderPage title="用户管理" />} />
            <Route path="permissions" element={<PlaceholderPage title="权限管理" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
