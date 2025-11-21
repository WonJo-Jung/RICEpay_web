import { IsEthereumAddress, IsInt, IsOptional, isString, IsString } from 'class-validator';

export class CreateTxDto {
  @IsString() txHash!: `0x${string}`;
  @IsEthereumAddress() from!: `0x${string}`;
  @IsEthereumAddress() to!: `0x${string}`;
  @IsInt() chainId!: number;
  @IsString() gasPaid!: string;
  @IsString() quote!: string;
  @IsOptional() @IsString() token?: `0x${string}`;
  @IsOptional() @IsString() amount?: string;
}