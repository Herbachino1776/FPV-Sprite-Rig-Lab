import { RigProject } from '../types/rig';

export const exportProjectJson = (project: RigProject) => {
  const json = JSON.stringify(project, null, 2);
  return new Blob([json], { type: 'application/json' });
};

export const importProjectJson = async (file: File): Promise<RigProject> => {
  const text = await file.text();
  const project = JSON.parse(text) as RigProject;
  if (!project.version || !project.settings || !project.animations || !Array.isArray(project.layers)) {
    throw new Error('This does not look like an FPV Sprite Rig Lab project file.');
  }
  return project;
};
