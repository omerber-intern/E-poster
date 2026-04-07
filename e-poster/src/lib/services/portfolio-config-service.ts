import fs from 'fs';
import path from 'path';
import type {
  PortfolioConfigData,
  PortfolioConfigEntry,
  PortfolioCredentials,
  MaskedPortfolioConfigEntry,
} from '../models/portfolio';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'portfolio-config.json');

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

export function getCredentials(username: string): PortfolioCredentials | null {
  const envCreds = parseEnvCredentials();
  return envCreds[username] ?? null;
}

export function getUsernamesWithCredentials(): string[] {
  const config = readPortfolioConfig();
  const envCreds = parseEnvCredentials();
  return config.portfolios
    .filter((p) => !!envCreds[p.username])
    .map((p) => p.username);
}

function maskValue(value: string): string {
  if (value.length <= 10) return '****';
  return value.slice(0, 5) + '***' + value.slice(-5);
}

export function getMaskedConfigs(): MaskedPortfolioConfigEntry[] {
  const config = readPortfolioConfig();
  const envCreds = parseEnvCredentials();

  return config.portfolios.map((p) => {
    const creds = envCreds[p.username] ?? null;
    return {
      username: p.username,
      hasCredentials: creds !== null,
      credentials: creds
        ? {
            apiKey: maskValue(creds.apiKey),
            userKey: maskValue(creds.userKey),
            gcid: creds.gcid,
          }
        : null,
    };
  });
}

export function addPortfolios(
  entries: { username: string; credentials: PortfolioCredentials }[],
): { added: string[]; duplicates: string[] } {
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
    added.push(entry.username);
  }

  config.updatedAt = new Date().toISOString();
  writePortfolioConfig(config);
  return { added, duplicates };
}

export function updateCredentials(
  username: string,
  _credentials: PortfolioCredentials,
): boolean {
  const config = readPortfolioConfig();
  const entry = config.portfolios.find((p) => p.username === username);
  if (!entry) return false;

  config.updatedAt = new Date().toISOString();
  writePortfolioConfig(config);
  return true;
}

export function removePortfolio(username: string): boolean {
  const config = readPortfolioConfig();
  const idx = config.portfolios.findIndex((p) => p.username === username);
  if (idx === -1) return false;

  config.portfolios.splice(idx, 1);
  config.updatedAt = new Date().toISOString();
  writePortfolioConfig(config);
  return true;
}
