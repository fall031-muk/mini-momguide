import { describe, it, expect } from 'vitest';
import { listBrands, createBrand } from '../modules/brands/brand.service.js';

describe('BrandService', () => {
  describe('listBrands', () => {
    it('브랜드 목록을 이름순으로 반환한다', async () => {
      const brands = await listBrands();

      expect(brands.length).toBeGreaterThanOrEqual(3);
      const names = brands.map((b) => b.name);
      expect(names).toEqual([...names].sort());
    });
  });

  describe('createBrand', () => {
    it('새 브랜드를 생성한다', async () => {
      const brand = await createBrand({ name: '테스트브랜드' });

      expect(brand.id).toBeDefined();
      expect(brand.name).toBe('테스트브랜드');
    });

    it('중복 이름은 에러를 던진다', async () => {
      await expect(createBrand({ name: 'MOTHER-K' })).rejects.toThrow();
    });
  });
});
