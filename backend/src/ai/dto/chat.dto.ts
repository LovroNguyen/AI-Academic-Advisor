import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatMessageItemDto {
  @IsString()
  sender: 'user' | 'ai';

  @IsString()
  content: string;
}

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  chatHistory?: ChatMessageItemDto[];
}
