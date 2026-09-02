import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Plus, X, Trash2, TrendingUp, TrendingDown, Wallet,
  Briefcase, User, ChevronRight, PiggyBank,
} from "lucide-react";

// ---------- constants ----------

const CATEGORIES = {
  expense: [
    { name: "Food", color: "#B4552F" },
    { name: "Rent", color: "#8B5E3C" },
    { name: "Transport", color: "#C99A3E" },
    { name: "Utilities", color: "#7A6A53" },
    { name: "Supplies", color: "#A66A4E" },
    { name: "Marketing", color: "#C77B4F" },
    { name: "Software", color: "#9E7B4F" },
    { name: "Other", color: "#8E8577" },
  ],
  income: [
    { name: "Sales", color: "#5C7A5C" },
    { name: "Salary", color: "#4C7A6B" },
    { name: "Freelance", color: "#6B8F6B" },
    { name: "Investment", color: "#4E8A72" },
    { name: "Other", color: "#7D9A7D" },
  ],
};

const INK = "#1C2321";
const PAPER = "#F6F4EE";
const PAPER_DIM = "#EDEAE0";
const LINE = "#DAD5C5";
const MUTED = "#7A7566";
const SAGE = "#5C7A5C";
const RUST = "#B4552F";
const GOLD = "#C99A3E";

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtMoney = (n) => {
  const sign = n < 0 ? "-" : "";
  return sign + "₱" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtMonthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- storage ----------

const STORAGE_KEY = "budget-tracker:transactions";
const BUDGETS_KEY = "budget-tracker:budgets";

function useStorage() {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) setTransactions(JSON.parse(t));
    } catch (e) { /* no data yet */ }
    try {
      const b = localStorage.getItem(BUDGETS_KEY);
      if (b) setBudgets(JSON.parse(b));
    } catch (e) { /* no data yet */ }
    setLoaded(true);
  }, []);

  const persistTransactions = useCallback((next) => {
    setTransactions(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) { setSaveError(true); }
  }, []);

  const persistBudgets = useCallback((next) => {
    setBudgets(next);
    try {
      localStorage.setItem(BUDGETS_KEY, JSON.stringify(next));
    } catch (e) { setSaveError(true); }
  }, []);

  return { transactions, budgets, loaded, saveError, persistTransactions, persistBudgets };
}

// ---------- small UI pieces ----------

function IconCircle({ children, bg, fg, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function CategoryDot({ color }) {
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

// ---------- main app ----------

export default function BudgetTracker() {
  const { transactions, budgets, loaded, saveError, persistTransactions, persistBudgets } = useStorage();
  const [tab, setTab] = useState("overview");
  const [scope, setScope] = useState("all"); // all | personal | business
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));

  const filtered = useMemo(() => {
    return transactions.filter((t) => scope === "all" || t.scope === scope);
  }, [transactions, scope]);

  const months = useMemo(() => {
    const set = new Set(filtered.map((t) => monthKey(new Date(t.date))));
    set.add(monthKey(new Date()));
    return Array.from(set).sort().reverse();
  }, [filtered]);

  useEffect(() => {
    if (!months.includes(selectedMonth) && months.length) setSelectedMonth(months[0]);
  }, [months, selectedMonth]);

  const monthTx = useMemo(
    () => filtered.filter((t) => monthKey(new Date(t.date)) === selectedMonth),
    [filtered, selectedMonth]
  );

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    monthTx.forEach((t) => (t.type === "income" ? (income += t.amount) : (expense += t.amount)));
    return { income, expense, net: income - expense };
  }, [monthTx]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    monthTx.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    const cats = CATEGORIES.expense;
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        color: cats.find((c) => c.name === name)?.color || MUTED,
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthTx]);

  const trend = useMemo(() => {
    const last6 = months.slice(0, 6).reverse();
    return last6.map((mk) => {
      const tx = filtered.filter((t) => monthKey(new Date(t.date)) === mk);
      let income = 0, expense = 0;
      tx.forEach((t) => (t.type === "income" ? (income += t.amount) : (expense += t.amount)));
      return { month: fmtMonthLabel(mk), income: Math.round(income), expense: Math.round(expense) };
    });
  }, [filtered, months]);

  const dailyData = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, income: 0, expense: 0 }));
    monthTx.forEach((t) => {
      const d = new Date(t.date).getDate();
      if (t.type === "income") days[d - 1].income += t.amount;
      else days[d - 1].expense += t.amount;
    });
    return days.map((d) => ({ ...d, income: Math.round(d.income), expense: Math.round(d.expense) }));
  }, [monthTx, selectedMonth]);

  const addTransaction = (tx) => {
    const next = [{ ...tx, id: uid() }, ...transactions];
    persistTransactions(next);
    setShowAdd(false);
  };

  const deleteTransaction = (id) => {
    persistTransactions(transactions.filter((t) => t.id !== id));
  };

  const setBudgetForCategory = (category, amount) => {
    persistBudgets({ ...budgets, [category]: amount });
  };

  if (!loaded) {
    return (
      <div style={{ ...appShell, alignItems: "center", justifyContent: "center", display: "flex" }}>
        <span style={{ color: MUTED, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={appShell}>
      <style>{`
        * { box-sizing: border-box; }
        .btr-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <Header scope={scope} setScope={setScope} />

      <div className="btr-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 18px 90px" }}>
        {tab === "overview" && (
          <Overview
            totals={totals}
            months={months}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            categoryBreakdown={categoryBreakdown}
            trend={trend}
            dailyData={dailyData}
            budgets={budgets}
          />
        )}
        {tab === "transactions" && (
          <Transactions monthTx={monthTx} onDelete={deleteTransaction} selectedMonth={selectedMonth} />
        )}
        {tab === "budgets" && (
          <Budgets categoryBreakdown={categoryBreakdown} budgets={budgets} onSet={setBudgetForCategory} />
        )}
        {saveError && (
          <p style={{ fontSize: 12, color: RUST, textAlign: "center", marginTop: 16, fontFamily: "system-ui, sans-serif" }}>
            Couldn't save changes. They may not persist.
          </p>
        )}
      </div>

      <TabBar tab={tab} setTab={setTab} onAdd={() => setShowAdd(true)} />

      {showAdd && <AddSheet onClose={() => setShowAdd(false)} onAdd={addTransaction} />}
    </div>
  );
}

const appShell = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  background: PAPER,
  color: INK,
  minHeight: "100vh",
  width: "100%",
  maxWidth: 480,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  position: "relative",
};

// ---------- header ----------

function Header({ scope, setScope }) {
  const opts = [
    { key: "all", label: "All" },
    { key: "personal", label: "Personal" },
    { key: "business", label: "Business" },
  ];
  return (
    <div style={{ padding: "20px 18px 12px", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
            EcoMe
          </h1>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>My pocket economy</div>
        </div>
        <PiggyBank size={20} color={MUTED} strokeWidth={1.5} style={{ marginTop: 2 }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {opts.map((o) => (
          <button
            key={o.key}
            onClick={() => setScope(o.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1px solid ${scope === o.key ? INK : LINE}`,
              background: scope === o.key ? INK : "transparent",
              color: scope === o.key ? PAPER : MUTED,
              fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- overview ----------

function Overview({ totals, months, selectedMonth, setSelectedMonth, categoryBreakdown, trend, dailyData, budgets }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 0 6px" }} className="btr-scroll">
        {months.slice(0, 8).map((mk) => (
          <button
            key={mk}
            onClick={() => setSelectedMonth(mk)}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 20,
              border: "none",
              background: mk === selectedMonth ? GOLD : PAPER_DIM,
              color: mk === selectedMonth ? INK : MUTED,
              fontSize: 12.5,
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {fmtMonthLabel(mk)}
          </button>
        ))}
      </div>

      <div style={{ padding: "18px 0 6px" }}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Net this month</div>
        <div style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 40,
          fontWeight: 400,
          color: totals.net >= 0 ? SAGE : RUST,
          letterSpacing: "-0.02em",
        }}>
          {fmtMoney(totals.net)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, padding: "10px 0 20px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconCircle bg="rgba(92,122,92,0.12)" fg={SAGE} size={30}><TrendingUp size={15} strokeWidth={2} /></IconCircle>
          <div>
            <div style={{ fontSize: 11, color: MUTED }}>Income</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{fmtMoney(totals.income)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconCircle bg="rgba(180,85,47,0.12)" fg={RUST} size={30}><TrendingDown size={15} strokeWidth={2} /></IconCircle>
          <div>
            <div style={{ fontSize: 11, color: MUTED }}>Expenses</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{fmtMoney(totals.expense)}</div>
          </div>
        </div>
      </div>

      {categoryBreakdown.length > 0 ? (
        <div style={{ padding: "20px 0" }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>Spending by category</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 120, height: 120, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={34}
                    outerRadius={58}
                    stroke={PAPER}
                    strokeWidth={2}
                  >
                    {categoryBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmtMoney(v)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, fontFamily: "system-ui, sans-serif" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {categoryBreakdown.slice(0, 5).map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <CategoryDot color={c.color} />
                  <span style={{ flex: 1, color: INK }}>{c.name}</span>
                  <span style={{ color: MUTED }}>{fmtMoney(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyNote text="No expenses logged this month yet." />
      )}
      
      {dailyData.some((d) => d.income || d.expense) && (
        <div style={{ padding: "20px 0 10px", borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>
            Daily income vs expenses — {fmtMonthLabel(selectedMonth)}
          </div>
          <div style={{ width: "100%", height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} barGap={1}>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: MUTED }}
                  axisLine={{ stroke: LINE }}
                  tickLine={false}
                  interval={dailyData.length > 20 ? 4 : dailyData.length > 10 ? 2 : 0}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => fmtMoney(v)}
                  labelFormatter={(d) => `Day ${d}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, fontFamily: "system-ui, sans-serif" }}
                />
                <Bar dataKey="income" fill={SAGE} radius={[2, 2, 0, 0]} maxBarSize={8} />
                <Bar dataKey="expense" fill={RUST} radius={[2, 2, 0, 0]} maxBarSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11.5, color: MUTED }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CategoryDot color={SAGE} /> Income</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CategoryDot color={RUST} /> Expense</span>
          </div>
        </div>
      )}

      {trend.length > 1 && (
        <div style={{ padding: "20px 0 10px", borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>Income vs expenses, last {trend.length} months</div>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={4}>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} axisLine={{ stroke: LINE }} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => fmtMoney(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${LINE}`, fontFamily: "system-ui, sans-serif" }}
                />
                <Bar dataKey="income" fill={SAGE} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="expense" fill={RUST} radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>
      {text}
    </div>
  );
}

// ---------- transactions (spreadsheet-like) ----------

function Transactions({ monthTx, onDelete, selectedMonth }) {
  const sorted = useMemo(
    () => [...monthTx].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [monthTx]
  );

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>
        {fmtMonthLabel(selectedMonth)} · {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
      </div>
      {sorted.length === 0 && <EmptyNote text="Nothing logged for this month." />}
      <div>
        {sorted.map((t) => {
          const cats = CATEGORIES[t.type];
          const color = cats.find((c) => c.name === t.category)?.color || MUTED;
          return (
            <div
              key={t.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 0", borderBottom: `1px solid ${LINE}`,
              }}
            >
              <CategoryDot color={color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.note || t.category}
                  </span>
                  {t.scope === "business" ? (
                    <Briefcase size={11} color={MUTED} strokeWidth={2} />
                  ) : (
                    <User size={11} color={MUTED} strokeWidth={2} />
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: MUTED }}>
                  {t.category} · {new Date(t.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: t.type === "income" ? SAGE : RUST, whiteSpace: "nowrap" }}>
                {t.type === "income" ? "+" : "-"}{fmtMoney(t.amount)}
              </div>
              <button
                onClick={() => onDelete(t.id)}
                aria-label="Delete"
                style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: MUTED, flexShrink: 0 }}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- budgets ----------

function Budgets({ categoryBreakdown, budgets, onSet }) {
  const spentByCat = useMemo(() => {
    const m = {};
    categoryBreakdown.forEach((c) => (m[c.name] = c.value));
    return m;
  }, [categoryBreakdown]);

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>
        Set a monthly limit per category. Bars show this month's spend.
      </div>
      {CATEGORIES.expense.map((cat) => {
        const limit = budgets[cat.name] || 0;
        const spent = spentByCat[cat.name] || 0;
        const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
        const over = limit > 0 && spent > limit;
        return (
          <div key={cat.name} style={{ padding: "12px 0", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <CategoryDot color={cat.color} />
                {cat.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, color: MUTED }}>₱</span>
                <input
                  type="number"
                  inputMode="decimal"
                  defaultValue={limit || ""}
                  placeholder="0"
                  onBlur={(e) => onSet(cat.name, Number(e.target.value) || 0)}
                  style={{
                    width: 64, border: "none", borderBottom: `1px solid ${LINE}`,
                    background: "transparent", fontSize: 13, textAlign: "right",
                    padding: "2px 0", color: INK, fontFamily: "system-ui, sans-serif",
                  }}
                />
              </div>
            </div>
            {limit > 0 && (
              <>
                <div style={{ height: 5, borderRadius: 3, background: PAPER_DIM, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: over ? RUST : GOLD, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 11.5, color: over ? RUST : MUTED, marginTop: 4 }}>
                  {fmtMoney(spent)} of {fmtMoney(limit)}{over ? " — over budget" : ""}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- tab bar ----------

function TabBar({ tab, setTab, onAdd }) {
  const tabs = [
    { key: "overview", label: "Overview", icon: Wallet },
    { key: "transactions", label: "Entries", icon: ChevronRight },
    { key: "budgets", label: "Budgets", icon: PiggyBank },
  ];
  return (
    <div style={{
      position: "sticky", bottom: 0, left: 0, right: 0,
      background: PAPER, borderTop: `1px solid ${LINE}`,
      display: "flex", alignItems: "center", padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
      maxWidth: 480, margin: "0 auto", width: "100%",
    }}>
      {tabs.slice(0, 2).map(({ key, label, icon: Icon }) => (
        <TabButton key={key} active={tab === key} label={label} icon={Icon} onClick={() => setTab(key)} />
      ))}
      <button
        onClick={onAdd}
        aria-label="Add transaction"
        style={{
          width: 46, height: 46, borderRadius: "50%", background: INK, color: PAPER,
          border: "none", display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 8px", cursor: "pointer", flexShrink: 0,
        }}
      >
        <Plus size={22} strokeWidth={2} />
      </button>
      {tabs.slice(2).map(({ key, label, icon: Icon }) => (
        <TabButton key={key} active={tab === key} label={label} icon={Icon} onClick={() => setTab(key)} />
      ))}
    </div>
  );
}

function TabButton({ active, label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        color: active ? INK : MUTED, padding: "4px 0",
      }}
    >
      <Icon size={19} strokeWidth={active ? 2 : 1.5} />
      <span style={{ fontSize: 10.5, fontFamily: "system-ui, sans-serif" }}>{label}</span>
    </button>
  );
}

// ---------- add sheet ----------

function AddSheet({ onClose, onAdd }) {
  const [type, setType] = useState("expense");
  const [scope, setScope] = useState("personal");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES.expense[0].name);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  useEffect(() => {
    setCategory(CATEGORIES[type][0].name);
  }, [type]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    onAdd({ type, scope, amount: amt, category, note: note.trim(), date: new Date(date).toISOString() });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(28,35,33,0.4)",
      display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PAPER, width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0",
          padding: "18px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 19, margin: 0 }}>New entry</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <SegRow>
          {["expense", "income"].map((v) => (
            <SegBtn key={v} active={type === v} onClick={() => setType(v)}>
              {v === "expense" ? "Expense" : "Income"}
            </SegBtn>
          ))}
        </SegRow>

        <div style={{ height: 10 }} />

        <SegRow>
          {["personal", "business"].map((v) => (
            <SegBtn key={v} active={scope === v} onClick={() => setScope(v)}>
              {v === "personal" ? "Personal" : "Business"}
            </SegBtn>
          ))}
        </SegRow>

        <Field label="Amount">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22, color: MUTED, fontFamily: "Georgia, serif" }}>₱</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
              style={{ ...inputBase, fontSize: 26, fontFamily: "Georgia, serif", border: "none", padding: "4px 0" }}
              autoFocus
            />
          </div>
        </Field>
        {error && <div style={{ color: RUST, fontSize: 12.5, marginTop: -8, marginBottom: 10 }}>{error}</div>}

        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectBase}>
            {CATEGORIES[type].map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Note (optional)">
          <input
            type="text"
            placeholder="What was this for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={inputBase}
          />
        </Field>

        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputBase} />
        </Field>

        <button
          onClick={submit}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: INK, color: PAPER, fontSize: 15, fontFamily: "system-ui, sans-serif",
            fontWeight: 500, marginTop: 8, cursor: "pointer",
          }}
        >
          Save entry
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function SegRow({ children }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}

function SegBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "9px 0", borderRadius: 10,
        border: `1px solid ${active ? INK : LINE}`,
        background: active ? INK : "transparent",
        color: active ? PAPER : INK,
        fontSize: 13.5, fontFamily: "system-ui, sans-serif", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const inputBase = {
  width: "100%", padding: "10px 0", border: "none", borderBottom: `1px solid ${LINE}`,
  background: "transparent", fontSize: 15, color: INK, fontFamily: "system-ui, sans-serif",
  outline: "none",
};

const selectBase = {
  ...inputBase,
  appearance: "none",
  WebkitAppearance: "none",
};
