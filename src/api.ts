let csrfToken = ''

export async function csrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const response = await fetch('/api/auth/csrf', { credentials: 'include' })
  if (!response.ok) throw new Error('无法建立安全连接')
  csrfToken = (await response.json()).token
  return csrfToken
}

export function clearCsrf() { csrfToken = '' }

export async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  if (method !== 'GET') await csrf()
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-XSRF-TOKEN': csrfToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    if (response.status === 403 && method !== 'GET') {
      clearCsrf()
      throw new Error('会话已更新，请重试')
    }
    throw new Error(response.status === 401 ? '请先登录' : `请求失败（${response.status}）`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}
