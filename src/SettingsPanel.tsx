import { useState } from 'react'
import { request } from './api'

type Props = { onClose: () => void; onDeleted: () => void }

export default function SettingsPanel({ onClose, onDeleted }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function deleteAccount() {
    if (!password || !window.confirm('注销后，对话和记忆会被清理，且无法恢复。确定继续？')) return
    setBusy(true); setError('')
    try {
      await request<void>('/api/account', 'DELETE', { password })
      onDeleted()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="settings-panel" role="dialog" aria-modal="true" aria-label="账号设置">
      <button className="close-modal" onClick={onClose} aria-label="关闭">×</button>
      <h2>账号设置</h2>
      <p>你可以管理账号数据。</p>
      <div className="danger-zone"><strong>注销账号</strong><p>注销会清理账号信息、对话内容和记忆。请输入密码确认。</p><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入当前密码" /><button disabled={busy || !password} onClick={deleteAccount}>注销并清理数据</button></div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  </div>
}
