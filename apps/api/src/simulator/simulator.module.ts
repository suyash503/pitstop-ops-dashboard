import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [BookingsModule],
  providers: [SimulatorService],
})
export class SimulatorModule {}
