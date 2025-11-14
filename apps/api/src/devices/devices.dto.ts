// devices.dto.ts
import { IsString, IsIn } from 'class-validator';

export class RegisterDeviceDto {
  @IsString() wallet: string;      // checksum address
  @IsString() pushToken: string;
  @IsString() @IsIn(['ios', 'android', 'expo']) platform: 'ios' | 'android' | 'expo';
}