import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@Request() req) {
    return this.conversationsService.create(req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.conversationsService.findAll(req.user.id);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Request() req) {
    return this.conversationsService.getMessages(id, req.user.id);
  }
}
