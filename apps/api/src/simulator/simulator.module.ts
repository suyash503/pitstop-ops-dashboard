import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [BookingsModule, RealtimeModule],
  providers: [SimulatorService],
})
export class SimulatorModule {}
