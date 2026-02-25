import { NextRequest, NextResponse } from 'next/server';
import { getInstrumentsByIds } from '@/lib/utils/instrument-helper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json(
        { error: 'ids parameter is required' },
        { status: 400 }
      );
    }

    const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid instrument IDs' },
        { status: 400 }
      );
    }

    const instrumentMap = await getInstrumentsByIds(ids);

    // Convert map to array for JSON response
    const instruments = Array.from(instrumentMap.values());

    return NextResponse.json({
      instruments,
      count: instruments.length,
    });
  } catch (error) {
    console.error('Error fetching instruments:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch instruments',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

