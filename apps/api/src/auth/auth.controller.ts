import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, LoginResult } from './auth.service';
import { AuthUser, CurrentUser, Public } from './decorators';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange credentials for a JWT',
    description: 'Demo accounts: admin@pitstop.dev (ADMIN) and ops@pitstop.dev (OPS), password123.',
  })
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the user behind the current token' })
  @ApiOkResponse({ description: 'The authenticated user.' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
