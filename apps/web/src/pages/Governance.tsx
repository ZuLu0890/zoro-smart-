import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { useStellar } from '../contexts/StellarProvider';
import {
  Vote,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Ban,
  PlusCircle,
  TrendingUp,
  Users,
  Timer,
  ExternalLink,
} from 'lucide-react';
import type { GovernanceProposal, ProposalVote } from '@solshare/shared';
import { fmt } from '../lib/format';

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Draft: FileText,
  Active: Clock,
  Passed: CheckCircle2,
  Rejected: XCircle,
  Executed: PlayCircle,
  Cancelled: Ban,
};

const STATUS_COLORS: Record<string, string> = {
  Draft: 'text-ink-300 bg-ink-700/60 ring-white/10',
  Active: 'text-sun-400 bg-sun-500/10 ring-sun-500/30',
  Passed: 'text-leaf-500 bg-leaf-500/10 ring-leaf-500/30',
  Rejected: 'text-ember-400 bg-ember-500/10 ring-ember-500/30',
  Executed: 'text-sky-400 bg-sky-500/10 ring-sky-500/30',
  Cancelled: 'text-ink-400 bg-ink-700/60 ring-white/10',
};

export default function Governance() {
  const { publicKey } = useStellar();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ['governance-proposals', filter],
    queryFn: () => api.governanceProposals({ status: filter }),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['governance-stats'],
    queryFn: () => api.governanceStats(),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Governance</h1>
          <p className="text-ink-300 text-sm mt-1">
            Vote on proposals that shape the SolShare protocol. Your voting power
            is proportional to your share holdings across all arrays.
          </p>
        </div>
        {publicKey && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sun-500 to-ember-500 hover:brightness-110 text-ink-950 px-4 py-2.5 text-sm font-semibold shadow-glow transition"
          >
            <PlusCircle className="w-4 h-4" /> New proposal
          </button>
        )}
      </div>

      {/* Governance stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill icon={FileText} label="Total proposals" value={String(stats.totalProposals)} />
          <StatPill icon={Clock} label="Active" value={String(stats.activeProposals)} />
          <StatPill icon={Users} label="Voters" value={String(stats.totalVoters)} />
          <StatPill
            icon={TrendingUp}
            label="Participation"
            value={fmt.percent(stats.participationRate * 100)}
          />
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter(undefined)}
          className={`pill ring-1 text-xs ${
            !filter
              ? 'ring-white/30 bg-white/10 text-white'
              : 'ring-white/10 bg-ink-800 text-ink-300 hover:bg-white/5'
          }`}
        >
          All
        </button>
        {['Active', 'Passed', 'Rejected', 'Executed', 'Draft', 'Cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`pill ring-1 text-xs ${
              filter === s
                ? 'ring-white/30 bg-white/10 text-white'
                : 'ring-white/10 bg-ink-800 text-ink-300 hover:bg-white/5'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Proposal list */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-6 text-sm text-ember-400">
          Failed to load governance proposals.
        </div>
      ) : (data?.items?.length ?? 0) === 0 ? (
        <div className="card p-10 text-center text-ink-300">
          <FileText className="w-8 h-8 mx-auto mb-3 text-ink-500" />
          <p>No proposals found{filter ? ` with status "${filter}"` : ''}.</p>
          <p className="text-xs text-ink-400 mt-2">
            Create a proposal or check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data!.items.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {/* Create proposal modal (simplified inline) */}
      {showCreate && (
        <CreateProposalPanel
          onClose={() => setShowCreate(false)}
          proposer={publicKey}
        />
      )}
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: GovernanceProposal }) {
  const StatusIcon = STATUS_ICONS[proposal.status] ?? FileText;
  const colorClass = STATUS_COLORS[proposal.status] ?? 'text-ink-300';

  return (
    <Link
      to={`/governance/${proposal.id}`}
      className="card p-5 flex items-start gap-4 group hover:shadow-glow transition"
    >
      <div className={`p-2 rounded-xl ${colorClass.split(' ')[1] ?? 'bg-white/10'}`}>
        <StatusIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold tracking-tight group-hover:text-sun-400 transition-colors">
          {proposal.title}
        </h3>
        <p className="text-sm text-ink-300 mt-1 line-clamp-2">
          {proposal.description}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
          <span>By {fmt.address(proposal.proposer)}</span>
          {proposal.votingEndAt > 0 && (
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {proposal.status === 'Active' ? 'Ends' : 'Ended'}{' '}
              {fmt.relative(proposal.votingEndAt)}
            </span>
          )}
          {proposal.arrayId && (
            <Link
              to={`/arrays/${proposal.arrayId}`}
              className="text-sun-400 hover:underline flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Array <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
      <span className={`pill ring-1 text-[10px] shrink-0 ${colorClass}`}>
        {proposal.status}
      </span>
    </Link>
  );
}

function CreateProposalPanel({
  onClose,
  proposer,
}: {
  onClose: () => void;
  proposer: string | null;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposalType, setProposalType] = useState('General');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!proposer || !title || !description) return;
    setSubmitting(true);
    try {
      await api.createProposal({
        title,
        description,
        proposalType,
        proposer,
        payload: {},
      });
      onClose();
    } catch {
      // Handle error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-lg mx-4 space-y-4">
        <h2 className="text-lg font-semibold">Create proposal</h2>
        <div>
          <label className="text-xs uppercase tracking-widest text-ink-400">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-xl bg-ink-800 ring-1 ring-white/10 focus:ring-sun-500 outline-none px-3 py-2"
            placeholder="E.g., Increase yield distribution frequency"
            maxLength={140}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-ink-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-xl bg-ink-800 ring-1 ring-white/10 focus:ring-sun-500 outline-none px-3 py-2 min-h-[120px] resize-y"
            placeholder="Describe the proposal in detail…"
            maxLength={5000}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-ink-400">
            Type
          </label>
          <select
            value={proposalType}
            onChange={(e) => setProposalType(e.target.value)}
            className="mt-2 w-full rounded-xl bg-ink-800 ring-1 ring-white/10 focus:ring-sun-500 outline-none px-3 py-2"
          >
            {['General', 'ParameterChange', 'FeeUpdate', 'OperatorUpdate', 'MaintenanceSchedule', 'ArrayExpansion', 'TreasuryAllocation'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink-800 ring-1 ring-white/10 text-sm hover:bg-ink-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title || !description}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sun-500 to-ember-500 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-ink-950 px-4 py-2.5 text-sm font-semibold shadow-glow transition"
          >
            {submitting ? 'Submitting…' : 'Submit proposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/5">
        <Icon className="w-4 h-4 text-sun-400" />
      </div>
      <div>
        <div className="text-xs text-ink-400">{label}</div>
        <div className="font-semibold tracking-tight">{value}</div>
      </div>
    </div>
  );
}
