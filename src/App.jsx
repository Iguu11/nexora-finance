import React, { useEffect, useMemo, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Bot, Plus, Trash2, Target, CalendarDays, Search, AlertTriangle, CheckCircle2, Pencil, Download, Upload, Moon, Sun, Settings, Calculator, CreditCard, RotateCcw, Save, X, User, LogOut, FileText, Bell, Repeat, MessageCircle, Database, ShieldCheck } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'

// =====================================================
// NEXORA FINANCE V2 - AGENTE FINANCEIRO WEB APP
// =====================================================
// Arquivo principal do sistema. Está bem comentado para você conseguir
// alterar textos, cores, regras do agente e funcionalidades depois.

const STORAGE_KEY = 'nexora_finance_data_v2'
const AUTH_KEY = 'nexora_finance_auth_v2'
const THEME_KEY = 'nexora_finance_theme_v2'
const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().toISOString().slice(0, 7)
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

// =====================================================
// DADOS PADRÃO DO SISTEMA
// =====================================================
const defaultData = {
  // O projeto começa zerado para cada pessoa cadastrar as próprias informações.
  user: { name: '', email: '' },
  transactions: [],
  categories: ['Alimentação', 'Casa', 'Transporte', 'Lazer', 'Renda', 'Saúde', 'Educação', 'Dívidas', 'Outros'],
  budgets: {},
  goal: 0,
  saved: 0,
  monthlyLimit: 0,
  emergencyMonths: 6,
  debt: { name: '', total: 0, monthlyPayment: 0 }
}

function loadData() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData } catch { return defaultData } }
function saveFile(name, content, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click() }

export default function App() {
  // =====================================================
  // LOGIN LOCAL
  // =====================================================
  // Esse login é local/offline para proteger a tela no navegador.
  // Para banco online real, veja o arquivo README: Supabase/Firebase.
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'))
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')

  const [data, setData] = useState(loadData)
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'dark')
  const [tab, setTab] = useState('dashboard')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())

  // Formulário de movimentação.
  const emptyForm = { id: null, title: '', amount: '', type: 'expense', category: 'Alimentação', date: today(), fixed: false, recurring: false, dueDay: '', paid: true }
  const [form, setForm] = useState(emptyForm)

  // Busca, filtro, categoria, chat e configurações.
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [newCategory, setNewCategory] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chat, setChat] = useState([{ role: 'agent', text: 'Olá! Cadastre suas receitas e despesas para eu analisar sua vida financeira. Você pode perguntar: posso gastar quanto hoje? Qual meu maior gasto? Como economizar?' }])

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data])
  useEffect(() => localStorage.setItem(THEME_KEY, theme), [theme])

  // =====================================================
  // FILTRO POR MÊS/ANO
  // =====================================================
  const monthTransactions = useMemo(() => data.transactions.filter(t => String(t.date).slice(0, 7) === selectedMonth), [data.transactions, selectedMonth])

  // =====================================================
  // CÁLCULOS FINANCEIROS DO MÊS SELECIONADO
  // =====================================================
  const stats = useMemo(() => {
    const income = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const balance = income - expenses
    const fixedExpenses = monthTransactions.filter(t => t.type === 'expense' && t.fixed).reduce((s, t) => s + Number(t.amount), 0)
    const variableExpenses = expenses - fixedExpenses
    const byCategory = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc }, {})
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    const limitUsed = data.monthlyLimit > 0 ? Math.round((expenses / data.monthlyLimit) * 100) : 0
    const emergencyGoal = fixedExpenses * Number(data.emergencyMonths || 6)
    const debtMonths = data.debt.monthlyPayment > 0 ? Math.ceil(data.debt.total / data.debt.monthlyPayment) : 0
    const daysInMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()
    const currentDay = selectedMonth === currentMonth() ? new Date().getDate() : 1
    const dailySafe = Math.max(0, balance / Math.max(1, daysInMonth - currentDay + 1))
    return { income, expenses, balance, fixedExpenses, variableExpenses, byCategory, topCategory, limitUsed, emergencyGoal, debtMonths, dailySafe }
  }, [monthTransactions, data, selectedMonth])

  const filteredTransactions = useMemo(() => monthTransactions.filter(t => (`${t.title} ${t.category}`).toLowerCase().includes(search.toLowerCase()) && (filterType === 'all' || t.type === filterType)), [monthTransactions, search, filterType])
  const categoryChart = Object.entries(stats.byCategory).map(([name, value]) => ({ name, value }))
  const monthlyChart = useMemo(() => Object.values(data.transactions.reduce((acc, t) => { const m = String(t.date).slice(0, 7); acc[m] ||= { month: m, receitas: 0, despesas: 0 }; acc[m][t.type === 'income' ? 'receitas' : 'despesas'] += Number(t.amount); return acc }, {})).sort((a, b) => a.month.localeCompare(b.month)), [data.transactions])

  // =====================================================
  // ALERTAS DE VENCIMENTO
  // =====================================================
  const alerts = useMemo(() => monthTransactions.filter(t => t.type === 'expense' && !t.paid && t.dueDay).map(t => {
    const due = new Date(`${selectedMonth}-${String(t.dueDay).padStart(2, '0')}T12:00:00`)
    const diff = Math.ceil((due - new Date()) / 86400000)
    return { ...t, diff }
  }).filter(t => t.diff <= 7), [monthTransactions, selectedMonth])

  // =====================================================
  // ANÁLISES AUTOMÁTICAS DO AGENTE
  // =====================================================
  const advice = useMemo(() => {
    const tips = []
    if (!monthTransactions.length) tips.push(['info', 'Comece cadastrando sua primeira receita e sua primeira despesa para o agente gerar análises reais.'])
    if (stats.balance < 0) tips.push(['danger', `Saldo negativo em ${money(Math.abs(stats.balance))}. Corte gastos variáveis primeiro.`])
    if (stats.income > 0 && stats.expenses > stats.income * 0.7) tips.push(['warning', 'Gastos passaram de 70% da renda. Tente segurar compras extras.'])
    if (stats.limitUsed >= 100) tips.push(['danger', `Você ultrapassou o limite mensal de ${money(data.monthlyLimit)}.`])
    else if (stats.limitUsed >= 80) tips.push(['warning', `Você já usou ${stats.limitUsed}% do limite mensal.`])
    if (stats.topCategory) tips.push(['info', `Maior gasto do mês: ${stats.topCategory[0]} com ${money(stats.topCategory[1])}.`])
    if (stats.balance > 0) tips.push(['success', `Você ainda tem ${money(stats.balance)} livre. Gasto seguro por dia: ${money(stats.dailySafe)}.`])
    if (data.saved < data.goal) tips.push(['info', `Faltam ${money(data.goal - data.saved)} para sua meta principal.`])
    if (alerts.length) tips.push(['warning', `Você tem ${alerts.length} conta(s) para vencer ou vencida(s).`])
    return tips
  }, [stats, data, alerts, monthTransactions.length])

  // =====================================================
  // FUNÇÕES DE LOGIN
  // =====================================================
  function login() { const user = { name: loginName || 'Usuário', email: loginEmail || 'usuario@nexora.local' }; setAuth(user); localStorage.setItem(AUTH_KEY, JSON.stringify(user)); setData(p => ({ ...p, user })) }
  function logout() { localStorage.removeItem(AUTH_KEY); setAuth(null) }

  // =====================================================
  // CRIAR, EDITAR E EXCLUIR MOVIMENTAÇÃO
  // =====================================================
  function saveTransaction() {
    const parsed = Number(String(form.amount).replace(',', '.'))
    if (!form.title.trim() || !parsed || parsed <= 0) return alert('Preencha nome e valor corretamente.')
    const item = { ...form, amount: parsed, dueDay: form.dueDay ? Number(form.dueDay) : '', id: form.id || Date.now() }
    setData(p => ({ ...p, transactions: form.id ? p.transactions.map(t => t.id === form.id ? item : t) : [item, ...p.transactions] }))
    setForm(emptyForm)
  }
  function editTransaction(t) { setForm(t); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function removeTransaction(id) { if (confirm('Excluir essa movimentação?')) setData(p => ({ ...p, transactions: p.transactions.filter(t => t.id !== id) })) }
  function togglePaid(id) { setData(p => ({ ...p, transactions: p.transactions.map(t => t.id === id ? { ...t, paid: !t.paid } : t) })) }

  // =====================================================
  // RECORRÊNCIA AUTOMÁTICA DE CONTAS FIXAS
  // =====================================================
  function generateRecurring() {
    const existingKeys = new Set(data.transactions.map(t => `${t.title}-${t.category}-${String(t.date).slice(0, 7)}`))
    const bases = data.transactions.filter(t => t.recurring)
    const created = bases.map(t => ({ ...t, id: Date.now() + Math.random(), date: `${selectedMonth}-${String(t.dueDay || 1).padStart(2, '0')}`, paid: false })).filter(t => !existingKeys.has(`${t.title}-${t.category}-${selectedMonth}`))
    if (!created.length) return alert('Não há recorrências novas para gerar nesse mês.')
    setData(p => ({ ...p, transactions: [...created, ...p.transactions] }))
  }

  // =====================================================
  // CATEGORIAS E ORÇAMENTOS
  // =====================================================
  function addCategory() { const c = newCategory.trim(); if (!c) return; if (data.categories.includes(c)) return alert('Categoria já existe.'); setData(p => ({ ...p, categories: [...p.categories, c] })); setNewCategory('') }
  function deleteCategory(cat) { if (['Renda', 'Outros'].includes(cat)) return alert('Essa categoria é base do sistema.'); if (!confirm(`Excluir categoria ${cat}? Movimentações dela irão para Outros.`)) return; setData(p => ({ ...p, categories: p.categories.filter(c => c !== cat), transactions: p.transactions.map(t => t.category === cat ? { ...t, category: 'Outros' } : t) })) }
  function setBudget(cat, value) { setData(p => ({ ...p, budgets: { ...p.budgets, [cat]: Number(value || 0) } })) }

  // =====================================================
  // CHAT DO AGENTE
  // =====================================================
  function answerAgent(question) {
    const q = question.toLowerCase()
    if (q.includes('gastar') || q.includes('hoje')) return `Para não se apertar, hoje você poderia gastar até ${money(stats.dailySafe)} considerando o saldo do mês e os dias restantes.`
    if (q.includes('maior') || q.includes('gasto')) return stats.topCategory ? `Seu maior gasto no mês é ${stats.topCategory[0]} com ${money(stats.topCategory[1])}.` : 'Ainda não há despesas neste mês.'
    if (q.includes('economizar')) return `Comece reduzindo ${stats.topCategory?.[0] || 'gastos variáveis'} e tente guardar pelo menos ${money(Math.max(50, stats.balance * 0.2))}.`
    if (q.includes('limite')) return `Você usou ${stats.limitUsed}% do limite mensal de ${money(data.monthlyLimit)}.`
    if (q.includes('meta')) return data.saved >= data.goal ? 'Sua meta principal já foi batida. Parabéns!' : `Faltam ${money(data.goal - data.saved)} para bater sua meta.`
    if (q.includes('conta') || q.includes('venc')) return alerts.length ? `Você tem ${alerts.length} conta(s) vencendo ou vencida(s). Veja a aba Alertas.` : 'Não encontrei contas próximas do vencimento.'
    return `Resumo: receitas ${money(stats.income)}, despesas ${money(stats.expenses)}, saldo ${money(stats.balance)}. Pergunte sobre gasto hoje, meta, limite ou vencimentos.`
  }
  function sendChat() { if (!chatInput.trim()) return; const a = answerAgent(chatInput); setChat(p => [...p, { role: 'user', text: chatInput }, { role: 'agent', text: a }]); setChatInput('') }

  // =====================================================
  // EXPORTAR EXCEL, JSON E PDF
  // =====================================================
  // Gera um nome de arquivo padronizado para relatórios.
  function reportFileName(extension) {
    return `nexora-finance-relatorio-${selectedMonth}.${extension}`
  }

  // Converte as movimentações do mês em linhas mais bonitas para relatórios.
  function reportRows() {
    return monthTransactions.map(t => ({
      Data: new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR'),
      Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      Descricao: t.title,
      Categoria: t.category,
      Status: t.paid ? 'Pago' : 'Aberto',
      Fixa: t.fixed ? 'Sim' : 'Não',
      Recorrente: t.recurring ? 'Sim' : 'Não',
      Valor: Number(t.amount)
    }))
  }

  // =====================================================
  // EXPORTAÇÃO EXCEL EMPRESARIAL
  // =====================================================
  // Cria um arquivo .xlsx com abas separadas, resumo executivo,
  // orçamento por categoria, movimentações e análises do agente.
  function exportExcel() {
    const wb = XLSX.utils.book_new()
    wb.Props = {
      Title: 'Relatório Executivo - Nexora Finance',
      Subject: 'Relatório financeiro mensal',
      Author: 'Nexora Finance',
      Company: 'Nexora Finance',
      CreatedDate: new Date()
    }

    const owner = data.user?.name || auth?.name || 'Usuário'
    const generatedAt = new Date().toLocaleString('pt-BR')

    const summary = [
      ['NEXORA FINANCE'],
      ['Relatório Executivo Financeiro'],
      [],
      ['Responsável', owner],
      ['E-mail', data.user?.email || auth?.email || 'Não informado'],
      ['Competência', selectedMonth],
      ['Gerado em', generatedAt],
      [],
      ['Indicador', 'Valor'],
      ['Receitas', stats.income],
      ['Despesas', stats.expenses],
      ['Saldo', stats.balance],
      ['Despesas fixas', stats.fixedExpenses],
      ['Despesas variáveis', stats.variableExpenses],
      ['Limite mensal', data.monthlyLimit],
      ['Limite utilizado (%)', `${stats.limitUsed}%`],
      ['Meta financeira', data.goal],
      ['Valor guardado', data.saved],
      ['Reserva de emergência ideal', stats.emergencyGoal],
      ['Gasto seguro por dia', stats.dailySafe],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summary)
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 28 }]
    wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo Executivo')

    const movementData = reportRows()
    const wsMovements = XLSX.utils.json_to_sheet(movementData.length ? movementData : [{ Aviso: 'Nenhuma movimentação cadastrada para o mês selecionado.' }])
    wsMovements['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsMovements, 'Movimentações')

    const categoryData = Object.entries(stats.byCategory).map(([Categoria, Valor]) => {
      const Limite = Number(data.budgets?.[Categoria] || 0)
      return {
        Categoria,
        Gasto: Valor,
        'Orçamento definido': Limite,
        'Saldo do orçamento': Limite ? Limite - Valor : 'Não definido',
        'Uso do orçamento': Limite ? `${Math.round((Valor / Limite) * 100)}%` : 'Não definido'
      }
    })
    const wsCategories = XLSX.utils.json_to_sheet(categoryData.length ? categoryData : [{ Aviso: 'Nenhum gasto por categoria neste mês.' }])
    wsCategories['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsCategories, 'Categorias')

    const adviceData = advice.map((a, i) => ({ Nº: i + 1, Nivel: a[0], Analise: a[1] }))
    const wsAdvice = XLSX.utils.json_to_sheet(adviceData.length ? adviceData : [{ Aviso: 'Sem análises disponíveis.' }])
    wsAdvice['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 90 }]
    XLSX.utils.book_append_sheet(wb, wsAdvice, 'Agent Insights')

    const readme = [
      ['Nexora Finance - Relatório Empresarial'],
      [],
      ['Abas do arquivo:'],
      ['Resumo Executivo', 'Indicadores principais do mês.'],
      ['Movimentações', 'Lista detalhada de receitas e despesas.'],
      ['Categorias', 'Análise de gastos por categoria e orçamento.'],
      ['Agent Insights', 'Observações automáticas do agente financeiro.'],
      [],
      ['Observação', 'Este relatório foi gerado automaticamente pelo Nexora Finance.']
    ]
    const wsReadme = XLSX.utils.aoa_to_sheet(readme)
    wsReadme['!cols'] = [{ wch: 28 }, { wch: 70 }]
    XLSX.utils.book_append_sheet(wb, wsReadme, 'Leia-me')

    XLSX.writeFile(wb, reportFileName('xlsx'))
  }

  function exportBackup() { saveFile('backup-nexora-finance.json', JSON.stringify(data, null, 2), 'application/json') }
  function importBackup(e) { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { try { setData(JSON.parse(r.result)); alert('Backup restaurado!') } catch { alert('Arquivo inválido.') } }; r.readAsText(file) }

  // =====================================================
  // EXPORTAÇÃO PDF EMPRESARIAL
  // =====================================================
  // Cria um PDF com capa, resumo executivo, insights, tabela de
  // movimentações e rodapé, com visual mais profissional.
  function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    let y = 18

    function header(title = 'Relatório Executivo Financeiro') {
      doc.setFillColor(2, 6, 23)
      doc.rect(0, 0, pageWidth, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont(undefined, 'bold')
      doc.text('NEXORA FINANCE', margin, 12)
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(title, margin, 20)
      doc.setDrawColor(37, 99, 235)
      doc.setLineWidth(1.2)
      doc.line(margin, 29.5, pageWidth - margin, 29.5)
      doc.setTextColor(15, 23, 42)
      y = 40
    }

    function footer() {
      const page = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Gerado automaticamente pelo Nexora Finance • ${new Date().toLocaleString('pt-BR')}`, margin, pageHeight - 10)
      doc.text(`Página ${page}`, pageWidth - margin - 15, pageHeight - 10)
    }

    function checkPage(extra = 20) {
      if (y + extra > pageHeight - 22) {
        footer()
        doc.addPage()
        header('Relatório Executivo Financeiro')
      }
    }

    function sectionTitle(text) {
      checkPage(16)
      doc.setFontSize(13)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(text, margin, y)
      y += 7
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, y, pageWidth - margin, y)
      y += 7
    }

    function kpiCard(x, yPos, title, value) {
      doc.setDrawColor(203, 213, 225)
      doc.setFillColor(248, 250, 252)
      doc.roundedRect(x, yPos, 86, 22, 3, 3, 'FD')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(title, x + 4, yPos + 7)
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.setFont(undefined, 'bold')
      doc.text(String(value), x + 4, yPos + 16)
      doc.setFont(undefined, 'normal')
    }

    function table(headers, rows, widths) {
      checkPage(16)
      doc.setFontSize(8)
      doc.setFont(undefined, 'bold')
      doc.setFillColor(37, 99, 235)
      doc.setTextColor(255, 255, 255)
      let x = margin
      headers.forEach((h, i) => { doc.rect(x, y, widths[i], 8, 'F'); doc.text(String(h), x + 2, y + 5.3); x += widths[i] })
      y += 8
      doc.setFont(undefined, 'normal')
      rows.forEach((row, rowIndex) => {
        checkPage(10)
        let x = margin
        doc.setFillColor(rowIndex % 2 === 0 ? 248 : 241, 245, 249)
        doc.setTextColor(15, 23, 42)
        row.forEach((cell, i) => {
          doc.rect(x, y, widths[i], 8, 'F')
          const value = String(cell ?? '').slice(0, i === 1 ? 22 : 16)
          doc.text(value, x + 2, y + 5.3)
          x += widths[i]
        })
        y += 8
      })
      y += 4
    }

    header()

    const owner = data.user?.name || auth?.name || 'Usuário'
    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    doc.text(`Responsável: ${owner}`, margin, y)
    y += 6
    doc.text(`Competência: ${selectedMonth}`, margin, y)
    y += 10

    kpiCard(margin, y, 'Receitas', money(stats.income))
    kpiCard(margin + 94, y, 'Despesas', money(stats.expenses))
    y += 28
    kpiCard(margin, y, 'Saldo do mês', money(stats.balance))
    kpiCard(margin + 94, y, 'Gasto seguro por dia', money(stats.dailySafe))
    y += 32

    sectionTitle('Resumo executivo')
    const executiveText = [
      `Este relatório consolida as informações financeiras cadastradas no Nexora Finance para a competência ${selectedMonth}.`,
      `O período apresenta ${money(stats.income)} em receitas, ${money(stats.expenses)} em despesas e saldo final de ${money(stats.balance)}.`,
      `Despesas fixas: ${money(stats.fixedExpenses)}. Despesas variáveis: ${money(stats.variableExpenses)}. Limite mensal utilizado: ${stats.limitUsed}%.`
    ]
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    executiveText.forEach(line => { doc.splitTextToSize(line, pageWidth - margin * 2).forEach(part => { checkPage(7); doc.text(part, margin, y); y += 6 }) })
    y += 4

    sectionTitle('Análises do Agent')
    doc.setFontSize(9)
    advice.forEach((a, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${a[1]}`, pageWidth - margin * 2)
      lines.forEach(line => { checkPage(6); doc.text(line, margin, y); y += 5 })
      y += 2
    })

    sectionTitle('Gastos por categoria')
    const categoryRows = Object.entries(stats.byCategory).map(([cat, value]) => [cat, money(value), data.budgets?.[cat] ? money(data.budgets[cat]) : 'Não definido'])
    table(['Categoria', 'Gasto', 'Orçamento'], categoryRows.length ? categoryRows : [['Sem dados', '-', '-']], [72, 50, 50])

    sectionTitle('Movimentações do mês')
    const movementRows = reportRows().map(r => [r.Data, r.Descricao, r.Tipo, r.Categoria, money(r.Valor), r.Status])
    table(['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Status'], movementRows.length ? movementRows : [['-', 'Nenhuma movimentação', '-', '-', '-', '-']], [24, 48, 24, 34, 34, 24])

    checkPage(26)
    sectionTitle('Validação')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text('Relatório gerado automaticamente a partir dos dados cadastrados pelo usuário.', margin, y)
    y += 16
    doc.line(margin, y, margin + 70, y)
    y += 5
    doc.text('Assinatura / Conferência', margin, y)

    footer()
    doc.save(reportFileName('pdf'))
  }

  if (!auth) return <LoginScreen theme={theme} setTheme={setTheme} loginName={loginName} setLoginName={setLoginName} loginEmail={loginEmail} setLoginEmail={setLoginEmail} login={login} />

  return <div className={`app ${theme}`}>
    <header className="topbar">
      <div className="brand"><div className="logo">NX</div><div><h1>Nexora Finance</h1><p>Agent financeiro completo • {auth.name}</p></div></div>
      <div className="topActions"><button className="iconBtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun/> : <Moon/>}</button><button className="iconBtn ghost" onClick={logout}><LogOut/></button></div>
    </header>

    <nav className="tabs">{[
      ['dashboard','Dashboard'],['mov','Movimentações'],['budget','Orçamentos'],['chat','Agent Chat'],['alerts','Alertas'],['tools','Ferramentas'],['settings','Configurações']
    ].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? 'active' : ''}>{label}</button>)}</nav>

    <main className="single">
      <div className="monthBar"><label>Mês/Ano</label><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} /><button className="primary" onClick={generateRecurring}><Repeat size={17}/> Gerar fixas do mês</button></div>

      {tab === 'dashboard' && <Dashboard stats={stats} data={data} advice={advice} categoryChart={categoryChart} monthlyChart={monthlyChart} alerts={alerts} selectedMonth={selectedMonth} />}
      {tab === 'mov' && <Movements data={data} form={form} setForm={setForm} emptyForm={emptyForm} saveTransaction={saveTransaction} editTransaction={editTransaction} removeTransaction={removeTransaction} togglePaid={togglePaid} filteredTransactions={filteredTransactions} search={search} setSearch={setSearch} filterType={filterType} setFilterType={setFilterType} />}
      {tab === 'budget' && <Budgets data={data} stats={stats} setBudget={setBudget} />}
      {tab === 'chat' && <AgentChat chat={chat} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} />}
      {tab === 'alerts' && <Alerts alerts={alerts} togglePaid={togglePaid} />}
      {tab === 'tools' && <Tools data={data} setData={setData} stats={stats} exportExcel={exportExcel} exportBackup={exportBackup} importBackup={importBackup} exportPDF={exportPDF} />}
      {tab === 'settings' && <SettingsPanel data={data} setData={setData} newCategory={newCategory} setNewCategory={setNewCategory} addCategory={addCategory} deleteCategory={deleteCategory} />}
    </main>
  </div>
}

function LoginScreen({ theme, setTheme, loginName, setLoginName, loginEmail, setLoginEmail, login }) { return <div className={`app login ${theme}`}><section className="loginCard"><div className="logo big">NX</div><h1>Nexora Finance</h1><p>Entre para acessar seu painel financeiro. Login local pronto; banco online configurável no README.</p><input placeholder="Seu nome" value={loginName} onChange={e=>setLoginName(e.target.value)}/><input placeholder="Seu e-mail" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}/><button className="primary full" onClick={login}><User size={18}/> Entrar</button><button className="linkBtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>Alternar tema</button></section></div> }
function Dashboard({ stats, data, advice, categoryChart, monthlyChart, alerts }) { return <div className="gridMain"><section className="content"><div className="cards four"><Stat icon={<TrendingUp/>} label="Receitas" value={money(stats.income)}/><Stat icon={<TrendingDown/>} label="Despesas" value={money(stats.expenses)} danger/><Stat icon={<Wallet/>} label="Saldo" value={money(stats.balance)}/><Stat icon={<PiggyBank/>} label="Guardado" value={money(data.saved)}/></div><div className="gridTwo"><ChartPanel title="Gastos por categoria" data={categoryChart}/><MonthlyPanel data={monthlyChart}/></div></section><aside className="sidebar"><Panel title="Análise do Agent" icon={<Bot/>}>{advice.map((a,i)=><Tip key={i} type={a[0]} text={a[1]}/>)}</Panel><Panel title="Meta" icon={<Target/>}><Progress value={data.goal > 0 ? Math.min(100, Math.round((data.saved / data.goal) * 100)) : 0}/><p>{money(data.saved)} de {money(data.goal)}</p></Panel><Panel title="Alertas rápidos" icon={<Bell/>}><p>{alerts.length ? `${alerts.length} conta(s) próximas do vencimento.` : 'Nenhuma conta próxima vencendo.'}</p></Panel></aside></div> }
function Movements(p){ const {data,form,setForm,emptyForm,saveTransaction,editTransaction,removeTransaction,togglePaid,filteredTransactions,search,setSearch,filterType,setFilterType}=p; return <div className="gridMain"><section className="content"><Panel title={form.id?'Editar movimentação':'Nova movimentação'} icon={<Plus/>}><div className="formGrid"><input placeholder="Nome" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="Valor" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="expense">Despesa</option><option value="income">Receita</option></select><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{data.categories.map(c=><option key={c}>{c}</option>)}</select><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/><input placeholder="Venc." type="number" min="1" max="31" value={form.dueDay} onChange={e=>setForm({...form,dueDay:e.target.value})}/><button className="primary" onClick={saveTransaction}><Save size={17}/>Salvar</button></div><div className="checks"><label><input type="checkbox" checked={form.fixed} onChange={e=>setForm({...form,fixed:e.target.checked})}/> Fixa</label><label><input type="checkbox" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})}/> Recorrente</label><label><input type="checkbox" checked={form.paid} onChange={e=>setForm({...form,paid:e.target.checked})}/> Pago</label>{form.id&&<button className="linkBtn" onClick={()=>setForm(emptyForm)}><X size={16}/>Cancelar edição</button>}</div></Panel><Panel title="Buscar e filtrar" icon={<Search/>}><div className="filterGrid"><input placeholder="Buscar por nome/categoria" value={search} onChange={e=>setSearch(e.target.value)}/><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></div></Panel><Panel title="Movimentações do mês" icon={<CalendarDays/>}><div className="list">{filteredTransactions.map(t=><Transaction key={t.id} t={t} editTransaction={editTransaction} removeTransaction={removeTransaction} togglePaid={togglePaid}/>)}</div></Panel></section></div> }
function Budgets({ data, stats, setBudget }) { return <Panel title="Orçamento por categoria" icon={<Calculator/>}><div className="budgetList">{data.categories.filter(c=>c!=='Renda').map(cat=>{ const used=stats.byCategory[cat]||0; const limit=data.budgets[cat]||0; return <div className="budget" key={cat}><div><b>{cat}</b><p>Usado: {money(used)}</p></div><input type="number" value={limit} onChange={e=>setBudget(cat,e.target.value)}/><Progress value={limit?Math.min(100,Math.round((used/limit)*100)):0} danger={limit&&used>limit}/></div>})}</div></Panel> }
function AgentChat({ chat, chatInput, setChatInput, sendChat }) { return <Panel title="Agent em formato chat" icon={<MessageCircle/>}><div className="chatBox">{chat.map((m,i)=><div key={i} className={`msg ${m.role}`}>{m.text}</div>)}</div><div className="chatInput"><input placeholder="Ex: posso gastar quanto hoje?" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}/><button className="primary" onClick={sendChat}>Enviar</button></div></Panel> }
function Alerts({ alerts, togglePaid }) { return <Panel title="Alertas de vencimento" icon={<Bell/>}>{alerts.length===0?<p>Nenhuma conta vencendo nos próximos 7 dias.</p>:<div className="list">{alerts.map(a=><div className="item" key={a.id}><div><b>{a.title}</b><p>{a.diff<0?`Vencida há ${Math.abs(a.diff)} dia(s)`:a.diff===0?'Vence hoje':`Vence em ${a.diff} dia(s)`} • {money(a.amount)}</p></div><button className="primary" onClick={()=>togglePaid(a.id)}>Marcar pago</button></div>)}</div>}</Panel> }
function Tools({ data, setData, stats, exportExcel, exportBackup, importBackup, exportPDF }) { return <div className="gridTwo"><Panel title="Relatórios e backup" icon={<FileText/>}><div className="stack"><button className="primary" onClick={exportExcel}><Download size={17}/> Exportar Excel</button><button className="primary" onClick={exportPDF}><FileText size={17}/> Relatório PDF</button><button className="primary" onClick={exportBackup}><Download size={17}/> Backup JSON</button><label className="upload"><Upload size={17}/> Restaurar backup<input type="file" accept="application/json" onChange={importBackup}/></label></div></Panel><Panel title="Reserva e dívidas" icon={<CreditCard/>}><label>Meses de reserva</label><input type="number" value={data.emergencyMonths} onChange={e=>setData(p=>({...p,emergencyMonths:Number(e.target.value)}))}/><p className="result">Reserva ideal: {money(stats.emergencyGoal)}</p><label>Nome da dívida</label><input value={data.debt.name} onChange={e=>setData(p=>({...p,debt:{...p.debt,name:e.target.value}}))}/><label>Total da dívida</label><input type="number" value={data.debt.total} onChange={e=>setData(p=>({...p,debt:{...p.debt,total:Number(e.target.value)}}))}/><label>Pagamento mensal</label><input type="number" value={data.debt.monthlyPayment} onChange={e=>setData(p=>({...p,debt:{...p.debt,monthlyPayment:Number(e.target.value)}}))}/><p className="result">Quitação em: {stats.debtMonths} mês(es)</p></Panel></div> }
function SettingsPanel({ data, setData, newCategory, setNewCategory, addCategory, deleteCategory }) { return <div className="gridTwo"><Panel title="Categorias" icon={<Settings/>}><div className="filterGrid"><input placeholder="Nova categoria" value={newCategory} onChange={e=>setNewCategory(e.target.value)}/><button className="primary" onClick={addCategory}><Plus size={17}/>Adicionar</button></div><div className="chips">{data.categories.map(c=><span key={c}>{c}<button onClick={()=>deleteCategory(c)}>×</button></span>)}</div></Panel><Panel title="Banco online" icon={<Database/>}><p>O app está pronto para trocar LocalStorage por Supabase/Firebase. Veja o README para configurar autenticação e banco real.</p><div className="badge"><ShieldCheck/> Preparado para hospedagem e PWA</div></Panel></div> }
function Stat({ icon, label, value, danger }) { return <div className="stat"><div className={`statIcon ${danger?'dangerBg':''}`}>{icon}</div><p>{label}</p><h3>{value}</h3></div> }
function Panel({ title, icon, children }) { return <section className="panel"><h2>{icon}{title}</h2>{children}</section> }
function Tip({ type, text }) { const icons={danger:<AlertTriangle/>,warning:<AlertTriangle/>,success:<CheckCircle2/>,info:<Pencil/>}; return <div className={`tip ${type}`}>{icons[type]||icons.info}<span>{text}</span></div> }
function Progress({ value, danger }) { return <div className="progress"><div className={`bar ${danger?'redbar':''}`} style={{width:`${value||0}%`}} /></div> }
function ChartPanel({ title, data }) { return <Panel title={title} icon={<Wallet/>}>{data.length?<ResponsiveContainer width="100%" height={260}><PieChart><Pie dataKey="value" data={data} outerRadius={90} label>{data.map((_,i)=><Cell key={i} fill={['#2563eb','#22c55e','#f97316','#ef4444','#a855f7','#14b8a6'][i%6]}/>)}</Pie><Tooltip formatter={money}/></PieChart></ResponsiveContainer>:<p>Sem dados.</p>}</Panel> }
function MonthlyPanel({ data }) { return <Panel title="Receitas x despesas" icon={<TrendingUp/>}><ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={money}/><Bar dataKey="receitas" fill="#22c55e"/><Bar dataKey="despesas" fill="#ef4444"/></BarChart></ResponsiveContainer></Panel> }
function Transaction({ t, editTransaction, removeTransaction, togglePaid }) { return <div className="item"><div><b>{t.title}</b>{t.fixed&&<span className="tag">fixa</span>}{t.recurring&&<span className="tag">recorrente</span>}<p>{t.category} • {new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR')} • {t.paid?'Pago':'Aberto'}</p></div><div className="right"><strong className={t.type==='income'?'green':'red'}>{t.type==='income'?'+':'-'}{money(t.amount)}</strong><button onClick={()=>togglePaid(t.id)}><CheckCircle2/></button><button onClick={()=>editTransaction(t)}><Pencil/></button><button onClick={()=>removeTransaction(t.id)}><Trash2/></button></div></div> }
