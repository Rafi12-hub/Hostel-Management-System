import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useDemoAuth, type Role } from "@/context/DemoAuthContext";

interface DemoProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const DemoProtectedRoute: React.FC<DemoProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role } = useDemoAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-red-100 p-4 text-red-600 dark:bg-red-950 dark:text-red-400">
          <span className="text-2xl font-bold">403</span>
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Access Restricted</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Your current role (<strong className="uppercase">{role}</strong>) does not have permission to access this module. Use the Role Switcher in the top bar to switch roles.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
