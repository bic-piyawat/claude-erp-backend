import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { AttachmentService } from './attachment.service';

@ApiTags('attachments')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('projects/:projectId/attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Get()
  async findAll(@Param('projectId') projectId: string) {
    return this.attachmentService.findAllByProject(projectId);
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
  ) {
    return this.attachmentService.upload(
      projectId,
      req.activeOrganizationId!,
      req.user!.userId,
      file,
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
