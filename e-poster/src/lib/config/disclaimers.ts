/**
 * Disclaimer rules for eToro compliance.
 *
 * Each rule defines: when it applies, the mobile disclaimer text,
 * and how auto-detection should work (holdings-based, content-based, or always-on).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type DetectionType = 'always' | 'holdings' | 'content' | 'manual';

export interface DisclaimerRule {
  id: string;
  category: string;
  useCase: string;
  text: string;
  detectionType: DetectionType;
  /** For holdings-based: which asset characteristic triggers this rule */
  holdingsDetection?: {
    type: 'crypto' | 'cfd' | 'futures' | 'options';
  };
  /** For content-based: regex patterns to scan the post text */
  contentPatterns?: RegExp[];
}

export interface SelectedDisclaimer {
  rule: DisclaimerRule;
  isAutoDetected: boolean;
  reason: string;
}

// ── Known crypto symbols/names for holdings detection ────────────────────────

export const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOGE', 'DOT', 'AVAX', 'MATIC',
  'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ALGO', 'FIL', 'NEAR', 'APT',
  'ARB', 'OP', 'SHIB', 'MANA', 'SAND', 'AXS', 'FTM', 'HBAR', 'VET',
  'ICP', 'EOS', 'XLM', 'TRX', 'XTZ', 'AAVE', 'MKR', 'CRV', 'COMP',
  'SNX', 'SUSHI', 'YFI', 'ENJ', 'BAT', 'ZRX', 'CELO', 'DASH', 'ZEC',
  'ETC', 'NEO', 'IOTA', 'THETA', 'KLAY', 'EGLD', 'FLOW', 'QNT', 'GRT',
  'RENDER', 'IMX', 'INJ', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE',
  'FLOKI', 'BONK', 'TON', 'KAS', 'STX', 'RUNE', 'TAO',
]);

export const CRYPTO_INSTRUMENT_NAMES = new Set([
  'bitcoin', 'ethereum', 'solana', 'cardano', 'ripple', 'dogecoin',
  'polkadot', 'avalanche', 'polygon', 'chainlink', 'uniswap', 'cosmos',
  'litecoin', 'bitcoin cash', 'algorand', 'filecoin', 'near protocol',
  'aptos', 'arbitrum', 'optimism', 'shiba inu', 'decentraland',
  'the sandbox', 'axie infinity', 'tron', 'tezos', 'stellar',
]);

// ── Disclaimer Rules ─────────────────────────────────────────────────────────

export const DISCLAIMER_RULES: DisclaimerRule[] = [
  // ── Always-on ──────────────────────────────────────────────────────────────
  {
    id: 'smart-portfolio',
    category: 'CopyTrading',
    useCase: 'All CopyTrading products / Popular Investors / Smart Portfolios',
    text: 'Copy Trading does not amount to investment advice. The value of your investments may go up or down. Your capital is at risk.\nPast performance is not an indication of future results.',
    detectionType: 'always',
  },

  // ── Holdings-based ─────────────────────────────────────────────────────────
  {
    id: 'crypto-real',
    category: 'Crypto',
    useCase: 'Real Cryptoasset',
    text: "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you should not expect to be protected if something goes wrong.",
    detectionType: 'holdings',
    holdingsDetection: { type: 'crypto' },
  },
  {
    id: 'cfd',
    category: 'CFDs',
    useCase: 'CFD Stock / Commodities / Indices / FX / Currencies',
    text: '50% of retail CFD accounts lose money.',
    detectionType: 'holdings',
    holdingsDetection: { type: 'cfd' },
  },
  {
    id: 'futures',
    category: 'Futures',
    useCase: 'Futures',
    text: 'Futures are high-risk. Losses may exceed deposits.',
    detectionType: 'holdings',
    holdingsDetection: { type: 'futures' },
  },
  {
    id: 'options',
    category: 'Options',
    useCase: 'Options',
    text: 'Options are complex products, involve risk and are not appropriate for all investors. You may lose all your invested capital. Please review risks prior to engaging.',
    detectionType: 'holdings',
    holdingsDetection: { type: 'options' },
  },

  // ── Content-based ──────────────────────────────────────────────────────────
  {
    id: 'past-performance',
    category: 'Performance',
    useCase: 'Past performance',
    text: 'Past performance is not a reliable indicator of future results',
    detectionType: 'content',
    contentPatterns: [
      /\b(past\s+performance|historical\s+(performance|returns?))\b/i,
      /\b(returned|gained|grew|rose|surged|rallied|jumped|climbed|outperformed|underperformed)\s+\d/i,
      /\b\d+%?\s+(return|gain|growth|increase|rise)\b/i,
      /\b(year-to-date|ytd|quarter(ly)?|annual)\s+(return|gain|performance|growth)\b/i,
      /\b(up|down|gained|lost)\s+\d+(\.\d+)?%/i,
    ],
  },
  {
    id: 'future-performance',
    category: 'Performance',
    useCase: 'Future performance / Forecasts',
    text: 'Forecasts are not a reliable indicator of future performance',
    detectionType: 'content',
    contentPatterns: [
      /\b(forecast|predict|projection|outlook|forward[\s-]looking)\b/i,
      /\b(is\s+expected\s+to|will\s+(likely|probably)|could\s+(reach|hit|grow))\b/i,
      /\b(price\s+target|upside\s+potential|target\s+price)\b/i,
      /\b(analysts?\s+(expect|estimate|forecast|predict))\b/i,
    ],
  },

  // ── Manual-only (available for user toggle) ────────────────────────────────
  {
    id: 'generic',
    category: 'Generic',
    useCase: 'Non-specific product or strategy / Generic platform',
    text: 'eToro is a multi-asset investment platform. The value of your investments may go up or down. Your capital is at risk.',
    detectionType: 'manual',
  },
  {
    id: 'stocks-etf',
    category: 'Stocks / ETFs',
    useCase: 'Real Stock / ETF',
    text: 'Your capital is at risk.',
    detectionType: 'manual',
  },
  {
    id: 'stocks-etf-commission',
    category: 'Stocks / ETFs',
    useCase: 'Real Stock/ETF (0% commission reference)',
    text: 'Your capital is at risk. Other fees apply.',
    detectionType: 'manual',
  },
  {
    id: 'fx-spreads',
    category: 'CFDs',
    useCase: 'FX spreads — new or reduced spreads',
    text: 'Spreads indicate the lowest possible scenario. Actual spreads may vary depending on market conditions. T&Cs apply.',
    detectionType: 'manual',
  },
  {
    id: 'crypto-experimental',
    category: 'Crypto',
    useCase: 'Experimental Cryptoassets',
    text: 'Experimental cryptoassets are highly volatile and you may lose all your investment.',
    detectionType: 'manual',
  },
  {
    id: 'crypto-staking',
    category: 'Crypto',
    useCase: 'Crypto Staking',
    text: 'Crypto staking can be risky due to volatility, technical vulnerabilities, and regulatory uncertainty. You may lose all your investment.',
    detectionType: 'manual',
  },
  {
    id: 'fees',
    category: 'Fees',
    useCase: 'Fees',
    text: 'Other fees apply.',
    detectionType: 'manual',
  },
  {
    id: 'not-investment-advice',
    category: 'Miscellaneous',
    useCase: 'Invitations to webinars / Podcast promos',
    text: 'Not investment advice.',
    detectionType: 'manual',
  },
  {
    id: 'tax',
    category: 'Miscellaneous',
    useCase: 'Tax',
    text: 'eToro does not provide tax advice and the information provided should not be interpreted as such. Customers should seek independent tax advice.',
    detectionType: 'manual',
  },
  {
    id: 'illustration-only',
    category: 'Fictitious',
    useCase: 'Platform images or fictitious figures',
    text: 'For illustration purposes only',
    detectionType: 'manual',
  },
  {
    id: 'ai-tools',
    category: 'Other Products',
    useCase: 'AI Tools',
    text: 'AI tools are for informational purposes only; their responses may be inaccurate or incomplete and should not be considered investment advice.',
    detectionType: 'manual',
  },
  {
    id: '24-5-trading',
    category: 'Other Products',
    useCase: '24/5 Trading',
    text: 'Trading outside of market hours (24/5) may be subject to low liquidity and high volatility, which can affect pricing. T&Cs apply.',
    detectionType: 'manual',
  },
];
