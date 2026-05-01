import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
} from 'sequelize';
import { sequelize } from '../sequelize.js';
import { Order } from './order.js';

export type PaymentStatus = 'PAID' | 'FAILED' | 'CANCELLED';

export class Payment extends Model<
  InferAttributes<Payment>,
  InferCreationAttributes<Payment>
> {
  declare id: CreationOptional<number>;
  declare orderId: ForeignKey<Order['id']>;
  declare pgProvider: string;
  declare pgPaymentKey: string;
  declare amount: number;
  declare status: PaymentStatus;
  declare paidAt: CreationOptional<Date | null>;
  declare rawResponse: CreationOptional<object | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Payment.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      references: { model: 'orders', key: 'id' },
    },
    pgProvider: { type: DataTypes.STRING(30), allowNull: false },
    pgPaymentKey: { type: DataTypes.STRING(200), allowNull: false, unique: true },
    amount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    status: {
      type: DataTypes.ENUM('PAID', 'FAILED', 'CANCELLED'),
      allowNull: false,
    },
    paidAt: { type: DataTypes.DATE, allowNull: true },
    rawResponse: { type: DataTypes.JSON, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Payment',
    tableName: 'payments',
  },
);
