import type { Product } from '../../db/models/product.js';
import type { Brand } from '../../db/models/brand.js';
import type { Category } from '../../db/models/category.js';
import type { Ingredient } from '../../db/models/ingredient.js';

type ProductWithBrandCategory = Product & {
  Brand?: Brand;
  Category?: Category;
  ingredients?: Ingredient[];
};

type BrandMini = { id: number; name: string } | null;
type CategoryMini = { id: number; name: string } | null;

function computeScore(scoreSum: number | string, scoreCnt: number): string | null {
  return scoreCnt > 0 ? (Number(scoreSum) / scoreCnt).toFixed(1) : null;
}

function pickBrand(b?: Brand): BrandMini {
  return b ? { id: b.id, name: b.name } : null;
}

function pickCategory(c?: Category): CategoryMini {
  return c ? { id: c.id, name: c.name } : null;
}

export type IngredientSummary = {
  id: number;
  korName: string;
  engName: string | null;
  ewgGrade: string;
  usePurpose: string | null;
  remarks: string | null;
};

function toIngredientSummary(i: Ingredient): IngredientSummary {
  return {
    id: i.id,
    korName: i.korName,
    engName: i.engName ?? null,
    ewgGrade: i.ewgGrade,
    usePurpose: i.usePurpose ?? null,
    remarks: i.remarks ?? null,
  };
}

export function toProductListItem(p: ProductWithBrandCategory) {
  return {
    id: p.id,
    name: p.name,
    imgUrl: p.imgUrl,
    price: p.price,
    priceUnit: p.priceUnit,
    views: p.views,
    scoreCnt: p.scoreCnt,
    score: computeScore(p.scoreSum, p.scoreCnt),
    productGrade: p.productGrade,
    ingredientGrade: p.ingredientGrade,
    brand: pickBrand(p.Brand),
    category: pickCategory(p.Category),
  };
}

export function toProductDetail(
  p: ProductWithBrandCategory,
  bufferedViews: number,
) {
  const ingredients = p.ingredients ?? [];
  return {
    id: p.id,
    name: p.name,
    imgUrl: p.imgUrl,
    price: p.price,
    priceUnit: p.priceUnit,
    views: p.views + bufferedViews,
    scoreCnt: p.scoreCnt,
    score: computeScore(p.scoreSum, p.scoreCnt),
    productGrade: p.productGrade,
    ingredientGrade: p.ingredientGrade,
    brand: pickBrand(p.Brand),
    category: pickCategory(p.Category),
    ingredients: ingredients.map(toIngredientSummary),
    groupedIngredients: groupIngredients(ingredients),
  };
}

function groupIngredients(list: Ingredient[]) {
  return {
    byInterest: {
      isFragrance: list.filter((i) => i.isFragrance).map(toIngredientSummary),
      isSlsSles: list.filter((i) => i.isSlsSles).map(toIngredientSummary),
      isColor: list.filter((i) => i.isColor).map(toIngredientSummary),
      isHumid: list.filter((i) => i.isHumid).map(toIngredientSummary),
    },
    byUsage: {
      allergic: list.filter((i) => i.isAllergic).map(toIngredientSummary),
    },
    byCaution: {
      high: list.filter((i) => i.ewgGrade === 'X').map(toIngredientSummary),
      middle: list.filter((i) => i.ewgGrade === 'D').map(toIngredientSummary),
      low: list.filter((i) => i.ewgGrade === 'C').map(toIngredientSummary),
    },
  };
}
