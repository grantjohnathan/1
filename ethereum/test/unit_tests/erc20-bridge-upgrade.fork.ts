import * as hardhat from 'hardhat';
import { expect } from 'chai';

import { ethers } from 'ethers';
import {
    L1ERC20BridgeTestFactory,
    TransparentUpgradeableProxyFactory,
    TransparentUpgradeableProxy,
    L1ERC20Bridge
} from '../../typechain';

// TODO: change to the mainet config
const L1_ERC20_BRIDGE = '0x927DdFcc55164a59E0F33918D13a2D559bC10ce7';
const GOVERNOR_ADDRESS = '0x98591957D9741e7E7d58FC253044e0A014A3a323';

async function isPromiseFailed(promise: Promise<any>): Promise<boolean> {
    let failed = false;
    try {
        await promise;
    } catch {
        failed = true;
    }
    return failed;
}

describe('L1 ERC20 proxy upgrade fork test', function () {
    const allowListOnNewImplementation = '0xdeadbeafdeadbeafdeadbeafdeadbeafdeadbeaf';
    const mailboxOnNewImplementation = '0x1234567890123456789012345678901234567890';

    let governor: ethers.Signer;
    let randomSigner: ethers.Signer;
    let bridgeProxy: TransparentUpgradeableProxy;
    let newBridgeImplementation: L1ERC20Bridge;
    let oldBridgeImplementationAddress: string;

    before(async () => {
        await hardhat.network.provider.request({ method: 'hardhat_impersonateAccount', params: [GOVERNOR_ADDRESS] });
        governor = await hardhat.ethers.provider.getSigner(GOVERNOR_ADDRESS);
        await hardhat.network.provider.send('hardhat_setBalance', [GOVERNOR_ADDRESS, '0xfffffffffffffffff']);

        const signers = await hardhat.ethers.getSigners();
        randomSigner = signers[0];
        bridgeProxy = TransparentUpgradeableProxyFactory.connect(L1_ERC20_BRIDGE, randomSigner);
        oldBridgeImplementationAddress = await bridgeProxy.connect(governor).callStatic.implementation();

        const l1Erc20BridgeFactory = await hardhat.ethers.getContractFactory('L1ERC20BridgeTest');
        const l1Erc20Bridge = await l1Erc20BridgeFactory.deploy(
            mailboxOnNewImplementation,
            allowListOnNewImplementation
        );
        newBridgeImplementation = L1ERC20BridgeTestFactory.connect(l1Erc20Bridge.address, l1Erc20Bridge.signer);
    });

    it('should revert on non-existed methods', async () => {
        const bridgeProxyAsNewImplementation = L1ERC20BridgeTestFactory.connect(bridgeProxy.address, randomSigner);

        const failedGetAllowList = await isPromiseFailed(bridgeProxyAsNewImplementation.getAllowList());
        expect(failedGetAllowList).to.be.true;

        const failedGetMailbox = await isPromiseFailed(bridgeProxyAsNewImplementation.getZkSyncMailbox());
        expect(failedGetMailbox).to.be.true;
    });

    it('should upgrade', async () => {
        await bridgeProxy.connect(governor).upgradeTo(newBridgeImplementation.address);
    });

    it('check new functions', async () => {
        const bridgeProxyAsNewImplementation = L1ERC20BridgeTestFactory.connect(bridgeProxy.address, randomSigner);

        const allowlist = await bridgeProxyAsNewImplementation.getAllowList();
        expect(allowlist.toLocaleLowerCase()).to.be.eq(allowListOnNewImplementation.toLocaleLowerCase());

        const mailbox = await bridgeProxyAsNewImplementation.getZkSyncMailbox();
        expect(mailbox.toLocaleLowerCase()).to.be.eq(mailboxOnNewImplementation.toLocaleLowerCase());
    });

    it('should upgrade second time', async () => {
        const bridgeAsTransparentProxy = TransparentUpgradeableProxyFactory.connect(bridgeProxy.address, governor);
        await bridgeAsTransparentProxy.upgradeTo(oldBridgeImplementationAddress);
    });

    it('should revert on non-existed methods', async () => {
        const bridgeProxyAsNewImplementation = L1ERC20BridgeTestFactory.connect(bridgeProxy.address, randomSigner);

        const failedGetAllowList = await isPromiseFailed(bridgeProxyAsNewImplementation.getAllowList());
        expect(failedGetAllowList).to.be.true;

        const failedGetMailbox = await isPromiseFailed(bridgeProxyAsNewImplementation.getZkSyncMailbox());
        expect(failedGetMailbox).to.be.true;
    });
});
