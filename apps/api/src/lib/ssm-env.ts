// apps/api/src/lib/ssm-env.ts
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';

const REGION = process.env.AWS_REGION || 'us-east-1';

// SSM에 저장한 "이름 그대로" 적기
const PARAM_KEYS = [
  'ALCHEMY_AUTH_TOKEN',
  'ALCHEMY_WEBHOOK_ID',
  'ALCHEMY_WEBHOOK_SECRET',
  'DATABASE_URL',
  'IPREGISTRY_API_KEY',
  'OPENSANCTIONS_API_KEY',
  'OXR_APP_ID',
] as const;

export async function loadSsmEnv() {
  const client = new SSMClient({ region: REGION });

  const command = new GetParametersCommand({
    Names: PARAM_KEYS as unknown as string[],
    WithDecryption: true,
  });

  const { Parameters, InvalidParameters } = await client.send(command);

  for (const p of Parameters ?? []) {
    if (p.Name && p.Value) {
      // SSM 파라미터 이름과 env 이름을 "동일하게" 맞췄으니까
      // 그냥 process.env[이름]에 그대로 박아주면 됨
      process.env[p.Name] = p.Value;
    }
  }

  if (InvalidParameters && InvalidParameters.length > 0) {
    console.warn(
      '[SSM] Missing parameters:',
      InvalidParameters.join(', '),
    );
  }
}