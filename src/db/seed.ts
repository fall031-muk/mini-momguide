import { sequelize } from './sequelize.js';
import { setupAssociations } from './associations.js';
import { Brand } from './models/brand.js';
import { Category } from './models/category.js';
import { Product } from './models/product.js';
import { Ingredient } from './models/ingredient.js';
import { ProductIngredient } from './models/product-ingredient.js';
import { User } from './models/user.js';
import { logger } from '../common/logger.js';

async function seed() {
  await sequelize.authenticate();
  setupAssociations();
  await sequelize.sync({ force: true });
  logger.info('DB synced (force: true)');

  // 카테고리 — 3단계 트리 (Baby&Kid > 유아 리빙케어 > 유아 세탁세제 > 세탁비누/기타)
  const babyKid = await Category.create({ name: 'Baby&Kid', depth: 0 });
  const babyLiving = await Category.create({ name: '유아 리빙케어', parentId: babyKid.id, depth: 1 });
  const babyLaundry = await Category.create({ name: '유아 세탁세제', parentId: babyLiving.id, depth: 2 });
  const laundrySoap = await Category.create({ name: '세탁비누/기타', parentId: babyLaundry.id, depth: 3 });
  const liquidSoap = await Category.create({ name: '액체/가루세제', parentId: babyLaundry.id, depth: 3 });

  const babyDental = await Category.create({ name: '유아 덴탈케어', parentId: babyKid.id, depth: 1 });
  const babyToothpaste = await Category.create({ name: '유아 치약', parentId: babyDental.id, depth: 2 });
  await Category.create({ name: '무불소', parentId: babyToothpaste.id, depth: 3 });
  await Category.create({ name: '불소', parentId: babyToothpaste.id, depth: 3 });

  // 브랜드
  const motherK = await Brand.create({ name: '마더케이(MOTHER-K)' });
  const mybee = await Brand.create({ name: '마이비(MyBEE)' });
  const bnb = await Brand.create({ name: '비앤비(B&B)' });

  // 성분
  const water = await Ingredient.create({
    korName: '정제수', engName: 'Water', ewgGrade: 'A', usePurpose: '용제',
  });
  const glycerin = await Ingredient.create({
    korName: '글리세린', engName: 'Glycerin', ewgGrade: 'A', usePurpose: '보습제',
  });
  const fragrance = await Ingredient.create({
    korName: '향료', engName: 'Fragrance', ewgGrade: 'D',
    isFragrance: true, isAllergic: true,
    remarks: '복합 향료 성분. 알레르기 및 피부 자극 가능성 있음.',
  });
  const palmKernel = await Ingredient.create({
    korName: '팜커넬애씨드', engName: 'Palm Kernel Acid', ewgGrade: 'X',
    usePurpose: '계면활성제-세정제',
  });
  const sls = await Ingredient.create({
    korName: '소듐라우릴설페이트', engName: 'Sodium Lauryl Sulfate', ewgGrade: 'C',
    isSlsSles: true, usePurpose: '계면활성제',
  });

  // 제품
  const p1 = await Product.create({
    name: '디아 세탁비누 베르가못향', brandId: motherK.id, categoryId: laundrySoap.id,
    imgUrl: 'https://example.com/p1.png', price: 7430, priceUnit: '150g × 3개',
    views: 24074, scoreSum: 757, scoreCnt: 162,
    productGrade: 'B', ingredientGrade: 'O',
  });
  await ProductIngredient.bulkCreate([
    { productId: p1.id, ingredientId: water.id, displayOrder: 1 },
    { productId: p1.id, ingredientId: glycerin.id, displayOrder: 2 },
    { productId: p1.id, ingredientId: fragrance.id, displayOrder: 3 },
    { productId: p1.id, ingredientId: palmKernel.id, displayOrder: 4 },
  ]);

  const p2 = await Product.create({
    name: '마이비 얼룩제거제(리뉴얼)', brandId: mybee.id, categoryId: liquidSoap.id,
    price: 12000, priceUnit: '500ml',
    views: 31264, scoreSum: 1062.5, scoreCnt: 235,
    productGrade: 'X', ingredientGrade: '△',
  });
  await ProductIngredient.bulkCreate([
    { productId: p2.id, ingredientId: water.id, displayOrder: 1 },
    { productId: p2.id, ingredientId: sls.id, displayOrder: 2 },
    { productId: p2.id, ingredientId: fragrance.id, displayOrder: 3 },
  ]);

  const p3 = await Product.create({
    name: '비앤비 세탁비누 카모마일', brandId: bnb.id, categoryId: laundrySoap.id,
    price: 5500, priceUnit: '200g × 2개',
    views: 10956, scoreSum: 345.5, scoreCnt: 79,
    productGrade: 'A', ingredientGrade: 'O',
  });
  await ProductIngredient.bulkCreate([
    { productId: p3.id, ingredientId: water.id, displayOrder: 1 },
    { productId: p3.id, ingredientId: glycerin.id, displayOrder: 2 },
  ]);

  await User.bulkCreate([{ nickname: 'alice' }, { nickname: 'bob' }]);

  logger.info('✅ Seed completed');
  await sequelize.close();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
