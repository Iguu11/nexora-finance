import React, { useState } from 'react'
import { User, Mail, Lock, Moon, Sun } from 'lucide-react'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from './authService'

export default function LoginSupabase({ theme, setTheme, onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmailAccess() {
    if (!email || !password) {
      alert('Preencha e-mail e senha.')
      return
    }

    if (password.length < 6) {
      alert('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    try {
      setLoading(true)

      if (isRegister) {
        await signUpWithEmail({ name, email, password })
        alert('Conta criada! Se o Supabase pedir confirmação, verifique seu e-mail. Depois faça login.')
        setIsRegister(false)
        return
      }

      const data = await signInWithEmail({ email, password })

      onLogin({
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email
      })
    } catch (error) {
      alert(error.message || 'Erro ao acessar conta.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleAccess() {
    try {
      setLoading(true)
      await signInWithGoogle()
    } catch (error) {
      alert(error.message || 'Erro ao entrar com Google.')
      setLoading(false)
    }
  }

  return (
    <div className={`app login ${theme}`}>
      <section className="loginCard">
        <div className="logo big">NX</div>
        <h1>Nexora Finance</h1>
        <p>{isRegister ? 'Crie sua conta para salvar seus dados na nuvem.' : 'Entre para acessar seu painel financeiro na nuvem.'}</p>

        {isRegister && (
          <div className="inputIcon">
            <User size={17} />
            <input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} />
          </div>
        )}

        <div className="inputIcon">
          <Mail size={17} />
          <input placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="inputIcon">
          <Lock size={17} />
          <input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailAccess()} />
        </div>

        <button className="primary full" onClick={handleEmailAccess} disabled={loading}>
          <User size={18} /> {loading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
        </button>

        <button className="primary full ghostGoogle" onClick={handleGoogleAccess} disabled={loading}>
          Entrar com Google
        </button>

        <button className="linkBtn" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Já tenho conta' : 'Criar nova conta'}
        </button>

        <button className="linkBtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Alternar tema
        </button>
      </section>
    </div>
  )
}
