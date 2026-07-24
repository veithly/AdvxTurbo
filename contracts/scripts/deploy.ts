import { ethers, network } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

// 部署全部合约 (PRD 42.1) 并输出地址到 deployments/<network>.json
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address, 'network:', network.name);

  const Passport = await ethers.getContractFactory('AgentPassport');
  const passport = await Passport.deploy(deployer.address);
  await passport.waitForDeployment();

  const Strategy = await ethers.getContractFactory('StrategyRegistry');
  const strategy = await Strategy.deploy(deployer.address, await passport.getAddress());
  await strategy.waitForDeployment();

  const MatchRoot = await ethers.getContractFactory('MatchRootRegistry');
  const matchRoot = await MatchRoot.deploy(deployer.address);
  await matchRoot.waitForDeployment();

  const Escrow = await ethers.getContractFactory('TournamentEscrow');
  const escrow = await Escrow.deploy(deployer.address);
  await escrow.waitForDeployment();

  const addresses = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    AgentPassport: await passport.getAddress(),
    StrategyRegistry: await strategy.getAddress(),
    MatchRootRegistry: await matchRoot.getAddress(),
    TournamentEscrow: await escrow.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  const dir = path.resolve(__dirname, '../deployments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, network.name + '.json'), JSON.stringify(addresses, null, 2));
  console.log('\nDeployed:');
  console.log(JSON.stringify(addresses, null, 2));
  console.log('\n将地址写入 apps/server .env:');
  console.log(`ADDR_PASSPORT=${addresses.AgentPassport}`);
  console.log(`ADDR_STRATEGY=${addresses.StrategyRegistry}`);
  console.log(`ADDR_MATCHROOT=${addresses.MatchRootRegistry}`);
  console.log(`ADDR_TOURNEY=${addresses.TournamentEscrow}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
