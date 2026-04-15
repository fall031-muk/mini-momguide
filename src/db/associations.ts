import { Brand } from './models/brand.js';
import { Category } from './models/category.js';
import { Product } from './models/product.js';
import { Ingredient } from './models/ingredient.js';
import { ProductIngredient } from './models/product-ingredient.js';
import { User } from './models/user.js';
import { Review } from './models/review.js';

export function setupAssociations() {
  Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });
  Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });

  Brand.hasMany(Product, { foreignKey: 'brandId' });
  Product.belongsTo(Brand, { foreignKey: 'brandId' });

  Category.hasMany(Product, { foreignKey: 'categoryId' });
  Product.belongsTo(Category, { foreignKey: 'categoryId' });

  Product.belongsToMany(Ingredient, {
    through: ProductIngredient,
    foreignKey: 'productId',
    otherKey: 'ingredientId',
    as: 'ingredients',
  });
  Ingredient.belongsToMany(Product, {
    through: ProductIngredient,
    foreignKey: 'ingredientId',
    otherKey: 'productId',
    as: 'products',
  });

  User.hasMany(Review, { foreignKey: 'userId' });
  Review.belongsTo(User, { foreignKey: 'userId' });

  Product.hasMany(Review, { foreignKey: 'productId' });
  Review.belongsTo(Product, { foreignKey: 'productId' });
}
