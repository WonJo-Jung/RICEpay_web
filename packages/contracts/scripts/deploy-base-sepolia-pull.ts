import { network } from "hardhat";

async function main() {
  // const PERMIT2 = process.env.PERMIT2_ADDR!;   // Base Permit2
  const USDC = process.env.BASE_SEPOLIA_USDC_ADDR!;         // Base USDC
  const FEE_RECIPIENT = process.env.RICE_FEE_RECIPIENT!;   // 회사 법인 지갑 주소

  if (!FEE_RECIPIENT) {
    throw new Error("❌ 환경변수 RICE_FEE_RECIPIENT 누락됨");
  }

  console.log("🚀 Deploying RicePayTransferPull...");
  // console.log(`Permit2: ${PERMIT2}`);
  console.log(`USDC: ${USDC}`);
  console.log(`FeeRecipient: ${FEE_RECIPIENT}`);

  const { ethers, networkName } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const addr = await deployer.getAddress();
  const bal1  = await ethers.provider.getBalance(addr);

  console.log("Network:", networkName);
  console.log("Deployer:", addr);
  console.log("Deployer before balance (ETH):", ethers.formatEther(bal1));

  const factory = await ethers.getContractFactory("RicePayTransferPull");
  const contract = await factory.deploy(USDC, FEE_RECIPIENT);
  await contract.waitForDeployment();

  console.log("✅ RicePayTransferPull deployed at:", await contract.getAddress());

  const bal2  = await ethers.provider.getBalance(addr);
  console.log("Deployer after balance (ETH):", ethers.formatEther(bal2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});