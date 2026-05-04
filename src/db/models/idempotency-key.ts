import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import { sequelize } from '../sequelize.js';

/**
 * 멱등키 저장 테이블.
 *  - (userId, key, requestPath) UNIQUE: 같은 사용자가 같은 path에 같은 키로 재요청하면
 *    INSERT가 거부되고, 기존 row의 status/response를 그대로 돌려준다.
 *  - status='IN_FLIGHT'인 동안 두 번째 요청이 오면 409로 거절 (race 방지).
 *  - 응답을 JSON으로 박제해서 같은 결과 보장.
 */
export class IdempotencyKey extends Model<
  InferAttributes<IdempotencyKey>,
  InferCreationAttributes<IdempotencyKey>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare key: string;
  declare requestPath: string;
  declare status: 'IN_FLIGHT' | 'COMPLETED';
  declare responseStatus: CreationOptional<number | null>;
  declare responseBody: CreationOptional<object | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

IdempotencyKey.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    key: { type: DataTypes.STRING(100), allowNull: false },
    requestPath: { type: DataTypes.STRING(200), allowNull: false },
    status: {
      type: DataTypes.ENUM('IN_FLIGHT', 'COMPLETED'),
      allowNull: false,
      defaultValue: 'IN_FLIGHT',
    },
    responseStatus: { type: DataTypes.INTEGER, allowNull: true },
    responseBody: { type: DataTypes.JSON, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'IdempotencyKey',
    tableName: 'idempotency_keys',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'key', 'request_path'],
        name: 'uniq_user_key_path',
      },
    ],
  },
);
