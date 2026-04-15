import { Category } from '../../db/models/category.js';

type CategoryNode = {
  id: number;
  name: string;
  depth: number;
  sortOrder: number;
  children: CategoryNode[];
};

export async function getCategoryTree(): Promise<CategoryNode[]> {
  const rows = await Category.findAll({
    order: [
      ['depth', 'ASC'],
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const map = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      depth: row.depth,
      sortOrder: row.sortOrder,
      children: [],
    });
  }

  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parentId == null) {
      roots.push(node);
    } else {
      map.get(row.parentId)?.children.push(node);
    }
  }

  return roots;
}

export async function createCategory(input: {
  name: string;
  parentId?: number | null;
}) {
  let depth = 0;
  if (input.parentId != null) {
    const parent = await Category.findByPk(input.parentId);
    if (!parent) throw new Error('Parent category not found');
    depth = parent.depth + 1;
  }
  return Category.create({ name: input.name, parentId: input.parentId ?? null, depth });
}
