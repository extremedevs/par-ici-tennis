import {
  SSMClient, DeleteParameterCommand, GetParameterCommand, GetParametersByPathCommand, PutParameterCommand,
} from '@aws-sdk/client-ssm'
import {
  SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand, GetScheduleCommand, UpdateScheduleCommand,
} from '@aws-sdk/client-scheduler'

// Server-side only. Vercel reserves the AWS_* names, so credentials use a PIT_ prefix.
const clientConfig = {
  region: process.env.PIT_AWS_REGION || 'eu-west-3',
  credentials: {
    accessKeyId: process.env.PIT_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.PIT_AWS_SECRET_ACCESS_KEY || '',
  },
}
const ssm = new SSMClient(clientConfig)
const scheduler = new SchedulerClient(clientConfig)

export const ACCOUNTS_PREFIX = '/par-ici-tennis/accounts/'
const SCHEDULE_GROUP = process.env.SCHEDULE_GROUP || 'par-ici-tennis'
// AWS cron day names, index = JS getDay()
export const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export const awsConfigured = () => Boolean(
  process.env.PIT_AWS_ACCESS_KEY_ID && process.env.PIT_AWS_SECRET_ACCESS_KEY
  && process.env.LAMBDA_ARN && process.env.SCHEDULER_ROLE_ARN,
)

// --- Accounts: one SecureString parameter per account, holding its config.json ---

export async function listAccounts() {
  const accounts = []
  let NextToken
  do {
    const res = await ssm.send(new GetParametersByPathCommand({ Path: ACCOUNTS_PREFIX.slice(0, -1), WithDecryption: true, NextToken }))
    for (const p of res.Parameters) {
      accounts.push({ id: p.Name.slice(ACCOUNTS_PREFIX.length), config: JSON.parse(p.Value) })
    }
    NextToken = res.NextToken
  } while (NextToken)
  return accounts.sort((a, b) => a.id.localeCompare(b.id))
}

export async function getAccount(id) {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: ACCOUNTS_PREFIX + id, WithDecryption: true }))
    return JSON.parse(res.Parameter.Value)
  } catch (err) {
    if (err.name === 'ParameterNotFound') return null
    throw err
  }
}

export async function saveAccount(id, config) {
  await ssm.send(new PutParameterCommand({
    Name: ACCOUNTS_PREFIX + id,
    Value: JSON.stringify(config),
    Type: 'SecureString',
    Overwrite: true,
  }))
}

export async function deleteAccount(id) {
  try {
    await ssm.send(new DeleteParameterCommand({ Name: ACCOUNTS_PREFIX + id }))
  } catch (err) {
    if (err.name !== 'ParameterNotFound') throw err
  }
}

// --- Schedules: one EventBridge Scheduler entry per account, invoking the Lambda at 7:59 ---

const scheduleName = (id) => `account-${id}`

// { enabled, runDays: ['MON', ...] } or null when the account has no schedule
export async function getSchedule(id) {
  try {
    const res = await scheduler.send(new GetScheduleCommand({ Name: scheduleName(id), GroupName: SCHEDULE_GROUP }))
    const days = res.ScheduleExpression.match(/cron\(\S+ \S+ \S+ \S+ (\S+)/)?.[1] ?? '*'
    return { enabled: res.State === 'ENABLED', runDays: days === '*' ? WEEK_DAYS : days.split(',') }
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return null
    throw err
  }
}

export async function saveSchedule(id, { runDays, enabled }) {
  const params = {
    Name: scheduleName(id),
    GroupName: SCHEDULE_GROUP,
    ScheduleExpression: `cron(59 7 ? * ${runDays.join(',')} *)`,
    ScheduleExpressionTimezone: 'Europe/Paris',
    FlexibleTimeWindow: { Mode: 'OFF' },
    State: enabled ? 'ENABLED' : 'DISABLED',
    Target: {
      Arn: process.env.LAMBDA_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({ account: id }),
      // A late retry would miss the 8:00 opening anyway
      RetryPolicy: { MaximumRetryAttempts: 0 },
    },
  }
  try {
    await scheduler.send(new UpdateScheduleCommand(params))
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') throw err
    await scheduler.send(new CreateScheduleCommand(params))
  }
}

export async function deleteSchedule(id) {
  try {
    await scheduler.send(new DeleteScheduleCommand({ Name: scheduleName(id), GroupName: SCHEDULE_GROUP }))
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') throw err
  }
}
