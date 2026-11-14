import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Server-side client for the Python face-recognition service.
 * The browser never talks to the face service directly: every call goes through
 * this admin-only API, and the backend authenticates to the face service with a
 * shared key (FACE_SERVICE_API_KEY) that is never sent to the browser.
 */
@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);

  constructor(private prisma: PrismaService) {}

  private get baseUrl(): string {
    return (process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
  }

  private async call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<any> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.FACE_SERVICE_API_KEY || '',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err: any) {
      this.logger.warn(`Face service unreachable: ${err.message}`);
      throw new ServiceUnavailableException('Face service is offline. Start the Python service (face-service/start.bat).');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Pass the face service's own message through (e.g. "No face detected"), but never its auth details.
      const detail = res.status === 401 ? 'Face service rejected the backend key (check FACE_SERVICE_API_KEY).' : data?.detail;
      throw new HttpException(detail || 'Face service error', res.status === 401 ? 502 : res.status);
    }
    return data;
  }

  listStudents() {
    return this.call('GET', '/students');
  }

  async register(studentId: string, imageBase64: string) {
    // The name comes from the database, not from the client.
    const student = await this.prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, role: true } });
    if (!student) throw new NotFoundException('Student not found');
    if (student.role !== 'student') throw new BadRequestException('Only student accounts can have a face template.');
    return this.call('POST', '/register', { student_id: student.id, student_name: student.name, image_base64: imageBase64 });
  }

  recognize(imageBase64: string, tolerance?: number, minFacePx?: number) {
    return this.call('POST', '/recognize', {
      image_base64: imageBase64,
      ...(tolerance !== undefined ? { tolerance } : {}),
      ...(minFacePx !== undefined ? { min_face_px: minFacePx } : {}),
    });
  }

  remove(studentId: string) {
    return this.call('DELETE', `/students/${encodeURIComponent(studentId)}`);
  }
}
