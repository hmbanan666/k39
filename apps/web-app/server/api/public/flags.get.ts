import process from 'node:process'

export default defineEventHandler(() => {
  return { map: process.env.FEATURE_MAP === 'true' }
})
