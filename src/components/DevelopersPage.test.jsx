import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import api from '../services/api';
import DevelopersPage from './DevelopersPage';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

const renderPage = (props = {}) => render(
  <HelmetProvider>
    <DevelopersPage {...props} />
  </HelmetProvider>,
);

describe('DevelopersPage', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    api.get.mockReset();
  });

  it('renders the English landing hero and quickstart', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Build on Atelnyo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Quickstart' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore the API' })).toHaveAttribute('href', '#api');
    expect(screen.getByText('https://api.atelnyo.site/api/')).toBeInTheDocument();
  });

  it('renders the page in Haitian Creole', () => {
    renderPage({ lang: 'ht' });

    expect(screen.getByRole('heading', { level: 1, name: 'Bati sou Atelnyo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Demaraj rapid' })).toBeInTheDocument();
  });

  it('falls back to English for an unsupported language', () => {
    renderPage({ lang: 'de' });

    expect(screen.getByRole('heading', { level: 1, name: 'Build on Atelnyo' })).toBeInTheDocument();
  });

  it('copies the quickstart sample to the clipboard', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('curl -X POST https://api.atelnyo.site/api/login/'),
    );
  });

  it('switches the quickstart sample language and copies the active one', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Python' }));
    expect(screen.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('import requests');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('import requests'),
    ));
  });

  it('links the in-page nav to existing sections', () => {
    renderPage();

    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#quickstart',
      '#features',
      '#api',
      '#errors',
      '#integrations',
      '#open-source',
      '#tools',
      '#contact',
    ]);
    links.forEach((link) => {
      expect(document.getElementById(link.getAttribute('href').slice(1))).not.toBeNull();
    });
  });

  it('sends a live explorer request and shows the response', async () => {
    api.get.mockResolvedValue({ status: 200, data: { ok: true } });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(screen.getByText('HTTP 200')).toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith('courses/', { timeout: 8000 });
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
  });

  it('reports a failed explorer request', async () => {
    api.get.mockRejectedValue({ response: { status: 503 } });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => expect(screen.getByText(/Request failed/)).toBeInTheDocument());
    expect(screen.getByText(/HTTP 503/)).toBeInTheDocument();
  });

  it('documents rate limits and error responses', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Rate limits & errors/ })).toBeInTheDocument();
    expect(screen.getByText('5 / min per IP')).toBeInTheDocument();
    expect(screen.getByText('429')).toBeInTheDocument();
    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    expect(screen.getByText('Dependency unavailable')).toBeInTheDocument();
  });

  it('shows a retry-with-backoff sample in the errors section', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /Retry with backoff/ })).toBeInTheDocument();
    expect(screen.getByText(/getWithRetry/)).toBeInTheDocument();
    expect(screen.getByText(/headers\.get\('Retry-After'\)/)).toBeInTheDocument();
  });

  it('preselects an endpoint in the explorer from its row', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Try it: GET /jobs/' }));

    expect(screen.getByLabelText('Endpoint')).toHaveValue('jobs/');
  });

  it('lists API endpoints with their HTTP methods', () => {
    renderPage();

    expect(screen.getByText('/courses/')).toBeInTheDocument();
    expect(screen.getByText('/login/')).toBeInTheDocument();
    expect(screen.getAllByText('GET').length).toBeGreaterThan(0);
    expect(screen.getAllByText('POST').length).toBeGreaterThan(0);
  });
});
