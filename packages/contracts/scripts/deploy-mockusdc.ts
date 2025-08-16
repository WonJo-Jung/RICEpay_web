import { network } from "hardhat";
import "dotenv/config"

async function main() {
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const { chainId } = await ethers.provider.getNetwork();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("chainId:", chainId.toString(), "balance:", bal.toString());

  // 1,000,000 mUSDC (소수점 6자리)
  const initialSupply = ethers.parseUnits("1000000", 6);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mock = await MockUSDC.deploy(initialSupply);
  await mock.waitForDeployment();

  const address = await mock.getAddress();
  console.log("MockUSDC deployed at:", address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
