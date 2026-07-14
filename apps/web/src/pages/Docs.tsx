import { Link } from 'react-router-dom';
import { BookOpen, Code, Layers, ArrowRight, ExternalLink } from 'lucide-react';

const sections = [
  {
    title: 'Getting started',
    description: 'Set up your wallet, fund your account, and begin exploring solar arrays.',
    links: [
      { label: 'Connect a wallet', to: '/docs#wallet' },
      { label: 'Buy your first shares', to: '/docs#first-shares' },
      { label: 'Understanding yield', to: '/docs#yield' },
    ],
  },
  {
    title: 'Protocol Reference',
    description: 'Technical deep-dives into each SolShare smart contract and their interactions.',
    links: [
      { label: 'rwa-token (SEP-41)', to: '/docs#rwa-token' },
      { label: 'solar-registry', to: '/docs#solar-registry' },
      { label: 'yield-distributor', to: '/docs#yield-distributor' },
      { label: 'bridge-wrapper', to: '/docs#bridge-wrapper' },
    ],
  },
  {
    title: 'Bridge Guide',
    description: 'How to wrap and unwrap tokens between external chains and Stellar.',
    links: [
      { label: 'Supported chains', to: '/docs#chains' },
      { label: 'Wrapping tutorial', to: '/docs#wrap' },
      { label: 'Validator model', to: '/docs#validators' },
    ],
  },
  {
    title: 'Governance',
    description: 'Participate in protocol upgrades and parameter changes.',
    links: [
      { label: 'Create a proposal', to: '/docs#create-proposal' },
      { label: 'Voting mechanics', to: '/docs#voting' },
      { label: 'Execution & timelock', to: '/docs#execution' },
    ],
  },
  {
    title: 'API Reference',
    description: 'Programmatic access to the SolShare API for builders and integrators.',
    links: [
      { label: 'REST endpoints', to: '/docs#rest' },
      { label: 'SSE streaming', to: '/docs#sse' },
      { label: 'SDK usage', to: '/docs#sdk' },
    ],
  },
  {
    title: 'Security',
    description: 'How SolShare protects your assets and ensures protocol integrity.',
    links: [
      { label: 'Self-custody model', to: '/docs#custody' },
      { label: 'Contract audits', to: '/docs#audits' },
      { label: 'Bug bounty', to: '/docs#bounty' },
    ],
  },
];

export default function Docs() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-sun-400" />
          Documentation
        </h1>
        <p className="text-ink-300 text-sm mt-1">
          Learn how to invest in solar energy, bridge assets from other chains,
          participate in governance, and build on SolShare.
        </p>
      </div>

      {/* Quick start card */}
      <div className="card p-6 bg-gradient-to-r from-sun-500/10 to-ember-500/5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="pill mb-3 ring-1 ring-white/10 bg-white/5 text-sun-400">
              <Code className="w-3 h-3" /> Quick start
            </div>
            <p className="text-sm text-ink-300 leading-relaxed max-w-xl">
              SolShare is a Soroban-powered RWA engine. To begin, install{' '}
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noreferrer"
                className="text-sun-400 hover:underline"
              >
                Freighter wallet
              </a>
              , connect on the Dashboard, and browse active solar arrays to find
              your first investment.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sun-500 to-ember-500 hover:brightness-110 text-ink-950 px-4 py-2.5 text-sm font-semibold shadow-glow transition shrink-0"
          >
            Launch dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Documentation sections */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <div key={s.title} className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sun-400" />
              <h2 className="font-semibold tracking-tight">{s.title}</h2>
            </div>
            <p className="text-xs text-ink-300">{s.description}</p>
            <div className="space-y-1 pt-1">
              {s.links.map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className="block text-xs text-ink-400 hover:text-sun-400 transition-colors py-1"
                >
                  → {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Open-source under Apache-2.0</h3>
          <p className="text-xs text-ink-300 mt-1">
            Explore the codebase, report issues, or contribute on GitHub.
          </p>
        </div>
        <a
          href="https://github.com/solshare-network/solshare-network"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-ink-800 ring-1 ring-white/10 hover:bg-ink-700 px-4 py-2.5 text-sm font-medium transition"
        >
          <Code className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
