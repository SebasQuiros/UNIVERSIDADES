import { Module } from '@nestjs/common';
import { SuperadminService }    from './superadmin.service';
import { SuperadminController } from './superadmin.controller';

@Module({
  providers:   [SuperadminService],
  controllers: [SuperadminController],
  exports:     [SuperadminService],
})
export class SuperadminModule {}
