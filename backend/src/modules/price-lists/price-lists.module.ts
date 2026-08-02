import { Module } from '@nestjs/common';
import { PriceListsService } from './price-lists.service';
import { PriceListsController } from './price-lists.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PriceListsController],
  providers: [PriceListsService],
})
export class PriceListsModule {}
