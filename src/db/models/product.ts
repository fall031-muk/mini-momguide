import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
} from 'sequelize';
import { sequelize } from '../sequelize.js';
import { Brand } from './brand.js';
import { Category } from './category.js';

export type ProductGrade = 'A' | 'B' | 'C' | 'D' | 'X';
export type IngredientOverallGrade = 'O' | '△' | 'X';

export class Product extends Model<
  InferAttributes<Product>,
  InferCreationAttributes<Product>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare brandId: ForeignKey<Brand['id']>;
  declare categoryId: ForeignKey<Category['id']>;
  declare imgUrl: CreationOptional<string | null>;
  declare price: CreationOptional<number | null>;
  declare priceUnit: CreationOptional<string | null>;
  declare views: CreationOptional<number>;
  declare scoreSum: CreationOptional<number>;
  declare scoreCnt: CreationOptional<number>;
  declare productGrade: CreationOptional<ProductGrade | null>;
  declare ingredientGrade: CreationOptional<IngredientOverallGrade | null>;
  declare isDiscontinued: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Product.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(300), allowNull: false },
    brandId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'brands', key: 'id' },
    },
    categoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'categories', key: 'id' },
    },
    imgUrl: { type: DataTypes.STRING(500), allowNull: true },
    price: { type: DataTypes.INTEGER, allowNull: true },
    priceUnit: { type: DataTypes.STRING(100), allowNull: true },
    views: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    scoreSum: { type: DataTypes.DECIMAL(10, 1), defaultValue: 0 },
    scoreCnt: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
    productGrade: { type: DataTypes.ENUM('A', 'B', 'C', 'D', 'X'), allowNull: true },
    ingredientGrade: { type: DataTypes.ENUM('O', '△', 'X'), allowNull: true },
    isDiscontinued: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
    indexes: [
      { fields: ['category_id'] },
      { fields: ['brand_id'] },
      { fields: ['product_grade'] },
      { fields: ['name'] },
    ],
  },
);
