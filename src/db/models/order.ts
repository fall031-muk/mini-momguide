import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
} from 'sequelize';
import { sequelize } from '../sequelize.js';
import { User } from './user.js';

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  declare id: CreationOptional<number>;
  declare orderUid: string;
  declare userId: ForeignKey<User['id']>;
  declare status: CreationOptional<OrderStatus>;
  declare totalAmount: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Order.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderUid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    totalAmount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    indexes: [{ fields: ['user_id'] }, { fields: ['status'] }],
  },
);
