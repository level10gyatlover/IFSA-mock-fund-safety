"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type User = { id: number; username: string; displayName: string; role: "admin" | "member" };
type Instrument = {
  id: number; symbol: string; exchange: string; name: string; assetType: string; lotSize: number;
  marginPercent: number; expiry: number | null; lastPrice: number; previousClose: number;
  priceSource: string; updatedAt: number;
};
type Position = {
  id: number; instrumentId: number; symbol: string; name: string; exchange: string; assetType: string;
  quantity: number; averagePrice: number; lastPrice: number; marketValue: number; unrealisedPnl: number; dayPnl: number;
};
type Order = {
  id: number; symbol: string; exchange: string; side: string; orderType: string; quantity: number;
  limitPrice: number | null; triggerPrice: number | null; status: string; executedPrice: number | null;
  placedAt: number; executedAt: number | null; isBackdated: boolean;
};
type Leader = {
  id: number; name: string; kind: string; displayName: string; netWorth: number; pnl: number; returnPct: number;
};
type Recommendation = {
  id: number; side: string; thesis: string; targetPrice: number | null; stopLoss: number | null;
  status: string; adminNote: string | null; createdAt: number; symbol: string; exchange: string; memberName: string;
};
type Member = {
  id: number; username: string; displayName: string; status: string; portfolioId: number; cash: number; netContributions: number;
};
type DashboardData = {
  user: User;
  portfolio: { id: number; name: string; kind: string; cash: number; netContributions: number };
  summary: { netWorth: number; cash: number; investedValue: number; dayPnl: number; totalPnl: number; returnPct: number; netContributions: number };
  instruments: Instrument[]; positions: Position[]; orders: Order[]; leaderboard: Leader[];
  recommendations: Recommendation[]; members: Member[]; seasons: Array<{ id: number; name: string }>;
  history: Array<{ netWorth: number; recordedAt: number }>;
  corporateActions: Array<{ id: number; actionType: string; effectiveAt: number; ratioBase: number | null; ratioNew: number | null; cashPerShare: number | null; quantityBefore: number; quantityAfter: number; destinationQuantityAdded: number; cashAmount: number; symbol: string; exchange: string; destinationSymbol: string | null }>;
  quoteMode: string;
};

type ChatMessage = {
  id: number; userId: number; username: string; accountName: string; deviceId: string;
  senderName: string; message: string; createdAt: number; editedAt: number | null;
};

type WatchlistItem = Instrument & { id: number; instrumentId: number; sortOrder: number; createdAt: number };
type LearningProgress = { moduleKey: string; completed: boolean; quizScore: number; updatedAt: number };
type CorporateActionRecord = {
  id: number; actionType: string; effectiveAt: number; ratioBase: number | null; ratioNew: number | null;
  cashPerShare: number | null; costAllocationPercent: number | null; sourceUrl: string; notes: string | null;
  status: string; lastError: string | null; appliedAt: number | null; symbol: string; exchange: string;
  destinationSymbol: string | null; destinationExchange: string | null; portfoliosAffected: number; totalCash: number;
};

const navItems = ["Overview", "Markets", "Orders", "Leaderboard", "Chat Room", "Tutorial", "Learning Hub", "Recommendations", "Admin"] as const;
type Tab = (typeof navItems)[number];

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const price = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Something went wrong.");
  return payload;
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await api<DashboardData>("/api/dashboard", { cache: "no-store" });
      setData(result);
      setError("");
    } catch (caught) {
      if (caught instanceof Error && caught.message === "UNAUTHENTICATED") setData(null);
      else setError(caught instanceof Error ? caught.message : "Unable to load the fund.");
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [data, refresh]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) return <div className="boot-screen"><Image src="/ifsa-svc-square-white.png" alt="IFSA SVC" className="boot-logo" width={2048} height={2048} priority unoptimized /><span className="loader" /></div>;
  if (!data) return <LoginScreen onSubmit={login} loading={loading} error={error} />;
  return <FundApp data={data} refresh={refresh} globalError={error} onLogout={async () => { await api("/api/auth/logout", { method: "POST" }); setData(null); }} />;
}

function LoginScreen({ onSubmit, loading, error }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean; error: string }) {
  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="login-brand-top">
          <Image src="/ifsa-svc-banner-white.png" alt="IFSA SVC" className="login-logo" width={2048} height={1024} priority unoptimized />
          <span className="chapter-pill">Mock Fund</span>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow light">STUDENT-LED INVESTMENT PLATFORM</p>
          <h1>Research.<br />Invest. <em>Learn.</em></h1>
          <p>One flagship fund. Individual portfolios. A shared arena for disciplined investment thinking.</p>
        </div>
        <div className="market-strip" aria-hidden="true">
          <span>NIFTY 50 <b>25,482.60</b> <i>+0.48%</i></span>
          <span>GOLD <b>₹1,02,340</b> <i>+0.71%</i></span>
          <span>IFSA FLAGSHIP <b>₹10,00,000</b> <i>OPEN</i></span>
        </div>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="mobile-brand"><Image src="/ifsa-svc-banner-dark.png" alt="IFSA SVC" className="mobile-brand-logo" width={2048} height={1024} unoptimized /><span>Mock Fund</span></div>
          <p className="eyebrow">MEMBER PORTAL</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with the credentials created by your fund administrator.</p>
          <label>Username<input name="username" autoComplete="username" placeholder="your.username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary-button wide" disabled={loading}>{loading ? "Signing in…" : "Enter the fund"}<span>→</span></button>
          <p className="security-note"><span>●</span> Educational simulation only · No real money is transacted</p>
        </form>
      </section>
    </main>
  );
}

function FundApp({ data, refresh, globalError, onLogout }: { data: DashboardData; refresh: () => Promise<void>; globalError: string; onLogout: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticket, setTicket] = useState<Instrument | null>(null);
  const [toast, setToast] = useState("");
  const isAdmin = data.user.role === "admin";
  const visibleNav = navItems.filter((item) => item !== "Admin" || isAdmin);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><Image src="/ifsa-svc-banner-white.png" alt="IFSA SVC" width={2048} height={1024} unoptimized /><span>Mock Fund</span></div>
        <nav>
          {visibleNav.map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setSidebarOpen(false); }}>
              <NavIcon item={item} /><span>{item}</span>{item === "Recommendations" && data.recommendations.filter((x) => x.status === "NEW").length > 0 && <b>{data.recommendations.filter((x) => x.status === "NEW").length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{data.user.displayName.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div>
          <div><strong>{data.user.displayName}</strong><small>{isAdmin ? "Fund Administrator" : "Member Investor"}</small></div>
          <button className="logout" onClick={() => void onLogout()} title="Sign out">↗</button>
        </div>
      </aside>
      <main className="main-stage">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div><p>{data.portfolio.kind === "flagship" ? "Flagship Portfolio" : "Personal Portfolio"}</p><h1>{tab}</h1></div>
          <div className="topbar-actions">
            <div className="market-status"><span /> Market data active<small>{data.quoteMode}</small></div>
            <button className="trade-button" onClick={() => { setTab("Markets"); setTicket(data.instruments[0]); }}>＋ Place order</button>
          </div>
        </header>
        <div className="content">
          {globalError && <div className="alert error">{globalError}</div>}
          {tab === "Overview" && <Overview data={data} onTrade={(instrument) => setTicket(instrument)} />}
          {tab === "Markets" && <Markets data={data} onTrade={setTicket} refresh={refresh} notify={notify} />}
          {tab === "Orders" && <Orders orders={data.orders} />}
          {tab === "Leaderboard" && <Leaderboard data={data} />}
          {tab === "Chat Room" && <ChatRoom user={data.user} notify={notify} />}
          {tab === "Tutorial" && <Tutorial goTo={setTab} />}
          {tab === "Learning Hub" && <LearningHub notify={notify} />}
          {tab === "Recommendations" && <Recommendations data={data} refresh={refresh} notify={notify} />}
          {tab === "Admin" && isAdmin && <Admin data={data} refresh={refresh} notify={notify} onBackdatedTrade={setTicket} />}
        </div>
      </main>
      {ticket && <TradeTicket instrument={ticket} isAdmin={isAdmin} onClose={() => setTicket(null)} onSuccess={async (message) => { notify(message); setTicket(null); await refresh(); }} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function NavIcon({ item }: { item: Tab }) {
  const icons: Record<Tab, string> = { Overview: "◫", Markets: "⌁", Orders: "⇄", Leaderboard: "♜", "Chat Room": "◌", Tutorial: "?", "Learning Hub": "◇", Recommendations: "✦", Admin: "⚙" };
  return <span className="nav-icon">{icons[item]}</span>;
}

function Overview({ data, onTrade }: { data: DashboardData; onTrade: (instrument: Instrument) => void }) {
  const total = data.summary.investedValue || 1;
  const groups = useMemo(() => {
    const map = new Map<string, number>();
    data.positions.forEach((position) => map.set(position.assetType, (map.get(position.assetType) ?? 0) + position.marketValue));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.positions]);
  const donut = groups.length
    ? `conic-gradient(${groups.map((_, index) => `var(--chart-${(index % 5) + 1}) ${groups.slice(0, index).reduce((sum, [, item]) => sum + item, 0) / total * 100}% ${(groups.slice(0, index + 1).reduce((sum, [, item]) => sum + item, 0) / total) * 100}%`).join(",")})`
    : "conic-gradient(var(--line) 0 100%)";
  return (
    <div className="page-stack">
      <section className="summary-grid">
        <SummaryCard label="Net worth" value={inr.format(data.summary.netWorth)} change={data.summary.totalPnl} sub={`on ${inr.format(data.summary.netContributions)} net capital`} hero />
        <SummaryCard label="Available cash" value={inr.format(data.summary.cash)} sub={`${((data.summary.cash / Math.max(data.summary.netWorth, 1)) * 100).toFixed(1)}% of portfolio`} />
        <SummaryCard label="Today's P&L" value={inr.format(data.summary.dayPnl)} change={data.summary.dayPnl} sub="Based on latest available prices" />
        <SummaryCard label="Total return" value={`${data.summary.returnPct >= 0 ? "+" : ""}${data.summary.returnPct.toFixed(2)}%`} change={data.summary.totalPnl} sub={`${inr.format(data.summary.totalPnl)} absolute P&L`} />
      </section>
      <section className="overview-grid">
        <article className="panel performance-panel">
          <PanelHead title="Portfolio performance" subtitle="Net worth over time" action={<select aria-label="Performance period"><option>Lifetime</option><option>This season</option><option>1 month</option></select>} />
          <PerformanceChart history={data.history} current={data.summary.netWorth} />
          <div className="chart-footer"><span><i className="legend-line portfolio" />Your portfolio</span><span><i className="legend-line benchmark" />NIFTY 50 benchmark</span><small>Updated {new Date(Math.max(...data.instruments.map((item) => item.updatedAt))).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></div>
        </article>
        <article className="panel allocation-panel">
          <PanelHead title="Asset allocation" subtitle="Current exposure" />
          <div className="allocation-wrap"><div className="donut" style={{ background: donut }}><span><strong>{data.positions.length}</strong>positions</span></div>
            <div className="allocation-list">{groups.length ? groups.slice(0, 5).map(([name, value], index) => <div key={name}><i style={{ background: `var(--chart-${(index % 5) + 1})` }} /><span>{name}</span><b>{(value / total * 100).toFixed(1)}%</b></div>) : <p className="empty-mini">No allocation yet. Place your first simulated trade.</p>}</div>
          </div>
        </article>
      </section>
      <section className="panel">
        <PanelHead title="Holdings" subtitle={`${data.positions.length} active positions`} action={<button className="text-button">View analysis →</button>} />
        <HoldingsTable positions={data.positions} instruments={data.instruments} onTrade={onTrade} />
      </section>
      {data.corporateActions.length > 0 && <section className="panel portfolio-actions"><PanelHead title="Portfolio actions" subtitle="Verified corporate actions already reflected in your quantities and cash" /><div>{data.corporateActions.map((item) => <article key={item.id}><span className="action-mark">{item.actionType === "DIVIDEND" ? "₹" : "⇢"}</span><div><b>{item.symbol} · {item.actionType}</b><small>{new Date(item.effectiveAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</small></div><p>{item.actionType === "DIVIDEND" ? `${price.format(item.cashPerShare || 0)} per share · ${inr.format(item.cashAmount)} credited` : item.destinationSymbol ? `${item.quantityBefore} ${item.symbol} → +${item.destinationQuantityAdded} ${item.destinationSymbol}` : `${item.quantityBefore} shares → ${item.quantityAfter} shares`}</p><span className="status applied">Applied</span></article>)}</div></section>}
    </div>
  );
}

function SummaryCard({ label, value, change, sub, hero }: { label: string; value: string; change?: number; sub: string; hero?: boolean }) {
  return <article className={`summary-card ${hero ? "hero" : ""}`}><div className="card-label"><span>{label}</span><i>↗</i></div><strong>{value}</strong><p className={change == null ? "" : change >= 0 ? "positive" : "negative"}>{change != null && `${change >= 0 ? "▲" : "▼"} `}{sub}</p></article>;
}

function PanelHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function PerformanceChart({ history, current }: { history: Array<{ netWorth: number; recordedAt: number }>; current: number }) {
  const source = history.length > 1 ? history : Array.from({ length: 12 }, (_, index) => ({ netWorth: current * (0.94 + index * 0.006 + Math.sin(index * 1.4) * 0.008), recordedAt: 1783814400000 - (11 - index) * 86400000 }));
  const values = source.map((point) => point.netWorth);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const coords = source.map((point, index) => `${(index / (source.length - 1)) * 100},${92 - ((point.netWorth - min) / Math.max(max - min, 1)) * 72}`).join(" ");
  const benchmark = source.map((_, index) => `${(index / (source.length - 1)) * 100},${82 - index * 2.4 + Math.cos(index) * 3}`).join(" ");
  const actualGrowth = history.length > 1 ? ((current / history[0].netWorth) - 1) * 100 : 0;
  return <div className="chart-wrap"><div className="chart-value"><strong>{inr.format(current)}</strong><span className={actualGrowth >= 0 ? "positive" : "negative"}>{actualGrowth >= 0 ? "+" : ""}{actualGrowth.toFixed(2)}%</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Portfolio performance line chart"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8c260f" stopOpacity=".22" /><stop offset="1" stopColor="#8c260f" stopOpacity="0" /></linearGradient></defs><g className="gridlines"><line x1="0" y1="20" x2="100" y2="20"/><line x1="0" y1="45" x2="100" y2="45"/><line x1="0" y1="70" x2="100" y2="70"/><line x1="0" y1="95" x2="100" y2="95"/></g><polyline className="benchmark-line" points={benchmark}/><polygon className="area-fill" points={`0,100 ${coords} 100,100`} /><polyline className="portfolio-line" points={coords}/></svg><div className="axis-labels"><span>{new Date(source[0].recordedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span><span>{new Date(source[Math.floor(source.length / 2)].recordedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span><span>Today</span></div></div>;
}

function HoldingsTable({ positions, instruments, onTrade }: { positions: Position[]; instruments: Instrument[]; onTrade: (instrument: Instrument) => void }) {
  if (!positions.length) return <EmptyState title="Your portfolio is ready" text="Choose a listed instrument and place your first simulated order." />;
  return <div className="table-scroll"><table><thead><tr><th>Instrument</th><th>Qty / lots</th><th>Avg. price</th><th>LTP</th><th>Current value</th><th>P&L</th><th /></tr></thead><tbody>{positions.map((position) => <tr key={position.id}><td><InstrumentName symbol={position.symbol} exchange={position.exchange} name={position.name} /></td><td>{position.quantity}</td><td>{price.format(position.averagePrice)}</td><td>{price.format(position.lastPrice)}</td><td>{inr.format(position.marketValue)}</td><td className={position.unrealisedPnl >= 0 ? "positive" : "negative"}>{position.unrealisedPnl >= 0 ? "+" : ""}{inr.format(position.unrealisedPnl)}</td><td><button className="row-action" onClick={() => { const found = instruments.find((item) => item.id === position.instrumentId); if (found) onTrade(found); }}>Trade</button></td></tr>)}</tbody></table></div>;
}

function InstrumentName({ symbol, exchange, name }: { symbol: string; exchange: string; name: string }) {
  return <div className="instrument-name"><div>{symbol.slice(0, 2)}</div><span><strong>{symbol}</strong><small>{exchange} · {name}</small></span></div>;
}

type RemoteInstrument = {
  yahooSymbol: string;
  symbol: string;
  exchange: string;
  name: string;
  assetType: string;
  series?: string;
  isin?: string;
  lotSize?: number;
  lastPrice: number;
  previousClose: number;
  priceSource: string;
  official?: boolean;
};

const FALLBACK_MARKET_CATALOG: Array<RemoteInstrument & { aliases: string }> = [
  { yahooSymbol: "SBIN.NS", symbol: "SBIN", exchange: "NSE", name: "State Bank of India", assetType: "Equity", lastPrice: 915, previousClose: 910, priceSource: "reference-catalog", aliases: "sbi state bank" },
  { yahooSymbol: "ICICIBANK.NS", symbol: "ICICIBANK", exchange: "NSE", name: "ICICI Bank", assetType: "Equity", lastPrice: 1460, previousClose: 1452, priceSource: "reference-catalog", aliases: "icici" },
  { yahooSymbol: "INFY.NS", symbol: "INFY", exchange: "NSE", name: "Infosys", assetType: "Equity", lastPrice: 1730, previousClose: 1718, priceSource: "reference-catalog", aliases: "infosys information technology" },
  { yahooSymbol: "ITC.NS", symbol: "ITC", exchange: "NSE", name: "ITC Limited", assetType: "Equity", lastPrice: 490, previousClose: 487, priceSource: "reference-catalog", aliases: "itc hotels fmcg" },
  { yahooSymbol: "LT.NS", symbol: "LT", exchange: "NSE", name: "Larsen & Toubro", assetType: "Equity", lastPrice: 3750, previousClose: 3728, priceSource: "reference-catalog", aliases: "l&t larsen toubro" },
  { yahooSymbol: "MARUTI.NS", symbol: "MARUTI", exchange: "NSE", name: "Maruti Suzuki India", assetType: "Equity", lastPrice: 12800, previousClose: 12720, priceSource: "reference-catalog", aliases: "suzuki auto" },
  { yahooSymbol: "HINDUNILVR.NS", symbol: "HINDUNILVR", exchange: "NSE", name: "Hindustan Unilever", assetType: "Equity", lastPrice: 2550, previousClose: 2538, priceSource: "reference-catalog", aliases: "hul unilever fmcg" },
  { yahooSymbol: "AXISBANK.NS", symbol: "AXISBANK", exchange: "NSE", name: "Axis Bank", assetType: "Equity", lastPrice: 1300, previousClose: 1294, priceSource: "reference-catalog", aliases: "axis bank" },
  { yahooSymbol: "BHARTIARTL.NS", symbol: "BHARTIARTL", exchange: "NSE", name: "Bharti Airtel", assetType: "Equity", lastPrice: 1950, previousClose: 1938, priceSource: "reference-catalog", aliases: "airtel telecom" },
  { yahooSymbol: "KOTAKBANK.NS", symbol: "KOTAKBANK", exchange: "NSE", name: "Kotak Mahindra Bank", assetType: "Equity", lastPrice: 2200, previousClose: 2187, priceSource: "reference-catalog", aliases: "kotak bank" },
  { yahooSymbol: "M&M.NS", symbol: "M&M", exchange: "NSE", name: "Mahindra & Mahindra", assetType: "Equity", lastPrice: 3200, previousClose: 3178, priceSource: "reference-catalog", aliases: "mahindra auto" },
  { yahooSymbol: "SUNPHARMA.NS", symbol: "SUNPHARMA", exchange: "NSE", name: "Sun Pharmaceutical Industries", assetType: "Equity", lastPrice: 1750, previousClose: 1742, priceSource: "reference-catalog", aliases: "sun pharma pharmaceutical" },
  { yahooSymbol: "ASIANPAINT.NS", symbol: "ASIANPAINT", exchange: "NSE", name: "Asian Paints", assetType: "Equity", lastPrice: 2400, previousClose: 2388, priceSource: "reference-catalog", aliases: "asian paint" },
  { yahooSymbol: "BAJFINANCE.NS", symbol: "BAJFINANCE", exchange: "NSE", name: "Bajaj Finance", assetType: "Equity", lastPrice: 920, previousClose: 913, priceSource: "reference-catalog", aliases: "bajaj finance nbfc" },
  { yahooSymbol: "TITAN.NS", symbol: "TITAN", exchange: "NSE", name: "Titan Company", assetType: "Equity", lastPrice: 3600, previousClose: 3579, priceSource: "reference-catalog", aliases: "tata titan jewellery" },
  { yahooSymbol: "ADANIPORTS.NS", symbol: "ADANIPORTS", exchange: "NSE", name: "Adani Ports and SEZ", assetType: "Equity", lastPrice: 1500, previousClose: 1488, priceSource: "reference-catalog", aliases: "adani ports" },
  { yahooSymbol: "POWERGRID.NS", symbol: "POWERGRID", exchange: "NSE", name: "Power Grid Corporation", assetType: "Equity", lastPrice: 310, previousClose: 308, priceSource: "reference-catalog", aliases: "power grid psu" },
  { yahooSymbol: "ONGC.NS", symbol: "ONGC", exchange: "NSE", name: "Oil and Natural Gas Corporation", assetType: "Equity", lastPrice: 250, previousClose: 247, priceSource: "reference-catalog", aliases: "oil gas psu" },
  { yahooSymbol: "COALINDIA.NS", symbol: "COALINDIA", exchange: "NSE", name: "Coal India", assetType: "Equity", lastPrice: 400, previousClose: 397, priceSource: "reference-catalog", aliases: "coal psu" },
  { yahooSymbol: "NTPC.NS", symbol: "NTPC", exchange: "NSE", name: "NTPC Limited", assetType: "Equity", lastPrice: 360, previousClose: 357, priceSource: "reference-catalog", aliases: "power psu" },
  { yahooSymbol: "TATAMOTORS.NS", symbol: "TATAMOTORS", exchange: "NSE", name: "Tata Motors", assetType: "Equity", lastPrice: 750, previousClose: 742, priceSource: "reference-catalog", aliases: "tata motors auto jaguar" },
  { yahooSymbol: "JSWSTEEL.NS", symbol: "JSWSTEEL", exchange: "NSE", name: "JSW Steel", assetType: "Equity", lastPrice: 1030, previousClose: 1021, priceSource: "reference-catalog", aliases: "jsw steel metal" },
  { yahooSymbol: "TATASTEEL.NS", symbol: "TATASTEEL", exchange: "NSE", name: "Tata Steel", assetType: "Equity", lastPrice: 165, previousClose: 163, priceSource: "reference-catalog", aliases: "tata steel metal" },
  { yahooSymbol: "WIPRO.NS", symbol: "WIPRO", exchange: "NSE", name: "Wipro", assetType: "Equity", lastPrice: 270, previousClose: 268, priceSource: "reference-catalog", aliases: "wipro information technology" },
  { yahooSymbol: "HCLTECH.NS", symbol: "HCLTECH", exchange: "NSE", name: "HCL Technologies", assetType: "Equity", lastPrice: 1850, previousClose: 1838, priceSource: "reference-catalog", aliases: "hcl tech information technology" },
];

function Markets({ data, onTrade, refresh, notify }: {
  data: DashboardData;
  onTrade: (instrument: Instrument) => void;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [remoteResults, setRemoteResults] = useState<RemoteInstrument[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [universeSize, setUniverseSize] = useState(0);
  const [directoryDate, setDirectoryDate] = useState("");
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchBusy, setWatchBusy] = useState<string | null>(null);
  const types = ["All", ...Array.from(new Set(data.instruments.map((item) => item.assetType)))];
  const filtered = data.instruments.filter((item) => (filter === "All" || item.assetType === filter) && `${item.symbol} ${item.name} ${item.exchange}`.toLowerCase().includes(query.toLowerCase()));

  const loadWatchlist = useCallback(async () => {
    try {
      const payload = await api<{ items: WatchlistItem[] }>("/api/watchlist", { cache: "no-store" });
      setWatchlist(payload.items);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to load your watchlist.");
    }
  }, [notify]);

  useEffect(() => { void Promise.resolve().then(loadWatchlist); }, [loadWatchlist]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (searchTerm.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const payload = await api<{ results: RemoteInstrument[]; totalUniverse: number; asOf: string }>(
          `/api/instruments/search?q=${encodeURIComponent(searchTerm)}`,
          { cache: "no-store" },
        );
        if (!cancelled) {
          setUniverseSize(payload.totalUniverse);
          setDirectoryDate(payload.asOf);
          setRemoteResults(payload.results.filter((result) => !data.instruments.some((item) => item.symbol === result.symbol && item.exchange === result.exchange)));
        }
      } catch (caught) {
        if (!cancelled) {
          const normalized = searchTerm.toLowerCase();
          const fallback = FALLBACK_MARKET_CATALOG
            .filter((item) => `${item.symbol} ${item.name} ${item.aliases}`.toLowerCase().includes(normalized));
          setRemoteResults(fallback);
          setSearchError(fallback.length
            ? "The full exchange directory is temporarily unavailable; these limited cached matches are shown instead."
            : (caught instanceof Error ? caught.message : "Market search is temporarily unavailable."));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, data.instruments]);

  async function saveRemote(result: RemoteInstrument) {
    const response = await api<{ instrument: Instrument }>("/api/instruments/search", {
      method: "POST",
      body: JSON.stringify(result),
    });
    await refresh();
    return response.instrument;
  }

  async function addAndTrade(result: RemoteInstrument) {
    try {
      const instrument = await saveRemote(result);
      notify(`${result.symbol} added to the market universe`);
      onTrade(instrument);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to add this instrument.");
    }
  }

  async function addToWatchlist(instrument: Instrument) {
    const key = `add-${instrument.id}`;
    setWatchBusy(key);
    try {
      await api("/api/watchlist", { method: "POST", body: JSON.stringify({ instrumentId: instrument.id }) });
      await loadWatchlist();
      notify(`${instrument.symbol} added to your watchlist`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to update the watchlist.");
    } finally {
      setWatchBusy(null);
    }
  }

  async function addRemoteToWatchlist(result: RemoteInstrument) {
    const key = `remote-${result.exchange}-${result.symbol}`;
    setWatchBusy(key);
    try {
      const instrument = await saveRemote(result);
      await api("/api/watchlist", { method: "POST", body: JSON.stringify({ instrumentId: instrument.id }) });
      await loadWatchlist();
      notify(`${result.symbol} added to your watchlist`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to update the watchlist.");
    } finally {
      setWatchBusy(null);
    }
  }

  async function removeFromWatchlist(item: WatchlistItem) {
    setWatchBusy(`remove-${item.id}`);
    try {
      await api(`/api/watchlist?id=${item.id}`, { method: "DELETE" });
      await loadWatchlist();
      notify(`${item.symbol} removed from your watchlist`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to update the watchlist.");
    } finally {
      setWatchBusy(null);
    }
  }

  async function moveWatchlist(item: WatchlistItem, direction: "up" | "down") {
    setWatchBusy(`move-${item.id}`);
    try {
      await api("/api/watchlist", { method: "PATCH", body: JSON.stringify({ id: item.id, direction }) });
      await loadWatchlist();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to reorder the watchlist.");
    } finally {
      setWatchBusy(null);
    }
  }

  const watched = new Set(watchlist.map((item) => item.instrumentId));
  const asInstrument = (item: WatchlistItem): Instrument => ({ ...item, id: item.instrumentId });

  const showExternal = query.trim().length >= 2;
  return <div className="page-stack">
    <section className="market-hero"><div><p className="eyebrow">NSE · BSE · NFO · MCX</p><h2>Explore instruments</h2><p>Official NSE/BSE security directory with free delayed quotes and administrator-managed derivative fallbacks.</p></div><div className="market-clock"><span>INDIA MARKET</span><strong>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong><small>Prices carry individual timestamps</small></div></section>
    <section className="panel watchlist-panel">
      <PanelHead title="My watchlist" subtitle={`${watchlist.length} saved instrument${watchlist.length === 1 ? "" : "s"} · ordered your way`} action={<span className="watchlist-hint">Use ↑ ↓ to reorder</span>} />
      {watchlist.length ? <div className="watchlist-items">{watchlist.map((item, index) => {
        const change = item.lastPrice - item.previousClose;
        return <article className="watchlist-row" key={item.id}>
          <span className="watch-rank">{String(index + 1).padStart(2, "0")}</span>
          <InstrumentName symbol={item.symbol} exchange={item.exchange} name={item.name} />
          <span className="watch-price"><b>{price.format(item.lastPrice)}</b><small className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{(change / Math.max(item.previousClose, 0.01) * 100).toFixed(2)}%</small></span>
          <div className="watch-controls"><button disabled={index === 0 || watchBusy === `move-${item.id}`} aria-label={`Move ${item.symbol} up`} onClick={() => void moveWatchlist(item, "up")}>↑</button><button disabled={index === watchlist.length - 1 || watchBusy === `move-${item.id}`} aria-label={`Move ${item.symbol} down`} onClick={() => void moveWatchlist(item, "down")}>↓</button><button className="remove" disabled={watchBusy === `remove-${item.id}`} onClick={() => void removeFromWatchlist(item)}>Remove</button><button className="trade" onClick={() => onTrade(asInstrument(item))}>Trade</button></div>
        </article>;
      })}</div> : <EmptyState title="Build your watchlist" text="Use the star beside any saved security, or search the full NSE/BSE directory and add it here." />}
    </section>
    <div className="market-tools"><label className="search-box">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search any NSE/BSE symbol, company, ETF, REIT or bond" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}>{types.map((type) => <option key={type}>{type}</option>)}</select></div>
    {showExternal && <section className="panel external-results"><PanelHead title="Complete NSE/BSE directory" subtitle={searching ? "Searching the full listed universe…" : universeSize ? `${universeSize.toLocaleString("en-IN")} instruments · exchange directory ${directoryDate}` : remoteResults.length ? `${remoteResults.length} match${remoteResults.length === 1 ? "" : "es"}` : "No additional matches yet"} />{searchError && <div className={remoteResults.length ? "alert warning" : "alert error"}>{searchError}</div>}{remoteResults.map((result) => {
      const key = `remote-${result.exchange}-${result.symbol}`;
      return <div className="external-result" key={`${result.exchange}:${result.symbol}`}><InstrumentName symbol={result.symbol} exchange={result.exchange} name={result.name} /><span className="external-price"><b>{result.lastPrice > 0 ? price.format(result.lastPrice) : "Quote on selection"}</b><small>{result.official ? `Official · ${result.series || "listed"}` : result.priceSource}</small></span><span className="asset-pill">{result.assetType}</span><div className="market-row-actions"><button className="watch-star" disabled={watchBusy === key} onClick={() => void addRemoteToWatchlist(result)} aria-label={`Add ${result.symbol} to watchlist`}>☆</button><button className="row-action filled" onClick={() => void addAndTrade(result)}>{result.lastPrice > 0 ? "Add & trade" : "Get quote"}</button></div></div>;
    })}</section>}
    <section className="panel market-table"><div className="table-scroll"><table><thead><tr><th>Watch</th><th>Instrument</th><th>Type</th><th>Lot</th><th>Margin</th><th>Last price</th><th>Day change</th><th>Updated</th><th /></tr></thead><tbody>{filtered.map((item) => { const change = item.lastPrice - item.previousClose; const isWatched = watched.has(item.id); return <tr key={item.id}><td><button className={`watch-star ${isWatched ? "active" : ""}`} disabled={isWatched || watchBusy === `add-${item.id}`} onClick={() => void addToWatchlist(item)} aria-label={isWatched ? `${item.symbol} is on watchlist` : `Add ${item.symbol} to watchlist`}>{isWatched ? "★" : "☆"}</button></td><td><InstrumentName symbol={item.symbol} exchange={item.exchange} name={item.name} /></td><td><span className="asset-pill">{item.assetType}</span></td><td>{item.lotSize}</td><td>{item.marginPercent}%</td><td><strong>{price.format(item.lastPrice)}</strong></td><td className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{(change / Math.max(item.previousClose, 0.01) * 100).toFixed(2)}%</td><td><span className="update-time">{new Date(item.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}<small>{item.priceSource}</small></span></td><td><button className="row-action filled" onClick={() => onTrade(item)}>Trade</button></td></tr>; })}</tbody></table></div>{!filtered.length && !showExternal && <EmptyState title="No saved instruments match" text="Try another symbol, company or exchange." />}</section>
  </div>;
}

function Orders({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState("ALL");
  const shown = orders.filter((order) => filter === "ALL" || order.status === filter);
  return <div className="page-stack"><section className="section-intro"><div><p className="eyebrow">ORDER BOOK</p><h2>Orders and executions</h2><p>Market orders fill immediately. Conditional orders trigger automatically when refreshed prices cross your level.</p></div><div className="segmented">{["ALL", "PENDING", "EXECUTED"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></section><section className="panel"><div className="table-scroll"><table><thead><tr><th>Time</th><th>Instrument</th><th>Side</th><th>Type</th><th>Qty</th><th>Trigger / limit</th><th>Fill price</th><th>Status</th></tr></thead><tbody>{shown.map((order) => <tr key={order.id}><td><span className="date-cell">{new Date(order.placedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}<small>{new Date(order.placedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{order.isBackdated ? " · Backdated" : ""}</small></span></td><td><strong>{order.symbol}</strong><small className="block">{order.exchange}</small></td><td><span className={`side-pill ${order.side.toLowerCase()}`}>{order.side}</span></td><td>{order.orderType}</td><td>{order.quantity}</td><td>{order.triggerPrice ? price.format(order.triggerPrice) : order.limitPrice ? price.format(order.limitPrice) : "Market"}</td><td>{order.executedPrice ? price.format(order.executedPrice) : "—"}</td><td><span className={`status ${order.status.toLowerCase()}`}>{order.status}</span></td></tr>)}</tbody></table></div>{!shown.length && <EmptyState title="No orders here" text="Orders matching this status will appear here." />}</section></div>;
}

function Leaderboard({ data }: { data: DashboardData }) {
  const [metric, setMetric] = useState<"netWorth" | "pnl" | "returnPct">("netWorth");
  const [period, setPeriod] = useState("Lifetime");
  const ranked = [...data.leaderboard].sort((a, b) => b[metric] - a[metric]);
  return <div className="page-stack"><section className="leader-hero"><div><p className="eyebrow light">IFSA INVESTMENT LEAGUE</p><h2>Ideas compete.<br />Everyone learns.</h2><p>Friendly rankings across the flagship fund and member portfolios.</p></div><div className="leader-controls"><label>Ranking metric<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}><option value="netWorth">Overall net worth</option><option value="pnl">Absolute P&L</option><option value="returnPct">Return percentage</option></select></label><label>Period<select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Lifetime</option>{data.seasons.map((season) => <option key={season.id}>{season.name}</option>)}</select></label></div></section>{ranked.length > 0 && <section className="podium">{ranked.slice(0, 3).map((leader, index) => <article key={leader.id} className={`podium-card rank-${index + 1}`}><span className="medal">{index === 0 ? "1" : index === 1 ? "2" : "3"}</span><div className="avatar large">{leader.displayName.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><h3>{leader.kind === "flagship" ? "IFSA Flagship" : leader.displayName}</h3><p>{leader.kind === "flagship" ? "Society portfolio" : "Member portfolio"}</p><strong>{metric === "returnPct" ? `${leader.returnPct.toFixed(2)}%` : inr.format(leader[metric])}</strong><small className={leader.pnl >= 0 ? "positive" : "negative"}>{leader.pnl >= 0 ? "+" : ""}{inr.format(leader.pnl)} P&L</small></article>)}</section>}<section className="panel"><PanelHead title="Full standings" subtitle={`${period} · Ranked by ${metric === "netWorth" ? "overall net worth" : metric === "pnl" ? "absolute P&L" : "return percentage"}`} /><div className="table-scroll"><table><thead><tr><th>Rank</th><th>Portfolio</th><th>Net worth</th><th>Absolute P&L</th><th>Return</th><th>Badge</th></tr></thead><tbody>{ranked.map((leader, index) => <tr key={leader.id} className={leader.id === data.portfolio.id ? "highlight-row" : ""}><td><strong className="rank-number">#{index + 1}</strong></td><td><InstrumentName symbol={leader.kind === "flagship" ? "IF" : leader.displayName.slice(0, 2).toUpperCase()} exchange={leader.kind === "flagship" ? "FLAGSHIP" : "MEMBER"} name={leader.kind === "flagship" ? "IFSA SVC Flagship Fund" : leader.displayName} /></td><td><strong>{inr.format(leader.netWorth)}</strong></td><td className={leader.pnl >= 0 ? "positive" : "negative"}>{leader.pnl >= 0 ? "+" : ""}{inr.format(leader.pnl)}</td><td className={leader.returnPct >= 0 ? "positive" : "negative"}>{leader.returnPct >= 0 ? "+" : ""}{leader.returnPct.toFixed(2)}%</td><td>{index === 0 ? <span className="asset-pill gold">Season leader</span> : index < 3 ? <span className="asset-pill">Top 3</span> : "—"}</td></tr>)}</tbody></table></div></section></div>;
}

function ChatRoom({ user, notify }: { user: User; notify: (message: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senderName, setSenderName] = useState(user.displayName);
  const [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [moderatingId, setModeratingId] = useState<number | null>(null);
  const chatRevision = useRef(-1);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const idKey = `ifsa-chat-device-${user.id}`;
    const nameKey = `ifsa-chat-name-${user.id}`;
    let id = window.localStorage.getItem(idKey);
    if (!id) {
      id = typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(idKey, id);
    }
    const savedName = window.localStorage.getItem(nameKey) || user.displayName;
    void Promise.resolve().then(() => {
      setDeviceId(id);
      setSenderName(savedName);
    });
  }, [user.id, user.displayName]);

  const loadMessages = useCallback(async () => {
    try {
      const result = await api<{ messages: ChatMessage[]; revision: number; replace: boolean }>(`/api/chat?revision=${chatRevision.current}`, { cache: "no-store" });
      if (result.replace) setMessages(result.messages);
      chatRevision.current = result.revision;
      setChatError("");
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : "Live updates are temporarily unavailable.");
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 2_000);
    return () => window.clearInterval(timer);
  }, [deviceId, loadMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto", block: "end" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") || "").trim();
    if (!message) return;
    setBusy(true);
    setChatError("");
    try {
      await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, senderName, deviceId }),
      });
      form.reset();
      await loadMessages();
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Could not send the message.";
      setChatError(messageText);
      notify(messageText);
    } finally {
      setBusy(false);
    }
  }

  function saveSenderName(value: string) {
    const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 36) || user.displayName;
    setSenderName(cleaned);
    window.localStorage.setItem(`ifsa-chat-name-${user.id}`, cleaned);
  }

  async function saveEditedMessage(id: number) {
    const message = editValue.trim();
    if (!message) return;
    setModeratingId(id);
    try {
      await api("/api/chat", { method: "PATCH", body: JSON.stringify({ id, message, deviceId }) });
      setEditingId(null);
      setEditValue("");
      chatRevision.current = -1;
      await loadMessages();
      notify("Message edited");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not edit the message.");
    } finally {
      setModeratingId(null);
    }
  }

  async function deleteMessage(id: number) {
    setModeratingId(id);
    try {
      await api(`/api/chat?id=${id}&deviceId=${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      chatRevision.current = -1;
      await loadMessages();
      notify("Message deleted");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not delete the message.");
    } finally {
      setModeratingId(null);
    }
  }

  const participantCount = new Set(messages.map((message) => `${message.userId}:${message.deviceId}`)).size;

  return (
    <div className="page-stack chat-page">
      <section className="chat-banner">
        <div><p className="eyebrow light">IFSA MEMBER FLOOR</p><h2>Chat room</h2><p>A shared space for market views, trade ideas and society discussion.</p></div>
        <div className="chat-live"><i /><span>LIVE ROOM</span><strong>{participantCount || 1}</strong><small>device{participantCount === 1 ? "" : "s"} in recent chat</small></div>
      </section>
      <div className="chat-layout">
        <section className="panel chat-panel">
          <header className="chat-panel-head">
            <div><strong>General discussion</strong><small>Messages update automatically every 2 seconds</small></div>
            <span><i /> Connected</span>
          </header>
          <div className="chat-messages" aria-live="polite">
            {initialLoad && <div className="chat-loading"><span className="loader" />Opening the room…</div>}
            {!initialLoad && !messages.length && <EmptyState title="Start the conversation" text="Share a market observation, ask a question or discuss a mock trade." />}
            {messages.map((message, index) => {
              const own = message.userId === user.id && message.deviceId === deviceId;
              const previous = messages[index - 1];
              const grouped = previous && previous.userId === message.userId && previous.deviceId === message.deviceId && message.createdAt - previous.createdAt < 5 * 60_000;
              return (
                <article className={`chat-message ${own ? "own" : ""} ${grouped ? "grouped" : ""}`} key={message.id}>
                  {!grouped && <div className="chat-avatar">{message.senderName.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</div>}
                  <div className="chat-bubble">
                    {!grouped && <header><strong>{message.senderName}</strong><span>@{message.username}</span><time>{new Date(message.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{message.editedAt ? " · edited" : ""}</time></header>}
                    {editingId === message.id ? (
                      <div className="chat-edit-box">
                        <textarea value={editValue} maxLength={1000} rows={3} onChange={(event) => setEditValue(event.target.value)} autoFocus />
                        <div><button onClick={() => { setEditingId(null); setEditValue(""); }}>Cancel</button><button className="save" disabled={moderatingId === message.id} onClick={() => void saveEditedMessage(message.id)}>Save edit</button></div>
                      </div>
                    ) : <p>{message.message}</p>}
                    {message.editedAt && grouped && editingId !== message.id && <small className="chat-edited">edited</small>}
                    {own && editingId !== message.id && <div className="chat-message-tools">
                      <button onClick={() => { setEditingId(message.id); setEditValue(message.message); setDeleteConfirmId(null); }}>Edit</button>
                      {deleteConfirmId === message.id ? <><span>Delete permanently?</span><button onClick={() => setDeleteConfirmId(null)}>Cancel</button><button className="danger" disabled={moderatingId === message.id} onClick={() => void deleteMessage(message.id)}>Delete</button></> : <button className="danger" onClick={() => { setDeleteConfirmId(message.id); setEditingId(null); }}>Delete</button>}
                    </div>}
                  </div>
                </article>
              );
            })}
            <div ref={bottom} />
          </div>
          {chatError && <div className="chat-error">{chatError}</div>}
          <form className="chat-composer" onSubmit={sendMessage}>
            <textarea
              name="message"
              rows={2}
              maxLength={1000}
              placeholder={`Message as ${senderName}…`}
              aria-label="Chat message"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              required
            />
            <button className="chat-send" disabled={busy || !deviceId}>{busy ? "Sending…" : "Send ↗"}</button>
            <small>Enter to send · Shift + Enter for a new line</small>
          </form>
        </section>
        <aside className="panel chat-profile">
          <p className="eyebrow">THIS DEVICE</p>
          <div className="chat-profile-avatar">{senderName.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</div>
          <h3>{senderName}</h3>
          <p>Signed in through <b>@{user.username}</b></p>
          <label>Display name for this device
            <input value={senderName} maxLength={36} onChange={(event) => setSenderName(event.target.value)} onBlur={(event) => saveSenderName(event.target.value)} />
          </label>
          <button className="secondary-button wide" onClick={() => saveSenderName(senderName)}>Save display name</button>
          <div className="chat-note"><b>Using one shared account?</b><p>Set a different name on each phone or laptop so everyone remains identifiable in the room.</p></div>
        </aside>
      </div>
    </div>
  );
}

const tutorialSteps = [
  { key: "overview", title: "Read your portfolio", icon: "01", text: "Start with net worth, cash, P&L and holdings. Green and red show direction, not a recommendation.", tab: "Overview" as Tab },
  { key: "markets", title: "Find & watch securities", icon: "02", text: "Search the complete NSE/BSE directory, star an instrument and arrange your watchlist with the arrow controls.", tab: "Markets" as Tab },
  { key: "trade", title: "Place a mock order", icon: "03", text: "Open Trade, choose BUY or SELL, select an order type and review the estimated virtual amount before submitting.", tab: "Markets" as Tab },
  { key: "orders", title: "Track execution", icon: "04", text: "Market orders fill at the latest available simulated price. Limit, stop-loss and GTT orders remain visible until triggered.", tab: "Orders" as Tab },
  { key: "community", title: "Learn with the society", icon: "05", text: "Compare portfolios, share research in Chat Room and send a structured trade recommendation to the flagship team.", tab: "Chat Room" as Tab },
  { key: "learn", title: "Build investing skills", icon: "06", text: "Use the Learning Hub modules, visual examples and quick checks. Your completion progress is saved to your profile.", tab: "Learning Hub" as Tab },
];

function Tutorial({ goTo }: { goTo: (tab: Tab) => void }) {
  const [selected, setSelected] = useState(0);
  const step = tutorialSteps[selected];
  return <div className="page-stack tutorial-page">
    <section className="tutorial-hero"><div><p className="eyebrow light">DASHBOARD WALKTHROUGH</p><h2>From first login to first mock trade.</h2><p>A visual, six-step tour you can revisit at any time.</p></div><div className="tutorial-progress-ring" style={{ "--tour-progress": `${((selected + 1) / tutorialSteps.length) * 100}%` } as React.CSSProperties}><span><b>{selected + 1}</b>/6</span></div></section>
    <section className="tutorial-layout">
      <nav className="panel tutorial-steps" aria-label="Tutorial steps">{tutorialSteps.map((item, index) => <button className={selected === index ? "active" : ""} key={item.key} onClick={() => setSelected(index)}><span>{item.icon}</span><div><b>{item.title}</b><small>{index < selected ? "Viewed" : index === selected ? "Now viewing" : "Next"}</small></div></button>)}</nav>
      <article className="panel tutorial-stage">
        <div className="tutorial-copy"><span className="lesson-number">STEP {step.icon}</span><h3>{step.title}</h3><p>{step.text}</p></div>
        <TutorialVisual kind={step.key} />
        <footer><button className="secondary-button" disabled={selected === 0} onClick={() => setSelected((value) => Math.max(0, value - 1))}>← Previous</button><button className="primary-button" onClick={() => selected === tutorialSteps.length - 1 ? goTo(step.tab) : setSelected((value) => Math.min(tutorialSteps.length - 1, value + 1))}>{selected === tutorialSteps.length - 1 ? "Open Learning Hub" : "Next step →"}</button></footer>
      </article>
    </section>
    <section className="tutorial-shortcuts">{tutorialSteps.slice(0, 4).map((item) => <button key={item.key} onClick={() => goTo(item.tab)}><span>{item.icon}</span><b>{item.title}</b><small>Open {item.tab} →</small></button>)}</section>
  </div>;
}

function TutorialVisual({ kind }: { kind: string }) {
  if (kind === "overview") return <div className="ui-demo overview-demo"><div className="demo-top"><i /><span /><b /></div><div className="demo-metrics"><div className="featured"><small>NET WORTH</small><strong>₹10,42,800</strong><em>+4.28%</em></div><div><small>CASH</small><strong>₹2,10,000</strong></div><div><small>TODAY</small><strong className="positive">+₹4,240</strong></div></div><svg viewBox="0 0 400 100" aria-label="Example rising portfolio line"><polyline points="0,82 55,68 105,72 150,45 205,54 260,31 315,37 400,12" /></svg></div>;
  if (kind === "markets") return <div className="ui-demo market-demo"><div className="demo-search">⌕ Search NSE/BSE</div>{["RELIANCE", "GOLDBEES", "EMBASSY"].map((symbol, index) => <div className="demo-market-row" key={symbol}><button>{index === 1 ? "★" : "☆"}</button><b>{symbol}</b><span>{index === 0 ? "₹1,518.40" : index === 1 ? "₹81.42" : "₹414.30"}</span><i className={index === 2 ? "negative" : "positive"}>{index === 2 ? "−0.4%" : "+0.8%"}</i></div>)}</div>;
  if (kind === "trade") return <div className="ui-demo ticket-demo"><div><span className="asset-pill">EQUITY</span><b>RELIANCE</b><small>NSE</small></div><strong>₹1,518.40</strong><div className="demo-side"><button className="buy">BUY</button><button>SELL</button></div><div className="demo-fields"><span>Market order</span><span>10 shares</span></div><footer><span>Estimated value <b>₹15,184</b></span><button>Review BUY</button></footer></div>;
  if (kind === "orders") return <div className="ui-demo order-demo">{[{ side: "BUY", type: "MARKET", status: "EXECUTED" }, { side: "SELL", type: "GTT", status: "PENDING" }, { side: "BUY", type: "SL-M", status: "PENDING" }].map((order, index) => <div key={index}><span className={`side-pill ${order.side.toLowerCase()}`}>{order.side}</span><b>{index === 0 ? "HDFCBANK" : index === 1 ? "TCS" : "NIFTYBEES"}</b><small>{order.type}</small><em className={`status ${order.status.toLowerCase()}`}>{order.status}</em></div>)}</div>;
  if (kind === "community") return <div className="ui-demo community-demo"><div className="mini-podium"><span><b>2</b>Member A</span><span className="winner"><b>1</b>IFSA Flagship</span><span><b>3</b>Member B</span></div><div className="mini-chat"><i>AK</i><p><b>Achintya</b>What risk would invalidate this thesis?</p></div><div className="mini-chat reply"><i>RS</i><p><b>Research desk</b>Margin compression below our base case.</p></div></div>;
  return <div className="ui-demo learning-demo"><div className="learning-road"><span className="done">✓</span><i /><span className="done">✓</span><i /><span>3</span><i /><span>4</span></div><h4>Learning path</h4><div className="mini-flashcards"><div>Risk<br /><b>Protect downside</b></div><div>Return<br /><b>Reward for risk</b></div><div>Time<br /><b>Let compounding work</b></div></div></div>;
}

const learningModules = [
  { key: "basics", number: "01", title: "Market foundations", time: "8 min", color: "#7b210e", summary: "Ownership, return and the difference between price and value.", concepts: ["A share is a fractional ownership claim", "Price changes every trade; value is an estimate", "Return combines price change and cash received"], visual: "ownership", question: "Which statement best describes a listed share?", options: ["A guaranteed bank deposit", "Part ownership in a company", "A fixed-interest loan"], answer: 1 },
  { key: "stocks", number: "02", title: "Reading a business", time: "12 min", color: "#b06b2b", summary: "Connect revenue, profit, cash flow and valuation.", concepts: ["Income statement: performance over a period", "Balance sheet: resources and obligations", "Cash flow: where cash actually moved"], visual: "statements", question: "A profitable company can still face trouble when…", options: ["Cash collection is weak", "Its logo changes", "Its share has a ticker"], answer: 0 },
  { key: "orders", number: "03", title: "Orders & risk", time: "10 min", color: "#355f52", summary: "Market, limit, stop-loss and GTT through a price ladder.", concepts: ["Market prioritises execution", "Limit prioritises price", "Stop-loss manages a rule, not certainty"], visual: "ladder", question: "A buy limit at ₹100 should trigger when the latest price is…", options: ["₹105 or higher", "₹100 or lower", "Any price at all"], answer: 1 },
  { key: "portfolio", number: "04", title: "Portfolio thinking", time: "11 min", color: "#575183", summary: "Diversification, position sizing and drawdown.", concepts: ["Diversification reduces single-name dependence", "Position size controls impact", "Correlation can rise during stress"], visual: "allocation", question: "Diversification mainly helps reduce…", options: ["All market losses", "Company-specific concentration", "The need to research"], answer: 1 },
  { key: "derivatives", number: "05", title: "Derivatives & actions", time: "14 min", color: "#8a3f55", summary: "Lots, margin, expiry and how corporate actions change holdings.", concepts: ["Derivatives use contracts, lots and expiry", "Margin is collateral, not maximum loss", "Splits, bonuses and dividends alter quantity or cash"], visual: "payoff", question: "In a 1:2 split, 10 old shares become…", options: ["5 shares", "10 shares", "20 shares"], answer: 2 },
];

function LearningHub({ notify }: { notify: (message: string) => void }) {
  const [selectedKey, setSelectedKey] = useState("basics");
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const selected = learningModules.find((module) => module.key === selectedKey) ?? learningModules[0];
  const completed = new Set(progress.filter((item) => item.completed).map((item) => item.moduleKey));

  const loadProgress = useCallback(async () => {
    try {
      const payload = await api<{ progress: LearningProgress[] }>("/api/learning", { cache: "no-store" });
      setProgress(payload.progress);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to load learning progress.");
    }
  }, [notify]);
  useEffect(() => { void Promise.resolve().then(loadProgress); }, [loadProgress]);

  async function saveProgress(markComplete: boolean, correct = checked && answer === selected.answer) {
    try {
      await api("/api/learning", { method: "POST", body: JSON.stringify({ moduleKey: selected.key, completed: markComplete, quizScore: correct ? 1 : 0 }) });
      await loadProgress();
      if (markComplete) notify(`${selected.title} completed`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to save learning progress.");
    }
  }

  function chooseModule(key: string) { setSelectedKey(key); setAnswer(null); setChecked(false); }
  const completionPct = Math.round(completed.size / learningModules.length * 100);
  return <div className="page-stack learning-page">
    <section className="learning-hero"><div><p className="eyebrow light">IFSA LEARNING HUB</p><h2>Learn the idea. See the pattern. Try the decision.</h2><p>Short visual modules for members using their mock portfolio as a learning laboratory.</p></div><div className="learning-progress"><span>YOUR PROGRESS</span><strong>{completionPct}%</strong><i><b style={{ width: `${completionPct}%` }} /></i><small>{completed.size} of {learningModules.length} modules complete</small></div></section>
    <section className="module-strip">{learningModules.map((module) => <button key={module.key} className={`${selected.key === module.key ? "active" : ""} ${completed.has(module.key) ? "complete" : ""}`} onClick={() => chooseModule(module.key)} style={{ "--module-color": module.color } as React.CSSProperties}><span>{completed.has(module.key) ? "✓" : module.number}</span><div><b>{module.title}</b><small>{module.time}</small></div></button>)}</section>
    <section className="learning-layout">
      <article className="panel lesson-card"><header><div><span className="lesson-number">MODULE {selected.number}</span><h3>{selected.title}</h3><p>{selected.summary}</p></div><span className="lesson-time">◷ {selected.time}</span></header><LearningVisual kind={selected.visual} /><div className="concept-grid">{selected.concepts.map((concept, index) => <div key={concept}><span>{index + 1}</span><p>{concept}</p></div>)}</div></article>
      <aside className="panel knowledge-check"><p className="eyebrow">QUICK CHECK</p><h3>{selected.question}</h3><div className="quiz-options">{selected.options.map((option, index) => <button key={option} className={`${answer === index ? "selected" : ""} ${checked && index === selected.answer ? "correct" : ""} ${checked && answer === index && index !== selected.answer ? "wrong" : ""}`} onClick={() => { setAnswer(index); setChecked(false); }}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>{checked && <div className={`quiz-feedback ${answer === selected.answer ? "correct" : "wrong"}`}>{answer === selected.answer ? "Correct — the concept is working." : "Not quite. Revisit the visual and try again."}</div>}<button className="primary-button wide" disabled={answer === null} onClick={() => { const correct = answer === selected.answer; setChecked(true); void saveProgress(false, correct); }}>Check answer</button><button className="secondary-button wide" disabled={!checked || answer !== selected.answer || completed.has(selected.key)} onClick={() => void saveProgress(true, true)}>{completed.has(selected.key) ? "✓ Module completed" : "Mark module complete"}</button><p className="learning-note">Educational simulation only. Examples explain mechanics and are not investment advice.</p></aside>
    </section>
  </div>;
}

function LearningVisual({ kind }: { kind: string }) {
  if (kind === "ownership") return <div className="lesson-visual ownership-visual"><div><span>COMPANY</span><b>100%</b></div><i>divided into</i><div className="share-grid">{Array.from({ length: 12 }, (_, index) => <span className={index < 3 ? "owned" : ""} key={index} />)}</div><p><b>3 / 12 shares</b><span>25% illustrative ownership</span></p></div>;
  if (kind === "statements") return <div className="lesson-visual statement-visual"><div><span>Revenue</span><b>₹100</b></div><i>− costs</i><div><span>Profit</span><b>₹14</b></div><i>± timing</i><div><span>Cash flow</span><b>₹9</b></div></div>;
  if (kind === "ladder") return <div className="lesson-visual ladder-visual"><div className="ladder-price"><span>₹106</span><i /><small>BUY STOP</small></div><div className="ladder-price current"><span>₹103</span><i /><small>LATEST PRICE</small></div><div className="ladder-price"><span>₹100</span><i /><small>BUY LIMIT</small></div><div className="ladder-price"><span>₹96</span><i /><small>SELL STOP</small></div></div>;
  if (kind === "allocation") return <div className="lesson-visual allocation-visual"><div className="learning-donut"><span>10<br /><small>positions</small></span></div><div>{[["Banking", 35], ["Technology", 25], ["Consumer", 20], ["Cash", 20]].map(([name, value]) => <p key={String(name)}><span>{name}</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}%</strong></p>)}</div></div>;
  return <div className="lesson-visual payoff-visual"><div className="payoff-axis"><i /><b /></div><svg viewBox="0 0 420 130" aria-label="Illustrative option payoff"><polyline points="12,98 215,98 405,18" /><line x1="215" y1="8" x2="215" y2="120" /></svg><span className="loss-zone">LOSS</span><span className="gain-zone">GAIN</span><div className="action-formulas"><b>1:2 split</b><span>10 shares → 20</span><b>₹5 dividend</b><span>10 shares → ₹50 cash</span></div></div>;
}

function Recommendations({ data, refresh, notify }: { data: DashboardData; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await api("/api/recommendations", { method: "POST", body: JSON.stringify({ instrumentId: Number(form.get("instrumentId")), side: form.get("side"), thesis: form.get("thesis"), targetPrice: Number(form.get("targetPrice")) || undefined, stopLoss: Number(form.get("stopLoss")) || undefined }) }); notify("Recommendation sent to the flagship team"); setOpen(false); await refresh(); } catch (caught) { notify(caught instanceof Error ? caught.message : "Could not submit recommendation"); }
  }
  return <div className="page-stack"><section className="section-intro"><div><p className="eyebrow">MEMBER RESEARCH DESK</p><h2>Recommend a flagship trade</h2><p>Share your action, price levels and concise investment thesis with the fund administrator.</p></div><button className="primary-button" onClick={() => setOpen(!open)}>＋ New recommendation</button></section>{open && <form className="panel form-grid recommendation-form" onSubmit={submit}><label>Instrument<select name="instrumentId" required>{data.instruments.map((item) => <option value={item.id} key={item.id}>{item.symbol} · {item.name}</option>)}</select></label><label>Action<select name="side"><option>BUY</option><option>SELL</option><option>WATCH</option></select></label><label>Target price<input name="targetPrice" type="number" step="0.01" placeholder="Optional" /></label><label>Stop loss<input name="stopLoss" type="number" step="0.01" placeholder="Optional" /></label><label className="full">Investment thesis<textarea name="thesis" rows={4} placeholder="What is mispriced, what changes the market's view, and what invalidates the thesis?" required /></label><div className="full form-actions"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button">Submit recommendation</button></div></form>}<section className="recommendation-grid">{data.recommendations.map((item) => <article className="panel recommendation-card" key={item.id}><div className="recommendation-top"><span className={`side-pill ${item.side.toLowerCase()}`}>{item.side}</span><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></div><h3>{item.symbol} <small>{item.exchange}</small></h3><p>{item.thesis}</p><div className="levels"><span>Target <b>{item.targetPrice ? price.format(item.targetPrice) : "—"}</b></span><span>Stop <b>{item.stopLoss ? price.format(item.stopLoss) : "—"}</b></span></div><footer><span>{item.memberName}</span><small>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></footer>{item.adminNote && <div className="admin-note"><b>Fund team:</b> {item.adminNote}</div>}</article>)}</section>{!data.recommendations.length && <EmptyState title="No recommendations yet" text="Your submitted ideas and the fund team's decision will appear here." />}</div>;
}

function Admin({ data, refresh, notify, onBackdatedTrade }: { data: DashboardData; refresh: () => Promise<void>; notify: (message: string) => void; onBackdatedTrade: (instrument: Instrument) => void }) {
  const [section, setSection] = useState("Members");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [deletingMember, setDeletingMember] = useState<number | null>(null);
  async function action(payload: Record<string, unknown>, success: string) { try { await api("/api/admin", { method: "POST", body: JSON.stringify(payload) }); notify(success); await refresh(); } catch (caught) { notify(caught instanceof Error ? caught.message : "Action failed"); } }
  async function createMember(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await action({ action: "createMember", username: form.get("username"), displayName: form.get("displayName"), password: form.get("password"), capital: Number(form.get("capital")) }, "Member account created"); event.currentTarget.reset(); }
  async function adjustFunds(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const direction = form.get("direction") === "withdraw" ? -1 : 1; await action({ action: "adjustFunds", portfolioId: Number(form.get("portfolioId")), amount: direction * Number(form.get("amount")), reason: form.get("reason"), occurredAt: form.get("date") ? new Date(String(form.get("date"))).getTime() : Date.now() }, "Fund balance updated"); event.currentTarget.reset(); }
  async function deleteMember(member: Member) {
    setDeletingMember(member.id);
    try {
      await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "deleteMember", userId: member.id }) });
      notify(`${member.displayName}'s account and portfolio were deleted`);
      setPendingDelete(null);
      await refresh();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Could not delete the account.");
    } finally {
      setDeletingMember(null);
    }
  }
  return <div className="page-stack"><section className="admin-banner"><div><p className="eyebrow light">CONTROL CENTRE</p><h2>Fund administration</h2><p>Create member access, allocate virtual capital and maintain the flagship simulation.</p></div><div className="admin-stat"><span>Active portfolios</span><strong>{data.members.length}</strong></div></section><div className="admin-tabs">{["Members", "Funds", "Quotes", "Corporate actions", "Review desk"].map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>)}</div>{section === "Members" && <div className="admin-grid"><form className="panel form-stack" onSubmit={createMember}><PanelHead title="Create member account" subtitle="Only administrators can issue credentials" /><label>Member name<input name="displayName" placeholder="Full name" required /></label><label>Username<input name="username" placeholder="firstname.lastname" required /></label><label>Temporary password<input name="password" type="password" minLength={8} placeholder="Minimum 8 characters" required /></label><label>Opening virtual capital<input name="capital" type="number" min="0" step="1000" defaultValue="1000000" required /></label><button className="primary-button wide">Create portfolio</button></form><section className="panel"><PanelHead title="Portfolio access" subtitle="Manage member accounts and credentials" /><div className="member-list">{data.members.map((member) => <div className={pendingDelete === member.id ? "confirming" : ""} key={member.id}><div className="avatar">{member.displayName.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><span><strong>{member.displayName}</strong><small>@{member.username}</small></span><b>{inr.format(member.netContributions)}</b>{member.id === data.user.id ? <span className="admin-protected">Protected</span> : pendingDelete === member.id ? <div className="member-delete-confirm"><span>Delete account and all portfolio data?</span><button onClick={() => setPendingDelete(null)}>Cancel</button><button className="danger" disabled={deletingMember === member.id} onClick={() => void deleteMember(member)}>{deletingMember === member.id ? "Deleting…" : "Delete permanently"}</button></div> : <button className="member-delete" onClick={() => setPendingDelete(member.id)}>Delete</button>}</div>)}</div></section></div>}{section === "Funds" && <div className="admin-grid"><form className="panel form-stack" onSubmit={adjustFunds}><PanelHead title="Add or withdraw funds" subtitle="Every adjustment is recorded in the audit ledger" /><label>Portfolio<select name="portfolioId">{data.members.map((member) => <option value={member.portfolioId} key={member.portfolioId}>{member.displayName}</option>)}</select></label><label>Action<select name="direction"><option value="deposit">Add virtual funds</option><option value="withdraw">Withdraw virtual funds</option></select></label><label>Amount<input name="amount" type="number" min="1" step="1000" required /></label><label>Effective date<input name="date" type="date" /></label><label>Reason<input name="reason" placeholder="Allocation, correction, withdrawal…" required /></label><button className="primary-button wide">Record adjustment</button></form><section className="panel"><PanelHead title="Administrator tools" subtitle="Flagship-only controls" /><div className="tool-cards"><button onClick={() => onBackdatedTrade(data.instruments[0])}><span>↶</span><strong>Backdated trade</strong><small>Record an historical flagship execution</small></button><button onClick={() => setSection("Quotes")}><span>₹</span><strong>Manual quote</strong><small>Update unsupported contracts</small></button><button onClick={() => setSection("Corporate actions")}><span>⇢</span><strong>Corporate actions</strong><small>Schedule verified portfolio changes</small></button><button onClick={() => setSection("Review desk")}><span>✦</span><strong>Review ideas</strong><small>{data.recommendations.filter((x) => x.status === "NEW").length} awaiting review</small></button></div></section></div>}{section === "Quotes" && <QuoteAdmin data={data} action={action} />}{section === "Corporate actions" && <CorporateActionsAdmin data={data} refresh={refresh} notify={notify} />}{section === "Review desk" && <section className="panel"><PanelHead title="Flagship recommendation desk" subtitle="Assess member-generated trade ideas" /><div className="review-list">{data.recommendations.map((item) => <div key={item.id}><div><span className={`side-pill ${item.side.toLowerCase()}`}>{item.side}</span><strong>{item.symbol}</strong><small>by {item.memberName}</small><p>{item.thesis}</p></div><div className="review-actions"><button onClick={() => void action({ action: "updateRecommendation", id: item.id, status: "ACCEPTED", adminNote: "Accepted for the flagship watchlist." }, "Recommendation accepted")}>Accept</button><button onClick={() => void action({ action: "updateRecommendation", id: item.id, status: "REVIEWING", adminNote: "Under review by the fund team." }, "Marked for review")}>Review</button><button className="decline" onClick={() => void action({ action: "updateRecommendation", id: item.id, status: "DECLINED", adminNote: "Not taken forward at this time." }, "Recommendation declined")}>Decline</button></div></div>)}</div></section>}</div>;
}

function QuoteAdmin({ data, action }: { data: DashboardData; action: (payload: Record<string, unknown>, success: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await action({ action: "updateQuote", instrumentId: Number(form.get("instrumentId")), price: Number(form.get("price")) }, "Quote updated"); event.currentTarget.reset(); }
  return <div className="admin-grid"><form className="panel form-stack" onSubmit={submit}><PanelHead title="Manual quote update" subtitle="For F&O, commodity and debt instruments without a free feed" /><label>Instrument<select name="instrumentId">{data.instruments.map((item) => <option value={item.id} key={item.id}>{item.symbol} · {item.exchange}</option>)}</select></label><label>Latest price<input name="price" type="number" min="0.01" step="0.01" required /></label><button className="primary-button wide">Publish quote</button></form><section className="panel"><PanelHead title="Data source status" subtitle="No paid market-data API is used" /><div className="source-list">{data.instruments.map((item) => <div key={item.id}><InstrumentName symbol={item.symbol} exchange={item.exchange} name={item.name} /><span className={`source-status ${item.priceSource === "admin" ? "manual" : ""}`}>{item.priceSource}<small>{new Date(item.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span></div>)}</div></section></div>;
}

function CorporateActionsAdmin({ data, refresh, notify }: { data: DashboardData; refresh: () => Promise<void>; notify: (message: string) => void }) {
  const [actions, setActions] = useState<CorporateActionRecord[]>([]);
  const [actionType, setActionType] = useState("DIVIDEND");
  const [busy, setBusy] = useState(false);

  const loadActions = useCallback(async () => {
    try {
      const payload = await api<{ actions: CorporateActionRecord[] }>("/api/corporate-actions", { cache: "no-store" });
      setActions(payload.actions);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to load corporate actions.");
    }
  }, [notify]);
  useEffect(() => { void Promise.resolve().then(loadActions); }, [loadActions]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    try {
      const effectiveDate = String(values.get("effectiveDate"));
      await api("/api/corporate-actions", { method: "POST", body: JSON.stringify({
        instrumentId: Number(values.get("instrumentId")),
        destinationInstrumentId: Number(values.get("destinationInstrumentId")) || undefined,
        actionType,
        effectiveAt: new Date(`${effectiveDate}T00:00:00+05:30`).getTime(),
        ratioBase: Number(values.get("ratioBase")) || undefined,
        ratioNew: Number(values.get("ratioNew")) || undefined,
        cashPerShare: Number(values.get("cashPerShare")) || undefined,
        costAllocationPercent: Number(values.get("costAllocationPercent")) || undefined,
        sourceUrl: values.get("sourceUrl"), notes: values.get("notes"),
      }) });
      form.reset();
      setActionType("DIVIDEND");
      await Promise.all([loadActions(), refresh()]);
      notify("Verified corporate action scheduled");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to schedule the corporate action.");
    } finally {
      setBusy(false);
    }
  }

  async function applyDue(id?: number) {
    setBusy(true);
    try {
      await api("/api/corporate-actions", { method: "POST", body: JSON.stringify({ operation: "applyDue", id }) });
      await Promise.all([loadActions(), refresh()]);
      notify("Due corporate actions processed");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to apply the corporate action.");
    } finally {
      setBusy(false);
    }
  }

  const needsRatio = actionType !== "DIVIDEND";
  const needsDestination = actionType === "MERGER" || actionType === "DEMERGER";
  return <div className="corporate-admin">
    <div className="admin-grid corporate-form-grid"><form className="panel form-stack" onSubmit={submit}>
      <PanelHead title="Schedule verified action" subtitle="Applied automatically at the first dashboard refresh or trade after the effective date" />
      <label>Affected security<select name="instrumentId" required>{data.instruments.map((item) => <option key={item.id} value={item.id}>{item.symbol} · {item.exchange}</option>)}</select></label>
      <label>Action type<select value={actionType} onChange={(event) => setActionType(event.target.value)}><option value="DIVIDEND">Cash dividend</option><option value="BONUS">Bonus issue</option><option value="SPLIT">Share split / consolidation</option><option value="MERGER">Merger / symbol replacement</option><option value="DEMERGER">Demerger / spin-off</option></select></label>
      <label>Effective date<input name="effectiveDate" type="date" required /></label>
      {actionType === "DIVIDEND" && <label>Cash per share<input name="cashPerShare" type="number" min="0.0001" step="0.0001" required /></label>}
      {needsRatio && <div className="form-pair"><label>{actionType === "BONUS" ? "Shares held" : "Old / base shares"}<input name="ratioBase" type="number" min="0.0001" step="0.0001" placeholder="1" required /></label><label>{actionType === "BONUS" ? "Bonus shares" : actionType === "SPLIT" ? "New total shares" : "Destination shares"}<input name="ratioNew" type="number" min="0.0001" step="0.0001" placeholder="2" required /></label></div>}
      {needsDestination && <label>Destination security<select name="destinationInstrumentId" required><option value="">Choose destination…</option>{data.instruments.map((item) => <option key={item.id} value={item.id}>{item.symbol} · {item.exchange}</option>)}</select></label>}
      {actionType === "DEMERGER" && <label>Cost allocated to destination (%)<input name="costAllocationPercent" type="number" min="0.01" max="99.99" step="0.01" required /></label>}
      <label>Official filing URL<input name="sourceUrl" type="url" placeholder="https://www.nseindia.com/…" required /></label>
      <label>Audit note<textarea name="notes" rows={3} placeholder="Board announcement, ratio interpretation, cost-allocation circular…" /></label>
      <label className="checkbox corporate-confirm"><input type="checkbox" required /> I checked the ratio, effective date and cost allocation against the official filing.</label>
      <button className="primary-button wide" disabled={busy}>{busy ? "Saving…" : "Verify and schedule"}</button>
    </form><section className="panel corporate-safety"><PanelHead title="Controlled action engine" subtitle="Automation with an audit trail" /><div className="action-flow"><div><span>1</span><b>Verify</b><small>Use the exchange or issuer filing</small></div><i>→</i><div><span>2</span><b>Schedule</b><small>Set the official effective date</small></div><i>→</i><div><span>3</span><b>Apply</b><small>Update every eligible portfolio once</small></div></div><ul><li><b>Dividend:</b> credits virtual cash without changing capital contributed.</li><li><b>Split / bonus:</b> changes quantity and preserves total cost basis.</li><li><b>Merger / demerger:</b> transfers or allocates cost to the destination security.</li><li><b>Safety stop:</b> fractional units or missing demerger allocation block the action for review.</li></ul><div className="official-links"><a href="https://www.nseindia.com/companies-listing/corporate-filings-actions" target="_blank" rel="noreferrer">Open NSE corporate actions ↗</a><a href="https://www.bseindia.com/corporates/corporate_act.html" target="_blank" rel="noreferrer">Open BSE corporate actions ↗</a></div><button className="secondary-button wide" disabled={busy} onClick={() => void applyDue()}>Run due-action check now</button></section></div>
    <section className="panel"><PanelHead title="Corporate-action ledger" subtitle="Verified schedules, application status and portfolio impact" /><div className="table-scroll"><table><thead><tr><th>Effective</th><th>Security</th><th>Action</th><th>Terms</th><th>Status</th><th>Impact</th><th>Source</th><th /></tr></thead><tbody>{actions.map((item) => <tr key={item.id}><td>{new Date(item.effectiveAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td><td><strong>{item.symbol}</strong>{item.destinationSymbol && <small className="block">→ {item.destinationSymbol}</small>}</td><td><span className="asset-pill">{item.actionType}</span></td><td>{item.actionType === "DIVIDEND" ? `${price.format(Number(item.cashPerShare))} / share` : `${item.ratioBase}:${item.ratioNew}`}{item.costAllocationPercent ? <small className="block">{item.costAllocationPercent}% cost transferred</small> : null}</td><td><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>{item.lastError && <small className="block action-error">{item.lastError}</small>}</td><td>{item.portfoliosAffected} portfolio{Number(item.portfoliosAffected) === 1 ? "" : "s"}{Number(item.totalCash) > 0 && <small className="block">{inr.format(Number(item.totalCash))} cash</small>}</td><td><a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Filing ↗</a></td><td>{item.status === "VERIFIED" ? <button className="row-action" disabled={busy} onClick={() => void applyDue(item.id)}>Check due</button> : "—"}</td></tr>)}</tbody></table></div>{!actions.length && <EmptyState title="No corporate actions scheduled" text="Verified dividend, bonus, split, merger and demerger entries will appear here." />}</section>
  </div>;
}

function TradeTicket({ instrument, isAdmin, onClose, onSuccess }: { instrument: Instrument; isAdmin: boolean; onClose: () => void; onSuccess: (message: string) => Promise<void> }) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState("MARKET");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backdated, setBackdated] = useState(false);
  const estimate = quantity * instrument.lotSize * instrument.lastPrice * (instrument.assetType.includes("Future") || instrument.assetType.includes("Option") ? instrument.marginPercent / 100 : 1);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try { await api("/api/trade", { method: "POST", body: JSON.stringify({ instrumentId: instrument.id, side, orderType, quantity, limitPrice: Number(form.get("limitPrice")) || undefined, triggerPrice: Number(form.get("triggerPrice")) || undefined, backdatedAt: backdated && form.get("backdatedAt") ? new Date(String(form.get("backdatedAt"))).getTime() : undefined, backdatedPrice: backdated ? Number(form.get("backdatedPrice")) || instrument.lastPrice : undefined, note: form.get("note") }) }); await onSuccess(orderType === "MARKET" || backdated ? "Order executed" : "Conditional order placed"); } catch (caught) { setError(caught instanceof Error ? caught.message : "Order failed"); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="trade-ticket" onSubmit={submit}><header><div><span className="asset-pill">{instrument.assetType}</span><h2>{instrument.symbol}</h2><p>{instrument.exchange} · {instrument.name}</p></div><button type="button" onClick={onClose}>×</button></header><div className="quote-block"><div><span>Last traded price</span><strong>{price.format(instrument.lastPrice)}</strong></div><span className={instrument.lastPrice >= instrument.previousClose ? "positive" : "negative"}>{instrument.lastPrice >= instrument.previousClose ? "+" : ""}{((instrument.lastPrice - instrument.previousClose) / instrument.previousClose * 100).toFixed(2)}%</span><small>Updated {new Date(instrument.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></div><div className="buy-sell"><button type="button" className={side === "BUY" ? "active buy" : ""} onClick={() => setSide("BUY")}>BUY</button><button type="button" className={side === "SELL" ? "active sell" : ""} onClick={() => setSide("SELL")}>SELL</button></div><label>Order type<select value={orderType} onChange={(event) => setOrderType(event.target.value)}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="SL">Stop-loss limit</option><option value="SL-M">Stop-loss market</option><option value="GTT">Good till triggered</option></select></label><div className="ticket-row"><label>{instrument.lotSize > 1 ? "Lots" : "Quantity"}<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label>{orderType === "LIMIT" && <label>Limit price<input name="limitPrice" type="number" step="0.01" required /></label>}{["SL", "SL-M", "GTT"].includes(orderType) && <label>Trigger price<input name="triggerPrice" type="number" step="0.01" required /></label>}</div>{isAdmin && <div className="backdate-box"><label className="checkbox"><input type="checkbox" checked={backdated} onChange={(event) => setBackdated(event.target.checked)} /> Record as a backdated flagship trade</label>{backdated && <div className="ticket-row"><label>Execution date<input name="backdatedAt" type="datetime-local" required /></label><label>Execution price<input name="backdatedPrice" type="number" step="0.01" defaultValue={instrument.lastPrice} required /></label></div>}</div>}<label>Order note<input name="note" placeholder="Optional rationale or desk note" /></label><div className="estimate"><span>Estimated {instrument.marginPercent < 100 ? "margin" : "value"}<b>{inr.format(estimate)}</b></span><span>Lot size<b>{instrument.lotSize}</b></span><span>Charges<b>₹0</b></span></div>{error && <div className="alert error">{error}</div>}<button className={`order-submit ${side.toLowerCase()}`} disabled={busy}>{busy ? "Processing…" : `${side} ${quantity} ${instrument.lotSize > 1 ? "lot(s)" : "unit(s)"}`}</button><p className="ticket-disclaimer">Simulated execution at the latest available price. No real trade is placed.</p></form></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span>↗</span><h3>{title}</h3><p>{text}</p></div>; }
