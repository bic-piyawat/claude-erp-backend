import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as os from 'os';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { AuditTrailInterceptor } from '../../common/interceptors/audit-trail.interceptor';
import { AttachmentService } from './attachment.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { QueryAttachmentDto } from './dto/query-attachment.dto';

@ApiTags('attachments')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@UseInterceptors(AuditTrailInterceptor)
@Controller('projects/:projectId/attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryAttachmentDto,
  ) {
    return this.attachmentService.findAllByProject(projectId, query.category);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
  ) {
    return this.attachmentService.upload(
      projectId,
      req.activeOrganizationId!,
      req.user!.userId,
      file,
      dto.category,
    );
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('projectId') projectId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.attachmentService.delete(projectId, attachmentId);
  }
}
