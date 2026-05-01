import { describe, it, expect, beforeEach } from 'vitest';
import { signup, login, verifyToken } from '../modules/auth/auth.service.js';
import { User } from '../db/models/user.js';

describe('auth.service', () => {
  beforeEach(async () => {
    await User.destroy({ where: { email: ['new@test.com', 'login@test.com'] } });
  });

  describe('signup', () => {
    it('회원가입 후 JWT 토큰을 발급한다', async () => {
      const result = await signup({
        email: 'new@test.com',
        password: 'password123',
        nickname: 'newbie',
      });
      expect(result.user.email).toBe('new@test.com');
      expect(result.user.passwordHash).not.toBe('password123');
      expect(result.token).toMatch(/^eyJ/);

      const payload = verifyToken(result.token);
      expect(payload.sub).toBe(result.user.id);
      expect(payload.nickname).toBe('newbie');
    });

    it('중복 이메일은 409', async () => {
      await signup({ email: 'new@test.com', password: 'password123', nickname: 'a1' });
      await expect(
        signup({ email: 'new@test.com', password: 'password123', nickname: 'a2' }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('login', () => {
    it('올바른 자격증명으로 로그인 성공', async () => {
      await signup({ email: 'login@test.com', password: 'password123', nickname: 'loginer' });
      const result = await login({ email: 'login@test.com', password: 'password123' });
      expect(result.token).toMatch(/^eyJ/);
    });

    it('비밀번호 틀리면 401', async () => {
      await signup({ email: 'login@test.com', password: 'password123', nickname: 'loginer' });
      await expect(
        login({ email: 'login@test.com', password: 'wrong' }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('없는 이메일은 401', async () => {
      await expect(
        login({ email: 'ghost@test.com', password: 'whatever' }),
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('verifyToken', () => {
    it('잘못된 토큰은 401', () => {
      expect(() => verifyToken('not-a-jwt')).toThrowError();
    });
  });
});
