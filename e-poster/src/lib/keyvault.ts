import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const APP_PREFIX = 'app-';
const LOCAL_PATH = join(process.cwd(), 'data', 'app-secrets.json');

let kvClient: import('@azure/keyvault-secrets').SecretClient | null = null;

async function getKvClient(): Promise<import('@azure/keyvault-secrets').SecretClient | null> {
  if (!process.env.AZURE_KV_URL) return null;
  if (kvClient) return kvClient;

  const { SecretClient } = await import('@azure/keyvault-secrets');
  const { DefaultAzureCredential } = await import('@azure/identity');
  kvClient = new SecretClient(process.env.AZURE_KV_URL, new DefaultAzureCredential());
  return kvClient;
}

function loadLocal(): Record<string, string> {
  if (!existsSync(LOCAL_PATH)) return {};
  return JSON.parse(readFileSync(LOCAL_PATH, 'utf-8'));
}

function saveLocal(data: Record<string, string>) {
  const dir = join(process.cwd(), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2));
}

export async function getAppSecret(name: string): Promise<string | null> {
  const kvName = `${APP_PREFIX}${name}`;
  const client = await getKvClient();
  if (client) {
    try {
      const secret = await client.getSecret(kvName);
      return secret.value ?? null;
    } catch {
      return null;
    }
  }
  return loadLocal()[name] ?? null;
}

export async function setAppSecret(name: string, value: string): Promise<void> {
  const kvName = `${APP_PREFIX}${name}`;
  const client = await getKvClient();
  if (client) {
    await client.setSecret(kvName, value);
    return;
  }
  const data = loadLocal();
  data[name] = value;
  saveLocal(data);
}

export async function deleteAppSecret(name: string): Promise<void> {
  const kvName = `${APP_PREFIX}${name}`;
  const client = await getKvClient();
  if (client) {
    await client.beginDeleteSecret(kvName);
    return;
  }
  const data = loadLocal();
  delete data[name];
  saveLocal(data);
}
