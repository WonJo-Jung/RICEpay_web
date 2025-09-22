import { IsEthereumAddress, IsInt, IsString } from 'class-validator';

export class PreviewDto {
  @IsString() chainId: string;               // 8453 | 84532
  @IsEthereumAddress() from: string;
  @IsEthereumAddress() to: string;
  @IsEthereumAddress() token: string;     // USDC
  @IsString() amount: string;             // bigint string (6 decimals)
}