import process from 'node:process'
import { writeDevEditorToken } from '../utils/dev-editor-token'

export default defineNitroPlugin(() => {
  if (!import.meta.dev) {
    return
  }
  if (process.env.NODE_ENV === 'production') {
    return
  }
  if (process.env.DEV_EDITOR_SESSION !== '1') {
    return
  }
  writeDevEditorToken()
})
