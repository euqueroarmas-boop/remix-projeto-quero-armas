import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import type { AppRole } from '@/shared/types/domain';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: AppRole;
}

export const ProtectedRoute = ({ children, requireRole }: ProtectedRouteProps) => {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          Verificando acesso...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  if (requireRole && !roles.includes(requireRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
};