import { expect } from 'chai';
import { ethers } from 'hardhat';

// PRD 44.3 核心 Invariant + 57.4 合约测试矩阵
describe('BLAME GAME contracts', () => {
  async function deploy() {
    const [admin, alice, bob] = await ethers.getSigners();
    const Passport = await ethers.getContractFactory('AgentPassport');
    const passport = await Passport.deploy(admin.address);
    const Strategy = await ethers.getContractFactory('StrategyRegistry');
    const strategy = await Strategy.deploy(admin.address, await passport.getAddress());
    const MatchRoot = await ethers.getContractFactory('MatchRootRegistry');
    const matchRoot = await MatchRoot.deploy(admin.address);
    const Escrow = await ethers.getContractFactory('TournamentEscrow');
    const escrow = await Escrow.deploy(admin.address);
    return { admin, alice, bob, passport, strategy, matchRoot, escrow };
  }

  it('Passport: 唯一 workerIdHash 且不可转让', async () => {
    const { passport, alice } = await deploy();
    const wh = ethers.keccak256(ethers.toUtf8Bytes('worker:1'));
    const mh = ethers.keccak256(ethers.toUtf8Bytes('meta'));
    await passport.mintPassport(alice.address, wh, mh, 'uri://1');
    expect(await passport.activePassportOf(wh)).to.equal(1n);
    // 重复 mint 同一 workerHash 应 revert
    await expect(passport.mintPassport(alice.address, wh, mh, 'uri://1')).to.be.revertedWith('ALREADY_MINTED');
    // 转让应 revert
    await expect(passport.transferFrom(alice.address, alice.address, 1)).to.be.revertedWithCustomError(passport, 'NonTransferable');
  });

  it('StrategyRegistry: 登记与可用性', async () => {
    const { passport, strategy, alice } = await deploy();
    const wh = ethers.keccak256(ethers.toUtf8Bytes('worker:2'));
    await passport.mintPassport(alice.address, wh, wh, 'uri');
    const vh = ethers.keccak256(ethers.toUtf8Bytes('v1'));
    await strategy.registerVersion(1, vh, vh, vh, ethers.ZeroHash, ethers.ZeroHash, vh, 'uri');
    expect(await strategy.isVersionUsable(1, vh)).to.equal(true);
    expect(await strategy.versionCount(1)).to.equal(1n);
  });

  it('MatchRootRegistry: 单场比赛 Merkle 验证', async () => {
    const { matchRoot } = await deploy();
    const a = ethers.keccak256(ethers.toUtf8Bytes('match-a'));
    const b = ethers.keccak256(ethers.toUtf8Bytes('match-b'));
    const [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
    const root = ethers.keccak256(ethers.concat([lo, hi]));
    await matchRoot.submitBatch(1, root, ethers.ZeroHash, ethers.ZeroHash, 2, 0, 0, 'uri', ['0x00', '0x00']);
    expect(await matchRoot.verifyMatch(1, a, [b])).to.equal(true);
    expect(await matchRoot.verifyMatch(1, a, [a])).to.equal(false);
  });

  it('TournamentEscrow: 资金守恒 + 领取防重复', async () => {
    const { escrow, admin, alice } = await deploy();
    const now = Math.floor(Date.now() / 1000);
    await escrow.createTournament(ethers.ZeroHash, ethers.ZeroAddress, now, now, now - 10, 1, 3600);
    await escrow.fundNative(1, { value: ethers.parseEther('1') });
    const amount = ethers.parseEther('0.4');
    const leaf = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [alice.address, amount]));
    // 单叶树：root == leaf
    await escrow.submitResults(1, ethers.ZeroHash, leaf);
    await new Promise((r) => setTimeout(r, 1200));
    await escrow.connect(alice).claim(1, amount, []);
    expect(await escrow.escrowBalance(1)).to.equal(ethers.parseEther('0.6'));
    // 重复领取 revert
    await expect(escrow.connect(alice).claim(1, amount, [])).to.be.revertedWith('ALREADY_CLAIMED');
  });
});
