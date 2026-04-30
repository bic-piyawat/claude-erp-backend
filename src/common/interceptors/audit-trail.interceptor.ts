import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedRequest } from '../guards/organization.guard';

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method?.toUpperCase();

    if (method !== 'PATCH' && method !== 'DELETE') {
      return next.handle();
    }

    const userId = request.user?.userId;
    const organizationId = request.activeOrganizationId;

    if (!userId || !organizationId) {
      return next.handle();
    }

    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    const entityId = params['id'] ?? params['projectId'] ?? 'unknown';

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              entityType: this.resolveEntityType(request.path ?? ''),
              entityId,
              action: method,
              fieldChanged: body ? Object.keys(body).join(',') : null,
              oldValue: null,
              newValue: body ? JSON.stringify(body) : null,
              userId,
              organizationId,
            },
          });
        } catch {
          // audit log failure must not break the response
        }
      }),
    );
  }

  private resolveEntityType(path: string): string {
    // Most-specific-first ordering: nested/leaf paths (e.g. /projects/:id/cost-items)
    // must be matched BEFORE their parent prefix (/projects) so the resolver
    // correctly identifies the actual entity being mutated.
    if (path.includes('/cost-items')) return 'CostItem';
    if (path.includes('/estimate-items')) return 'EstimateItem';
    if (path.includes('/contacts')) return 'ContactPerson';
    if (path.includes('/attachments')) return 'Attachment';
    if (path.includes('/budget')) return 'Budget';
    if (path.includes('/customers')) return 'Customer';
    if (path.includes('/suppliers')) return 'Supplier';
    if (path.includes('/products')) return 'Product';
    if (path.includes('/stages')) return 'Stage';
    if (path.includes('/projects')) return 'Project';
    return 'Unknown';
  }
}
