/**
 * Disclaimer Service — auto-detects applicable disclaimers
 * based on portfolio holdings and post content.
 *
 * Content-based detection uses AI classification (Claude) for
 * semantic understanding instead of brittle regex matching.
 */

import type { PortfolioHolding } from '../models/portfolio';
import {
  DISCLAIMER_RULES,
  CRYPTO_SYMBOLS,
  CRYPTO_INSTRUMENT_NAMES,
  type DisclaimerRule,
  type SelectedDisclaimer,
} from '../config/disclaimers';
import { classifyContentDisclaimers } from './ai-service';

/**
 * Detect which disclaimers apply to a post given the portfolio's
 * holdings and the current post content.
 *
 * - "always" and "holdings" rules are evaluated deterministically.
 * - "content" rules are classified by AI for semantic accuracy.
 */
export async function getApplicableDisclaimers(
  holdings: PortfolioHolding[],
  postContent: string,
): Promise<SelectedDisclaimer[]> {
  const results: SelectedDisclaimer[] = [];
  const contentRules: DisclaimerRule[] = [];

  for (const rule of DISCLAIMER_RULES) {
    if (rule.detectionType === 'manual') continue;

    if (rule.detectionType === 'always') {
      results.push({
        rule,
        isAutoDetected: true,
        reason: 'All Smart Portfolio posts require this disclaimer',
      });
      continue;
    }

    if (rule.detectionType === 'holdings' && rule.holdingsDetection) {
      const match = detectFromHoldings(holdings, rule.holdingsDetection.type);
      if (match) {
        results.push({
          rule,
          isAutoDetected: true,
          reason: match.reason,
        });
      }
      continue;
    }

    if (rule.detectionType === 'content') {
      contentRules.push(rule);
    }
  }

  if (contentRules.length > 0 && postContent.trim()) {
    const ruleMap = new Map(contentRules.map((r) => [r.id, r]));
    const aiMatches = await classifyContentDisclaimers(postContent, contentRules);
    for (const match of aiMatches) {
      const rule = ruleMap.get(match.ruleId);
      if (rule) {
        results.push({
          rule,
          isAutoDetected: true,
          reason: match.reason,
        });
      }
    }
  }

  return results;
}

/**
 * Return all available disclaimer rules (for the "all disclaimers" toggle UI).
 */
export function getAllDisclaimerRules(): DisclaimerRule[] {
  return DISCLAIMER_RULES;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function detectFromHoldings(
  holdings: PortfolioHolding[],
  type: 'crypto' | 'cfd' | 'futures' | 'options',
): { reason: string } | null {
  switch (type) {
    case 'crypto': {
      const cryptoHoldings = holdings.filter(
        (h) =>
          CRYPTO_SYMBOLS.has(h.symbol?.toUpperCase()) ||
          CRYPTO_INSTRUMENT_NAMES.has(h.instrumentName?.toLowerCase()),
      );
      if (cryptoHoldings.length > 0) {
        const symbols = cryptoHoldings
          .slice(0, 3)
          .map((h) => `$${h.symbol}`)
          .join(', ');
        return {
          reason: `Portfolio holds crypto assets: ${symbols}${cryptoHoldings.length > 3 ? ` +${cryptoHoldings.length - 3} more` : ''}`,
        };
      }
      return null;
    }

    case 'cfd': {
      const leveraged = holdings.filter((h) => h.leverage > 1);
      if (leveraged.length > 0) {
        const examples = leveraged
          .slice(0, 3)
          .map((h) => `$${h.symbol} (x${h.leverage})`)
          .join(', ');
        return {
          reason: `Portfolio has leveraged/CFD positions: ${examples}${leveraged.length > 3 ? ` +${leveraged.length - 3} more` : ''}`,
        };
      }
      return null;
    }

    case 'futures': {
      const futureHoldings = holdings.filter(
        (h) =>
          /\bfuture/i.test(h.instrumentName) ||
          /\bfuture/i.test(h.assetType),
      );
      if (futureHoldings.length > 0) {
        return {
          reason: `Portfolio holds futures: ${futureHoldings[0].instrumentName}`,
        };
      }
      return null;
    }

    case 'options': {
      const optionHoldings = holdings.filter(
        (h) =>
          /\boption/i.test(h.instrumentName) ||
          /\boption/i.test(h.assetType),
      );
      if (optionHoldings.length > 0) {
        return {
          reason: `Portfolio holds options: ${optionHoldings[0].instrumentName}`,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

