export class IdGenerator {
  /**
   * 生成唯一编号
   * 格式: 前缀 + 年月日时分秒 + 3位随机数
   * 例如: generateCode('SUP') -> SUP20260326153022123
   * @param prefix 编号前缀
   * @returns 唯一编号
   */
  static generateCode(prefix: string = ''): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    
    return `${prefix}${year}${month}${day}${hours}${minutes}${seconds}${random}`
  }
}
