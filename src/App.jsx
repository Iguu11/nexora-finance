import React, { useEffect, useMemo, useState } from 'react'
import LoginSupabase from './LoginSupabase'
import { signOut } from './authService'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Bot, Plus, Trash2, Target, CalendarDays, Search, AlertTriangle, CheckCircle2, Pencil, Download, Upload, Moon, Sun, Settings, Calculator, CreditCard, Save, X, User, LogOut, FileText, Bell, Repeat, MessageCircle, Database, ShieldCheck, Activity, BarChart3, LineChart, Sparkles, Users, Building2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart as ReLineChart, Line } from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { supabase } from './supabaseClient'

const THEME_KEY = 'nexora_finance_theme_v2'
const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
const percent = value => `${Number(value || 0).toFixed(1).replace('.', ',')}%`

const defaultData = {
  user: { name: '', email: '' },
  transactions: [],
  categories: ['Alimentação', 'Casa', 'Transporte', 'Lazer', 'Renda', 'Saúde', 'Educação', 'Dívidas', 'Assinaturas', 'Cartão', 'Investimentos', 'Outros'],
  budgets: {},
  goal: 0,
  saved: 0,
  monthlyLimit: 0,
  emergencyMonths: 6,
  patrimonyStart: 0,
  debt: { name: '', total: 0, monthlyPayment: 0 },
  smartRules: {
    Alimentação: ['ifood', 'mercado', 'supermercado', 'restaurante', 'lanche', 'açaí', 'pizza', 'padaria'],
    Transporte: ['uber', '99', 'ônibus', 'gasolina', 'combustível', 'posto', 'moto', 'corrida'],
    Lazer: ['netflix', 'spotify', 'cinema', 'jogo', 'steam', 'prime', 'disney', 'show'],
    Casa: ['aluguel', 'energia', 'água', 'internet', 'condomínio', 'casa', 'móveis'],
    Saúde: ['farmácia', 'remédio', 'consulta', 'médico', 'exame', 'dentista'],
    Educação: ['curso', 'faculdade', 'livro', 'escola', 'matrícula'],
    Renda: ['salário', 'pagamento', 'freela', 'comissão', 'pix recebido'],
    Dívidas: ['empréstimo', 'financiamento', 'parcela', 'dívida'],
    Cartão: ['cartão', 'fatura', 'nubank', 'inter', 'caixa']
  }
}

function safeParse(value, fallback) {
  try { return JSON.parse(value) || fallback } catch { return fallback }
}

function userStorageKey(auth) {
  return `nexora_finance_data_v3_${auth?.id || 'local'}`
}

function loadUserData(auth) {
  const newKey = userStorageKey(auth)
  const oldKey = 'nexora_finance_data_v2'

  const newData = safeParse(localStorage.getItem(newKey), null)

  if (newData) {
    return {
      ...defaultData,
      ...newData,
      user: {
        name: auth?.name || newData.user?.name || '',
        email: auth?.email || newData.user?.email || ''
      },
      smartRules: {
        ...defaultData.smartRules,
        ...(newData.smartRules || {})
      }
    }
  }

  const oldData = safeParse(localStorage.getItem(oldKey), null)

  if (oldData) {
    const migratedData = {
      ...defaultData,
      ...oldData,
      user: {
        name: auth?.name || oldData.user?.name || '',
        email: auth?.email || oldData.user?.email || ''
      },
      smartRules: {
        ...defaultData.smartRules,
        ...(oldData.smartRules || {})
      }
    }

    localStorage.setItem(newKey, JSON.stringify(migratedData))
    localStorage.setItem(`${oldKey}_migrated_backup`, JSON.stringify(oldData))

    return migratedData
  }

  return {
    ...defaultData,
    user: {
      name: auth?.name || '',
      email: auth?.email || ''
    }
  }
}

function saveFile(name, content, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function monthOffset(month, offset) {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(year, m - 1 + offset, 1)
  return d.toISOString().slice(0, 7)
}

function monthLabel(month) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function categorySuggestion(title, rules) {
  const text = String(title || '').toLowerCase()
  for (const [category, words] of Object.entries(rules || {})) {
    if ((words || []).some(word => text.includes(String(word).toLowerCase()))) return category
  }
  return 'Outros'
}

export default function App() {
  const [auth, setAuth] = useState(null)
  const [data, setData] = useState(defaultData)
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'dark')
  const [tab, setTab] = useState('dashboard')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [loadingSession, setLoadingSession] = useState(true)

  const emptyForm = { id: null, title: '', amount: '', type: 'expense', category: 'Alimentação', date: today(), fixed: false, recurring: false, dueDay: '', paid: true }
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [newCategory, setNewCategory] = useState('')
  const [ruleCategory, setRuleCategory] = useState('Alimentação')
  const [newRuleWord, setNewRuleWord] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chat, setChat] = useState([{ role: 'agent', text: 'Olá! Eu sou o Agent Nexora. Pergunte sobre saúde financeira, previsão do mês, maior gasto, economia, meta ou comparativo mensal.' }])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (user) {
        const profile = { id: user.id, email: user.email, name: user.user_metadata?.name || user.email }
        setAuth(profile)
        setData(loadUserData(profile))
      }
      setLoadingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      if (user) {
        const profile = { id: user.id, email: user.email, name: user.user_metadata?.name || user.email }
        setAuth(profile)
        setData(loadUserData(profile))
      } else {
        setAuth(null)
        setData(defaultData)
      }
      setLoadingSession(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => localStorage.setItem(THEME_KEY, theme), [theme])
  useEffect(() => {
    if (auth) localStorage.setItem(userStorageKey(auth), JSON.stringify(data))
  }, [data, auth])

  const monthTransactions = useMemo(() => data.transactions.filter(t => String(t.date).slice(0, 7) === selectedMonth), [data.transactions, selectedMonth])
  const prevMonthTransactions = useMemo(() => data.transactions.filter(t => String(t.date).slice(0, 7) === monthOffset(selectedMonth, -1)), [data.transactions, selectedMonth])

  function calcStats(list) {
    const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = list.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const balance = income - expenses
    const fixedExpenses = list.filter(t => t.type === 'expense' && t.fixed).reduce((s, t) => s + Number(t.amount), 0)
    const variableExpenses = expenses - fixedExpenses
    const byCategory = list.filter(t => t.type === 'expense').reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc }, {})
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    return { income, expenses, balance, fixedExpenses, variableExpenses, byCategory, topCategory }
  }

  const stats = useMemo(() => {
    const base = calcStats(monthTransactions)
    const limitUsed = data.monthlyLimit > 0 ? Math.round((base.expenses / data.monthlyLimit) * 100) : 0
    const emergencyGoal = base.fixedExpenses * Number(data.emergencyMonths || 6)
    const debtMonths = data.debt.monthlyPayment > 0 ? Math.ceil(data.debt.total / data.debt.monthlyPayment) : 0
    const daysInMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()
    const currentDay = selectedMonth === currentMonth() ? new Date().getDate() : daysInMonth
    const remainingDays = Math.max(1, daysInMonth - currentDay + 1)
    const dailySafe = Math.max(0, base.balance / remainingDays)
    const projectedExpenses = selectedMonth === currentMonth() ? (base.expenses / Math.max(1, currentDay)) * daysInMonth : base.expenses
    const projectedBalance = base.income - projectedExpenses
    const savingsRate = base.income > 0 ? (base.balance / base.income) * 100 : 0
    const debtRatio = base.income > 0 ? (Number(data.debt.monthlyPayment || 0) / base.income) * 100 : 0
    const emergencyRate = emergencyGoal > 0 ? (Number(data.saved || 0) / emergencyGoal) * 100 : 0
    const limitScore = data.monthlyLimit > 0 ? Math.max(0, 100 - Math.max(0, limitUsed - 70) * 2) : 70
    const healthScore = Math.max(0, Math.min(100, Math.round(
      40 + Math.min(25, Math.max(-20, savingsRate)) + Math.min(20, emergencyRate / 5) - Math.min(25, debtRatio) + (base.balance >= 0 ? 10 : -20) + (limitScore - 70) / 4
    )))
    return { ...base, limitUsed, emergencyGoal, debtMonths, dailySafe, projectedExpenses, projectedBalance, savingsRate, debtRatio, emergencyRate, healthScore }
  }, [monthTransactions, data, selectedMonth])

  const prevStats = useMemo(() => calcStats(prevMonthTransactions), [prevMonthTransactions])
  const filteredTransactions = useMemo(() => monthTransactions.filter(t => (`${t.title} ${t.category}`).toLowerCase().includes(search.toLowerCase()) && (filterType === 'all' || t.type === filterType)), [monthTransactions, search, filterType])
  const categoryChart = Object.entries(stats.byCategory).map(([name, value]) => ({ name, value }))
  const monthlyChart = useMemo(() => Object.values(data.transactions.reduce((acc, t) => { const m = String(t.date).slice(0, 7); acc[m] ||= { month: m, receitas: 0, despesas: 0, saldo: 0 }; acc[m][t.type === 'income' ? 'receitas' : 'despesas'] += Number(t.amount); acc[m].saldo = acc[m].receitas - acc[m].despesas; return acc }, {})).sort((a, b) => a.month.localeCompare(b.month)), [data.transactions])
  const patrimonyChart = useMemo(() => {
    let patrimony = Number(data.patrimonyStart || 0)
    return monthlyChart.map(m => { patrimony += Number(m.saldo || 0); return { month: m.month, patrimonio: patrimony } })
  }, [monthlyChart, data.patrimonyStart])

  const alerts = useMemo(() => monthTransactions.filter(t => t.type === 'expense' && !t.paid && t.dueDay).map(t => {
    const due = new Date(`${selectedMonth}-${String(t.dueDay).padStart(2, '0')}T12:00:00`)
    const diff = Math.ceil((due - new Date()) / 86400000)
    return { ...t, diff }
  }).filter(t => t.diff <= 7), [monthTransactions, selectedMonth])

  const advice = useMemo(() => getAdvice(stats, prevStats, data, alerts, monthTransactions.length), [stats, prevStats, data, alerts, monthTransactions.length])

  async function logout() {
    await signOut()
    setAuth(null)
  }

  function saveTransaction() {
    const parsed = Number(String(form.amount).replace(',', '.'))
    if (!form.title.trim() || !parsed || parsed <= 0) return alert('Preencha nome e valor corretamente.')
    const smartCategory = form.category || categorySuggestion(form.title, data.smartRules)
    const item = { ...form, category: smartCategory, amount: parsed, dueDay: form.dueDay ? Number(form.dueDay) : '', id: form.id || Date.now() }
    setData(p => ({ ...p, transactions: form.id ? p.transactions.map(t => t.id === form.id ? item : t) : [item, ...p.transactions] }))
    setForm(emptyForm)
  }
  function editTransaction(t) { setForm(t); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function removeTransaction(id) { if (confirm('Excluir essa movimentação?')) setData(p => ({ ...p, transactions: p.transactions.filter(t => t.id !== id) })) }
  function togglePaid(id) { setData(p => ({ ...p, transactions: p.transactions.map(t => t.id === id ? { ...t, paid: !t.paid } : t) })) }

  function generateRecurring() {
    const existingKeys = new Set(data.transactions.map(t => `${t.title}-${t.category}-${String(t.date).slice(0, 7)}`))
    const bases = data.transactions.filter(t => t.recurring)
    const created = bases.map(t => ({ ...t, id: Date.now() + Math.random(), date: `${selectedMonth}-${String(t.dueDay || 1).padStart(2, '0')}`, paid: false })).filter(t => !existingKeys.has(`${t.title}-${t.category}-${selectedMonth}`))
    if (!created.length) return alert('Não há recorrências novas para gerar nesse mês.')
    setData(p => ({ ...p, transactions: [...created, ...p.transactions] }))
  }

  function addCategory() { const c = newCategory.trim(); if (!c) return; if (data.categories.includes(c)) return alert('Categoria já existe.'); setData(p => ({ ...p, categories: [...p.categories, c] })); setNewCategory('') }
  function deleteCategory(cat) { if (['Renda', 'Outros'].includes(cat)) return alert('Essa categoria é base do sistema.'); if (!confirm(`Excluir categoria ${cat}? Movimentações dela irão para Outros.`)) return; setData(p => ({ ...p, categories: p.categories.filter(c => c !== cat), transactions: p.transactions.map(t => t.category === cat ? { ...t, category: 'Outros' } : t) })) }
  function setBudget(cat, value) { setData(p => ({ ...p, budgets: { ...p.budgets, [cat]: Number(value || 0) } })) }
  function addSmartRule() { const word = newRuleWord.trim().toLowerCase(); if (!word) return; setData(p => ({ ...p, smartRules: { ...p.smartRules, [ruleCategory]: [...new Set([...(p.smartRules?.[ruleCategory] || []), word])] } })); setNewRuleWord('') }
  function removeSmartRule(category, word) { setData(p => ({ ...p, smartRules: { ...p.smartRules, [category]: (p.smartRules?.[category] || []).filter(w => w !== word) } })) }

  function answerAgent(question) {
    const q = question.toLowerCase()
    if (q.includes('saúde') || q.includes('nota')) return `Sua saúde financeira está em ${stats.healthScore}/100. ${stats.healthScore >= 75 ? 'Você está em zona saudável.' : stats.healthScore >= 50 ? 'Você está em atenção, vale reduzir gastos variáveis.' : 'Situação crítica: priorize cortar despesas e evitar novas dívidas.'}`
    if (q.includes('comparativo') || q.includes('mês anterior')) return `Comparativo: receitas ${variationText(stats.income, prevStats.income)}, despesas ${variationText(stats.expenses, prevStats.expenses)} e saldo ${variationText(stats.balance, prevStats.balance)} em relação ao mês anterior.`
    if (q.includes('previs')) return `A previsão de saldo do mês é ${money(stats.projectedBalance)} considerando o ritmo atual de gastos.`
    if (q.includes('patrim')) return `Seu patrimônio estimado está em ${money(patrimonyChart.at(-1)?.patrimonio || data.patrimonyStart || 0)}.`
    if (q.includes('gastar') || q.includes('hoje')) return `Para não se apertar, hoje você poderia gastar até ${money(stats.dailySafe)} considerando o saldo do mês e os dias restantes.`
    if (q.includes('maior') || q.includes('gasto')) return stats.topCategory ? `Seu maior gasto no mês é ${stats.topCategory[0]} com ${money(stats.topCategory[1])}.` : 'Ainda não há despesas neste mês.'
    if (q.includes('economizar')) return `Comece reduzindo ${stats.topCategory?.[0] || 'gastos variáveis'} e tente guardar pelo menos ${money(Math.max(50, stats.balance * 0.2))}.`
    if (q.includes('limite')) return `Você usou ${stats.limitUsed}% do limite mensal de ${money(data.monthlyLimit)}.`
    if (q.includes('meta')) return data.saved >= data.goal ? 'Sua meta principal já foi batida. Parabéns!' : `Faltam ${money(data.goal - data.saved)} para bater sua meta.`
    if (q.includes('conta') || q.includes('venc')) return alerts.length ? `Você tem ${alerts.length} conta(s) vencendo ou vencida(s). Veja a aba Alertas.` : 'Não encontrei contas próximas do vencimento.'
    return `Resumo inteligente: receitas ${money(stats.income)}, despesas ${money(stats.expenses)}, saldo ${money(stats.balance)}, saúde financeira ${stats.healthScore}/100 e previsão de saldo ${money(stats.projectedBalance)}.`
  }
  function sendChat() { if (!chatInput.trim()) return; const a = answerAgent(chatInput); setChat(p => [...p, { role: 'user', text: chatInput }, { role: 'agent', text: a }]); setChatInput('') }

  function reportFileName(extension) { return `nexora-finance-relatorio-${selectedMonth}.${extension}` }
  function reportRows() { return monthTransactions.map(t => ({ Data: new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR'), Tipo: t.type === 'income' ? 'Receita' : 'Despesa', Descricao: t.title, Categoria: t.category, Status: t.paid ? 'Pago' : 'Aberto', Fixa: t.fixed ? 'Sim' : 'Não', Recorrente: t.recurring ? 'Sim' : 'Não', Valor: Number(t.amount) })) }

  function exportExcel() {
    const wb = XLSX.utils.book_new()
    const owner = data.user?.name || auth?.name || 'Usuário'
    const summary = [['NEXORA FINANCE'], ['Relatório Executivo Financeiro'], [], ['Responsável', owner], ['E-mail', data.user?.email || auth?.email || 'Não informado'], ['Competência', selectedMonth], ['Gerado em', new Date().toLocaleString('pt-BR')], [], ['Indicador', 'Valor'], ['Nota de saúde financeira', stats.healthScore], ['Receitas', stats.income], ['Despesas', stats.expenses], ['Saldo', stats.balance], ['Previsão de saldo', stats.projectedBalance], ['Taxa de poupança', `${stats.savingsRate.toFixed(1)}%`], ['Limite utilizado (%)', `${stats.limitUsed}%`], ['Meta financeira', data.goal], ['Valor guardado', data.saved], ['Patrimônio estimado', patrimonyChart.at(-1)?.patrimonio || data.patrimonyStart || 0]]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Resumo Executivo')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportRows().length ? reportRows() : [{ Aviso: 'Nenhuma movimentação no mês.' }]), 'Movimentações')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(stats.byCategory).map(([Categoria, Valor]) => ({ Categoria, Gasto: Valor, Orçamento: data.budgets?.[Categoria] || 0 }))), 'Categorias')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(advice.map((a, i) => ({ Nº: i + 1, Nivel: a[0], Analise: a[1] }))), 'Agent Insights')
    XLSX.writeFile(wb, reportFileName('xlsx'))
  }

  function exportBackup() {
    const backup = { app: 'Nexora Finance', version: '3.0-option-b', createdAt: new Date().toISOString(), user: auth, data }
    saveFile(`backup-nexora-finance-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json')
  }
  function importBackup(e) {
    const file = e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result)
        exportBackup()
        setData({ ...defaultData, ...(parsed.data || parsed), smartRules: { ...defaultData.smartRules, ...((parsed.data || parsed).smartRules || {}) } })
        alert('Backup restaurado! Um backup automático do estado anterior foi baixado antes da restauração.')
      } catch { alert('Arquivo inválido.') }
    }
    r.readAsText(file)
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 18
    doc.setFillColor(2, 6, 23); doc.rect(0, 0, pageWidth, 30, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text('NEXORA FINANCE', 14, 13)
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text('Relatório mensal automático e diagnóstico inteligente', 14, 22)
    doc.setTextColor(15, 23, 42); y = 42
    const lines = [
      `Responsável: ${data.user?.name || auth?.name || 'Usuário'}`,
      `Competência: ${selectedMonth}`,
      `Nota de saúde financeira: ${stats.healthScore}/100`,
      `Receitas: ${money(stats.income)} | Despesas: ${money(stats.expenses)} | Saldo: ${money(stats.balance)}`,
      `Previsão de saldo no fechamento: ${money(stats.projectedBalance)}`,
      `Comparativo com mês anterior: receitas ${variationText(stats.income, prevStats.income)}, despesas ${variationText(stats.expenses, prevStats.expenses)}, saldo ${variationText(stats.balance, prevStats.balance)}.`
    ]
    doc.setFontSize(10); lines.forEach(line => { doc.text(line, 14, y); y += 7 })
    y += 4; doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text('Análises do Agent', 14, y); y += 8; doc.setFont(undefined, 'normal'); doc.setFontSize(9)
    advice.forEach((a, i) => doc.splitTextToSize(`${i + 1}. ${a[1]}`, pageWidth - 28).forEach(part => { if (y > 280) { doc.addPage(); y = 18 } doc.text(part, 14, y); y += 5 }))
    y += 5; doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text('Movimentações do mês', 14, y); y += 8; doc.setFont(undefined, 'normal'); doc.setFontSize(8)
    reportRows().slice(0, 26).forEach(r => { if (y > 280) { doc.addPage(); y = 18 } doc.text(`${r.Data} • ${r.Tipo} • ${r.Descricao.slice(0, 28)} • ${r.Categoria} • ${money(r.Valor)}`, 14, y); y += 5 })
    doc.save(reportFileName('pdf'))
  }

  if (loadingSession) return <div className={`app login ${theme}`}><section className="loginCard"><div className="logo big">NX</div><h1>Carregando...</h1><p>Preparando seu painel financeiro.</p></section></div>
  if (!auth) return <LoginSupabase theme={theme} setTheme={setTheme} onLogin={user => { setAuth(user); setData(loadUserData(user)) }} />

  return <div className={`app ${theme}`}>
    <header className="topbar">
      <div className="brand"><div className="logo">NX</div><div><h1>Nexora Finance</h1><p>Agent financeiro completo • {auth.name}</p></div></div>
      <div className="topActions"><button className="iconBtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun/> : <Moon/>}</button><button className="iconBtn ghost" onClick={logout}><LogOut/></button></div>
    </header>

    <nav className="tabs">{[
      ['dashboard','Dashboard'],['mov','Movimentações'],['budget','Orçamentos'],['chat','Agent Chat'],['alerts','Alertas'],['tools','Ferramentas'],['admin','Admin'],['settings','Configurações']
    ].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? 'active' : ''}>{label}</button>)}</nav>

    <main className="single">
      <div className="monthBar"><label>Mês/Ano</label><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} /><button className="primary" onClick={generateRecurring}><Repeat size={17}/> Gerar fixas do mês</button></div>
      {tab === 'dashboard' && <Dashboard stats={stats} prevStats={prevStats} data={data} advice={advice} categoryChart={categoryChart} monthlyChart={monthlyChart} patrimonyChart={patrimonyChart} alerts={alerts} selectedMonth={selectedMonth} />}
      {tab === 'mov' && <Movements data={data} form={form} setForm={setForm} emptyForm={emptyForm} saveTransaction={saveTransaction} editTransaction={editTransaction} removeTransaction={removeTransaction} togglePaid={togglePaid} filteredTransactions={filteredTransactions} search={search} setSearch={setSearch} filterType={filterType} setFilterType={setFilterType} suggest={title => categorySuggestion(title, data.smartRules)} />}
      {tab === 'budget' && <Budgets data={data} stats={stats} setBudget={setBudget} />}
      {tab === 'chat' && <AgentChat chat={chat} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} />}
      {tab === 'alerts' && <Alerts alerts={alerts} togglePaid={togglePaid} />}
      {tab === 'tools' && <Tools data={data} setData={setData} stats={stats} exportExcel={exportExcel} exportBackup={exportBackup} importBackup={importBackup} exportPDF={exportPDF} />}
      {tab === 'admin' && <AdminPanel auth={auth} data={data} stats={stats} monthlyChart={monthlyChart} />}
      {tab === 'settings' && <SettingsPanel data={data} setData={setData} newCategory={newCategory} setNewCategory={setNewCategory} addCategory={addCategory} deleteCategory={deleteCategory} ruleCategory={ruleCategory} setRuleCategory={setRuleCategory} newRuleWord={newRuleWord} setNewRuleWord={setNewRuleWord} addSmartRule={addSmartRule} removeSmartRule={removeSmartRule} />}
    </main>
  </div>
}

function getAdvice(stats, prevStats, data, alerts, count) {
  const tips = []
  if (!count) tips.push(['info', 'Comece cadastrando sua primeira receita e despesa para o Agent gerar diagnósticos reais.'])
  tips.push([stats.healthScore >= 75 ? 'success' : stats.healthScore >= 50 ? 'warning' : 'danger', `Saúde financeira: ${stats.healthScore}/100. ${stats.healthScore >= 75 ? 'Cenário saudável.' : stats.healthScore >= 50 ? 'Atenção aos gastos variáveis.' : 'Priorize reduzir despesas e dívidas.'}`])
  if (stats.projectedBalance < 0) tips.push(['danger', `Previsão de fechamento negativa em ${money(Math.abs(stats.projectedBalance))}.`])
  if (stats.topCategory) tips.push(['info', `Maior gasto do mês: ${stats.topCategory[0]} com ${money(stats.topCategory[1])}.`])
  if (prevStats.expenses && stats.expenses > prevStats.expenses) tips.push(['warning', `Despesas subiram ${variationText(stats.expenses, prevStats.expenses)} frente ao mês anterior.`])
  if (stats.savingsRate >= 20) tips.push(['success', `Taxa de poupança forte: ${percent(stats.savingsRate)} da renda.`])
  if (stats.limitUsed >= 90) tips.push(['danger', `Você já usou ${stats.limitUsed}% do limite mensal.`])
  if (data.saved < data.goal) tips.push(['info', `Faltam ${money(data.goal - data.saved)} para sua meta principal.`])
  if (alerts.length) tips.push(['warning', `Você tem ${alerts.length} conta(s) para vencer ou vencida(s).`])
  return tips
}
function variation(current, previous) { if (!previous) return current ? 100 : 0; return ((current - previous) / Math.abs(previous)) * 100 }
function variationText(current, previous) { const v = variation(current, previous); const arrow = v > 0 ? '↑' : v < 0 ? '↓' : '→'; return `${arrow} ${percent(Math.abs(v))}` }
function healthLabel(score) { return score >= 75 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico' }
function Dashboard({ stats, prevStats, data, advice, categoryChart, monthlyChart, patrimonyChart, alerts }) { return <div className="gridMain"><section className="content"><div className="heroPanel"><div><span className="eyebrow">Nexora Intelligence</span><h2>Seu centro financeiro inteligente</h2><p>Diagnóstico, previsão e evolução patrimonial em uma única tela.</p></div><div className={`scoreCircle ${stats.healthScore >= 75 ? 'ok' : stats.healthScore >= 50 ? 'warn' : 'bad'}`}><strong>{stats.healthScore}</strong><span>{healthLabel(stats.healthScore)}</span></div></div><div className="cards four"><Stat icon={<TrendingUp/>} label="Receitas" value={money(stats.income)}/><Stat icon={<TrendingDown/>} label="Despesas" value={money(stats.expenses)} danger/><Stat icon={<Wallet/>} label="Saldo" value={money(stats.balance)}/><Stat icon={<Activity/>} label="Previsão" value={money(stats.projectedBalance)}/></div><HealthPanel stats={stats}/><ComparisonPanel stats={stats} prevStats={prevStats}/><div className="gridTwo"><ChartPanel title="Gastos por categoria" data={categoryChart}/><MonthlyPanel data={monthlyChart}/></div><PatrimonyPanel data={patrimonyChart}/></section><aside className="sidebar"><Panel title="Análise do Agent" icon={<Bot/>}>{advice.map((a,i)=><Tip key={i} type={a[0]} text={a[1]}/>)}</Panel><Panel title="Meta" icon={<Target/>}><Progress value={data.goal > 0 ? Math.min(100, Math.round((data.saved / data.goal) * 100)) : 0}/><p>{money(data.saved)} de {money(data.goal)}</p></Panel><Panel title="Alertas rápidos" icon={<Bell/>}><p>{alerts.length ? `${alerts.length} conta(s) próximas do vencimento.` : 'Nenhuma conta próxima vencendo.'}</p></Panel></aside></div> }
function HealthPanel({ stats }) { return <Panel title="Dashboard de saúde financeira" icon={<ShieldCheck/>}><div className="cards four"><Stat icon={<Activity/>} label="Nota" value={`${stats.healthScore}/100`}/><Stat icon={<PiggyBank/>} label="Poupança" value={percent(stats.savingsRate)}/><Stat icon={<CreditCard/>} label="Dívida/Renda" value={percent(stats.debtRatio)} danger={stats.debtRatio>30}/><Stat icon={<Calculator/>} label="Limite usado" value={`${stats.limitUsed}%`} danger={stats.limitUsed>90}/></div></Panel> }
function ComparisonPanel({ stats, prevStats }) { return <Panel title="Mês atual x mês anterior" icon={<BarChart3/>}><div className="cards four"><Stat icon={<TrendingUp/>} label="Receitas" value={variationText(stats.income, prevStats.income)}/><Stat icon={<TrendingDown/>} label="Despesas" value={variationText(stats.expenses, prevStats.expenses)} danger={stats.expenses>prevStats.expenses}/><Stat icon={<Wallet/>} label="Saldo" value={variationText(stats.balance, prevStats.balance)}/><Stat icon={<Sparkles/>} label="Previsão" value={money(stats.projectedBalance)}/></div></Panel> }
function PatrimonyPanel({ data }) { return <Panel title="Evolução patrimonial" icon={<LineChart/>}>{data.length?<ResponsiveContainer width="100%" height={260}><ReLineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tickFormatter={monthLabel}/><YAxis/><Tooltip formatter={money}/><Line type="monotone" dataKey="patrimonio" stroke="#60a5fa" strokeWidth={3}/></ReLineChart></ResponsiveContainer>:<p>Cadastre movimentações para acompanhar sua evolução patrimonial.</p>}</Panel> }
function Movements(p){ const {data,form,setForm,emptyForm,saveTransaction,editTransaction,removeTransaction,togglePaid,filteredTransactions,search,setSearch,filterType,setFilterType,suggest}=p; return <div className="gridMain"><section className="content"><Panel title={form.id?'Editar movimentação':'Nova movimentação'} icon={<Plus/>}><div className="formGrid"><input placeholder="Nome" value={form.title} onChange={e=>{ const title=e.target.value; setForm({...form,title,category:suggest(title)}) }}/><input placeholder="Valor" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="expense">Despesa</option><option value="income">Receita</option></select><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{data.categories.map(c=><option key={c}>{c}</option>)}</select><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/><input placeholder="Venc." type="number" min="1" max="31" value={form.dueDay} onChange={e=>setForm({...form,dueDay:e.target.value})}/><button className="primary" onClick={saveTransaction}><Save size={17}/>Salvar</button></div><div className="checks"><label><input type="checkbox" checked={form.fixed} onChange={e=>setForm({...form,fixed:e.target.checked})}/> Fixa</label><label><input type="checkbox" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})}/> Recorrente</label><label><input type="checkbox" checked={form.paid} onChange={e=>setForm({...form,paid:e.target.checked})}/> Pago</label>{form.id&&<button className="linkBtn" onClick={()=>setForm(emptyForm)}><X size={16}/>Cancelar edição</button>}<span className="badge"><Sparkles/> Categoria inteligente: {form.category}</span></div></Panel><Panel title="Buscar e filtrar" icon={<Search/>}><div className="filterGrid"><input placeholder="Buscar por nome/categoria" value={search} onChange={e=>setSearch(e.target.value)}/><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></div></Panel><Panel title="Movimentações do mês" icon={<CalendarDays/>}><div className="list">{filteredTransactions.map(t=><Transaction key={t.id} t={t} editTransaction={editTransaction} removeTransaction={removeTransaction} togglePaid={togglePaid}/>)}</div></Panel></section></div> }
function Budgets({ data, stats, setBudget }) { return <Panel title="Orçamento por categoria" icon={<Calculator/>}><div className="budgetList">{data.categories.filter(c=>c!=='Renda').map(cat=>{ const used=stats.byCategory[cat]||0; const limit=data.budgets[cat]||0; return <div className="budget" key={cat}><div><b>{cat}</b><p>Usado: {money(used)}</p></div><input type="number" value={limit} onChange={e=>setBudget(cat,e.target.value)}/><Progress value={limit?Math.min(100,Math.round((used/limit)*100)):0} danger={limit&&used>limit}/></div>})}</div></Panel> }
function AgentChat({ chat, chatInput, setChatInput, sendChat }) { return <Panel title="Agent financeiro inteligente" icon={<MessageCircle/>}><div className="chatBox">{chat.map((m,i)=><div key={i} className={`msg ${m.role}`}>{m.text}</div>)}</div><div className="chatInput"><input placeholder="Ex: qual minha saúde financeira?" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}/><button className="primary" onClick={sendChat}>Enviar</button></div></Panel> }
function Alerts({ alerts, togglePaid }) { return <Panel title="Alertas de vencimento" icon={<Bell/>}>{alerts.length===0?<p>Nenhuma conta vencendo nos próximos 7 dias.</p>:<div className="list">{alerts.map(a=><div className="item" key={a.id}><div><b>{a.title}</b><p>{a.diff<0?`Vencida há ${Math.abs(a.diff)} dia(s)`:a.diff===0?'Vence hoje':`Vence em ${a.diff} dia(s)`} • {money(a.amount)}</p></div><button className="primary" onClick={()=>togglePaid(a.id)}>Marcar pago</button></div>)}</div>}</Panel> }
function Tools({ data, setData, stats, exportExcel, exportBackup, importBackup, exportPDF }) { return <div className="gridTwo"><Panel title="Relatório mensal automático" icon={<FileText/>}><div className="stack"><button className="primary" onClick={exportPDF}><FileText size={17}/> Gerar PDF inteligente</button><button className="primary" onClick={exportExcel}><Download size={17}/> Exportar Excel executivo</button><button className="primary" onClick={exportBackup}><Download size={17}/> Backup completo</button><label className="upload"><Upload size={17}/> Restaurar backup<input type="file" accept="application/json" onChange={importBackup}/></label></div><p>O relatório já inclui saúde financeira, previsão, comparativo mensal e insights do Agent.</p></Panel><Panel title="Reserva, patrimônio e dívidas" icon={<CreditCard/>}><label>Patrimônio inicial</label><input type="number" value={data.patrimonyStart} onChange={e=>setData(p=>({...p,patrimonyStart:Number(e.target.value)}))}/><label>Meses de reserva</label><input type="number" value={data.emergencyMonths} onChange={e=>setData(p=>({...p,emergencyMonths:Number(e.target.value)}))}/><p className="result">Reserva ideal: {money(stats.emergencyGoal)}</p><label>Nome da dívida</label><input value={data.debt.name} onChange={e=>setData(p=>({...p,debt:{...p.debt,name:e.target.value}}))}/><label>Total da dívida</label><input type="number" value={data.debt.total} onChange={e=>setData(p=>({...p,debt:{...p.debt,total:Number(e.target.value)}}))}/><label>Pagamento mensal</label><input type="number" value={data.debt.monthlyPayment} onChange={e=>setData(p=>({...p,debt:{...p.debt,monthlyPayment:Number(e.target.value)}}))}/><p className="result">Quitação em: {stats.debtMonths} mês(es)</p></Panel></div> }
function AdminPanel({ auth, data, stats, monthlyChart }) { const totalMov = data.transactions.length; const totalIncome = data.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0); const totalExpense = data.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0); const categoryRank = Object.entries(data.transactions.filter(t=>t.type==='expense').reduce((a,t)=>{a[t.category]=(a[t.category]||0)+Number(t.amount);return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,6); return <div className="gridMain"><section className="content"><Panel title="Painel administrativo" icon={<Users/>}><div className="cards four"><Stat icon={<User/>} label="Usuário ativo" value={auth.email}/><Stat icon={<Database/>} label="Movimentações" value={totalMov}/><Stat icon={<TrendingUp/>} label="Receita total" value={money(totalIncome)}/><Stat icon={<TrendingDown/>} label="Despesa total" value={money(totalExpense)} danger/></div></Panel><Panel title="Ranking de categorias" icon={<BarChart3/>}>{categoryRank.length?<div className="list">{categoryRank.map(([cat,val])=><div className="item" key={cat}><b>{cat}</b><strong>{money(val)}</strong></div>)}</div>:<p>Sem despesas cadastradas.</p>}</Panel></section><aside className="sidebar"><Panel title="Gestão e observação" icon={<Building2/>}><p>Este painel mostra estatísticas administrativas do usuário logado. Para gerenciar todos os usuários do sistema, é necessário criar uma tabela administrativa própria no Supabase com permissões de administrador.</p><div className="badge"><ShieldCheck/> Sem expor chaves secretas no frontend</div></Panel><Panel title="Meses registrados" icon={<CalendarDays/>}><p>{monthlyChart.length} competência(s) com movimentações.</p><p>Saúde atual: {stats.healthScore}/100</p></Panel></aside></div> }
function SettingsPanel({ data, setData, newCategory, setNewCategory, addCategory, deleteCategory, ruleCategory, setRuleCategory, newRuleWord, setNewRuleWord, addSmartRule, removeSmartRule }) { return <div className="gridTwo"><Panel title="Categorias" icon={<Settings/>}><div className="filterGrid"><input placeholder="Nova categoria" value={newCategory} onChange={e=>setNewCategory(e.target.value)}/><button className="primary" onClick={addCategory}><Plus size={17}/>Adicionar</button></div><div className="chips">{data.categories.map(c=><span key={c}>{c}<button onClick={()=>deleteCategory(c)}>×</button></span>)}</div></Panel><Panel title="Categorias inteligentes" icon={<Sparkles/>}><div className="filterGrid"><select value={ruleCategory} onChange={e=>setRuleCategory(e.target.value)}>{data.categories.map(c=><option key={c}>{c}</option>)}</select><input placeholder="Palavra-chave ex: netflix" value={newRuleWord} onChange={e=>setNewRuleWord(e.target.value)}/></div><button className="primary" onClick={addSmartRule}><Plus size={17}/>Adicionar regra</button><div className="chips">{(data.smartRules?.[ruleCategory] || []).map(w=><span key={w}>{w}<button onClick={()=>removeSmartRule(ruleCategory,w)}>×</button></span>)}</div></Panel></div> }
function Stat({ icon, label, value, danger }) { return <div className="stat"><div className={`statIcon ${danger?'dangerBg':''}`}>{icon}</div><p>{label}</p><h3>{value}</h3></div> }
function Panel({ title, icon, children }) { return <section className="panel"><h2>{icon}{title}</h2>{children}</section> }
function Tip({ type, text }) { const icons={danger:<AlertTriangle/>,warning:<AlertTriangle/>,success:<CheckCircle2/>,info:<Pencil/>}; return <div className={`tip ${type}`}>{icons[type]||icons.info}<span>{text}</span></div> }
function Progress({ value, danger }) { return <div className="progress"><div className={`bar ${danger?'redbar':''}`} style={{width:`${value||0}%`}} /></div> }
function ChartPanel({ title, data }) { return <Panel title={title} icon={<Wallet/>}>{data.length?<ResponsiveContainer width="100%" height={260}><PieChart><Pie dataKey="value" data={data} outerRadius={90} label>{data.map((_,i)=><Cell key={i} fill={['#2563eb','#22c55e','#f97316','#ef4444','#a855f7','#14b8a6'][i%6]}/>)}</Pie><Tooltip formatter={money}/></PieChart></ResponsiveContainer>:<p>Sem dados.</p>}</Panel> }
function MonthlyPanel({ data }) { return <Panel title="Receitas x despesas" icon={<TrendingUp/>}><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tickFormatter={monthLabel}/><YAxis/><Tooltip formatter={money}/><Bar dataKey="receitas" fill="#22c55e"/><Bar dataKey="despesas" fill="#ef4444"/></BarChart></ResponsiveContainer></Panel> }
function Transaction({ t, editTransaction, removeTransaction, togglePaid }) { return <div className="item"><div><b>{t.title}</b>{t.fixed&&<span className="tag">fixa</span>}{t.recurring&&<span className="tag">recorrente</span>}<p>{t.category} • {new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR')} • {t.paid?'Pago':'Aberto'}</p></div><div className="right"><strong className={t.type==='income'?'green':'red'}>{t.type==='income'?'+':'-'}{money(t.amount)}</strong><button onClick={()=>togglePaid(t.id)}><CheckCircle2/></button><button onClick={()=>editTransaction(t)}><Pencil/></button><button onClick={()=>removeTransaction(t.id)}><Trash2/></button></div></div> }
