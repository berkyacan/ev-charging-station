import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIssueReportDto } from './create-issue-report.dto';

describe('CreateIssueReportDto', () => {
  it('rejects a missing description', async () => {
    const dto = plainToInstance(CreateIssueReportDto, {
      stationId: 'station-1',
      chargerId: 'charger-1',
      issueType: 'CHARGER_OFFLINE',
      description: '',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'description')).toBe(
      true,
    );
  });
});
