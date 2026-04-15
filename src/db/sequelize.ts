import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { logger } from '../common/logger.js';

export const sequelize = new Sequelize({
  dialect: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  logging: env.NODE_ENV === 'development' ? (sql) => logger.debug(sql) : false,
  define: {
    underscored: true,
    timestamps: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
  pool: { max: 10, min: 0, idle: 10_000 },
});

export async function connectDb() {
  await sequelize.authenticate();
  logger.info('✅ MySQL connected');
}
