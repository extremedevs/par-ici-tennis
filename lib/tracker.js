import { config } from '../staticFiles.js'

// Send the run result to the web dashboard (see web/README.md)
export const report = async (result) => {
  const url = config?.tracker?.url || process.env.TRACKER_URL
  const token = config?.tracker?.token || process.env.TRACKER_TOKEN
  if (!url || !token) return

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        account: config.name || config.ntfy?.title || 'default',
        ...result,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    console.log('Result sent to tracker')
  } catch (err) {
    console.log('Error while sending result to tracker:', err.message)
  }
}
