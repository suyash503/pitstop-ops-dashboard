import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'List the service catalogue',
    description: 'Small, static reference data — used to populate filter dropdowns in the UI.',
  })
  findAll() {
    return this.prisma.service.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, basePrice: true, durationMins: true },
    });
  }
}
