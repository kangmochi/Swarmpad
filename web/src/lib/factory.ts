import { FACTORY_ID } from "./config";
import { rpcView } from "./rpc";
import type { ProjectRecord } from "./types";

const PAGE = 12;

export async function fetchProjectCount(): Promise<number> {
  return rpcView<number>(FACTORY_ID, "project_count");
}

/** Registry page. The factory keeps insertion order, oldest first. */
export async function fetchProjects(from = 0, limit = PAGE): Promise<ProjectRecord[]> {
  return rpcView<ProjectRecord[]>(FACTORY_ID, "projects", { from, limit });
}

export async function fetchProject(slug: string): Promise<ProjectRecord | null> {
  return rpcView<ProjectRecord | null>(FACTORY_ID, "project", { slug });
}

export async function fetchLaunchDeposit(): Promise<string> {
  return rpcView<string>(FACTORY_ID, "launch_deposit");
}

export async function fetchTokenCodeLen(): Promise<number> {
  return rpcView<number>(FACTORY_ID, "token_code_len");
}

export { PAGE };
