import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

interface ManualChapter {
  id: string
  number: string
  title: string
  summary: string
  content: React.ReactNode
}

export default function ManualPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('platform-overview')

  const chapters: ManualChapter[] = useMemo(
    () => [
      {
        id: 'platform-overview',
        number: '01',
        title: 'Platform Overview & Philosophy',
        summary: 'Understanding Cyber Risk Intelligence Quantification (CRIQ) and how telemetry becomes financial value.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">What is CRIQ?</div>
              <p className="manual-card-desc">
                CRIQ (Cyber Risk Intelligence Quantification) is an enterprise-grade financial cyber risk modeling
                system. It bridges the communication chasm between technical cybersecurity operations (vulnerabilities,
                CVEs, telemetry, network hops) and executive capital governance (balance-sheet liabilities, Value at
                Risk, capital allocation, and statutory penalties).
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">The Fundamental Problem It Solves</div>
              <p className="manual-card-desc">
                Traditional cybersecurity relies on subjective heat maps (Red/Yellow/Green) and arbitrary qualitative
                scores (Low, Medium, High). These fail the Board of Directors because risk cannot be added, subtracted,
                or traded off in colors. CRIQ solves this by translating cyber risk into the universal language of business:
                <strong> currency (₹ INR)</strong> and <strong>exceedance probabilities</strong>.
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Continuous Quantification vs Periodic Audits</div>
              <p className="manual-card-desc">
                Traditional risk assessments take 3–6 months and are obsolete the moment they are printed. CRIQ connects
                directly to active asset telemetry, CISA Known Exploited Vulnerabilities (KEV), and EPSS exploit prediction
                feeds to re-quantify expected annual financial exposure continuously.
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Target Stakeholders</div>
              <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                <li><strong>Chief Information Security Officers (CISOs):</strong> Defend cybersecurity budgets with empirical ROI / ROSI metrics.</li>
                <li><strong>Chief Financial Officers (CFOs) & Treasurers:</strong> Size cyber insurance policy limits and calibrate capital reserves for tail events.</li>
                <li><strong>Board Risk Committees:</strong> Maintain fiduciary oversight under statutory frameworks (RBI CSF, SEBI CSCRF, DPDPA 2023).</li>
                <li><strong>Security Architects:</strong> Mathematically identify which controls reduce the maximum risk per rupee spent.</li>
              </ul>
            </div>
          </>
        ),
      },
      {
        id: 'command-center',
        number: '02',
        title: 'Command Center & Overview Metrics',
        summary: 'Detailed operational breakdown of every metric rendered on the executive dashboard.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Expected Annual Loss (EAL)</div>
              <p className="manual-card-desc">
                The statistical expected financial loss over a 12-month period across the entire enterprise portfolio.
                It accounts for expected incident frequency multiplied by compound primary and secondary loss severity.
                EAL is the bedrock metric against which security budgets are evaluated.
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">P95 & P99 Value at Risk (VaR)</div>
              <p className="manual-card-desc">
                Value at Risk measures the extreme tail of catastrophic financial exposure. P95 represents a 1-in-20 year
                severe event; P99 models a 1-in-100 year systemic black-swan catastrophe. These numbers indicate how much
                capital the organization could lose in an acute breach crisis.
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Regulatory Fine Exposure</div>
              <p className="manual-card-desc">
                Potential financial penalties under Reserve Bank of India (RBI) Cyber Resilience Directions, SEBI CSCRF,
                and the Digital Personal Data Protection (DPDP) Act 2023. Calculated based on sensitive record counts
                (PII & financial records), unpatched critical CVE duration, and formal compliance gap scores.
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Monitored Assets & Critical Infrastructure</div>
              <p className="manual-card-desc">
                The count of systems actively ingested into the quantification engine. Assets categorized as Critical Tier
                carry significant revenue-per-minute or sensitive customer data, making them the primary risk drivers.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to="/" className="btn btn-secondary btn-sm">Explore Overview Dashboard →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'exposure',
        number: '03',
        title: 'Exposure & Loss Distribution',
        summary: 'How to interpret the Loss Exceedance Curve (LEC) and Monte Carlo empirical outcome distributions.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Interpreting the Loss Exceedance Curve (LEC)</div>
              <p className="manual-card-desc">
                The LEC answers the executive question: <em>"What is the probability that cyber losses will exceed ₹X Cr this year?"</em>
                The vertical Y-axis indicates exceedance probability (0% to 100%); the horizontal X-axis indicates loss magnitude.
                As loss magnitude increases, the probability asymptotically decays, forming a long, heavy tail.
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Return Period Calibration</div>
              <p className="manual-card-desc">
                Exceedance probability directly maps to return periods:
                <br />
                • <strong>5% Exceedance:</strong> 1-in-20 Year Event (P95 VaR threshold)
                <br />
                • <strong>1% Exceedance:</strong> 1-in-100 Year Event (P99 VaR threshold)
                <br />
                • <strong>0.2% Exceedance:</strong> 1-in-500 Year Black Swan Event
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Monte Carlo Uncertainty Modeling</div>
              <p className="manual-card-desc">
                CRIQ runs 10,000 stochastic iterations per simulation cycle. Rather than generating a single deceptive
                prediction, the engine samples thousands of synthetic futures. This communicates realistic variance,
                fat-tailed kurtosis, and catastrophic scenario probabilities.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to="/exposure" className="btn btn-secondary btn-sm">Open Exposure Analytics →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'assets',
        number: '04',
        title: 'Asset Intelligence & Vulnerability Telemetry',
        summary: 'Asset classification, business unit mappings, CVE exploitability, and network perimeter hops.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Asset Criticality Tiers</div>
              <p className="manual-card-desc">
                Assets are stratified into three enterprise tiers:
                <br />
                • <strong>Critical:</strong> Transaction gateways, core banking switches, primary customer databases. Failure causes immediate revenue loss and severe regulatory sanctions.
                <br />
                • <strong>Medium:</strong> Internal ERPs, staff intranets, CRM systems. Moderate operational disruption.
                <br />
                • <strong>Low:</strong> Perimeter POS endpoints, branch Wi-Fi controllers, satellite services.
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">CISA KEV & EPSS Scoring</div>
              <p className="manual-card-desc">
                CRIQ prioritizes vulnerabilities based on real-world threat intelligence. A CVSS 9.8 vulnerability without
                known exploits is less urgent than a CVSS 8.2 vulnerability present on the <strong>CISA Known Exploited
                Vulnerabilities (KEV)</strong> catalog with a high <strong>EPSS (Exploit Prediction Scoring System)</strong> score.
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Network Distance (Hops from Internet)</div>
              <p className="manual-card-desc">
                Hops from the public internet (1 to 6) represent defense-in-depth isolation. While an internet-facing gateway
                (hops 2) has higher event frequency, deep database systems (hops 4–5) carry immense severity if breached.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to="/assets" className="btn btn-secondary btn-sm">Explore Asset Intelligence →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'investment',
        number: '05',
        title: 'Investment Lab & MILP Knapsack Optimizer',
        summary: 'Mathematical capital optimization, Return on Security Investment (ROSI), and diminishing returns.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">The Optimization Problem</div>
              <p className="manual-card-desc">
                Security leaders face dozens of competing vendor tools with limited budgets. Guessing which controls to buy
                leads to wasted capital. CRIQ uses <strong>Mixed-Integer Linear Programming (MILP)</strong> to solve the
                classic 0/1 Knapsack Problem: maximize aggregate risk reduction subject to a strict financial ceiling.
              </p>
              <div className="help-formula-box" style={{ marginTop: 10 }}>
                <code>max Σ (x_i · ΔEAL_i)   subject to   Σ (x_i · Cost_i) ≤ Budget,  x_i ∈ {'{0, 1}'}</code>
              </div>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Return on Security Investment (ROSI)</div>
              <p className="manual-card-desc">
                ROSI measures capital productivity. A ROSI of 2.5× means that for every ₹1.00 spent on security controls,
                the organization achieves ₹3.50 in expected loss mitigation (₹2.50 net risk savings).
              </p>
              <div className="help-formula-box" style={{ marginTop: 10 }}>
                <code>ROSI = (Net Risk Reduction - Capital Cost) / Capital Cost</code>
              </div>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Diminishing Marginal Returns (Efficiency Frontier)</div>
              <p className="manual-card-desc">
                Security investment follows an S-curve. The first ₹1.0 Cr mitigates the vast majority of high-impact risk
                (MFA, critical patching, database encryption). Beyond ₹3.0 Cr, additional spending yields diminishing
                marginal risk reduction. The Investment Lab visualizes this frontier so CFOs know exactly when to stop spending.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to="/investment" className="btn btn-secondary btn-sm">Launch Investment Lab →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'scenarios',
        number: '06',
        title: 'Scenario Studio & Stress Testing',
        summary: 'Simulating adversary campaigns, threat intelligence shifts, and defensive hypotheses.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Adversary Hypothesis Testing</div>
              <p className="manual-card-desc">
                Scenario Studio allows risk analysts to test "what-if" propositions:
                <br />
                • <em>"What if ransomware gangs target our core switch cluster with double-extortion payloads?"</em>
                <br />
                • <em>"What if we achieve 100% hardware MFA rollout across all administrator endpoints?"</em>
                <br />
                • <em>"What happens if our payment SDK provider is compromised in a third-party supply chain attack?"</em>
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Comparative Risk Synthesis</div>
              <p className="manual-card-desc">
                Each scenario dynamically calculates the delta against current baseline EAL, showing net loss delta,
                percentage variance, and the capital expenditure required to implement the defensive intervention.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to="/scenarios" className="btn btn-secondary btn-sm">Open Scenario Studio →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'decisions',
        number: '07',
        title: 'Decision Center & Board Recommendations',
        summary: 'Synthesized executive action items ranked by ROI, urgency, and regulatory imperative.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Evidence-Based Action Prioritization</div>
              <p className="manual-card-desc">
                The Decision Center translates analytical simulations into executive action items. Each recommended
                action item specifies its priority rank, projected financial risk reduction, required budget, and
                regulatory justification.
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Top Decision Archetypes</div>
              <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                <li><strong>Immediate Remediation:</strong> Patch unpatched CISA KEV CVEs on revenue-critical gateways.</li>
                <li><strong>Capital Optimization:</strong> Allocate annual security budget according to the MILP knapsack recommendation.</li>
                <li><strong>Regulatory Insulation:</strong> Close high-penalty compliance gaps to eliminate statutory fine liabilities.</li>
              </ul>
              <div style={{ marginTop: 12 }}>
                <Link to="/decisions" className="btn btn-secondary btn-sm">View Decision Center →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'compliance',
        number: '08',
        title: 'Regulatory Compliance & Statutory Frameworks',
        summary: 'Mapping technical controls to RBI CSF, SEBI CSCRF, and NIST CSF 2.0 standards.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Mandatory Regulatory Standards</div>
              <p className="manual-card-desc">
                CRIQ maintains compliance crosswalks against three major financial cybersecurity frameworks:
                <br />
                • <strong>RBI Cyber Security Framework:</strong> Mandatory operational resilience directives for scheduled commercial banks and digital payment operators.
                <br />
                • <strong>SEBI CSCRF:</strong> Cybersecurity and Cyber Resilience Framework governing capital market participants and trading exchanges.
                <br />
                • <strong>NIST CSF 2.0:</strong> Global best-practice baseline spanning Identify, Protect, Detect, Respond, and Recover functions.
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Closing Compliance Gaps to Reduce Financial Exposure</div>
              <p className="manual-card-desc">
                Compliance gaps are not merely audit checkmarks; each gap amplifies regulatory fine exposure in the
                event of an incident. Closing specific control gaps immediately lowers modeled balance-sheet penalties.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to="/compliance" className="btn btn-secondary btn-sm">Open Compliance Center →</Link>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'ai-agent',
        number: '09',
        title: 'AI Cyber Risk Agent Architecture',
        summary: 'Explicit boundary between deterministic mathematical calculations and AI intelligence assistance.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20, borderLeft: '3px solid var(--accent)' }}>
              <div className="manual-card-title">Crucial Distinction: Deterministic Math vs AI Assistance</div>
              <p className="manual-card-desc">
                CRIQ maintains an uncompromising architectural separation between quantitative risk computation and AI
                agent assistance. <strong>The AI does NOT calculate financial risk numbers out of thin air.</strong>
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Deterministic Engine Functions</div>
              <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                <li><strong>Risk Engine:</strong> Computes annual event frequencies and loss distributions via calibrated Poisson and Log-Normal algorithms.</li>
                <li><strong>Monte Carlo Simulator:</strong> Generates 10,000 independent trials to calculate EAL, P95, and P99 percentiles empirically.</li>
                <li><strong>MILP Solver:</strong> Formulates and solves the mathematical integer knapsack problem for control selection.</li>
                <li><strong>Compliance Mapper:</strong> Checks boolean control coverage against statutory regulation rulebooks.</li>
              </ul>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">AI Agent Role & Intelligence Presence</div>
              <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                <li><strong>Contextual Synthesis:</strong> Summarizes complex multi-dimensional risk states for C-suite briefings.</li>
                <li><strong>Anomaly Interpretation:</strong> Explains why a specific node or gateway drives disproportionate loss contribution.</li>
                <li><strong>Interactive Spatial Presence:</strong> The 3D AI Cyber Risk Face reflects enterprise posture in real-time, shifting between Analyzing, Stable, High-Risk, and Optimized states.</li>
              </ul>
            </div>
          </>
        ),
      },
      {
        id: 'methodology',
        number: '10',
        title: 'Mathematical Methodology & Formulas',
        summary: 'Exhaustive reference of every quantitative formula implemented in the platform.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">1. Loss Event Frequency (LEF)</div>
              <p className="manual-card-desc">
                The expected number of successful security compromise events per asset per year, modeled as a Poisson process.
                Influenced by unpatched vulnerability count, CVSS exploitability, EPSS scores, CISA KEV presence, and network hops.
              </p>
              <div className="help-formula-box" style={{ marginTop: 10 }}>
                <code>LEF_i = λ_i = BaseRate · (1 + 0.35 · KEV_count + 0.15 · Vuln_count) · (0.85 ^ (Hops - 2))</code>
              </div>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">2. Loss Magnitude (LM)</div>
              <p className="manual-card-desc">
                The financial severity of a single compromise event, modeled as a compound lognormal variable encompassing:
                <br />
                • Primary Loss: Revenue per minute × Expected downtime duration
                <br />
                • Data Loss: Sensitive records (PII / Financial) × Cost per record liability
                <br />
                • Incident Response: Forensic investigation, containment, customer notification, and legal defense
              </p>
              <div className="help-formula-box" style={{ marginTop: 10 }}>
                <code>LM_i = (RevPerMin_i · DowntimeMins) + (Records_i · CostPerRecord) + IncidentResponseCost</code>
              </div>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">3. Expected Annual Loss (EAL)</div>
              <p className="manual-card-desc">
                Mathematical expectation of enterprise financial loss over one year across all N active assets:
              </p>
              <div className="help-formula-box" style={{ marginTop: 10 }}>
                <code>EAL_total = Σ (LEF_i · LM_i) = (1 / M) · Σ (Loss_m)   for m = 1 to M=10,000 iterations</code>
              </div>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">4. Value at Risk (VaR)</div>
              <p className="manual-card-desc">
                Quantile of the empirical simulated loss distribution:
              </p>
              <div className="help-formula-box" style={{ marginTop: 10 }}>
                <code>VaR_α = inf {'{ L ∈ ℝ : P(AnnualLoss ≤ L) ≥ α }'}   (α = 0.95, α = 0.99)</code>
              </div>
            </div>
          </>
        ),
      },
      {
        id: 'data-assumptions',
        number: '11',
        title: 'Data Sources & Modeling Assumptions',
        summary: 'Data lineage, synthetic seed parameters, and configurable environmental assumptions.',
        content: (
          <>
            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Data Ingestion & Lineage</div>
              <p className="manual-card-desc">
                CRIQ ingests asset configurations from enterprise CMDBs, vulnerability scanners (Qualys, Tenable), and
                threat intelligence feeds (CISA KEV, FIRST EPSS).
              </p>
            </div>

            <div className="manual-card" style={{ marginBottom: 20 }}>
              <div className="manual-card-title">Demonstration Telemetry Notice</div>
              <p className="manual-card-desc">
                In this deployment, asset records (18 production systems), vulnerabilities (37 CVEs), and controls represent
                a calibrated synthetic banking enterprise (Retail Banking, UPI Digital Payments, Capital Markets).
                Financial values are calibrated to reflect realistic Indian corporate figures in Crores (₹ Cr).
              </p>
            </div>

            <div className="manual-card">
              <div className="manual-card-title">Configurability</div>
              <p className="manual-card-desc">
                Cost-per-record liabilities, hourly downtime revenue rates, and regulatory penalty coefficients are fully
                configurable through enterprise parameters to match specific corporate financial assumptions.
              </p>
            </div>
          </>
        ),
      },
      {
        id: 'glossary',
        number: '12',
        title: 'Comprehensive Cyber Risk Glossary',
        summary: 'A-to-Z dictionary of all financial, statistical, and cybersecurity terminology used in CRIQ.',
        content: (
          <div className="glossary-grid">
            {[
              { term: 'EAL', def: 'Expected Annual Loss — the statistical average financial loss expected over a 12-month period across all simulated incidents.' },
              { term: 'VaR', def: 'Value at Risk — maximum expected loss at a specified statistical confidence level (e.g., P95, P99) over a defined timeframe.' },
              { term: 'P95 VaR', def: 'The 95th percentile loss outcome representing a 1-in-20 year severe security incident threshold.' },
              { term: 'P99 VaR', def: 'The 99th percentile loss outcome modeling an extreme 1-in-100 year systemic black-swan catastrophe.' },
              { term: 'LEF', def: 'Loss Event Frequency — the expected number of successful security breach events per asset per year.' },
              { term: 'LM', def: 'Loss Magnitude — the total primary and secondary financial damage of a single security compromise.' },
              { term: 'ROSI', def: 'Return on Security Investment — financial metric measuring the ratio of net risk reduction to capital cost.' },
              { term: 'MILP', def: 'Mixed-Integer Linear Programming — mathematical optimization method used to solve the knapsack control selection problem.' },
              { term: 'Monte Carlo', def: 'Stochastic computational algorithm that relies on repeated random sampling (10,000 iterations) to model probability distributions.' },
              { term: 'CISA KEV', def: 'Known Exploited Vulnerabilities catalog maintained by CISA, indicating CVEs actively weaponized in the wild.' },
              { term: 'EPSS', def: 'Exploit Prediction Scoring System — probability score estimating likelihood that a software vulnerability will be exploited in 30 days.' },
              { term: 'CVSS', def: 'Common Vulnerability Scoring System — standardized metric reflecting the technical severity of software vulnerabilities (0 to 10).' },
              { term: 'RBI CSF', def: 'Reserve Bank of India Cyber Security Framework for banks and digital payment entities.' },
              { term: 'SEBI CSCRF', def: 'Securities and Exchange Board of India Cybersecurity and Cyber Resilience Framework for capital markets.' },
              { term: 'NIST CSF 2.0', def: 'National Institute of Standards and Technology Cybersecurity Framework version 2.0.' },
              { term: 'DPDPA 2023', def: 'Digital Personal Data Protection Act 2023 governing data privacy compliance and statutory penalties in India.' },
              { term: 'MFA', def: 'Multi-Factor Authentication — authentication mechanism requiring two or more independent credentials.' },
              { term: 'EDR / MDR', def: 'Endpoint Detection & Response / Managed Detection & Response providing continuous host telemetry and active containment.' },
              { term: 'IAM / PAM', def: 'Identity & Access Management / Privileged Access Management controlling high-privilege administrative access.' },
              { term: 'Risk Appetite', def: 'The maximum financial loss an enterprise board is prepared to tolerate before executing catastrophic capital reserves.' },
            ].map((item) => (
              <div key={item.term} className="glossary-card">
                <div className="glossary-term">{item.term}</div>
                <div className="glossary-def">{item.def}</div>
              </div>
            ))}
          </div>
        ),
      },
    ],
    []
  )

  // Search filter
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters
    const q = searchQuery.toLowerCase()
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    )
  }, [chapters, searchQuery])

  return (
    <div className="page-container--wide">
      <div className="manual-container">
        {/* Left: Sticky Sidebar Navigation & Search */}
        <aside className="manual-sidebar">
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
              Documentation & Manual
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>
              Platform Guide
            </h2>
            <input
              type="text"
              placeholder="Search the manual (e.g. EAL, P95)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="manual-search-input"
              aria-label="Search manual documentation"
            />
          </div>

          <nav className="manual-nav-list" aria-label="Manual table of contents">
            {filteredChapters.map((ch) => (
              <a
                key={ch.id}
                href={`#${ch.id}`}
                onClick={() => setActiveSection(ch.id)}
                className={`manual-nav-item ${activeSection === ch.id ? 'active' : ''}`}
              >
                <span className="manual-nav-index">{ch.number}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.title.split('&')[0]}
                </span>
              </a>
            ))}
          </nav>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              CRIQ Architecture Manual
              <br />
              Version 2.4 · Enterprise Edition
            </div>
          </div>
        </aside>

        {/* Right: Rich Editorial Content Chapters */}
        <main className="manual-content">
          <div style={{ marginBottom: -20 }}>
            <div className="section-number" style={{ marginBottom: 12 }}>SYSTEM MANUAL</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
              Comprehensive Platform Guide
            </h1>
            <p className="body-md" style={{ maxWidth: 640 }}>
              Complete reference manual explaining quantitative formulas, analytical instruments, data lineage,
              the interactive 3D AI agent, and strategic optimization workflows.
            </p>
          </div>

          {filteredChapters.map((ch) => (
            <section key={ch.id} id={ch.id} className="manual-chapter">
              <div>
                <span className="manual-chapter-number">CHAPTER {ch.number}</span>
                <h2 className="manual-chapter-title">{ch.title}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 }}>
                  {ch.summary}
                </p>
              </div>

              <div>{ch.content}</div>
            </section>
          ))}

          {filteredChapters.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14 }}>No documentation matches "{searchQuery}"</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchQuery('')}
                style={{ marginTop: 12 }}
              >
                Clear Search
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
