import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
} from 'sequelize';
import { sequelize } from '../sequelize.js';
import { Product } from './product.js';
import { Ingredient } from './ingredient.js';

export class ProductIngredient extends Model<
  InferAttributes<ProductIngredient>,
  InferCreationAttributes<ProductIngredient>
> {
  declare productId: ForeignKey<Product['id']>;
  declare ingredientId: ForeignKey<Ingredient['id']>;
  declare displayOrder: CreationOptional<number>;
}

ProductIngredient.init(
  {
    productId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      references: { model: 'products', key: 'id' },
    },
    ingredientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      references: { model: 'ingredients', key: 'id' },
    },
    displayOrder: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'ProductIngredient',
    tableName: 'product_ingredients',
    timestamps: false,
  },
);
