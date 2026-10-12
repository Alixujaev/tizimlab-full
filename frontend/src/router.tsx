import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { RoleRoute } from '@/components/routing/RoleRoute';
import { MANAGER_ROLES } from '@/config/navigation';
import { LoginPage } from '@/pages/auth/LoginPage';
import { CompaniesPage } from '@/pages/companies/CompaniesPage';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { RegistryDetailPage } from '@/pages/registry/RegistryDetailPage';
import { RegistryPage } from '@/pages/registry/RegistryPage';
import { SampleDetailPage } from '@/pages/samples/SampleDetailPage';
import { SamplesPage } from '@/pages/samples/SamplesPage';
import { SubstancesPage } from '@/pages/substances/SubstancesPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { ReagentsPage } from '@/pages/reagents/ReagentsPage';
import { ReagentDetailPage } from '@/pages/reagents/ReagentDetailPage';
import { ReagentJournalPage } from '@/pages/reagents/ReagentJournalPage';
import { ExpensesPage } from '@/pages/reagents/ExpensesPage';
import { TemperaturePage } from '@/pages/temperature/TemperaturePage';
import { StabilityPage } from '@/pages/stability/StabilityPage';
import { StabilityDetailPage } from '@/pages/stability/StabilityDetailPage';
import { AuditLogPage } from '@/pages/audit/AuditLogPage';
import { ActivityPage } from '@/pages/activity/ActivityPage';
import { COMPANY_ROLES } from '@/types';

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
          { path: '/profile', element: <ProfilePage /> },
          {
            // Kompaniya ichidagi ish oqimlari — super_admin qatnashmaydi (spec §1)
            element: <RoleRoute roles={COMPANY_ROLES} />,
            children: [
              { path: '/samples', element: <SamplesPage /> },
              { path: '/samples/:id', element: <SampleDetailPage /> },
              { path: '/registry', element: <RegistryPage /> },
              { path: '/registry/:id', element: <RegistryDetailPage /> },
              // Eski Protokollar sahifasi o'rniga Reyestr (spec §3)
              { path: '/protocols', element: <Navigate to="/registry" replace /> },
              { path: '/protocols/:id', element: <Navigate to="/registry" replace /> },
              { path: '/substances', element: <SubstancesPage /> },
              { path: '/substances/:id', element: <SubstancesPage /> },
              { path: '/reagents', element: <ReagentsPage /> },
              { path: '/reagents/:id', element: <ReagentDetailPage /> },
              { path: '/reagents/journal', element: <ReagentJournalPage /> },
              { path: '/expenses', element: <ExpensesPage /> },
              { path: '/temperature', element: <TemperaturePage /> },
              { path: '/stability', element: <StabilityPage /> },
              { path: '/stability/:id', element: <StabilityDetailPage /> },
            ],
          },
          {
            element: <RoleRoute roles={MANAGER_ROLES} />,
            children: [
              { path: '/users', element: <UsersPage /> },
              { path: '/activity', element: <ActivityPage /> },
            ],
          },
          {
            element: <RoleRoute roles={['super_admin']} />,
            children: [
              { path: '/companies', element: <CompaniesPage /> },
              { path: '/logs', element: <AuditLogPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
