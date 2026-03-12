import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "notion_kakeibo_settings";
const BUDGET_STORAGE_KEY = "notion_budget_settings";

const CATEGORIES = [
  { name: "クレカ支払い", emoji: "💳" },
  { name: "貯蓄", emoji: "👛" },
  { name: "衣服", emoji: "👔" },
  { name: "ホビー", emoji: "🎮" },
  { name: "自己投資", emoji: "🎧" },
  { name: "交際費", emoji: "🍸" },
  { name: "ジム", emoji: "💪" },
  { name: "ヘアカット・AGA", emoji: "✂️" },
  { name: "電気・ガス・水道・通信", emoji: "⚡" },
  { name: "家賃", emoji: "🏠" },
  { name: "サプリメント", emoji: "💊" },
  { name: "医療費", emoji: "🏥" },
  { name: "日用品", emoji: "🛒" },
  { name: "食事", emoji: "🍜" },
];

const getStatusColor = (pct) => {
  if (pct >= 100) return "#ff4444";
  if (pct >= 80) return "#ff9800";
  if (pct >= 60) return "#ffeb3b";
  return "#00c853";
};

const getStatusBg = (pct) => {
  if (pct >= 100) return "rgba(255,68,68,0.08)";
  if (pct >= 80) return "rgba(255,152,0,0.08)";
  if (pct >= 60) return "rgba(255,235,59,0.06)";
  return "rgba(0,200,83,0.06)";
};

function Field({ label, type = "text", placeholder, value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={s.label}>{label}</div>
      <input style={s.input} type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SettingsScreen({ onBack }) {
  const [tab, setTab] = useState("spending");
  const [spendSettings, setSpendSettings] = useState({ token: "", dbId: "" });
  const [budgets, setBudgets] = useState({});

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) setSpendSettings(JSON.parse(s));
    const b = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (b) {
      const parsed = JSON.parse(b);
      setBudgets(parsed.budgets || {});
    }
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spendSettings));
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify({ budgets }));
    onBack();
  };

  return (
    <div style={s.container}>
      <div style={s.settingsHeader}>
        <button style={s.backBtn} onClick={onBack}>←</button>
        <span style={s.pageTitle}>設定</span>
        <button style={s.saveBtn2} onClick={save}>保存</button>
      </div>
      <div style={s.tabRow}>
        {["spending", "budget"].map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === "spending" ? "📥 Notion接続" : "🎯 予算設定"}
          </button>
        ))}
      </div>

      {tab === "spending" && (
        <div style={s.settingsBody}>
          <p style={s.hint}>入力アプリと同じNotion IntegrationのTokenとDBのIDを入力してください</p>
          <Field label="Integration Token" type="password" placeholder="secret_xxxx..."
            value={spendSettings.token} onChange={(v) => setSpendSettings(p => ({ ...p, token: v }))} />
          <Field label="支出データベース ID" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={spendSettings.dbId} onChange={(v) => setSpendSettings(p => ({ ...p, dbId: v }))} />
        </div>
      )}

      {tab === "budget" && (
        <div style={s.settingsBody}>
          <p style={s.hint}>各カテゴリの月間予算を入力してください（円）</p>
          <div style={s.budgetGrid}>
            {CATEGORIES.map((c) => (
              <div key={c.name} style={s.budgetRow}>
                <span style={s.budgetCatName}>{c.emoji} {c.name}</span>
                <div style={s.budgetInputWrap}>
                  <span style={s.yen}>¥</span>
                  <input
                    style={s.budgetInput}
                    type="number"
                    placeholder="0"
                    value={budgets[c.name] === undefined ? "" : budgets[c.name]}
                    onChange={(e) => setBudgets(p => ({ ...p, [c.name]: e.target.value === "" ? "" : parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("dashboard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchData = useCallback(async () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const rawB = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) { setError("設定が未完了です。右上の⚙️から設定してください"); return; }
    const { token, dbId } = JSON.parse(raw);
    const budgetData = rawB ? JSON.parse(rawB) : { budgets: {} };
    const budgets = budgetData.budgets || {};
    if (!token || !dbId) { setError("TokenまたはDBのIDが未設定です"); return; }

    setLoading(true);
    setError(null);
    try {
      const [year, mon] = month.split("-");
      const startDate = `${year}-${mon}-01`;
      const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
      const endDate = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

      let results = [];
      let cursor = undefined;
      while (true) {
        const body = {
          filter: {
            and: [
              { property: "日付", date: { on_or_after: startDate } },
              { property: "日付", date: { on_or_before: endDate } },
              { property: "種別", select: { equals: "支出" } },
            ],
          },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        };
        const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const e = await resp.json();
          throw new Error(e.message || "Notion APIエラー");
        }
        const json = await resp.json();
        results = results.concat(json.results);
        if (!json.has_more) break;
        cursor = json.next_cursor;
      }

      const actual = {};
      let totalActual = 0;
      for (const page of results) {
        const cat = page.properties?.カテゴリ?.select?.name || "その他";
        const amt = page.properties?.金額?.number || 0;
        actual[cat] = (actual[cat] || 0) + amt;
        totalActual += amt;
      }
      const totalBudget = Object.values(budgets).reduce((a, b) => a + (parseInt(b) || 0), 0);
      setData({ actual, budgets, totalActual, totalBudget, count: results.length });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    if (screen === "dashboard") fetchData();
  }, [screen, fetchData]);

  const changeMonth = (dir) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("dashboard")} />;

  const [y, m] = month.split("-");
  const monthLabel = `${y}年${parseInt(m)}月`;
  const totalPct = data ? Math.round((data.totalActual / (data.totalBudget || 1)) * 100) : 0;
  const catsWithData = CATEGORIES.map((c) => ({
    ...c,
    budget: parseInt(data?.budgets?.[c.name] || 0),
    actual: data?.actual?.[c.name] || 0,
  })).filter((c) => c.budget > 0 || c.actual > 0);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.appName}>💴 予実管理</span>
        <button style={s.iconBtn} onClick={() => setScreen("settings")}>⚙️</button>
      </div>

      <div style={s.monthRow}>
        <button style={s.arrowBtn} onClick={() => changeMonth(-1)}>‹</button>
        <span style={s.monthLabel}>{monthLabel}</span>
        <button style={s.arrowBtn} onClick={() => changeMonth(1)}>›</button>
        <button style={s.reloadBtn} onClick={fetchData}>↻</button>
      </div>

      {data && (
        <div style={{ ...s.totalCard, background: getStatusBg(totalPct), borderColor: getStatusColor(totalPct) + "44" }}>
          <div style={s.totalRow}>
            <div>
              <div style={s.totalLabel}>今月の支出合計</div>
              <div style={s.totalAmount}>¥{data.totalActual.toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={s.totalLabel}>予算合計</div>
              <div style={s.totalBudget}>¥{data.totalBudget.toLocaleString()}</div>
            </div>
          </div>
          <div style={s.masterBarBg}>
            <div style={{ ...s.masterBarFill, width: `${Math.min(totalPct, 100)}%`, background: getStatusColor(totalPct) }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ ...s.pctLabel, color: getStatusColor(totalPct) }}>{totalPct}% 使用</span>
            <span style={s.remainLabel}>
              {data.totalBudget - data.totalActual >= 0
                ? `残り ¥${(data.totalBudget - data.totalActual).toLocaleString()}`
                : `¥${Math.abs(data.totalBudget - data.totalActual).toLocaleString()} オーバー`}
            </span>
          </div>
        </div>
      )}

      {loading && <div style={s.stateMsg}>🔄 データ取得中...</div>}
      {error && !loading && (
        <div style={s.errorBox}>
          <div style={s.errorText}>⚠️ {error}</div>
          <button style={s.retryBtn} onClick={fetchData}>再試行</button>
        </div>
      )}

      {!loading && data && (
        <div style={s.catList}>
          {catsWithData.length === 0 && <div style={s.emptyMsg}>この月のデータがありません</div>}
          {catsWithData.map((c) => {
            const pct = c.budget > 0 ? Math.round((c.actual / c.budget) * 100) : (c.actual > 0 ? 999 : 0);
            const color = getStatusColor(pct);
            const remain = c.budget - c.actual;
            return (
              <div key={c.name} style={{ ...s.catCard, background: getStatusBg(pct), borderColor: color + "33" }}>
                <div style={s.catCardTop}>
                  <div style={s.catCardLeft}>
                    <span style={s.catCardEmoji}>{c.emoji}</span>
                    <span style={s.catCardName}>{c.name}</span>
                  </div>
                  <span style={{ ...s.catPct, color }}>{pct >= 999 ? "超過" : `${pct}%`}</span>
                </div>
                <div style={s.barBg}>
                  <div style={{ ...s.barFill, width: `${Math.min(pct, 100)}%`, background: color }} />
                </div>
                <div style={s.catCardBottom}>
                  <span style={s.actualAmt}>実績 ¥{c.actual.toLocaleString()}</span>
                  {c.budget > 0 ? (
                    <span style={s.budgetAmt}>
                      予算 ¥{c.budget.toLocaleString()}
                      {remain < 0
                        ? <span style={{ color: "#ff4444" }}> (¥{Math.abs(remain).toLocaleString()}超過)</span>
                        : <span style={{ color: "#555" }}> (残¥{remain.toLocaleString()})</span>}
                    </span>
                  ) : <span style={{ color: "#444", fontSize: 11 }}>予算未設定</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}`}</style>
    </div>
  );
}

const s = {
  container: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif", maxWidth: 430, margin: "0 auto", paddingBottom: 40 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px", borderBottom: "1px solid #1e1e1e" },
  appName: { fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px" },
  iconBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer" },
  monthRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "14px 20px" },
  arrowBtn: { background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fff", width: 36, height: 36, borderRadius: 8, fontSize: 22, cursor: "pointer" },
  monthLabel: { fontSize: 20, fontWeight: 800, flex: 1, textAlign: "center" },
  reloadBtn: { background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#00c853", width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: "pointer" },
  totalCard: { margin: "0 16px 16px", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 20px" },
  totalRow: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  totalLabel: { fontSize: 11, color: "#666", marginBottom: 4 },
  totalAmount: { fontSize: 28, fontWeight: 900, letterSpacing: "-1px" },
  totalBudget: { fontSize: 18, fontWeight: 700, color: "#aaa" },
  masterBarBg: { height: 8, background: "#1e1e1e", borderRadius: 4, overflow: "hidden" },
  masterBarFill: { height: "100%", borderRadius: 4, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" },
  pctLabel: { fontSize: 13, fontWeight: 800 },
  remainLabel: { fontSize: 12, color: "#666" },
  stateMsg: { textAlign: "center", padding: 40, color: "#555", fontSize: 15 },
  errorBox: { margin: "12px 16px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  errorText: { color: "#ff6666", fontSize: 13 },
  retryBtn: { background: "#ff4444", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  catList: { padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 },
  emptyMsg: { textAlign: "center", color: "#444", padding: 40, fontSize: 14 },
  catCard: { border: "1px solid #2a2a2a", borderRadius: 14, padding: "12px 14px" },
  catCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  catCardLeft: { display: "flex", alignItems: "center", gap: 8 },
  catCardEmoji: { fontSize: 18 },
  catCardName: { fontSize: 14, fontWeight: 700 },
  catPct: { fontSize: 18, fontWeight: 900, letterSpacing: "-0.5px" },
  barBg: { height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" },
  catCardBottom: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  actualAmt: { fontSize: 13, fontWeight: 700 },
  budgetAmt: { fontSize: 11, color: "#666" },
  settingsHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #1e1e1e" },
  backBtn: { background: "none", border: "none", color: "#00c853", fontSize: 20, cursor: "pointer", width: 40 },
  pageTitle: { fontSize: 17, fontWeight: 800 },
  saveBtn2: { background: "#00c853", border: "none", color: "#fff", padding: "8px 20px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 14 },
  tabRow: { display: "flex", padding: "12px 16px 0", gap: 8 },
  tab: { flex: 1, background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#666", padding: "10px 0", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 },
  tabActive: { background: "#003820", borderColor: "#00c853", color: "#00c853" },
  settingsBody: { padding: "20px 16px" },
  hint: { color: "#555", fontSize: 12, marginBottom: 20, lineHeight: 1.6 },
  label: { fontSize: 12, color: "#666", marginBottom: 6, fontWeight: 600 },
  input: { width: "100%", background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 10, padding: "12px 14px", fontSize: 14, boxSizing: "border-box", outline: "none" },
  budgetGrid: { display: "flex", flexDirection: "column", gap: 10 },
  budgetRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a1a", borderRadius: 10, padding: "10px 14px", border: "1px solid #242424" },
  budgetCatName: { fontSize: 13, fontWeight: 600, flex: 1 },
  budgetInputWrap: { display: "flex", alignItems: "center", gap: 4 },
  yen: { color: "#555", fontSize: 14 },
  budgetInput: { background: "#0f0f0f", border: "1px solid #333", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 14, width: 100, textAlign: "right", outline: "none" },
};
