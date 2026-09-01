import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus, description: 'Target status. Must be a legal transition from the current one.' })
  @IsEnum(BookingStatus)
  status!: BookingStatus;

  @ApiPropertyOptional({ description: 'Optional note recorded on the timeline entry.' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
