import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { PortalLayout } from "./layouts/PortalLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/AboutPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { ActivityDetailPage } from "./pages/ActivityDetailPage";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { JoinPage } from "./pages/JoinPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="activities/:id" element={<ActivityDetailPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:id" element={<CourseDetailPage />} />
            <Route path="join" element={<JoinPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="me" element={<PlaceholderPage title="个人中心" />} />
            <Route
              path="me/*"
              element={<PlaceholderPage title="个人中心" note="个人中心子页由后续任务实现。" />}
            />
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
