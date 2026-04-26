import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  OrganizationGuard,
  AuthenticatedRequest,
} from '../../common/guards/organization.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@ApiTags('products')
@ApiCookieAuth('access_token')
@UseGuards(OrganizationGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryProductDto,
  ) {
    return this.productService.findAll(
      req.activeOrganizationId!,
      query.search,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
  ) {
    return this.productService.create(req.activeOrganizationId!, dto);
  }

  @Get(':id')
  async findById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.productService.findById(id, req.activeOrganizationId!);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, req.activeOrganizationId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.productService.delete(id, req.activeOrganizationId!);
  }
}
