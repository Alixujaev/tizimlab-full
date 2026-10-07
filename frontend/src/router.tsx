import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { RoleRoute } from '@/components/routing/RoleRoute';
import { MANAGER_ROLES } from '@/config/navigation';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ComingSoonPage } from '@/pages/common/ComingSoonPage';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { HomePage } from '@/pages/HomePage';
import { COMPANY_ROLES } from '@/types';

const stub = (path: string, titleKey: string): RouteObject => ({
  path,
  element: <ComingSoonPage titleKey={titleKey} />,
});

/**
 * Barcha yo'llar (spec §3, §6, §10, §11, §16; D-29). Sahifalar hozircha stub —
 * tegishli fazada almashtiriladi. Rol cheklovlari spec §1 matritsasi bo'yicha.
 */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          // Barcha autentifikatsiyalangan foydalanuvchilar (super_admin ham)
          stub('/profile', 'pages.profile'),
          {
            // Kompaniya ichidagi ish oqimlari — super_admin qatnashmaydi (spec §1)
            element: <RoleRoute roles={COMPANY_ROLES} />,
            children: [
              stub('/samples', 'pages.samples'),
              stub('/samples/:id', 'pages.sampleDetail'),
              stub('/registry', 'pages.registry'),
              stub('/registry/:id', 'pages.registryDetail'),
              // Eski Protokollar sahifasi o'rniga Reyestr (spec §3)
              { path: '/protocols', element: <Navigate to="/registry" replace /> },
              { path: '/protocols/:id', element: <Navigate to="/registry" replace /> },
              stub('/substances', 'pages.substances'),
              stub('/substances/:id', 'pages.substanceDetail'),
              stub('/reagents', 'pages.reagents'),
              stub('/reagents/journal', 'pages.reagentJournal'),
              stub('/expenses', 'pages.expenses'),
              stub('/temperature', 'pages.temperature'),
              stub('/stability', 'pages.stability'),
              stub('/stability/:id', 'pages.stabilityDetail'),
            ],
          },
          {
            element: <RoleRoute roles={MANAGER_ROLES} />,
            children: [stub('/users', 'pages.users'), stub('/activity', 'pages.activity')],
          },
          {
            element: <RoleRoute roles={['super_admin']} />,
            children: [stub('/companies', 'pages.companies'), stub('/logs', 'pages.auditLog')],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
