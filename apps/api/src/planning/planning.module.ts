/**
 * Planning Module — Blueprint §9.4.
 *
 * Budgets, savings goals, debt terms, calendar events and recurring rules ship
 * together because they are one product surface: a bill is a calendar event
 * driven by a recurring rule that spends against a budget line, and a debt's
 * minimum payment is a bill. Splitting them into five modules would mean five
 * copies of the same workspace-scoping and minor-unit parsing.
 */
import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  controllers: [PlanningController],
  providers: [PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
