import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [RealtimeModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  // Exported so the ops simulator drives bookings through the same validated
  // path the HTTP API uses, instead of writing to the database behind its back.
  exports: [BookingsService],
})
export class BookingsModule {}
