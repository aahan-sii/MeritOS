type StorageEnv = {
  FILES?: R2Bucket;
};

async function getStorageEnv(): Promise<StorageEnv> {
  const moduleName = "cloudflare:workers";
  return ((await import(/* @vite-ignore */ moduleName)) as { env: StorageEnv }).env;
}

export async function getFilesBucket() {
  const { env } = await getStorageEnv();
  if (!env.FILES) {
    throw new Error("MeritOS file storage is unavailable.");
  }
  return env.FILES;
}
