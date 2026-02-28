// staticFiles.js (ESM)
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// --- 1) Charger depuis SSM Parameter Store si demandé ---
async function loadConfigFromSSM() {
  const name = process.env.CONFIG_SSM_PARAM // ex: /par-ici-tennis/config
  if (!name) return null
  try {
    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm')
    const ssm = new SSMClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION })
    const res = await ssm.send(new GetParameterCommand({
      Name: name,
      WithDecryption: true, // pour SecureString, sinon sans effet
    }))
    console.log("Config loaded from SSM")
    return JSON.parse(res.Parameter.Value)
  } catch (e) {
    console.warn('[config] SSM GetParameter error:', e?.message || e)
    return null
  }
}

// --- 2) Charger un fichier local (bind mount) si présent ---
function loadConfigFromFile() {
  const p = path.join(__dirname, 'config.json')
  if (!existsSync(p)) return null
  try {
    console.log("Config loaded from file")
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    console.warn('[config] Local config.json parse error:', e?.message || e)
    return null
  }
}

console.log("Try to load config")
let fileConfig = await loadConfigFromSSM()
if (!fileConfig) fileConfig = loadConfigFromFile() || {}

export const config = {...fileConfig};