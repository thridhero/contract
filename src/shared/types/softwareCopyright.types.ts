export interface SoftwareCopyrightCreateDTO {
  libraryPath: string;
  softwareName: string;
  version: string;
  completionDate: string;
  copyrightOwner: string;
  softwareCategory: string;
  technicalFeatures: string;
  projectIcon: string;
  projectColor: string;
}

export interface SoftwareCopyrightProject {
  id: string;
  project_name: string;
  software_name: string;
  version: string;
  completion_date: string;
  copyright_owner: string;
  software_category: string;
  technical_features: string;
  project_icon: string | null;
  project_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoftwareCopyrightCreateResult {
  id: string;
  folderName: string;
  projectPath: string;
}
