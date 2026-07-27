import { Module } from '@nestjs/common';
import { NegotiationsService } from './negotiations.service';
import { NegotiationsController } from './negotiations.controller';

@Module({
  providers:   [NegotiationsService],
  controllers: [NegotiationsController],
  exports:     [NegotiationsService],
})
export class NegotiationsModule {}
