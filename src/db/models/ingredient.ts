import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { sequelize } from '../sequelize.js';

export type EwgGrade = 'A' | 'B' | 'C' | 'D' | 'X';

export class Ingredient extends Model<
  InferAttributes<Ingredient>,
  InferCreationAttributes<Ingredient>
> {
  declare id: CreationOptional<number>;
  declare korName: string;
  declare engName: CreationOptional<string | null>;
  declare usePurpose: CreationOptional<string | null>;
  declare ewgGrade: EwgGrade;
  declare isFragrance: CreationOptional<boolean>;
  declare isSlsSles: CreationOptional<boolean>;
  declare isColor: CreationOptional<boolean>;
  declare isHumid: CreationOptional<boolean>;
  declare isAllergic: CreationOptional<boolean>;
  declare remarks: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Ingredient.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    korName: { type: DataTypes.STRING(200), allowNull: false },
    engName: { type: DataTypes.STRING(200), allowNull: true },
    usePurpose: { type: DataTypes.STRING(500), allowNull: true },
    ewgGrade: { type: DataTypes.ENUM('A', 'B', 'C', 'D', 'X'), allowNull: false },
    isFragrance: { type: DataTypes.BOOLEAN, defaultValue: false },
    isSlsSles: { type: DataTypes.BOOLEAN, defaultValue: false },
    isColor: { type: DataTypes.BOOLEAN, defaultValue: false },
    isHumid: { type: DataTypes.BOOLEAN, defaultValue: false },
    isAllergic: { type: DataTypes.BOOLEAN, defaultValue: false },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Ingredient',
    tableName: 'ingredients',
    indexes: [
      { fields: ['kor_name'] },
      { fields: ['ewg_grade'] },
    ],
  },
);
