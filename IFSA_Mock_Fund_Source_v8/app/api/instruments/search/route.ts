import { getD1 } from "../../../../db";
import { requireUser } from "../../../../lib/auth";
import instrumentMaster from "../../../../lib/instrument-master.json";

type MasterInstrument = {
  s: string;
  n: string;
  e: "NSE" | "BSE";
  a: string;
  r: string;
  i: string;
  l: number;
  p: number;
};

type QuoteSnapshot = {
  lastPrice: number;
  previousClose: number;
};

const directory = instrumentMaster as MasterInstrument[];
const DIRECTORY_AS_OF = "10 July 2026";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreMatch(item: MasterInstrument, rawQuery: string) {
  const query = normalize(rawQuery);
  const symbol = normalize(item.s);
  const name = normalize(item.n);
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (symbol.includes(query)) return 3;
  if (name.includes(query)) return 4;
  const words = rawQuery.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every((word) => `${item.s} ${item.n}`.toLowerCase().includes(word)) ? 5 : 99;
}

function searchDirectory(query: string, limit = 24) {
  return directory
    .map((item) => ({ item, score: scoreMatch(item, query) }))
    .filter(({ score }) => score < 99)
    .sort((left, right) => left.score - right.score || left.item.s.localeCompare(right.item.s))
    .slice(0, limit)
    .map(({ item }) => item);
}

async function fetchQuote(yahooSymbol: string): Promise<QuoteSnapshot | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0 IFSA-Education-Simulator" } },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }> };
    };
    const meta = payload.chart?.result?.[0]?.meta;
    const lastPrice = Number(meta?.regularMarketPrice);
    if (!(lastPrice > 0)) return null;
    return {
      lastPrice,
      previousClose: Number(meta?.chartPreviousClose) || Number(meta?.previousClose) || lastPrice,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    await requireUser();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return Response.json({ results: [], totalUniverse: directory.length, asOf: DIRECTORY_AS_OF });

    const officialMatches = searchDirectory(query);
    const quotedOfficial = officialMatches.map((item) => {
      const yahooSymbol = `${item.s}.${item.e === "BSE" ? "BO" : "NS"}`;
      return {
          yahooSymbol,
          symbol: item.s,
          exchange: item.e,
          name: item.n,
          assetType: item.a,
          series: item.r,
          isin: item.i,
          lotSize: item.l,
          lastPrice: item.p,
          previousClose: item.p,
          priceSource: "official-eod-reference",
          official: true,
      };
    });

    return Response.json({
      results: quotedOfficial,
      totalUniverse: directory.length,
      asOf: DIRECTORY_AS_OF,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const payload = (await request.json()) as {
      yahooSymbol?: string;
      symbol?: string;
      exchange?: string;
      name?: string;
      assetType?: string;
      lastPrice?: number;
      previousClose?: number;
    };
    if (!payload.symbol || !payload.exchange || !["NSE", "BSE"].includes(payload.exchange)) {
      return Response.json({ error: "Invalid listed instrument." }, { status: 400 });
    }

    const masterItem = directory.find((item) => item.s === payload.symbol && item.e === payload.exchange);
    const yahooSymbol = payload.yahooSymbol && /\.(NS|BO)$/.test(payload.yahooSymbol)
      ? payload.yahooSymbol
      : `${payload.symbol}.${payload.exchange === "BSE" ? "BO" : "NS"}`;
    const quote = await fetchQuote(yahooSymbol);
    const lastPrice = quote?.lastPrice || Number(payload.lastPrice) || masterItem?.p || 0;
    const previousClose = quote?.previousClose || Number(payload.previousClose) || masterItem?.p || lastPrice;
    if (!(lastPrice > 0)) {
      return Response.json({ error: "This security is listed, but its reference price is temporarily unavailable." }, { status: 503 });
    }

    const symbol = masterItem?.s || payload.symbol;
    const exchange = masterItem?.e || payload.exchange;
    const name = masterItem?.n || payload.name || symbol;
    const assetType = masterItem?.a || payload.assetType || "Equity";
    const lotSize = masterItem?.l || 1;
    const db = getD1();
    const existing = await db.prepare(
      `SELECT id, symbol, yahoo_symbol AS yahooSymbol, exchange, name, asset_type AS assetType,
              lot_size AS lotSize, margin_percent AS marginPercent, expiry, last_price AS lastPrice,
              previous_close AS previousClose, price_source AS priceSource, updated_at AS updatedAt
       FROM instruments WHERE symbol = ? AND exchange = ? LIMIT 1`,
    ).bind(symbol, exchange).first();
    if (existing) return Response.json({ instrument: existing });

    const created = await db.prepare(
      `INSERT INTO instruments
       (symbol, yahoo_symbol, exchange, name, asset_type, lot_size, margin_percent,
        last_price, previous_close, price_source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 100, ?, ?, ?, ?) RETURNING id`,
    ).bind(symbol, yahooSymbol, exchange, name, assetType, lotSize, lastPrice, previousClose, quote ? "delayed-web" : "official-eod-reference", Date.now()).first<{ id: number }>();
    const instrument = await db.prepare(
      `SELECT id, symbol, yahoo_symbol AS yahooSymbol, exchange, name, asset_type AS assetType,
              lot_size AS lotSize, margin_percent AS marginPercent, expiry, last_price AS lastPrice,
              previous_close AS previousClose, price_source AS priceSource, updated_at AS updatedAt
       FROM instruments WHERE id = ?`,
    ).bind(created?.id).first();
    return Response.json({ instrument }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add the instrument.";
    return Response.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 400 });
  }
}
