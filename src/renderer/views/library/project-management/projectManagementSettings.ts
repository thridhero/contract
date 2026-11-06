type LoggerLike = { error: (...args: any[]) => void }

export const cloneConfig = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export const readJsonSetting = async <T,>(key: string, fallback: T, logger?: LoggerLike): Promise<T> => {
  try {
    const result = await window.electronAPI.db.getSetting(key)
    if (result.success && result.data?.value) {
      const parsed = JSON.parse(result.data.value) as T
      localStorage.setItem(key, result.data.value)
      return parsed
    }
  } catch (error) {
    logger?.error('读取设置失败', error)
  }

  const cached = localStorage.getItem(key)
  if (cached) {
    try {
      return JSON.parse(cached) as T
    } catch (error) {
      logger?.error('读取本地缓存失败', error)
    }
  }
  return cloneConfig(fallback)
}

export const writeJsonSetting = async (key: string, value: unknown, description: string) => {
  const json = JSON.stringify(value)
  localStorage.setItem(key, json)
  const existing = await window.electronAPI.db.getSetting(key)
  if (existing.success && existing.data) {
    await window.electronAPI.db.updateSetting(key, json, description)
  } else {
    await window.electronAPI.db.insertSetting(key, json, description)
  }
}
