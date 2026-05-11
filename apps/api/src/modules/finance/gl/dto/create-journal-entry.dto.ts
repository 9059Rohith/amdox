import { IsString, IsDateString, IsArray, ValidateNested, IsNumber, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class JournalLineDto {
  @ApiProperty() @IsString() accountId: string;
  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] }) @IsIn(['DEBIT', 'CREDIT']) type: 'DEBIT' | 'CREDIT';
  @ApiProperty() @IsNumber() amount: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() exchangeRate?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsDateString() entryDate: string;
  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}
