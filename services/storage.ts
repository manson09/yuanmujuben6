import { Project } from '../types';

const STORAGE_KEY = 'AI_CREATIVE_AGENT_PROJECTS';

export const storage = {
  getProjects: (): Project[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];


      return parsed.map(p => ({
        ...p,
        files: Array.isArray(p.files) ? p.files : [],
        scripts: Array.isArray(p.scripts) ? p.scripts : [],
        // 针对大纲数据的修补
        outline: p.outline ? {
          ...p.outline,
          characters: Array.isArray(p.outline.characters) ? p.outline.characters : [],
          phasePlans: Array.isArray(p.outline.phasePlans) ? p.outline.phasePlans : []
        } : p.outline
      }));
    } catch (e) {
      console.error("存储读取失败，已重置为空数组", e);
      return [];
    }
  },

  saveProjects: (projects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error("存储写入失败", e);
    }
  },

  getProject: (id: string): Project | undefined => {
    const projects = storage.getProjects();
    return projects.find(p => p.id === id);
  },

  updateProject: (project: Project) => {
    const projects = storage.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    // 确保更新时数据也是完整的
    const normalizedProject = {
      ...project,
      files: project.files || [],
      scripts: project.scripts || [],
      updatedAt: Date.now()
    };

    if (index !== -1) {
      projects[index] = normalizedProject;
    } else {
      projects.push(normalizedProject);
    }
    storage.saveProjects(projects);
  }
};
