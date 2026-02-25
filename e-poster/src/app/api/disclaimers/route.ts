import { NextResponse } from 'next/server';
import { getAllDisclaimerRules } from '@/lib/services/disclaimer-service';

/**
 * GET /api/disclaimers
 *
 * Returns all available disclaimer rules.
 */
export async function GET() {
  const rules = getAllDisclaimerRules();

  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      category: r.category,
      useCase: r.useCase,
      text: r.text,
      detectionType: r.detectionType,
    })),
  });
}
