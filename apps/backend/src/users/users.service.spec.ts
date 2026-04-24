import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('argon2');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

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
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        omit: { passwordHash: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmail', () => {
    it('should return user without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        omit: { passwordHash: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmailWithPassword', () => {
    it('should return user with passwordHash for auth comparison', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmailWithPassword('test@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('passwordHash');
    });
  });

  describe('createUser', () => {
    it('should hash password and create user omitting passwordHash', async () => {
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createUser({ email: 'new@example.com', password: 'password123' });

      expect(argon2.hash).toHaveBeenCalledWith('password123');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'new@example.com', passwordHash: 'hashed-password' },
        omit: { passwordHash: true },
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('listUsers', () => {
    it('should return users without passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.listUsers({});

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ omit: { passwordHash: true } }));
      expect(result).toHaveLength(1);
    });
  });
});
