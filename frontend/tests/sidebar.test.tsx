import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sidebar } from '@/components/layout/Sidebar';
import i18n from '@/i18n';
import type { Role } from '@/types';

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

function linksFor(role: Role) {
  render(
    <MemoryRouter>
      <Sidebar role={role} />
    </MemoryRouter>,
  );
  const nav = screen.getByRole('navigation', { name: 'Asosiy menyu' });
  return within(nav)
    .getAllByRole('link')
    .map((a) => [a.textContent, a.getAttribute('href')]);
}

const BASE = [
  ['Bosh sahifa', '/'],
  ['Namunalar', '/samples'],
  ['Moddalar', '/substances'],
  ['Reyestr', '/registry'],
  ['Harorat', '/temperature'],
  // P17 (D-175, D-176): barcha kompaniya rollariga
  ['Apparatlar', '/equipment'],
  ['Normativ hujjatlar', '/nd'],
];
// P18 (D-187): Protokollar — chemist, lab_head, director, admin (kontrolyor yo'q)
const PROTOCOLS = ['Protokollar', '/protocols'];
const MANAGER = [...BASE, PROTOCOLS, ['Foydalanuvchilar', '/users'], ['Faoliyat', '/activity']];
// P13 (D-165): "Mening natijalarim" — analitika rollari, "Jamoa" — lab_head/director; admin'da yo'q
const ME = ['Mening natijalarim', '/me'];
const TEAM = ['Jamoa', '/team'];
const ANALYST = [...BASE, ME];
const CHEMIST = [...BASE, PROTOCOLS, ME];
const LEAD = [
  ...BASE,
  PROTOCOLS,
  ME,
  TEAM,
  ['Foydalanuvchilar', '/users'],
  ['Faoliyat', '/activity'],
];

describe('Sidebar (D-28, D-149)', () => {
  it.each([
    ['kontrolyor', ANALYST],
    ['chemist', CHEMIST],
    ['lab_head', LEAD],
    ['director', LEAD],
    ['admin', MANAGER],
    [
      'super_admin',
      [
        ['Kompaniyalar', '/companies'],
        ['Audit jurnali', '/logs'],
      ],
    ],
  ] as [Role, string[][]][])('%s', (role, expected) => {
    expect(linksFor(role)).toEqual(expected);
  });

  it("hech bir rolda Reaktivlar, Stabilizatsiya yo'q", () => {
    for (const role of [
      'super_admin',
      'kontrolyor',
      'chemist',
      'lab_head',
      'director',
      'admin',
    ] as Role[]) {
      const hrefs = linksFor(role).map(([, href]) => href);
      expect(hrefs).not.toContain('/reagents');
      expect(hrefs).not.toContain('/stability');
      document.body.innerHTML = '';
    }
  });
});
