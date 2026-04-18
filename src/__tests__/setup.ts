import { beforeAll, afterAll, beforeEach } from 'vitest';
import { sequelize } from '../db/sequelize.js';
import { setupAssociations } from '../db/associations.js';
import { Brand } from '../db/models/brand.js';
import { Category } from '../db/models/category.js';
import { Product } from '../db/models/product.js';
import { Ingredient } from '../db/models/ingredient.js';
import { ProductIngredient } from '../db/models/product-ingredient.js';
import { User } from '../db/models/user.js';
import { Review } from '../db/models/review.js';

export let seedData: {
  brands: { motherK: Brand; mybee: Brand; bnb: Brand };
  categories: { root: Category; living: Category; laundry: Category; soap: Category };
  ingredients: { water: Ingredient; glycerin: Ingredient; fragrance: Ingredient; sls: Ingredient };
  products: { soap1: Product; cleaner: Product; soap2: Product };
  users: { alice: User; bob: User };
};

setupAssociations();

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await insertSeedData();
});

beforeEach(async () => {
  await Review.destroy({ where: {} });
  await Product.update({ scoreSum: 0, scoreCnt: 0, rank: null, rankDiff: 0 }, { where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

async function insertSeedData() {
  const motherK = await Brand.create({ name: 'MOTHER-K' });
  const mybee = await Brand.create({ name: 'MyBEE' });
  const bnb = await Brand.create({ name: 'B&B' });

  const root = await Category.create({ name: 'Baby&Kid', depth: 0 });
  const living = await Category.create({ name: '유아 리빙케어', parentId: root.id, depth: 1 });
  const laundry = await Category.create({ name: '유아 세탁세제', parentId: living.id, depth: 2 });
  const soap = await Category.create({ name: '세탁비누/기타', parentId: laundry.id, depth: 3 });

  const water = await Ingredient.create({ korName: '정제수', engName: 'Water', ewgGrade: 'A' });
  const glycerin = await Ingredient.create({ korName: '글리세린', engName: 'Glycerin', ewgGrade: 'A' });
  const fragrance = await Ingredient.create({
    korName: '향료', engName: 'Fragrance', ewgGrade: 'D',
    isFragrance: true, isAllergic: true,
  });
  const sls = await Ingredient.create({
    korName: '소듐라우릴설페이트', engName: 'SLS', ewgGrade: 'C',
    isSlsSles: true,
  });

  const soap1 = await Product.create({
    name: '디아 세탁비누', brandId: motherK.id, categoryId: soap.id,
    views: 24074, scoreSum: 757, scoreCnt: 162, productGrade: 'B', ingredientGrade: 'O',
  });
  const cleaner = await Product.create({
    name: '마이비 얼룩제거제', brandId: mybee.id, categoryId: soap.id,
    views: 31264, scoreSum: 1062, scoreCnt: 235, productGrade: 'X', ingredientGrade: 'O',
  });
  const soap2 = await Product.create({
    name: '비앤비 세탁비누', brandId: bnb.id, categoryId: soap.id,
    views: 10956, scoreSum: 345, scoreCnt: 79, productGrade: 'A', ingredientGrade: 'O',
  });

  await ProductIngredient.bulkCreate([
    { productId: soap1.id, ingredientId: water.id, displayOrder: 1 },
    { productId: soap1.id, ingredientId: glycerin.id, displayOrder: 2 },
    { productId: soap1.id, ingredientId: fragrance.id, displayOrder: 3 },
    { productId: cleaner.id, ingredientId: water.id, displayOrder: 1 },
    { productId: cleaner.id, ingredientId: sls.id, displayOrder: 2 },
    { productId: soap2.id, ingredientId: water.id, displayOrder: 1 },
    { productId: soap2.id, ingredientId: glycerin.id, displayOrder: 2 },
  ]);

  const alice = await User.create({ nickname: 'alice' });
  const bob = await User.create({ nickname: 'bob' });

  seedData = {
    brands: { motherK, mybee, bnb },
    categories: { root, living, laundry, soap },
    ingredients: { water, glycerin, fragrance, sls },
    products: { soap1, cleaner, soap2 },
    users: { alice, bob },
  };
}
