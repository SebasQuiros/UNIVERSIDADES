import { Module, Global } from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { DownloadsController } from './downloads.controller';

// Global: cualquier modulo que liste recursos descargables necesita firmar
// enlaces (facturas hoy; notas de credito y recepciones despues).
@Global()
@Module({
  providers:   [DownloadsService],
  controllers: [DownloadsController],
  exports:     [DownloadsService],
})
export class DownloadsModule {}
