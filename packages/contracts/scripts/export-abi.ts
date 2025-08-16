import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  const out = process.env.WEB_ABI_OUT || "../../apps/web/src/abi";
  const src = path.resolve("artifacts/contracts/MockUSDC.sol/MockUSDC.json");
  const dstDir = path.resolve(out);
  const dst = path.join(dstDir, "MockUSDC.json");

  const raw = JSON.parse(await fs.readFile(src, "utf-8"));
  const abiOnly = { abi: raw.abi };

  await fs.mkdir(dstDir, { recursive: true });
  await fs.writeFile(dst, JSON.stringify(abiOnly, null, 2), "utf-8");

  console.log("ABI exported to:", dst);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
