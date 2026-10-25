import { describe, it, expect } from 'vitest';
import { safeNextPath } from './safeNextPath';

describe('safeNextPath', () => {
  it('accepts in-app paths, including query strings', () => {
    expect(safeNextPath('/store/products/poster')).toBe('/store/products/poster');
    expect(safeNextPath('/store/cart?x=1')).toBe('/store/cart?x=1');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
  });

  it('rejects auth pages to avoid login loops', () => {
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath('/store/login')).toBeNull();
    expect(safeNextPath('/signup')).toBeNull();
    expect(safeNextPath('/sheet/auth')).toBeNull();
  });

  it('rejects missing or non-string values', () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath('store/cart')).toBeNull();
  });
});
