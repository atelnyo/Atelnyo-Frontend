// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import LegacyProductRedirect from './LegacyProductRedirect';

function StoreTarget() {
  const { slug } = useParams();
  return <p>STORE PRODUCT {slug}</p>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/marketplace/:id" element={<LegacyProductRedirect />} />
        <Route path="/:key/product" element={<LegacyProductRedirect />} />
        <Route path="/:slug/by/:user/product" element={<LegacyProductRedirect />} />
        <Route path="/store/products/:slug" element={<StoreTarget />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LegacyProductRedirect', () => {
  it('redirects /marketplace/:id to the Store detail', async () => {
    renderAt('/marketplace/42');
    expect(await screen.findByText('STORE PRODUCT 42')).toBeTruthy();
  });

  it('strips the legacy @username key', async () => {
    renderAt('/konpase-dijital@alex/product');
    expect(await screen.findByText('STORE PRODUCT konpase-dijital')).toBeTruthy();
  });

  it('redirects the old /by/:user product canonical shape', async () => {
    renderAt('/konpase-dijital/by/alex/product');
    expect(await screen.findByText('STORE PRODUCT konpase-dijital')).toBeTruthy();
  });
});
