import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAdminPermission } from "./admin/RequireAdminPermission";
import { PortalLayout } from "./layouts/PortalLayout";
import { MeLayout } from "./layouts/MeLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { HomePage } from "./pages/HomePage";
import { ContentDetailPage } from "./pages/ContentDetailPage";
import { AboutPage } from "./pages/AboutPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { ActivityDetailPage } from "./pages/ActivityDetailPage";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { JoinPage } from "./pages/JoinPage";
import { LoginPage } from "./pages/LoginPage";
import { MeOverviewPage } from "./pages/me/MeOverviewPage";
import { MeEnrollmentsPage } from "./pages/me/MeEnrollmentsPage";
import { MeApplicationsPage } from "./pages/me/MeApplicationsPage";
import { MePointsPage } from "./pages/me/MePointsPage";
import { NewApplicationPage } from "./pages/me/NewApplicationPage";
import { ApplicationDetailPage } from "./pages/me/ApplicationDetailPage";
import { ConsolePage } from "./pages/admin/ConsolePage";
import { ContentPage } from "./pages/admin/ContentPage";
import { JoinListPage } from "./pages/admin/JoinListPage";
import { JoinDetailPage } from "./pages/admin/JoinDetailPage";
import { ActivitiesListPage } from "./pages/admin/ActivitiesListPage";
import { ActivityEditPage } from "./pages/admin/ActivityEditPage";
import { ActivityEnrollmentsPage } from "./pages/admin/ActivityEnrollmentsPage";
import { CoursesPage as AdminCoursesPage } from "./pages/admin/CoursesPage";
import { CourseEditPage } from "./pages/admin/CourseEditPage";
import { CourseEnrollmentsPage } from "./pages/admin/CourseEnrollmentsPage";
import { PointTypesPage } from "./pages/admin/PointTypesPage";
import { PointAppsListPage } from "./pages/admin/PointAppsListPage";
import { PointAppDetailPage } from "./pages/admin/PointAppDetailPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { PermissionsPage } from "./pages/admin/PermissionsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route index element={<HomePage />} />
            <Route path="content/:key" element={<ContentDetailPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="activities/:id" element={<ActivityDetailPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:id" element={<CourseDetailPage />} />
            <Route path="join" element={<JoinPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="me" element={<MeLayout />}>
              <Route index element={<MeOverviewPage />} />
              <Route path="enrollments" element={<MeEnrollmentsPage />} />
              <Route path="applications" element={<MeApplicationsPage />} />
              <Route path="applications/new" element={<NewApplicationPage />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
              <Route path="points" element={<MePointsPage />} />
            </Route>
          </Route>
          <Route path="admin" element={<AdminLayout />}>
            <Route
              index
              element={
                <RequireAdminPermission>
                  <ConsolePage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="content"
              element={
                <RequireAdminPermission permission="content">
                  <ContentPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="join"
              element={
                <RequireAdminPermission permission="join_review">
                  <JoinListPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="join/:id"
              element={
                <RequireAdminPermission permission="join_review">
                  <JoinDetailPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="activities"
              element={
                <RequireAdminPermission permission="activity">
                  <ActivitiesListPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="activities/new"
              element={
                <RequireAdminPermission permission="activity">
                  <ActivityEditPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="activities/:id/edit"
              element={
                <RequireAdminPermission permission="activity">
                  <ActivityEditPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="activities/:id/enrollments"
              element={
                <RequireAdminPermission permission="activity">
                  <ActivityEnrollmentsPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="courses"
              element={
                <RequireAdminPermission permission="activity">
                  <AdminCoursesPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="courses/new"
              element={
                <RequireAdminPermission permission="activity">
                  <CourseEditPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="courses/:id/edit"
              element={
                <RequireAdminPermission permission="activity">
                  <CourseEditPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="courses/:id/enrollments"
              element={
                <RequireAdminPermission permission="activity">
                  <CourseEnrollmentsPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="point-types"
              element={
                <RequireAdminPermission permission="point_type">
                  <PointTypesPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="point-apps"
              element={
                <RequireAdminPermission permission="point_review">
                  <PointAppsListPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="point-apps/:id"
              element={
                <RequireAdminPermission permission="point_review">
                  <PointAppDetailPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="users"
              element={
                <RequireAdminPermission permission="user">
                  <UsersPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="dashboard"
              element={
                <RequireAdminPermission permission="dashboard">
                  <DashboardPage />
                </RequireAdminPermission>
              }
            />
            <Route
              path="permissions"
              element={
                <RequireAdminPermission permission="permission">
                  <PermissionsPage />
                </RequireAdminPermission>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
