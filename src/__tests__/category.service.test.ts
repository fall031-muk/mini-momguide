import { describe, it, expect } from 'vitest';
import { seedData } from './setup.js';
import { getCategoryTree, createCategory } from '../modules/categories/category.service.js';

describe('CategoryService', () => {
  describe('getCategoryTree', () => {
    it('루트 노드를 반환한다', async () => {
      const tree = await getCategoryTree();

      expect(tree.length).toBe(1);
      expect(tree[0].name).toBe('Baby&Kid');
      expect(tree[0].depth).toBe(0);
    });

    it('4단계 트리 구조로 조립된다', async () => {
      const tree = await getCategoryTree();
      const root = tree[0];

      expect(root.children.length).toBe(1);
      expect(root.children[0].name).toBe('유아 리빙케어');
      expect(root.children[0].children[0].name).toBe('유아 세탁세제');
      expect(root.children[0].children[0].children[0].name).toBe('세탁비누/기타');
    });

    it('children이 없는 리프 노드는 빈 배열', async () => {
      const tree = await getCategoryTree();
      const leaf = tree[0].children[0].children[0].children[0]; // 세탁비누/기타

      expect(leaf.children).toEqual([]);
    });
  });

  describe('createCategory', () => {
    it('새 카테고리를 생성한다', async () => {
      const category = await createCategory({ name: '테스트 카테고리' });

      expect(category.id).toBeDefined();
      expect(category.name).toBe('테스트 카테고리');
      expect(category.depth).toBe(0);
    });

    it('parentId 지정 시 depth가 자동 계산된다', async () => {
      const category = await createCategory({
        name: '하위 카테고리',
        parentId: seedData.categories.soap.id,
      });

      expect(category.depth).toBe(4);
    });
  });
});
