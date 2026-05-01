import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../database/database.module';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    // In production, validate against Keycloak OIDC
    // For dev/testing: lookup user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        tenants: {
          where: { isActive: true },
          include: { tenant: true },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenantUser = user.tenants[0];
    if (!tenantUser) throw new UnauthorizedException('No active tenant found for user');

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: tenantUser.tenantId,
      role: tenantUser.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION', '8h'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 28800,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: tenantUser.role,
        tenantId: tenantUser.tenantId,
        tenantName: tenantUser.tenant.name,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken);
      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, email: payload.email, tenantId: payload.tenantId, role: payload.role },
        { expiresIn: this.configService.get('JWT_EXPIRATION', '8h') },
      );
      return { accessToken: newAccessToken, expiresIn: 28800, tokenType: 'Bearer' };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          where: { tenantId, isActive: true },
          include: { tenant: { select: { id: true, name: true, slug: true, logo: true } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const tenantUser = user.tenants[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: tenantUser?.role,
      tenantId: tenantUser?.tenantId,
      tenant: tenantUser?.tenant,
    };
  }
}
