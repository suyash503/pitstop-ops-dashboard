import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryMechanicsDto } from './dto/query-mechanics.dto';
import { MechanicsService } from './mechanics.service';

@ApiTags('mechanics')
@ApiBearerAuth()
@Controller('mechanics')
export class MechanicsController {
  constructor(private readonly mechanics: MechanicsService) {}

  @Get()
  @ApiOperation({
    summary: 'List mechanics with their current job',
    description: 'Each row carries the mechanic current in-flight booking, or their most recent one if idle.',
  })
  findAll(@Query() query: QueryMechanicsDto) {
    return this.mechanics.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one mechanic with recent job history' })
  @ApiNotFoundResponse({ description: 'No mechanic with that id.' })
  findOne(@Param('id') id: string) {
    return this.mechanics.findOne(id);
  }
}
