import StatusDot from "../shared/StatusDot";
import TierBadge from "../shared/TierBadge";
import ModelBadge from "../shared/ModelBadge";
import BusinessUnitBadge from "../shared/BusinessUnitBadge";
import AgentAvatar from "../AgentAvatar";

interface AgentCardProps {
  agent: {
    _id: string;
    name: string;
    role: string;
    avatar: string;
    status: string;
    model?: string;
    tier?: string;
    businessUnit?: string;
    isEnabled?: boolean;
  };
  onClick?: (id: string) => void;
}

export default function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <div
      className="metric-card"
      onClick={onClick ? () => onClick(agent._id) : undefined}
      style={{
        cursor: onClick ? "pointer" : "default",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: agent.isEnabled === false ? 0.5 : 1,
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.18)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.transform = "";
      }}
    >
      {/* Top row: avatar + name + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AgentAvatar name={agent.name} avatar={agent.avatar} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--mc-text-primary)" }}>
            {agent.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--mc-text-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {agent.role}
          </div>
        </div>
        <StatusDot status={agent.status} size={10} pulse={agent.status === "active"} />
      </div>

      {/* Badges row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {agent.tier && <TierBadge tier={agent.tier} />}
        {agent.model && <ModelBadge model={agent.model} />}
        {agent.businessUnit && <BusinessUnitBadge unit={agent.businessUnit} />}
      </div>
    </div>
  );
}
