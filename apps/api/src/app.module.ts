import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BookingsModule } from './bookings/bookings.module';
import { CacheModule } from './common/cache/cache.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { MechanicsModule } from './mechanics/mechanics.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ServicesModule } from './services/services.module';
import { SimulatorModule } from './simulator/simulator.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CacheModule,
    AuthModule,
    RealtimeModule,
    HealthModule,
    DashboardModule,
    BookingsModule,
    MechanicsModule,
    CustomersModule,
    ServicesModule,
    SimulatorModule,
  ],
  providers: [
    // Order matters: throttle first, then authenticate, then authorise. Each
    // guard is global so a new route is protected by default and has to opt out
    // explicitly with @Public().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
