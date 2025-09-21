import { IsEthereumAddress, IsInt, IsString } from 'class-validator';

export class PreviewDto {
  @IsInt() chainId: number;               // 8453 | 84532
  @IsEthereumAddress() from: string;
  @IsEthereumAddress() to: string;
  @IsEthereumAddress() token: string;     // USDC
  @IsString() amount: string;             // bigint string (6 decimals)
}