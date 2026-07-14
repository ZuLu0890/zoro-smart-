import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useStellar } from '../contexts/StellarProvider';
import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import {
  Wallet,
  PieChart,
  TrendingUp,
  Coins,
  ArrowRight,
  Sun,
  Leaf,
  Zap,
  BarChart3,
  ArrowUpRight,
  History,
} from 'lucide-react';
import type { PortfolioSummary, PortfolioHolding } from '@solshare/shared';

export default function Portfolio() {
  const { publicKey } = useStellar();

  const { data, isPending } = useQuery<PortfolioSummary>({
    queryKey: ['portfolio', publicKey],
    queryFn: () => api.portfolio(publicKey!),
    enabled: Boolean(publicKey),
    refetchInterval: 30_000,
  });

  if (!publicKey) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <Wallet className="w-8 h-8 mx-auto text-sun-400" />
        <h2 className="mt-4 text-xl font-semibold">Connect your wallet</h2>
        <p className="text-sm text-ink-300 mt-2">
          View your complete portfolio across all solar arrays, track your
          investments, and monitor your yield earnings.
        </p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="card h-32 shimmer" />
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-28 shimmer" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-20 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const holdings = data?.holdings ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Portfolio</h1>
        <p className="text-ink-300 text-sm mt-1">
          Your share holdings across all SolShare solar arrays. Monitor
          performance, track yield, and manage your investments.
        </p>
      </div>

      {/* Portfolio stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <PortfolioStat
          icon={<Sun className="w-4 h-4 text-sun-400" />}
          label="Arrays held"
          value={String(data?.totalArrays ?? 0)}
          accent="sun"
        />
        <PortfolioStat
          icon={<Coins className="w-4 h-4 text-leaf-400" />}
          label="Total shares"
          value={fmt.compact(data?.totalShares ?? '0')}
          accent="leaf"
        />
        <PortfolioStat
          icon={<TrendingUp className="w-4 h-4 text-sun-400" />}
          label="Claimable yield"
          value={`${fmt.usdc(data?.totalClaimableYield ?? '0')} USDC`}
          accent="sun"
        />
        <PortfolioStat
          icon={<BarChart3 className="w-4 h-4 text-ember-400" />}
          label="Total claimed"
          value={`${fmt.usdc(data?.totalClaimedYield ?? '0')} USDC`}
          accent="ember"
        />
      </div>

      {/* Holdings list */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">My holdings</h2>
        {holdings.length === 0 ? (
          <div className="card p-10 text-center text-ink-300">
            <PieChart className="w-8 h-8 mx-auto mb-3 text-ink-500" />
            <p>No holdings yet.</p>
            <p className="text-xs text-ink-400 mt-1">
              Browse{' '}
              <Link to="/arrays" className="text-sun-400 hover:underline">
                available arrays
              </Link>{' '}
              to start investing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map((h) => (
              <HoldingCard key={h.arrayId} holding={h} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/arrays"
          className="card p-5 flex items-center gap-4 group hover:shadow-glow transition"
        >
          <div className="p-3 rounded-xl bg-sun-500/10">
            <Sun className="w-5 h-5 text-sun-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Explore arrays</div>
            <p className="text-xs text-ink-400 mt-1">Discover new investment opportunities</p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-white transition-colors" />
        </Link>
        <Link
          to="/yield"
          className="card p-5 flex items-center gap-4 group hover:shadow-glow transition"
        >
          <div className="p-3 rounded-xl bg-leaf-500/10">
            <Coins className="w-5 h-5 text-leaf-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Claim yield</div>
            <p className="text-xs text-ink-400 mt-1">Collect your accrued earnings</p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-white transition-colors" />
        </Link>
        <Link
          to="/bridge"
          className="card p-5 flex items-center gap-4 group hover:shadow-glow transition"
        >
          <div className="p-3 rounded-xl bg-ember-500/10">
            <ArrowUpRight className="w-5 h-5 text-ember-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Bridge assets</div>
            <p className="text-xs text-ink-400 mt-1">Wrap tokens from other chains</p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-white transition-colors" />
        </Link>
      </div>
    </div>
  );
}

function PortfolioStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'sun' | 'leaf' | 'ember' | 'ink';
}) {
  const accentMap = {
    sun: 'from-sun-500/15 to-transparent',
    leaf: 'from-leaf-500/15 to-transparent',
    ember: 'from-ember-500/15 to-transparent',
    ink: 'from-white/5 to-transparent',
  };
  return (
    <div className="relative overflow-hidden card p-5 group transition hover:shadow-glow hover:-translate-y-0.5">
      <div
        className={`absolute inset-0 opacity-60 bg-gradient-to-br pointer-events-none ${accentMap[accent ?? 'sun']}`}
      />
      <div className="relative flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-ink-400">{label}</div>
        {icon}
      </div>
      <div className="relative mt-3 text-2xl font-semibold tracking-tight truncate">{value}</div>
    </div>
  );
}

function HoldingCard({ holding }: { holding: PortfolioHolding }) {
  return (
    <Link
      to={`/arrays/${holding.arrayId}`}
      className="card p-4 flex items-center gap-4 group hover:shadow-glow transition"
    >
      <div className="p-2.5 rounded-xl bg-sun-500/10">
        <Zap className="w-5 h-5 text-sun-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm group-hover:text-sun-400 transition-colors">
          {holding.arrayName || `Array ${holding.arrayId.slice(0, 8)}`}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-ink-400">
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3" />
            {fmt.compact(holding.balance)} shares
          </span>
          <span className="flex items-center gap-1">
            <Leaf className="w-3 h-3" />
            {fmt.usdc(holding.claimableYield)} USDC claimable
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold">{fmt.compact(holding.capacityW)}W</div>
        <div className="text-xs text-ink-400">{holding.status}</div>
      </div>
    </Link>
  );
}
