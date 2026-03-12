import { useState, useEffect } from "react";

const STORAGE_KEY = "notion_kakeibo_settings";
const BUDGET_KEY = "notion_budget_settings";

const CATEGORIES = [
  { label: "クレカ支払い", emoji: "💳" },
  { label: "貯蓄", emoji: "👛" },
  { label: "衣服", emoji: "👔" },
  { label: "ホビー", emoji: "🎮" },
  { label: "自己投資", emoji: "🎧" },
  { label: "交際費", emoji: "🍸" },
  { label: "ジム", emoji: "💪" },
  { label: "ヘアカット・AGA", emoji: "✂️" },
  { label: "電気・ガス・水道・通信", emoji: "⚡" },
  { label: "家賃", emoji: "🏠" },
  { label: "サプリメント", emoji: "💊" },
  { label: "医療費", emoji: "🏥" },
  { label: "日用品", emoji: "🛒" },
  { label: "食事", emoji: "🍜" },
];

const DEFAULT_BUDGET = Object.fromEntries(CATEGORIES.map((c) => [c.label, 0]));

function getYearMonth(date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function App() {
  const now = new Date();
  const [ym, setYm] = useState(getYearMonth(now));
  const [settings, setSettings] = useState({ token: "", dbId: "" });
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("notion");
  const [tempSettings, setTempSettings] = useState({ token: "", dbId: "" });
  const [tempBudget, setTempBudget] = useState(DEFAULT_BUDGET);

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) setSettings(JSON.parse(s));
    const b = localStorage.getItem(BUDGET_KEY);
    if (b) setBudget(JSON.parse(b));
  }, []);

  useEffect(() => {
    if (settings.token && settings.dbId) fetchRecords();
  }, [settings, ym]);

  const fetchRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const start = `${ym.year}-${String(ym.month).padStart(2, "0")}-01`;
      const endDate = new Date(ym.year, ym.month, 0);
      const end = `${ym.year}-${String(ym.month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: settings.token, databaseId: settings.dbId, start, end }),
      });

      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setRecords(data.results || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempSettings));
    localStorage.setItem(BUDGET_KEY, JSON.stringify(tempBudget));
    setSettings(tempSettings);
    setBudget(tempBudget);
    setShowSettings(false);
  };

  const openSettings = () => {
    setTempSettings(settings);
    setTempBudget(budget);
    setSettingsTab("notion");
    setShowSettings(true);
  };

  const changeMonth = (delta) => {
    setYm((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  const expenses = records.filter((r) => r.properties?.種別?.select?.name === "支出");
  const totalActual = expenses.reduce((sum, r) => sum + (r.properties?.金額?.number || 0), 0);
  const totalBudget = Object.values(budget).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const usageRate = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const catActual = {};
  expenses.forEach((r) => {
    const cat = r.properties?.カテゴリ?.select?.name;
    if (cat) catActual[cat] = (catActual[cat] || 0) + (r.properties?.金額?.number || 0);
  });

  const barColor = (rate) => {
    if (rate >= 100) return "#e94560";
    if (rate >= 80) return "#ff9500";
    if (rate >= 60) return "#ffcc00";
    return "#4cd964";
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#1a1a2e", color: "#fff", fontFamily: "sans-serif", paddingBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => changeMonth(-1)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>‹</button>
          <span style={{ fontSize: 18, fontWeight: "bold" }}>{ym.year}年{ym.month}月</span>
          <button onClick={() => changeMonth(1)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>›</button>
          <button onClick={fetchRecords} style={{ background: "none", border: "none", color: "#aaa", fontSize: 18, cursor: "pointer" }}>↻</button>
        </div>
        <button onClick={openSettings} style={{ background: "none", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer" }}>⚙️</button>
      </div>

      <div style={{ margin: "8px 12px", background: "#2a2a4a", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#aaa", fontSize: 14 }}>支出合計</span>
          <span style={{ fontSize: 22, fontWeight: "bold", color: "#e94560" }}>¥{totalActual.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#aaa", fontSize: 14 }}>予算合計</span>
          <span style={{ fontSize: 16 }}>¥{totalBudget.toLocaleString()}</span>
        </div>
        <div style={{ background: "#1a1a2e", borderRadius: 8, height: 10, marginBottom: 4 }}>
          <div style={{ height: "100%", borderRadius: 8, width: `${Math.min(usageRate, 100)}%`, background: barColor(usageRate), transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#aaa" }}>
          <span>{usageRate}% 使用</span>
          <span>残 ¥{(totalBudget - totalActual).toLocaleString()}</span>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", color: "#aaa", padding: 16 }}>読み込み中...</div>}
      {error && <div style={{ textAlign: "center", color: "#e94560", padding: 16 }}>{error}</div>}
      {!settings.token && <div style={{ textAlign: "center", color: "#aaa", padding: 16 }}>⚙️ から設定を入力してください</div>}

      <div style={{ padding: "0 12px" }}>
        {CATEGORIES.map((cat) => {
          const actual = catActual[cat.label] || 0;
          const bud = Number(budget[cat.label]) || 0;
          const rate = bud > 0 ? Math.round((actual / bud) * 100) : (actual > 0 ? 100 : 0);
          if (actual === 0 && bud === 0) return null;
          return (
            <div key={cat.label} style={{ background: "#2a2a4a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{cat.emoji} {cat.label}</span>
                <span style={{ fontSize: 13 }}>
                  <span style={{ color: barColor(rate), fontWeight: "bold" }}>¥{actual.toLocaleString()}</span>
                  {bud > 0 && <span style={{ color: "#aaa" }}> / ¥{bud.toLocaleString()}</span>}
                </span>
              </div>
              {bud > 0 && (
                <div style={{ background: "#1a1a2e", borderRadius: 4, height: 6 }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(rate, 100)}%`, background: barColor(rate) }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, overflowY: "auto" }}>
          <div style={{ background: "#1a1a2e", borderRadius: 16, padding: 24, width: "90%", maxWidth: 400, marginBottom: 40 }}>
            <h3 style={{ margin: "0 0 16px" }}>⚙️ 設定</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["notion", "budget"].map((tab) => (
                <button key={tab} onClick={() => setSettingsTab(tab)}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: settingsTab === tab ? "#e94560" : "#2a2a4a", color: "#fff", cursor: "pointer" }}>
                  {tab === "notion" ? "Notion接続" : "予算設定"}
                </button>
              ))}
            </div>

            {settingsTab === "notion" ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#aaa" }}>Integration Token</label>
                  <input value={tempSettings.token} onChange={(e) => setTempSettings({ ...tempSettings, token: e.target.value })}
                    placeholder="secret_xxx..."
                    style={{ width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "none", background: "#2a2a4a", color: "#fff", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, color: "#aaa" }}>データベースID</label>
                  <input value={tempSettings.dbId} onChange={(e) => setTempSettings({ ...tempSettings, dbId: e.target.value })}
                    placeholder="32文字の英数字"
                    style={{ width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "none", background: "#2a2a4a", color: "#fff", boxSizing: "border-box" }} />
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {CATEGORIES.map((cat) => (
                  <div key={cat.label} style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
                    <span style={{ fontSize: 13, flex: 1 }}>{cat.emoji} {cat.label}</span>
                    <input type="number" value={tempBudget[cat.label] || ""} onChange={(e) => setTempBudget({ ...tempBudget, [cat.label]: e.target.value })}
                      placeholder="0"
                      style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "none", background: "#2a2a4a", color: "#fff", textAlign: "right" }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#2a2a4a", color: "#fff", cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveSettings} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
