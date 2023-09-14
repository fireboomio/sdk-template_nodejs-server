import { resolve } from "node:path";
import { HookParent, Operation } from "./types/server";
import { stat, readFile, writeFile, mkdir } from "node:fs/promises";

export async function saveOperationConfig(folder: HookParent, path: string, config: Partial<Operation>) {
  const outputFolder = resolve(process.cwd(), folder);
  if (!(await stat(outputFolder)).isDirectory()) {
    await mkdir(outputFolder);
  }
  const jsonPath = resolve(outputFolder, path + '.json');
  let json: Partial<Operation> = {}
  try {
    const content = await readFile(jsonPath, 'utf-8')
    json = JSON.parse(content)
  } catch (error) {
    // File not exist
  }
  json = { ...json, ...config }
  await writeFile(jsonPath, JSON.stringify(json, null, 2));
}