import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Controller } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {}
