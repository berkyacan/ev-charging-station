import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChargerStatus, IssueReportStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { IssuesService } from './issues.service';

describe('IssuesService', () => {
  let issuesService: IssuesService;
  let prismaService: {
    station: {
      findUnique: jest.Mock;
    };
    charger: {
      findFirst: jest.Mock;
    };
    issueReport: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      station: {
        findUnique: jest.fn(),
      },
      charger: {
        findFirst: jest.fn(),
      },
      issueReport: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    issuesService = new IssuesService(
      prismaService as unknown as PrismaService,
    );
  });

  it('allows a user to create an issue report', async () => {
    prismaService.station.findUnique.mockResolvedValue({
      id: 'station-1',
    });
    prismaService.charger.findFirst.mockResolvedValue({
      id: 'charger-1',
      stationId: 'station-1',
    });
    prismaService.issueReport.create.mockResolvedValue(
      buildIssueReportRecord(),
    );

    const result = await issuesService.createIssueForUser(
      buildJwtUser({ role: UserRole.EV_DRIVER }),
      buildCreateIssueDto(),
    );

    expect(prismaService.issueReport.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        stationId: 'station-1',
        chargerId: 'charger-1',
        issueType: 'CHARGER_OFFLINE',
        description: 'The charger screen is unresponsive.',
        status: IssueReportStatus.OPEN,
      },
      include: {
        station: true,
        charger: true,
      },
    });
    expect(result).toMatchObject({
      id: 'issue-1',
      issueType: 'CHARGER_OFFLINE',
      status: IssueReportStatus.OPEN,
    });
  });

  it('allows an operator to list issue reports', async () => {
    prismaService.issueReport.findMany.mockResolvedValue([
      buildIssueReportRecordWithReporter(),
    ]);

    const result = await issuesService.findAllForOperator(
      buildJwtUser({ role: UserRole.OPERATOR }),
    );

    expect(prismaService.issueReport.findMany).toHaveBeenCalledWith({
      include: {
        user: true,
        station: true,
        charger: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0].reporter.email).toBe('driver.demo@evcharging.local');
  });

  it('rejects non-driver issue creation', async () => {
    await expect(
      issuesService.createIssueForUser(
        buildJwtUser({ role: UserRole.OPERATOR }),
        buildCreateIssueDto(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects non-operator issue listing', async () => {
    await expect(
      issuesService.findAllForOperator(
        buildJwtUser({ role: UserRole.EV_DRIVER }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing station when creating an issue report', async () => {
    prismaService.station.findUnique.mockResolvedValue(null);
    prismaService.charger.findFirst.mockResolvedValue(null);

    await expect(
      issuesService.createIssueForUser(
        buildJwtUser({ role: UserRole.EV_DRIVER }),
        buildCreateIssueDto(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function buildJwtUser(
  overrides?: Partial<JwtUserPayload>,
): JwtUserPayload {
  return {
    sub: overrides?.sub ?? 'user-1',
    email: overrides?.email ?? 'driver.demo@evcharging.local',
    role: overrides?.role ?? UserRole.EV_DRIVER,
  };
}

function buildCreateIssueDto(
  overrides?: Partial<CreateIssueReportDto>,
): CreateIssueReportDto {
  return {
    stationId: overrides?.stationId ?? 'station-1',
    chargerId: overrides?.chargerId ?? 'charger-1',
    issueType: overrides?.issueType ?? 'CHARGER_OFFLINE',
    description:
      overrides?.description ?? 'The charger screen is unresponsive.',
  };
}

function buildIssueReportRecord(): {
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
    status: ChargerStatus;
  };
} {
  return {
    id: 'issue-1',
    issueType: 'CHARGER_OFFLINE',
    description: 'The charger screen is unresponsive.',
    status: IssueReportStatus.OPEN,
    createdAt: new Date('2026-05-03T10:00:00.000Z'),
    station: {
      id: 'station-1',
      name: 'Karsiyaka Hub',
      address: 'Izmir',
    },
    charger: {
      id: 'charger-1',
      label: 'DC 50kW #03',
      status: ChargerStatus.OFFLINE,
    },
  };
}

function buildIssueReportRecordWithReporter(): ReturnType<
  typeof buildIssueReportRecord
> & {
  user: {
    id: string;
    name: string;
    email: string;
  };
} {
  return {
    ...buildIssueReportRecord(),
    user: {
      id: 'user-1',
      name: 'Demo EV Driver',
      email: 'driver.demo@evcharging.local',
    },
  };
}
