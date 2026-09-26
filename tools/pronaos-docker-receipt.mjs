#!/usr/bin/env node
/** Read the finite Pronaos receipt from the running image, never from checkout. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function readRunningPronaosReceipt({
  container,
  receiptPath = "/app/pronaos-build/pronaos-artifact.json",
  docker = "docker",
  run = exec,
} = {}) {
  if (!container) throw new Error("running Pronaos receipt needs a container name");
  const idResult = await run(docker, ["inspect", "--format", "{{.Id}}", container], { encoding: "utf8" });
  const containerId = idResult.stdout.trim();
  if (!/^[0-9a-f]{12,64}$/i.test(containerId)) throw new Error("running Pronaos container has no attributable ID");
  const result = await run(docker, ["exec", container, "cat", receiptPath], { encoding: "utf8" });
  let receipt;
  try { receipt = JSON.parse(result.stdout); }
  catch (error) { throw new Error(`running image Pronaos receipt is invalid JSON: ${error.message}`); }
  if (!Array.isArray(receipt.routes) || !receipt.routes.some((route) => route.path === "/")) {
    throw new Error("running image Pronaos receipt has no finite root route");
  }
  return { container, containerId, receiptPath, receipt };
}

