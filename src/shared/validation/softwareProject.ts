export type SoftwareProjectFields = {
  softwareName: string
  version: string
  completionDate: string | Date | null
  copyrightOwner: string
  softwareCategory: string
  technicalFeatures: string
}

export function validateRequiredFields(fields: SoftwareProjectFields): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!fields.softwareName || String(fields.softwareName).trim() === '') {
    errors.softwareName = '软件名称不能为空'
  }
  if (!fields.version || String(fields.version).trim() === '') {
    errors.version = '版本号不能为空'
  }
  if (!fields.completionDate) {
    errors.completionDate = '开发完成日期不能为空'
  }
  if (!fields.copyrightOwner || String(fields.copyrightOwner).trim() === '') {
    errors.copyrightOwner = '著作权人不能为空'
  }
  if (!fields.softwareCategory || String(fields.softwareCategory).trim() === '') {
    errors.softwareCategory = '软件分类不能为空'
  }
  if (!fields.technicalFeatures || String(fields.technicalFeatures).trim() === '') {
    errors.technicalFeatures = '技术特点简述不能为空'
  }
  return errors
}
