import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByEmailWithPassword: jest.fn(),
            createUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without passwordHash when credentials are valid', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.validateUser('unknown@example.com', 'password123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should return a JWT access_token', async () => {
      const user = { id: 'user-1', email: 'test@example.com', name: 'Test' };
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');

      const result = await service.login(user);

      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1', email: 'test@example.com' });
      expect(result).toEqual({ access_token: 'mock-jwt-token' });
    });
  });

  describe('register', () => {
    it('should create a new user when email is not taken', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register('new@example.com', 'password123');

      expect(usersService.createUser).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
      });
      expect(result.email).toBe('new@example.com');
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register('test@example.com', 'password123')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
