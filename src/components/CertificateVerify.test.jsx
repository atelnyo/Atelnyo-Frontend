import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CertificateVerify from './CertificateVerify';

// Mock api service
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../services/api';

function renderWithQuery(cert) {
  const params = cert ? `?cert=${cert}` : '';
  return render(
    <MemoryRouter initialEntries={[`/verify${params}`]}>
      <CertificateVerify />
    </MemoryRouter>
  );
}

describe('CertificateVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "not found" when no cert param is provided', () => {
    renderWithQuery(null);
    expect(screen.getByText(/Certificate Verification/i)).toBeInTheDocument();
  });

  it('shows valid certificate details', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        valid: true,
        certificate_number: 'ATY-00000001-00000007',
        issued_at: '2026-08-27T12:00:00Z',
        course_title: 'Full Stack Web Development',
        learner_name: 'Jane Doe',
      },
    });

    renderWithQuery('ATY-00000001-00000007');

    await waitFor(() => {
      expect(screen.getByText(/Certificate Verified/)).toBeInTheDocument();
    });

    expect(screen.getByText('ATY-00000001-00000007')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Full Stack Web Development')).toBeInTheDocument();
    expect(screen.getByText('Official Certificate')).toBeInTheDocument();
  });

  it('shows invalid state when certificate not found', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } });

    renderWithQuery('ATY-99999999-99999999');

    await waitFor(() => {
      expect(screen.getByText(/Certificate Not Found/)).toBeInTheDocument();
    });

    expect(screen.getByText(
      /This certificate does not exist or the number is incorrect/
    )).toBeInTheDocument();
  });

  it('shows network error on API failure', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));

    renderWithQuery('ATY-00000001-00000007');

    await waitFor(() => {
      expect(screen.getByText(/Error/)).toBeInTheDocument();
    });

    expect(screen.getByText(
      /Network error. Please try again/
    )).toBeInTheDocument();
  });
});
