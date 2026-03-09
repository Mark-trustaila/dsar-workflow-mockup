import { useState, useRef, useEffect } from "react";

// ─── Mock data ───────────────────────────────────────────────────────────────

const SOURCE_TEXTS = {
  personal: `Dear Data Protection Team,

I am writing to formally request access to all personal data that your organisation holds about me, in accordance with Article 15 of the UK General Data Protection Regulation (UK GDPR).

My full name is John Smith, and my email address is john.smith@example.com. My date of birth is 22 July 1990. Please treat this as a formal Subject Access Request.

I would like to receive copies of all data you hold, the purposes for which it is processed, and details of any third parties with whom it has been shared.

Please acknowledge receipt of this request within the statutory timeframe.

Yours sincerely,
John Smith`,

  email_archive: `From: Data Protection Team <dpo@company.com>
To: John Smith <john.smith@example.com>
Date: 2 March 2026
Subject: Re: Subject Access Request – DSAR-2026-0304

Dear John Smith,

Thank you for your Subject Access Request received on 2 March 2026. We are writing to acknowledge receipt of your request reference DSAR-2026-0304.

We are required to respond within one calendar month of receipt. Your response will therefore be due by 2 April 2026.

If we require any clarification or need to verify your identity, we will contact you within the next few days. Please note that the time limit does not begin until we have verified your identity.

Should you have any questions in the meantime, please do not hesitate to contact us.

In the event that you are not satisfied with our response, you have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk, or to seek a judicial remedy.

Yours sincerely,
Data Protection Team
[Company Name]`,
};

const ENTITIES = [
  { ref: 1,  text: "John Smith",                    category: "Person",       subcategory: null,   confidence: 1.00, offset: 23,   length: 10, source: "personal",      severity: "HIGH",   autoDecision: "CONFIRM", note: "Clear case — automatically redacted" },
  { ref: 2,  text: "john.smith@example.com",         category: "Email",        subcategory: null,   confidence: 0.80, offset: 59,   length: 22, source: "personal",      severity: "MEDIUM", autoDecision: null,      note: "Edge case — review recommended" },
  { ref: 3,  text: "22 July 1990",                   category: "DateTime",     subcategory: "Date", confidence: 0.99, offset: 115,  length: 12, source: "personal",      severity: "HIGH",   autoDecision: "CONFIRM", note: "Clear case — automatically redacted" },
  { ref: 4,  text: "Data Protection Team",           category: "Organization", subcategory: null,   confidence: 0.98, offset: 5,    length: 20, source: "email_archive", severity: "LOW",    autoDecision: null,      note: "Internal team name — review recommended" },
  { ref: 5,  text: "John Smith",                     category: "Person",       subcategory: null,   confidence: 1.00, offset: 293,  length: 10, source: "email_archive", severity: "HIGH",   autoDecision: "CONFIRM", note: "Clear case — automatically redacted" },
  { ref: 6,  text: "John",                           category: "Person",       subcategory: null,   confidence: 1.00, offset: 309,  length: 4,  source: "email_archive", severity: "HIGH",   autoDecision: "CONFIRM", note: "Clear case — automatically redacted" },
  { ref: 7,  text: "2 March 2026",                   category: "DateTime",     subcategory: "Date", confidence: 1.00, offset: 677,  length: 12, source: "email_archive", severity: "LOW",    autoDecision: null,      note: "Correspondence date — may be disclosable" },
  { ref: 8,  text: "2026-0304",                      category: "PhoneNumber",  subcategory: null,   confidence: 0.80, offset: 718,  length: 9,  source: "email_archive", severity: "MEDIUM", autoDecision: null,      note: "Likely a reference number — review recommended" },
  { ref: 9,  text: "2 April 2026",                   category: "DateTime",     subcategory: "Date", confidence: 0.99, offset: 755,  length: 12, source: "email_archive", severity: "LOW",    autoDecision: null,      note: "Response deadline — may be disclosable" },
  { ref: 10, text: "Information Commissioner's Office", category: "Organization", subcategory: null, confidence: 1.00, offset: 1364, length: 33, source: "email_archive", severity: "LOW",   autoDecision: "RESTORE", note: "Public body — likely disclosable" },
  { ref: 11, text: "ICO",                            category: "Organization", subcategory: null,   confidence: 0.94, offset: 1399, length: 3,  source: "email_archive", severity: "LOW",    autoDecision: "RESTORE", note: "Public body acronym — likely disclosable" },
  { ref: 12, text: "Data Protection Team",           category: "Organization", subcategory: null,   confidence: 1.00, offset: 1471, length: 20, source: "email_archive", severity: "LOW",    autoDecision: null,      note: "Internal team name — review recommended" },
];

const DECISIONS = [
  { key: "CONFIRM",  label: "Redact",    color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", desc: "Remove from response" },
  { key: "RESTORE",  label: "Include",   color: "#16a34a", bg: "#dcfce7", border: "#86efac", desc: "Keep in response" },
  { key: "PARTIAL",  label: "Partial",   color: "#d97706", bg: "#fef3c7", border: "#fcd34d", desc: "Partial redaction" },
  { key: "WITHHOLD", label: "Withhold",  color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd", desc: "Withhold entirely" },
];

const SEVERITY_STYLE = {
  HIGH:   { bg: "#fee2e2", color: "#dc2626" },
  MEDIUM: { bg: "#fef3c7", color: "#d97706" },
  LOW:    { bg: "#f1f5f9", color: "#64748b" },
};

const CATEGORY_ICON = {
  Person: "👤", Email: "✉️", DateTime: "📅", Organization: "🏢",
  PhoneNumber: "📞", Address: "📍",
};

// ─── Document renderer ────────────────────────────────────────────────────────

function RenderedDocument({ text, entities, decisions, selectedRef, onSelect }) {
  const sorted = [...entities].sort((a, b) => a.offset - b.offset);
  const parts = [];
  let cursor = 0;

  sorted.forEach((entity) => {
    const { offset, length, ref } = entity;
    if (offset > cursor) {
      parts.push(<span key={`t${cursor}`}>{text.slice(cursor, offset)}</span>);
    }

    const decision = decisions[ref];
    const isSelected = selectedRef === ref;

    let style = {
      cursor: "pointer",
      borderRadius: "3px",
      padding: "1px 2px",
      transition: "all 0.15s ease",
      display: "inline",
    };

    if (decision === "CONFIRM") {
      style = {
        ...style,
        background: isSelected ? "#dc2626" : "#1e293b",
        color: "transparent",
        borderRadius: "2px",
        userSelect: "none",
        letterSpacing: "-0.5em",
        outline: isSelected ? "2px solid #dc2626" : "none",
        outlineOffset: "1px",
      };
    } else if (decision === "RESTORE") {
      style = { ...style, background: isSelected ? "#bbf7d0" : "#dcfce7", color: "#15803d", outline: isSelected ? "2px solid #16a34a" : "none", outlineOffset: "1px" };
    } else if (decision === "PARTIAL") {
      style = { ...style, background: isSelected ? "#fde68a" : "#fef9c3", color: "#92400e", outline: isSelected ? "2px solid #d97706" : "none", outlineOffset: "1px" };
    } else if (decision === "WITHHOLD") {
      style = { ...style, background: isSelected ? "#ddd6fe" : "#ede9fe", color: "#5b21b6", outline: isSelected ? "2px solid #7c3aed" : "none", outlineOffset: "1px" };
    } else {
      // No decision yet — pending
      style = { ...style, background: isSelected ? "#fef08a" : "#fefce8", color: "#713f12", outline: "1.5px dashed #ca8a04", outlineOffset: "1px" };
    }

    const displayText = decision === "CONFIRM"
      ? "\u00a0".repeat(Math.max(3, Math.floor(length * 0.8)))
      : text.slice(offset, offset + length);

    parts.push(
      <span key={`e${ref}`} style={style} onClick={() => onSelect(ref)} title={`R${String(ref).padStart(3,"0")} · ${entity.category} · ${decision || "Pending"}`}>
        {displayText}
      </span>
    );

    cursor = offset + length;
  });

  if (cursor < text.length) {
    parts.push(<span key="tend">{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: "Redacted",  bg: "#1e293b", color: "transparent", border: "none" },
    { label: "Included",  bg: "#dcfce7", color: "#15803d",     border: "none" },
    { label: "Partial",   bg: "#fef9c3", color: "#92400e",     border: "none" },
    { label: "Withheld",  bg: "#ede9fe", color: "#5b21b6",     border: "none" },
    { label: "Pending",   bg: "#fefce8", color: "#713f12",     border: "1.5px dashed #ca8a04" },
  ];
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {items.map(item => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{
            display: "inline-block", width: "32px", height: "14px",
            background: item.bg, border: item.border, borderRadius: "2px",
          }} />
          <span style={{ fontSize: "11px", color: "#64748b" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Decision card ────────────────────────────────────────────────────────────

function DecisionCard({ entity, decision, onDecide, isSelected, cardRef }) {
  const sevStyle = SEVERITY_STYLE[entity.severity] || SEVERITY_STYLE.LOW;
  const isEdge = !entity.autoDecision;

  return (
    <div
      ref={cardRef}
      onClick={() => {}}
      style={{
        border: isSelected ? "1.5px solid #2383e2" : isEdge ? "1.5px solid #fcd34d" : "1px solid #e2e8f0",
        borderRadius: "8px",
        background: isSelected ? "#f8faff" : "#fff",
        overflow: "hidden",
        transition: "all 0.15s ease",
        boxShadow: isSelected ? "0 0 0 3px rgba(35,131,226,0.1)" : "none",
      }}
    >
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "8px 14px",
        background: isSelected ? "#eff6ff" : "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", fontWeight: "700", color: "#64748b" }}>
          R{String(entity.ref).padStart(3, "0")}
        </span>
        <span style={{
          fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px",
          letterSpacing: "0.04em", textTransform: "uppercase",
          background: sevStyle.bg, color: sevStyle.color,
        }}>
          {entity.severity}
        </span>
        <span style={{ fontSize: "12px", color: "#64748b" }}>
          {CATEGORY_ICON[entity.category] || "•"} {entity.category}
          {entity.subcategory ? ` · ${entity.subcategory}` : ""}
        </span>
        {isEdge && (
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "#d97706", fontWeight: "600" }}>
            ⚠ Review needed
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "10px 14px 8px" }}>
        <div style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", marginBottom: "3px" }}>
          {entity.text}
        </div>
        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
          Confidence: {(entity.confidence * 100).toFixed(0)}% · Source: {entity.source.replace("_", " ")}
        </div>
        {entity.note && (
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "5px", fontStyle: "italic" }}>
            {isEdge ? "⚠" : "✓"} {entity.note}
          </div>
        )}
      </div>

      {/* Decision buttons */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 14px", borderTop: "1px solid #f1f5f9",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "11px", color: "#94a3b8", marginRight: "4px" }}>Decision:</span>
        {DECISIONS.map(d => {
          const isActive = decision === d.key;
          return (
            <button
              key={d.key}
              onClick={() => onDecide(entity.ref, d.key)}
              title={d.desc}
              style={{
                fontSize: "11px", fontWeight: isActive ? "600" : "500",
                padding: "3px 10px", borderRadius: "5px",
                border: isActive ? `1px solid ${d.border}` : "1px solid #e2e8f0",
                background: isActive ? d.bg : "#f8fafc",
                color: isActive ? d.color : "#475569",
                cursor: "pointer",
                transition: "all 0.12s ease",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DSARRedactionReview() {
  const initialDecisions = {};
  ENTITIES.forEach(e => {
    initialDecisions[e.ref] = e.autoDecision || null;
  });

  const [decisions, setDecisions] = useState(initialDecisions);
  const [selectedRef, setSelectedRef] = useState(null);
  const [activeSource, setActiveSource] = useState("personal");
  const [saved, setSaved] = useState(false);

  const cardRefs = useRef({});

  const sourceEntities = ENTITIES.filter(e => e.source === activeSource);
  const reviewed = Object.values(decisions).filter(Boolean).length;
  const total = ENTITIES.length;
  const allDone = reviewed === total;
  const progress = Math.round((reviewed / total) * 100);

  const pendingCount = ENTITIES.filter(e => !decisions[e.ref]).length;
  const edgeCases = ENTITIES.filter(e => !e.autoDecision);

  const handleSelectEntity = (ref) => {
    const entity = ENTITIES.find(e => e.ref === ref);
    if (!entity) return;
    if (entity.source !== activeSource) setActiveSource(entity.source);
    setSelectedRef(ref);
  };

  useEffect(() => {
    if (selectedRef && cardRefs.current[selectedRef]) {
      cardRefs.current[selectedRef].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedRef]);

  const setDecision = (ref, decision) => {
    setDecisions(prev => ({ ...prev, [ref]: decision }));
    // Auto-advance to next unreviewed
    const currentIdx = ENTITIES.findIndex(e => e.ref === ref);
    const next = ENTITIES.slice(currentIdx + 1).find(e => !decisions[e.ref] || e.ref === ref);
    if (next && next.ref !== ref) {
      setTimeout(() => handleSelectEntity(next.ref), 200);
    }
  };

  const jumpToNextUnreviewed = () => {
    const next = ENTITIES.find(e => !decisions[e.ref]);
    if (next) handleSelectEntity(next.ref);
  };

  const sources = [
    { key: "personal",      label: "Original Request",  count: ENTITIES.filter(e => e.source === "personal").length },
    { key: "email_archive", label: "Email Archive",      count: ENTITIES.filter(e => e.source === "email_archive").length },
  ];

  return (
    <div style={{
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      height: "100vh", display: "flex", flexDirection: "column",
      background: "#f8fafc", color: "#0f172a",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "0 20px", height: "52px",
        display: "flex", alignItems: "center", gap: "16px", flexShrink: 0,
      }}>
        {/* Logo + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            background: "#0f172a", color: "#fff", fontSize: "11px", fontWeight: "700",
            padding: "3px 8px", borderRadius: "4px", letterSpacing: "0.05em",
            fontFamily: "'DM Mono', monospace",
          }}>AiLA</div>
          <span style={{ color: "#cbd5e1", fontSize: "13px" }}>›</span>
          <span style={{ fontSize: "13px", color: "#64748b" }}>DSARs</span>
          <span style={{ color: "#cbd5e1", fontSize: "13px" }}>›</span>
          <span style={{ fontSize: "13px", color: "#64748b", fontFamily: "'DM Mono', monospace" }}>DSAR-2026-0304</span>
          <span style={{ color: "#cbd5e1", fontSize: "13px" }}>›</span>
          <span style={{ fontSize: "13px", fontWeight: "600" }}>Redaction Review</span>
        </div>

        {/* Subject pill */}
        <div style={{
          fontSize: "12px", background: "#f1f5f9", color: "#475569",
          padding: "3px 10px", borderRadius: "20px", border: "1px solid #e2e8f0",
        }}>
          👤 John Smith · Due 2 April 2026
        </div>

        <div style={{ flex: 1 }} />

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {pendingCount > 0 && (
            <span style={{ fontSize: "12px", color: "#d97706", fontWeight: "500" }}>
              {pendingCount} pending
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "100px", height: "4px", background: "#e2e8f0", borderRadius: "2px" }}>
              <div style={{
                width: `${progress}%`, height: "100%", borderRadius: "2px",
                background: allDone ? "#16a34a" : "#2383e2",
                transition: "width 0.3s ease",
              }} />
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
              {reviewed}/{total}
            </span>
          </div>

          {!allDone && (
            <button onClick={jumpToNextUnreviewed} style={{
              fontSize: "12px", color: "#2383e2", background: "none",
              border: "1px solid #bfdbfe", borderRadius: "5px",
              padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap",
            }}>
              Next pending ↓
            </button>
          )}

          <button onClick={() => setSaved(true)} style={{
            fontSize: "13px", fontWeight: "600",
            background: allDone ? "#16a34a" : "#2383e2",
            color: "#fff", border: "none", borderRadius: "6px",
            padding: "6px 16px", cursor: "pointer",
            opacity: saved ? 0.7 : 1,
          }}>
            {saved ? "Saved ✓" : "Save decisions"}
          </button>
        </div>
      </div>

      {/* ── Main split ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — Document panel */}
        <div style={{
          flex: "0 0 57%", display: "flex", flexDirection: "column",
          borderRight: "1px solid #e2e8f0", background: "#fff",
          overflow: "hidden",
        }}>
          {/* Source tabs */}
          <div style={{
            borderBottom: "1px solid #e2e8f0", display: "flex",
            padding: "0 20px", flexShrink: 0,
            alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex" }}>
              {sources.map(s => (
                <button key={s.key} onClick={() => setActiveSource(s.key)} style={{
                  padding: "12px 14px", fontSize: "13px",
                  fontWeight: activeSource === s.key ? "600" : "400",
                  color: activeSource === s.key ? "#0f172a" : "#64748b",
                  background: "none", border: "none",
                  borderBottom: activeSource === s.key ? "2px solid #0f172a" : "2px solid transparent",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  {s.label}
                  <span style={{
                    marginLeft: "6px", fontSize: "11px",
                    background: activeSource === s.key ? "#0f172a" : "#e2e8f0",
                    color: activeSource === s.key ? "#fff" : "#64748b",
                    padding: "1px 6px", borderRadius: "10px",
                  }}>{s.count}</span>
                </button>
              ))}
            </div>
            <div style={{ paddingRight: "4px" }}>
              <Legend />
            </div>
          </div>

          {/* Document text */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "28px 32px",
          }}>
            <pre style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: "13.5px",
              lineHeight: "1.85", color: "#1e293b", whiteSpace: "pre-wrap",
              wordBreak: "break-word", margin: 0,
            }}>
              <RenderedDocument
                text={SOURCE_TEXTS[activeSource]}
                entities={sourceEntities}
                decisions={decisions}
                selectedRef={selectedRef}
                onSelect={handleSelectEntity}
              />
            </pre>
          </div>
        </div>

        {/* RIGHT — Decision panel */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "#f8fafc", overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            padding: "14px 16px 10px", borderBottom: "1px solid #e2e8f0",
            background: "#fff", flexShrink: 0,
          }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#0f172a", marginBottom: "4px" }}>
              Redaction decisions
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              {edgeCases.length} items need review · Click any highlighted text to jump to its card
            </div>
          </div>

          {/* Cards list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {ENTITIES.map(entity => (
                <div
                  key={entity.ref}
                  ref={el => cardRefs.current[entity.ref] = el}
                  onClick={() => handleSelectEntity(entity.ref)}
                >
                  <DecisionCard
                    entity={entity}
                    decision={decisions[entity.ref]}
                    onDecide={setDecision}
                    isSelected={selectedRef === entity.ref}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Summary footer */}
          <div style={{
            borderTop: "1px solid #e2e8f0", padding: "10px 16px",
            background: "#fff", flexShrink: 0,
          }}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {DECISIONS.map(d => {
                const count = Object.values(decisions).filter(v => v === d.key).length;
                return count > 0 ? (
                  <div key={d.key} style={{
                    fontSize: "11px", color: d.color, fontWeight: "600",
                    background: d.bg, padding: "2px 8px", borderRadius: "4px",
                    border: `1px solid ${d.border}`,
                  }}>
                    {count} {d.label}
                  </div>
                ) : null;
              })}
              {pendingCount > 0 && (
                <div style={{
                  fontSize: "11px", color: "#d97706", fontWeight: "600",
                  background: "#fef9c3", padding: "2px 8px", borderRadius: "4px",
                  border: "1px solid #fcd34d",
                }}>
                  {pendingCount} pending
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
