import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { QueryCustomersDto } from './dto/query-customers.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'List customers',
    description: 'Includes booking count, vehicle count and lifetime value from completed bookings.',
  })
  findAll(@Query() query: QueryCustomersDto) {
    return this.customers.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one customer with vehicles and recent bookings' })
  @ApiNotFoundResponse({ description: 'No customer with that id.' })
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }
}
