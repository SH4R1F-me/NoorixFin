/**
 * Transactions Module — Blueprint §8.2, §9.3, §11.2
 * Journal entry engine with balanced postings.
 */
import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  // Transactions resolve a category to its backing ledger account (DEC-015).
  imports: [CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
