import { printJson } from "../node/json-output";
import { findTemplate, loadTemplates } from "../node/template-loader";

export const runTemplatesList = async (json: boolean): Promise<void> => {
  const templates = await loadTemplates();
  const result = templates.map((template) => ({
    id: template.id,
    name: template.name,
    version: template.version,
    description: template.description ?? "",
    features: template.features,
    layout: template.layout,
  }));
  if (json) printJson({ ok: true, templates: result });
  else {
    for (const template of result) process.stdout.write(`${template.id}\t${template.name}\t${template.version}\t${template.description}\n`);
  }
};

export const runTemplateSchema = async (templateId: string, json: boolean): Promise<void> => {
  const template = await findTemplate(templateId);
  const result = {
    ok: true,
    template: {
      id: template.id,
      name: template.name,
      version: template.version,
      description: template.description ?? "",
      defaults: template.defaults,
      editorSchema: template.editorSchema,
      features: template.features,
      layout: template.layout,
    },
  };
  if (json) printJson(result);
  else process.stdout.write(`${JSON.stringify(result.template, null, 2)}\n`);
};
