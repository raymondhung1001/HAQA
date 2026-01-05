import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './guards';
import { CurrentUser } from './decorators';
import { Users } from './entities/Users';
import { Public } from './decorators';

@Controller()
@UseGuards(JwtAuthGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('auth/check')
  checkAuth(@CurrentUser() user: Users): { authenticated: boolean; user: { id: number; username: string; email: string } } {
    return {
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  @Get('profile')
  getProfile(@CurrentUser() user: Users): Users {
    return user;
  }
}
