import { Module } from '@nestjs/common';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { PrismaModule } from '../../prisma/prisma.module';
// El movimiento de banco ahora genera su asiento: hace falta el diario.
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [PrismaModule, JournalModule],
  controllers: [BankController],
  providers: [BankService],
})
export class BankModule {}
