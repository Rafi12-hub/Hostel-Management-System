import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import SplashScreen from "./SplashScreen";
import { DemoAuthProvider } from "@/context/DemoAuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PrivateLayout } from "@/components/layout/PrivateLayout";
import { DemoProtectedRoute } from "@/components/auth/DemoProtectedRoute";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { ToastProvider } from "@/components/ui/Toast";

// Public Pages (lazy-loaded)
const Home = lazy(() => import("@/pages/public/Home"));
const FoodMenu = lazy(() => import("@/pages/public/FoodMenu"));
const Hostels = lazy(() => import("@/pages/public/Hostels"));
const Facilities = lazy(() => import("@/pages/public/Facilities"));
const Announcements = lazy(() => import("@/pages/public/Announcements"));
const HostelRules = lazy(() => import("@/pages/public/HostelRules"));
const Faq = lazy(() => import("@/pages/public/Faq"));
const Emergency = lazy(() => import("@/pages/public/Emergency"));
const Contact = lazy(() => import("@/pages/public/Contact"));
const Login = lazy(() => import("@/pages/public/Login"));

// Private Portal Pages (lazy-loaded)
const Dashboard = lazy(() => import("@/pages/portal/Dashboard"));
const MyRoom = lazy(() => import("@/pages/portal/MyRoom"));
const Profile = lazy(() => import("@/pages/portal/Profile"));
const Students = lazy(() => import("@/pages/portal/Students"));
const Rooms = lazy(() => import("@/pages/portal/Rooms"));
const RoomAvailability = lazy(() => import("@/pages/portal/RoomAvailability"));
const GatePass = lazy(() => import("@/pages/portal/GatePass"));
const EntryExit = lazy(() => import("@/pages/portal/EntryExit"));
const Leave = lazy(() => import("@/pages/portal/Leave"));
const Attendance = lazy(() => import("@/pages/portal/Attendance"));
const NightRollCall = lazy(() => import("@/pages/portal/NightRollCall"));
const Visitors = lazy(() => import("@/pages/portal/Visitors"));
const Maintenance = lazy(() => import("@/pages/portal/Maintenance"));
const Housekeeping = lazy(() => import("@/pages/portal/Housekeeping"));
const Mess = lazy(() => import("@/pages/portal/Mess"));
const Inventory = lazy(() => import("@/pages/portal/Inventory"));
const ManageAnnouncements = lazy(() => import("@/pages/portal/ManageAnnouncements"));
const Notifications = lazy(() => import("@/pages/portal/Notifications"));
const UserManagement = lazy(() => import("@/pages/portal/UserManagement"));
const Reports = lazy(() => import("@/pages/portal/Reports"));
const Analytics = lazy(() => import("@/pages/portal/Analytics"));
const AuditLogs = lazy(() => import("@/pages/portal/AuditLogs"));
const Settings = lazy(() => import("@/pages/portal/Settings"));
const ParentNotifications = lazy(() => import("@/pages/portal/ParentNotifications"));

// Smart Hostel Security Module Pages (lazy-loaded)
const GateScanner = lazy(() => import("@/pages/security/GateScanner"));
const GateActivity = lazy(() => import("@/pages/security/GateActivity"));
const FaceEnrollment = lazy(() => import("@/pages/security/FaceEnrollment"));
const WardenLeaveRequests = lazy(() => import("@/pages/security/WardenLeaveRequests"));
const ParentNotificationLog = lazy(() => import("@/pages/security/ParentNotificationLog"));

export default function App() {
  return (
    <ThemeProvider>
      <DemoAuthProvider>
        <ToastProvider>
          <SplashScreen />
          <HashRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
          {/* Public Website Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/food-menu" element={<FoodMenu />} />
            <Route path="/hostels" element={<Hostels />} />
            <Route path="/facilities" element={<Facilities />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/hostel-rules" element={<HostelRules />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Private Management Portal Routes */}
          <Route
            element={
              <DemoProtectedRoute>
                <PrivateLayout />
              </DemoProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-room" element={<MyRoom />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/students" element={<Students />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/room-availability" element={<RoomAvailability />} />
            <Route path="/gate-pass" element={<GatePass />} />
            <Route path="/entry-exit" element={<EntryExit />} />
            <Route path="/leave" element={<Leave />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/night-roll-call" element={<NightRollCall />} />
            <Route path="/visitors" element={<Visitors />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/housekeeping" element={<Housekeeping />} />
            <Route path="/mess" element={<Mess />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/manage-announcements" element={<ManageAnnouncements />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/user-management"
              element={
                <DemoProtectedRoute allowedRoles={["admin", "chief_warden", "warden"]}>
                  <UserManagement />
                </DemoProtectedRoute>
              }
            />
            <Route path="/reports" element={<Reports />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/parent-notifications" element={<ParentNotifications />} />
            <Route path="/settings" element={<Settings />} />

            {/* Smart Hostel Security Module */}
            <Route
              path="/security/gate-scanner"
              element={
                <DemoProtectedRoute allowedRoles={["security", "warden", "admin", "chief_warden", "hostel_office", "management"]}>
                  <GateScanner />
                </DemoProtectedRoute>
              }
            />
            <Route
              path="/security/gate-activity"
              element={
                <DemoProtectedRoute allowedRoles={["security", "warden", "admin", "chief_warden", "hostel_office", "management", "principal"]}>
                  <GateActivity />
                </DemoProtectedRoute>
              }
            />
            <Route
              path="/face/enrollment"
              element={
                <DemoProtectedRoute allowedRoles={["student"]}>
                  <FaceEnrollment />
                </DemoProtectedRoute>
              }
            />
            <Route
              path="/warden/leave-requests"
              element={
                <DemoProtectedRoute allowedRoles={["warden", "admin", "chief_warden", "hostel_office"]}>
                  <WardenLeaveRequests />
                </DemoProtectedRoute>
              }
            />
            <Route
              path="/notification-log"
              element={
                <DemoProtectedRoute allowedRoles={["warden", "admin", "chief_warden", "hostel_office", "management", "principal"]}>
                  <ParentNotificationLog />
                </DemoProtectedRoute>
              }
            />
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </HashRouter>
        </ToastProvider>
    </DemoAuthProvider>
    </ThemeProvider>
  );
}
