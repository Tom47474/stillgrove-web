import { useEffect, useRef, useState } from 'react'
import { clearCsrf, csrf, request } from './api'
import SettingsPanel from './SettingsPanel'
import './App.css'

type User = { id: number; email: string }
type Conversation = { id: number; title: string; lastMessageAt?: string }
type Message = { id: number; role: 'USER' | 'ASSISTANT'; content: string; status: string }

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    request<User>('/api/auth/me').then(setUser).catch(() => {}).finally(() => setChecking(false))
  }, [])
  useEffect(() => {
    if (user) request<Conversation[]>('/api/conversations').then(setConversations).catch(e => setError(e.message))
  }, [user])
  useEffect(() => {
    if (busy) return
    if (active) request<Message[]>(`/api/conversations/${active}/messages`).then(setMessages).catch(e => setError(e.message))
  }, [active, busy])
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages])

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const result = await request<User>(`/api/auth/${mode}`, 'POST', { email, password })
      setUser(result); setPassword(''); await csrf()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function logout() {
    try { await request<void>('/api/auth/logout', 'POST'); setUser(null); setActive(null); setConversations([]); setMessages([]); clearCsrf() }
    catch (e) { setError((e as Error).message) }
  }
  async function createConversation() {
    try {
      const conversation = await request<Conversation>('/api/conversations', 'POST')
      setConversations(items => [conversation, ...items]); setMessages([]); setActive(conversation.id)
      return conversation.id
    } catch (e) { setError((e as Error).message); return null }
  }
  async function removeConversation(id: number) {
    if (!window.confirm('删除这段对话？')) return
    try {
      await request<void>(`/api/conversations/${id}`, 'DELETE')
      setConversations(items => items.filter(item => item.id !== id))
      if (active === id) { setActive(null); setMessages([]) }
    } catch (e) { setError((e as Error).message) }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setError(''); setBusy(true)
    try {
      let id = active
      if (!id) id = await createConversation()
      if (!id) return
      const userMessage: Message = { id: Date.now(), role: 'USER', content, status: 'COMPLETED' }
      const assistantMessage: Message = { id: Date.now() + 1, role: 'ASSISTANT', content: '', status: 'PENDING' }
      setMessages(items => [...items, userMessage, assistantMessage]); setDraft('')
      const token = await csrf()
      const response = await fetch(`/api/conversations/${id}/messages/stream`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify({ content, requestId: crypto.randomUUID() }),
      })
      if (!response.ok || !response.body) throw new Error(`回复失败（${response.status}）`)
      const reader = response.body.getReader(), decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const eventName = frame.match(/^event:\s?(.*)$/m)?.[1]
          const data = frame.match(/^data:\s?(.*)$/m)?.[1]
          if (eventName === 'delta' && data) {
            const text = (JSON.parse(data) as { text: string }).text
            setMessages(items => items.map(message => message.id === assistantMessage.id ? { ...message, content: message.content + text } : message))
          }
          if (eventName === 'error') throw new Error('AI 回复失败，请稍后再试')
        }
      }
      setMessages(await request<Message[]>(`/api/conversations/${id}/messages`))
      setConversations(await request<Conversation[]>('/api/conversations'))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function feedback(messageId: number, rating: 'HELPFUL' | 'NOT_HELPFUL') {
    try { await request<void>(`/api/messages/${messageId}/feedback`, 'PUT', { rating }); setError('谢谢你的反馈') }
    catch (e) { setError((e as Error).message) }
  }

  if (checking) return <div className="loading">Stillgrove · 正在进入树洞…</div>
  if (!user) return <main className="auth-page"><div className="auth-card">
    <div className="brand-mark">✦</div><p className="eyebrow">STILLGROVE</p>
    <h1>给心事一个<br />安静的地方</h1><p className="intro">在这里，你可以慢慢说。我们会认真听。</p>
    <form onSubmit={submitAuth}><label>邮箱<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? '请稍候…' : mode === 'login' ? '进入树洞' : '创建账号'}</button></form>
    <button className="text-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}</button>
    <p className="auth-note">Stillgrove 是倾听与陪伴工具，不能替代专业帮助。</p>
  </div></main>
  return <div className="shell"><aside className="sidebar"><div className="side-head"><div><span className="brand-mark small">✦</span><strong>Stillgrove</strong></div><button className="new-button" onClick={createConversation}>＋ 新对话</button></div>
    <div className="section-label">你的对话</div><nav className="conversation-list">{conversations.map(item => <div className={`conversation ${active === item.id ? 'active' : ''}`} key={item.id}><button onClick={() => setActive(item.id)}>{item.title}</button><button className="delete" title="删除对话" onClick={() => removeConversation(item.id)}>×</button></div>)}</nav>
    <div className="side-footer"><span>{user.email}</span><button onClick={() => setSettingsOpen(true)}>设置</button><button onClick={logout}>退出</button></div></aside>
    <main className="chat"><header className="chat-header"><span>✦</span><div><strong>{conversations.find(c => c.id === active)?.title ?? '新的对话'}</strong><small>一个可以安心说话的地方</small></div></header>
      <div className="message-scroll">{messages.length === 0 ? <div className="welcome"><span className="welcome-icon">✦</span><h2>今天有什么想说的？</h2><p>开心的、难过的，或是还没想清楚的，都可以从这里开始。</p></div> : <div className="message-list">{messages.map(message => <div className={`message ${message.role === 'USER' ? 'mine' : 'theirs'}`} key={message.id}><span className="message-role">{message.role === 'USER' ? '你' : 'Stillgrove'}</span><div className="bubble">{message.content || (message.status === 'PENDING' ? '正在思考…' : '回复未完成')}</div>{message.role === 'ASSISTANT' && message.status === 'COMPLETED' && <div className="feedback"><button onClick={() => feedback(message.id, 'HELPFUL')}>有帮助</button><button onClick={() => feedback(message.id, 'NOT_HELPFUL')}>没帮助</button></div>}</div>)}<div ref={bottom} /></div>}</div>
      <div className="composer-wrap">{error && <p className="error" role="alert">{error}</p>}<form className="composer" onSubmit={send}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="把想说的写在这里…" maxLength={8000} rows={3} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} /><button disabled={busy || !draft.trim()} aria-label="发送消息">↑</button></form><p className="disclaimer">如有紧急危险，请立即联系当地紧急服务或身边可信赖的人。</p></div>
    </main>{settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} onDeleted={() => { setSettingsOpen(false); setUser(null); setActive(null); setConversations([]); setMessages([]); clearCsrf() }} />}</div>
}

export default App
