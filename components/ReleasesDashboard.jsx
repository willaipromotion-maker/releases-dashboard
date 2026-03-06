import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ─── Mock Data (mirrors Supabase schema) ────────────────────────────────────
const GENRES = [
  { id: 1, name: "Hip-Hop" },
  { id: 2, name: "Pop" },
  { id: 3, name: "Electronic" },
  { id: 4, name: "R&B" },
  { id: 5, name: "Indie" },
  { id: 6, name: "Latin" },
  { id: 7, name: "Country" },
  { id: 8, name: "K-Pop" },
  { id: 9, name: "Rock" },
  { id: 10, name: "Jazz" },
];

const PLATFORMS = ["Spotify", "TikTok", "YouTube", "Instagram Reels"];

const PLATFORM_META = {
  Spotify: { color: "#1DB954", icon: "♫", abbr: "SP" },
  TikTok: { color: "#FF004F", icon: "◈", abbr: "TK" },
  YouTube: { color: "#FF0000", icon: "▶", abbr: "YT" },
  "Instagram Reels": { color: "#C13584", icon: "◉", abbr: "IG" },
};

function makeTrendHistory(baseValue, days = 30) {
  let v = baseValue;
  return Array.from({ length: days }, (_, i) => {
    v = Math.max(10, v + (Math.random() - 0.45) * 8);
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(v),
    };
  });
}

function generateTrends() {
  const trendNames = {
    "Hip-Hop": ["Drill beats", "Hyperpop crossover", "Melodic rap", "808 sub bass", "Afrobeats fusion"],
    Pop: ["Bedroom pop", "Synth-pop revival", "Hyperpop", "Indie-pop", "Dance-pop"],
    Electronic: ["Ambient techno", "UK garage revival", "Neo-trance", "Electroclash", "Modular synthesis"],
    "R&B": ["Neo-soul", "Alternative R&B", "Quiet storm revival", "Progressive R&B", "Alt-soul"],
    Indie: ["Lo-fi indie", "Dream pop", "Shoegaze revival", "Indie folk", "Chamber pop"],
    Latin: ["Reggaeton", "Latin trap", "Cumbia moderna", "Bachata pop", "Latin afrobeats"],
    Country: ["Country pop crossover", "Outlaw revival", "Bro-country decline", "Americana", "Country trap"],
    "K-Pop": ["4th gen girl groups", "Solo artist surge", "K-indie", "Concept albums", "Fan interaction drops"],
    Rock: ["Post-punk revival", "Math rock", "Emo revival", "Noise pop", "Indie rock"],
    Jazz: ["Jazz rap fusion", "Nu-jazz", "Smooth jazz revival", "Avant-garde", "Jazz funk"],
  };

  const descriptions = [
    "Gaining traction across playlist editorial placements and algorithmic feeds.",
    "Strong engagement driven by creator community adoption.",
    "Emerging from underground scenes into mainstream visibility.",
    "Cross-platform virality accelerating listener growth.",
    "Playlist curator interest rising significantly this month.",
  ];

  const trends = {};
  GENRES.forEach((genre) => {
    trends[genre.id] = {};
    PLATFORMS.forEach((platform) => {
      const names = trendNames[genre.name] || ["Emerging trend"];
      trends[genre.id][platform] = names.map((name, i) => ({
        trend_name: name,
        trend_description: descriptions[i % descriptions.length],
        is_growing: Math.random() > 0.3,
        data_value: Math.round(40 + Math.random() * 55),
        is_verified: false,
        history: makeTrendHistory(40 + Math.random() * 40),
      }));
    });
  });
  return trends;
}

const ALL_TRENDS = generateTrends();

// ─── Sub-components ──────────────────────────────────────────────────────────

function TrendRow({ trend, onSelect, isSelected }) {
  return (
    <div
      onClick={() => onSelect(trend)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "6px",
        cursor: "pointer",
        background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
        borderLeft: isSelected ? "2px solid #E8D5A3" : "2px solid transparent",
        transition: "all 0.15s ease",
        marginBottom: "2px",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "transparent";
      }}
    >
      <div>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#E8E0D0", fontFamily: "'DM Mono', monospace", letterSpacing: "0.01em" }}>
          {trend.trend_name}
        </div>
        <div style={{ fontSize: "11px", color: "#7A7468", marginTop: "2px", lineHeight: 1.4 }}>
          {trend.trend_description}
        </div>
      </div>
      <div style={{
        fontSize: "11px",
        fontFamily: "'DM Mono', monospace",
        color: trend.is_growing ? "#7EC896" : "#E07070",
        background: trend.is_growing ? "rgba(126,200,150,0.1)" : "rgba(224,112,112,0.1)",
        padding: "3px 8px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
      }}>
        {trend.is_growing ? "▲ growing" : "▼ fading"}
      </div>
      <div style={{
        fontSize: "12px",
        fontFamily: "'DM Mono', monospace",
        color: "#B8A882",
        minWidth: "32px",
        textAlign: "right",
      }}>
        {trend.data_value}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#1A1814",
        border: "1px solid #3A3628",
        borderRadius: "6px",
        padding: "8px 12px",
        fontFamily: "'DM Mono', monospace",
      }}>
        <div style={{ color: "#7A7468", fontSize: "11px", marginBottom: "4px" }}>{label}</div>
        <div style={{ color: "#E8D5A3", fontSize: "13px", fontWeight: 600 }}>{payload[0].value}</div>
      </div>
    );
  }
  return null;
}

function TrendChart({ trend, platformColor, onClose }) {
  return (
    <div style={{
      background: "#16140F",
      border: "1px solid #2E2A20",
      borderRadius: "10px",
      padding: "20px 24px",
      marginTop: "16px",
      position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8D5A3", fontFamily: "'DM Mono', monospace" }}>
            {trend.trend_name}
          </div>
          <div style={{ fontSize: "11px", color: "#7A7468", marginTop: "3px" }}>30-day performance index</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid #3A3628",
            borderRadius: "4px",
            color: "#7A7468",
            cursor: "pointer",
            padding: "4px 8px",
            fontSize: "12px",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          ✕ close
        </button>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={trend.history}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E2A20" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#5A5448", fontSize: 10, fontFamily: "'DM Mono', monospace" }}
            tickLine={false}
            axisLine={{ stroke: "#2E2A20" }}
            interval={6}
          />
          <YAxis
            tick={{ fill: "#5A5448", fontSize: 10, fontFamily: "'DM Mono', monospace" }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={platformColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: platformColor, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlatformBlock({ platform, trends, isExpanded, onToggle }) {
  const [selectedTrend, setSelectedTrend] = useState(null);
  const meta = PLATFORM_META[platform];

  return (
    <div style={{
      background: "#1C1A14",
      border: "1px solid #2E2A20",
      borderRadius: "10px",
      overflow: "hidden",
      transition: "border-color 0.2s ease",
    }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "#3A3628"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2E2A20"}
    >
      {/* Platform header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          cursor: "pointer",
          borderBottom: isExpanded ? "1px solid #2E2A20" : "none",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: `${meta.color}18`,
            border: `1px solid ${meta.color}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            color: meta.color,
          }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#D8CEB8", fontFamily: "'DM Mono', monospace" }}>
              {platform}
            </div>
            <div style={{ fontSize: "11px", color: "#5A5448", marginTop: "1px" }}>
              {trends.length} trends tracked
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            display: "flex",
            gap: "4px",
            alignItems: "center",
          }}>
            {trends.slice(0, 3).map((t, i) => (
              <div key={i} style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: t.is_growing ? "#7EC896" : "#E07070",
              }} />
            ))}
          </div>
          <div style={{
            color: "#5A5448",
            fontSize: "12px",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}>
            ▾
          </div>
        </div>
      </div>

      {/* Trend list */}
      {isExpanded && (
        <div style={{ padding: "8px 10px 12px" }}>
          {trends.map((trend, i) => (
            <TrendRow
              key={i}
              trend={trend}
              isSelected={selectedTrend?.trend_name === trend.trend_name}
              onSelect={(t) => setSelectedTrend(selectedTrend?.trend_name === t.trend_name ? null : t)}
            />
          ))}
          {selectedTrend && (
            <TrendChart
              trend={selectedTrend}
              platformColor={meta.color}
              onClose={() => setSelectedTrend(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function ReleasesDashboard({ genres: GENRES = [], trends: ALL_TRENDS = {} }) {
  const [activeGenre, setActiveGenre] = useState(1);
  const [expandedPlatforms, setExpandedPlatforms] = useState({ Spotify: true });
  const [lastUpdated] = useState(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));

  const togglePlatform = (platform) => {
    setExpandedPlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const currentTrends = ALL_TRENDS[activeGenre];
  const currentGenre = GENRES.find((g) => g.id === activeGenre);

  // Aggregate stats
  const totalGrowing = PLATFORMS.reduce((acc, p) => {
    return acc + (currentTrends[p]?.filter((t) => t.is_growing).length || 0);
  }, 0);
  const totalTrends = PLATFORMS.reduce((acc, p) => acc + (currentTrends[p]?.length || 0), 0);
  const avgValue = Math.round(
    PLATFORMS.reduce((acc, p) => acc + currentTrends[p].reduce((s, t) => s + t.data_value, 0), 0) / totalTrends
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0E0C08",
      fontFamily: "'DM Sans', 'DM Mono', sans-serif",
      color: "#D8CEB8",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0E0C08; }
        ::-webkit-scrollbar-thumb { background: #3A3628; border-radius: 2px; }
        body { margin: 0; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #2E2A20",
        padding: "18px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "#0E0C08",
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "20px",
            color: "#E8D5A3",
            letterSpacing: "0.02em",
          }}>
            releases
          </span>
          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "11px",
            color: "#5A5448",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            dashboard
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(224,175,90,0.08)",
            border: "1px solid rgba(224,175,90,0.2)",
            borderRadius: "5px",
            padding: "5px 10px",
          }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#E0AF5A", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#E0AF5A", letterSpacing: "0.08em" }}>
              TRAINING DATA
            </span>
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#5A5448" }}>
            {lastUpdated}
          </div>
        </div>
      </div>

      {/* Genre tabs */}
      <div style={{
        borderBottom: "1px solid #2E2A20",
        background: "#0E0C08",
        position: "sticky",
        top: "57px",
        zIndex: 99,
        overflowX: "auto",
      }}>
        <div style={{
          display: "flex",
          padding: "0 28px",
          gap: "0",
          minWidth: "max-content",
        }}>
          {GENRES.map((genre) => {
            const isActive = genre.id === activeGenre;
            return (
              <button
                key={genre.id}
                onClick={() => {
                  setActiveGenre(genre.id);
                  setExpandedPlatforms({ Spotify: true });
                }}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #E8D5A3" : "2px solid transparent",
                  color: isActive ? "#E8D5A3" : "#5A5448",
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: isActive ? 500 : 400,
                  letterSpacing: "0.06em",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  marginBottom: "-1px",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#A89878"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#5A5448"; }}
              >
                {genre.name.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "28px 32px", maxWidth: "1200px" }}>
        {/* Genre header + stats row */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "16px",
        }}>
          <div>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "32px",
              color: "#E8D5A3",
              margin: "0 0 4px 0",
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}>
              {currentGenre.name}
            </h1>
            <div style={{ fontSize: "12px", color: "#5A5448", fontFamily: "'DM Mono', monospace" }}>
              Music trends across 4 platforms
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {[
              { label: "TOTAL TRENDS", value: totalTrends },
              { label: "GROWING", value: totalGrowing, color: "#7EC896" },
              { label: "AVG INDEX", value: avgValue },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: "#1C1A14",
                border: "1px solid #2E2A20",
                borderRadius: "8px",
                padding: "12px 20px",
                textAlign: "center",
                minWidth: "90px",
              }}>
                <div style={{
                  fontSize: "22px",
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 500,
                  color: color || "#E8D5A3",
                  lineHeight: 1,
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: "9px",
                  fontFamily: "'DM Mono', monospace",
                  color: "#5A5448",
                  letterSpacing: "0.1em",
                  marginTop: "5px",
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform blocks grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))",
          gap: "16px",
        }}>
          {PLATFORMS.map((platform) => (
            <PlatformBlock
              key={platform}
              platform={platform}
              trends={currentTrends[platform]}
              isExpanded={!!expandedPlatforms[platform]}
              onToggle={() => togglePlatform(platform)}
            />
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: "48px",
          paddingTop: "20px",
          borderTop: "1px solid #2E2A20",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <div style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "#E0AF5A",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "11px", color: "#5A5448", fontFamily: "'DM Mono', monospace" }}>
            All trend data is currently unverified training data. Verified real-time data via web search will be enabled at launch.
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}