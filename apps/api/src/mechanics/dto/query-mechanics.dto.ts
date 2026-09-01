import { ApiPropertyOptional } from '@nestjs/swagger';
import { MechanicStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryMechanicsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MechanicStatus })
  @IsOptional()
  @IsEnum(MechanicStatus)
  status?: MechanicStatus;

  @ApiPropertyOptional({ description: 'Matches mechanic name or specialization.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;
}
