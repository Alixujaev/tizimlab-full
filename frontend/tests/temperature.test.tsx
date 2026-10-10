import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import type {
  SensorConfigDto,
  SensorStatusDto,
  TemperatureAlertDto,
  TemperatureReadingDto,
} from '@/types';
import { loginAs, renderAt, resetAuth } from './helpers';

let api: MockAdapter;

const mockSensor: SensorConfigDto = {
  id: 'sensor-1',
  companyId: 'c1',
  sensorId: 'SENSOR-01',
  locationName: 'Steril xona',
  tempMin: 18,
  tempMax: 24,
  humidityMin: 40,
  humidityMax: 60,
  isActive: true,
  apiKey: 'sensor-key-123',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

const mockReading: TemperatureReadingDto = {
  id: 'read-1',
  companyId: 'c1',
  sensorConfigId: 'sensor-1',
  sensorId: 'SENSOR-01',
  locationName: 'Steril xona',
  temperature: 21.5,
  humidity: 50,
  alertTriggered: false,
  recordedAt: '2026-03-01T12:00:00.000Z',
  isManual: false,
  recordedBy: null,
};

const mockAlert: TemperatureAlertDto = {
  id: 'alert-1',
  companyId: 'c1',
  sensorConfigId: 'sensor-1',
  sensorId: 'SENSOR-01',
  locationName: 'Steril xona',
  readingId: 'read-2',
  temperature: 28.5,
  alertType: 'temp_high',
  resolvedAt: null,
  resolvedBy: null,
  resolutionNote: null,
  notifiedAt: '2026-03-01T12:05:00.000Z',
  createdAt: '2026-03-01T12:05:00.000Z',
};

const mockStatus: SensorStatusDto[] = [
  {
    sensor: mockSensor,
    latestReading: mockReading,
    activeAlertCount: 1,
    stats24h: {
      minTemp: 19.0,
      maxTemp: 28.5,
      avgTemp: 22.1,
      readingCount: 10,
    },
  },
];

describe('Frontend: Harorat monitoringi sahifasi (P8, spec §7, D-52, D-136..D-140)', () => {
  beforeEach(() => {
    resetAuth();
    api = new MockAdapter(apiClient);

    api.onGet(/\/temperature\/status/).reply(200, { data: mockStatus });
    api.onGet(/\/temperature\/sensors/).reply(200, { data: [mockSensor] });
    api.onGet(/\/temperature\/readings/).reply(200, {
      data: [mockReading],
      meta: { page: 1, limit: 20, total: 1 },
    });
    api.onGet(/\/temperature\/alerts/).reply(200, {
      data: [mockAlert],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  afterEach(() => {
    api.restore();
    resetAuth();
  });

  describe('1. Ruxsat matritsasi va ko‘rinish qoidalari (RBAC UX)', () => {
    it('kontrolyor, chemist va director: sahifa ochiladi, lekin yozish tugmalari ko‘rinmaydi', async () => {
      for (const role of ['kontrolyor', 'chemist', 'director'] as const) {
        resetAuth();
        loginAs(role);
        renderAt('/temperature');

        await waitFor(() => {
          expect(screen.getAllByText('Steril xona').length).toBeGreaterThan(0);
        });

        // Ko'rish rollarida kiritish/sozlash tugmalari bo'lmasligi kerak (403 so'rov yuborilmaydi)
        expect(screen.queryByRole('button', { name: /\+ Qo'lda kiritish/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Sensor sozlamalari/i })).not.toBeInTheDocument();
      }
    });

    it('lab_head va admin: boshqaruv tugmalari mavjud bo‘ladi', async () => {
      for (const role of ['lab_head', 'admin'] as const) {
        resetAuth();
        loginAs(role);
        renderAt('/temperature');

        await waitFor(() => {
          expect(screen.getAllByText('Steril xona').length).toBeGreaterThan(0);
        });

        expect(screen.getAllByRole('button', { name: /Qo'lda kiritish/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /Sensor sozlamalari/i }).length).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Ko‘rsatkichlar va Alertlar jadvali', () => {
    it('o‘qishlar va status kartasi to‘g‘ri ma’lumotlarni ko‘rsatadi', async () => {
      loginAs('lab_head');
      renderAt('/temperature');

      await waitFor(() => {
        expect(screen.getAllByText('Steril xona').length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText(/21\.5/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('tablarni almashtirish va alertlar ro‘yxatini ko‘rish', async () => {
      loginAs('lab_head');
      renderAt('/temperature');

      await waitFor(() => {
        expect(screen.getAllByText('Steril xona').length).toBeGreaterThan(0);
      });

      // Alertlar tabiga o'tish
      const alertsTab = screen.getByRole('button', { name: /Ogohlantirishlar/i });
      await userEvent.click(alertsTab);

      await waitFor(() => {
        expect(screen.getAllByText(/28\.5/).length).toBeGreaterThan(0);
      });

      // lab_head uchun "Yopish" tugmasi chiqadi
      expect(screen.getByRole('button', { name: 'Yopish' })).toBeInTheDocument();
    });
  });

  describe('3. Qo‘lda kiritish modali', () => {
    it('lab_head qo‘lda o‘qish kiritish modalini ocha oladi', async () => {
      loginAs('lab_head');
      renderAt('/temperature');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Qo'lda kiritish/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /Qo'lda kiritish/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Saqlash/i })).toBeInTheDocument();
      });
    });
  });
});
