import { IsIn, IsOptional } from 'class-validator';

export class GetRateDto {
  @IsOptional()
  @IsIn(['USD'])
  base: 'USD' = 'USD';

  @IsOptional()
  @IsIn(['MXN'])
  quote: 'MXN' = 'MXN';
}