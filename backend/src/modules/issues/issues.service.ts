import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IssueReportStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import {
  IssueReportResponse,
  OperatorIssueReportResponse,
} from './types/issue-response.type';

interface IssueReportRecord {
  id: string;
  issueType: string;
  description: string;
  status: IssueReportStatus;
  createdAt: Date;
  station: {
    id: string;
    name: string;
    address: string;
  };
  charger: {
    id: string;
    label: string;
    status: OperatorIssueReportResponse['charger']['status'];
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

@Injectable()
export class IssuesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createIssueForUser(
    currentUser: JwtUserPayload,
    dto: CreateIssueReportDto,
  ): Promise<IssueReportResponse> {
    this.assertEvDriverAccess(currentUser.role);

    const [station, charger] = await Promise.all([
      this.prismaService.station.findUnique({
        where: {
          id: dto.stationId,
        },
      }),
      this.prismaService.charger.findFirst({
        where: {
          id: dto.chargerId,
          stationId: dto.stationId,
        },
      }),
    ]);

    if (!station) {
      throw new NotFoundException('Station not found.');
    }

    if (!charger) {
      throw new NotFoundException('Charger not found for the given station.');
    }

    const issueReport = await this.prismaService.issueReport.create({
      data: {
        userId: currentUser.sub,
        stationId: station.id,
        chargerId: charger.id,
        issueType: dto.issueType,
        description: dto.description,
        status: IssueReportStatus.OPEN,
      },
      include: {
        station: true,
        charger: true,
      },
    });

    return this.toIssueReportResponse(issueReport);
  }

  async findAllForOperator(
    currentUser: JwtUserPayload,
  ): Promise<OperatorIssueReportResponse[]> {
    this.assertOperatorAccess(currentUser.role);

    const issueReports = await this.prismaService.issueReport.findMany({
      include: {
        user: true,
        station: true,
        charger: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return issueReports.map((issueReport) =>
      this.toOperatorIssueReportResponse(issueReport),
    );
  }

  private assertEvDriverAccess(role: UserRole): void {
    if (role !== UserRole.EV_DRIVER) {
      throw new ForbiddenException(
        'Only EV drivers can create issue reports.',
      );
    }
  }

  private assertOperatorAccess(role: UserRole): void {
    if (role !== UserRole.OPERATOR && role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only operators can view issue reports.',
      );
    }
  }

  private toIssueReportResponse(
    issueReport: IssueReportRecord,
  ): IssueReportResponse {
    return {
      id: issueReport.id,
      issueType: issueReport.issueType as IssueReportResponse['issueType'],
      description: issueReport.description,
      status: issueReport.status,
      createdAt: issueReport.createdAt.toISOString(),
      station: {
        id: issueReport.station.id,
        name: issueReport.station.name,
        address: issueReport.station.address,
      },
      charger: {
        id: issueReport.charger.id,
        label: issueReport.charger.label,
        status: issueReport.charger.status,
      },
    };
  }

  private toOperatorIssueReportResponse(
    issueReport: IssueReportRecord,
  ): OperatorIssueReportResponse {
    if (!issueReport.user) {
      throw new Error('Operator issue report mapping requires reporter data.');
    }

    return {
      ...this.toIssueReportResponse(issueReport),
      reporter: {
        id: issueReport.user.id,
        name: issueReport.user.name,
        email: issueReport.user.email,
      },
    };
  }
}
