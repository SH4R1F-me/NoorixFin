/**
 * Transactions Module — Blueprint §8.2, §9.3, §11.2
 * Journal entry engine with balanced postings.
 */
import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
