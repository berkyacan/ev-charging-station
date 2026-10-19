import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ISSUE_TYPES, IssueType } from '../types/issue-type';

export class CreateIssueReportDto {
  @IsString()
  @IsNotEmpty()
  stationId!: string;

  @IsString()
  @IsNotEmpty()
  chargerId!: string;

  @IsString()
  @IsIn(ISSUE_TYPES)
  issueType!: IssueType;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;
}
