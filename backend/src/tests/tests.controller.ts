import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { TestsService, SubmitQuizDto } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// In-memory quiz session cache (keyed by "testId:userId")
const quizCache = new Map<string, any[]>();

@UseGuards(JwtAuthGuard)
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() createTestDto: CreateTestDto) {
    return this.testsService.create(createTestDto);
  }

  @Get('upcoming')
  getUpcoming(@Request() req) {
    return this.testsService.getUpcoming(req.user?.id);
  }

  @Get('attempts')
  getAttempts(@Request() req) {
    return this.testsService.getAttempts(req.user?.id);
  }

  @Get()
  findAll() {
    return this.testsService.findAll();
  }

  // ── AI Quiz: generate questions for a test ─────────────────────────────────
  @Post(':id/generate')
  async generateQuiz(@Param('id') id: string, @Request() req) {
    const { questions, source, basedOn } = await this.testsService.generateQuiz(id);
    // Cache questions for submission (keyed by testId + userId)
    const cacheKey = `${id}:${req.user?.id}`;
    quizCache.set(cacheKey, questions);
    // Never send correct answers or explanations before the student submits.
    return {
      questions: questions.map(({ answer, explanation, ...publicFields }) => publicFields),
      source,
      basedOn,
    };
  }

  // ── AI Quiz: submit answers, get score ────────────────────────────────────
  @Post(':id/submit')
  async submitQuiz(
    @Param('id') id: string,
    @Body() body: { answers: { questionId: number; answer: string }[] },
    @Request() req,
  ) {
    const cacheKey = `${id}:${req.user?.id}`;
    const questions = quizCache.get(cacheKey);
    if (!questions) {
      // Regenerating here could grade answers against different questions than the student saw.
      throw new BadRequestException('Quiz session expired (e.g. the server restarted). Please start the quiz again.');
    }
    quizCache.delete(cacheKey); // Clear after submit
    return this.testsService.submitQuiz({ testId: id, studentId: req.user?.id, answers: body.answers }, questions);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id/result')
  updateResult(@Param('id') id: string, @Body() dto: UpdateTestResultDto) {
    return this.testsService.updateResult(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.testsService.remove(id);
  }
}
