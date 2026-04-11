import { NextResponse } from "next/server";

const RBA_CSV_URL = "https://www.rba.gov.au/statistics/tables/csv/f5-data.csv";

// Column indices in the RBA F5 CSV (0-indexed)
// Col 4: Housing; Banks; Variable; Discounted; Owner-occupier
// Col 8: Housing; Banks; Variable; Discounted; Investor
const COL_OO_DISCOUNTED = 4;
const COL_INV_DISCOUNTED = 8;

export interface RBARate {
  ownerOccupier: number;
  investor: number;
  asOf: string; // DD/MM/YYYY from RBA
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(RBA_CSV_URL, {
      headers: {
        "Accept": "text/csv, */*",
        "User-Agent": "Mozilla/5.0 (compatible; InvestmentAnalyser/1.0)",
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `RBA returned ${res.status}` },
        { status: 502 },
      );
    }

    const text = await res.text();
    // The RBA CSV has thousands of trailing empty lines — filter them out
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    // Find the last line that starts with a date (DD/MM/YYYY)
    let lastDataLine: string | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\d{2}\/\d{2}\/\d{4}/.test(lines[i])) {
        lastDataLine = lines[i];
        break;
      }
    }

    if (!lastDataLine) {
      return NextResponse.json(
        { error: "No data rows found in RBA CSV" },
        { status: 500 },
      );
    }

    const cols = lastDataLine.split(",");
    const date = cols[0];
    const ooRate = parseFloat(cols[COL_OO_DISCOUNTED]);
    const invRate = parseFloat(cols[COL_INV_DISCOUNTED]);

    if (isNaN(ooRate) || isNaN(invRate)) {
      return NextResponse.json(
        { error: "Could not parse rates from RBA data" },
        { status: 500 },
      );
    }

    const data: RBARate = {
      ownerOccupier: Math.round(ooRate * 100) / 100,
      investor: Math.round(invRate * 100) / 100,
      asOf: date,
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch RBA rates" },
      { status: 500 },
    );
  }
}
