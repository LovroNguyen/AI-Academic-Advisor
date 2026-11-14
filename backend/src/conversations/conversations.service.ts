import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(studentId: string) {
    return this.prisma.conversation.create({
      data: {
        studentId,
      },
      include: {
        messages: true,
      },
    });
  }

  async findAll(studentId: string) {
    return this.prisma.conversation.findMany({
      where: { studentId },
      include: {
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getMessages(conversationId: string, studentId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, studentId },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation.messages;
  }
}
