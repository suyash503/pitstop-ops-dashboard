import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from './decorators';
import { LoginDto } from './dto/login.dto';

export type LoginResult = {
  accessToken: string;
  user: AuthUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });

    // Same message and roughly the same work whether the email exists or not,
    // so the response cannot be used to enumerate accounts.
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : await bcrypt.compare(dto.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
