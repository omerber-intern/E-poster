import fs from 'fs';
import path from 'path';
import { getAppSecret, setAppSecret, deleteAppSecret } from '../keyvault';
import type {
  PortfolioConfigData,
  PortfolioConfigEntry,
  PortfolioCredentials,
  MaskedPortfolioConfigEntry,
} from '../models/portfolio';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'portfolio-config.json');

const CRED_KEY_PREFIX = 'portfolio-creds-';

const DEFAULT_PORTFOLIOS = [
  'Short-Tech',
  'PureMomentum',
  'PureGrowth',
  'Momentum-LS',
  'MarketPicks',
  'BalancedPicks',
  'OutSmartNSDQ',
  'ProPicks',
  'GainersQtr',
  'ActiveTraders',
  'SharpTraders',
  'SectorNeutral',
  'Pure-Value',
  'SectorGurus',
  'NasdaqAI-Inverse',
];

function parseEnvCredentials(): Record<string, PortfolioCredentials> {
  const raw = process.env.PORTFOLIO_CREDENTIALS;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function credKey(username: string): string {
  return `${CRED_KEY_PREFIX}${username}`;
}

function seedConfigFromDefaults(): PortfolioConfigData {
  const portfolios: PortfolioConfigEntry[] = DEFAULT_PORTFOLIOS.map((username) => ({
    username,
    credentials: null,
  }));
  const config: PortfolioConfigData = {
    portfolios,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  return config;
}

export function readPortfolioConfig(): PortfolioConfigData {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw) as PortfolioConfigData;
    config.portfolios = config.portfolios.map((p) => ({
      username: p.username,
      credentials: null,
    }));
    return config;
  } catch {
    return seedConfigFromDefaults();
  }
}

function writePortfolioConfig(config: PortfolioConfigData): void {
  const sanitized: PortfolioConfigData = {
    ...config,
    portfolios: config.portfolios.map((p) => ({
      username: p.username,
      credentials: null,
    })),
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
}

export function getPortfolioUsernames(): string[] {
  const config = readPortfolioConfig();
  return config.portfolios.map((p) => p.username);
}

export async function getCredentials(username: string): Promise<PortfolioCredentials | null> {
  const stored = await getAppSecret(credKey(username));
  if (stored) {
    try {
      return JSON.parse(stored) as PortfolioCredentials;
    } catch { /* fall through */ }
  }

  const envCreds = parseEnvCredentials();
  return envCreds[username] ?? null;
}

export async function getUsernamesWithCredentials(): Promise<string[]> {
  const config = readPortfolioConfig();
  const envCreds = parseEnvCredentials();
  const results: string[] = [];

  for (const p of config.portfolios) {
    if (envCreds[p.username]) {
      results.push(p.username);
      continue;
    }
    const stored = await getAppSecret(credKey(p.username));
    if (stored) results.push(p.username);
  }

  return results;
}

function maskValue(value: string): string {
  if (value.length <= 10) return '****';
  return value.slice(0, 5) + '***' + value.slice(-5);
}

export async function getMaskedConfigs(): Promise<MaskedPortfolioConfigEntry[]> {
  const config = readPortfolioConfig();
  const envCreds = parseEnvCredentials();
  const results: MaskedPortfolioConfigEntry[] = [];

  for (const p of config.portfolios) {
    let creds: PortfolioCredentials | null = null;

    const stored = await getAppSecret(credKey(p.username));
    if (stored) {
      try { creds = JSON.parse(stored); } catch { /* ignore */ }
    }
    if (!creds) creds = envCreds[p.username] ?? null;

    results.push({
      username: p.username,
      hasCredentials: creds !== null,
      credentials: creds
        ? {
            apiKey: maskValue(creds.apiKey),
            userKey: maskValue(creds.userKey),
            gcid: creds.gcid,
          }
        : null,
    });
  }

  return results;
}

export async function addPortfolios(
  entries: { username: string; credentials: PortfolioCredentials }[],
): Promise<{ added: string[]; duplicates: string[] }> {
  const config = readPortfolioConfig();
  const existingSet = new Set(config.portfolios.map((p) => p.username));
  const added: string[] = [];
  const duplicates: string[] = [];

  for (const entry of entries) {
    if (existingSet.has(entry.username)) {
      duplicates.push(entry.username);
      continue;
    }
    config.portfolios.push({ username: entry.username, credentials: null });
    existingSet.add(entry.username);
    await setAppSecret(credKey(entry.username), JSON.stringify(entry.credentials));
    added.push(entry.username);
  }

  config.updatedAt = new Date().toISOString();
  writePortfolioConfig(config);
  return { added, duplicates };
}

export async function updateCredentials(
  username: string,
  credentials: PortfolioCredentials,
): Promise<boolean> {
  const config = readPortfolioConfig();
  const entry = config.portfolios.find((p) => p.username === username);
  if (!entry) return false;

  await setAppSecret(credKey(username), JSON.stringify(credentials));

  config.updatedAt = new Date().toISOString();
  writePortfolioConfig(config);
  return true;
}

export async function removePortfolio(username: string): Promise<boolean> {
  const config = readPortfolioConfig();
  const idx = config.portfolios.findIndex((p) => p.username === username);
  if (idx === -1) return false;

  config.portfolios.splice(idx, 1);
  config.updatedAt = new Date().toISOString();
  writePortfolioConfig(config);

  await deleteAppSecret(credKey(username));
  return true;
}
