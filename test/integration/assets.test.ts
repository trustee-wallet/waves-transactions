import {
  alias,
  broadcast,
  burn, exchange,
  IBurnParams,
  IIssueParams, IMassTransferParams,
  IReissueParams, ISetAssetScriptParams,
  issue,
  ITransferParams, massTransfer, order,
  reissue, setAssetScript, transfer,
  waitForTx
} from '../../src'
import { address, publicKey, randomUint8Array } from '@waves/waves-crypto'
import { MASTER_SEED, CHAIN_ID, TIMEOUT, API_BASE } from './config'

const recipientSeed = 'MyRecipient'

describe('Assets', () => {

  describe('Ordinary assets', () => {
    let assetId = ''

    it('Should ISSUE new token', async () => {
      const txParams: IIssueParams = {
        name: 'Test token',
        description: 'no description',
        decimals: 3,
        quantity: 1000,
        chainId: CHAIN_ID,
        reissuable: true,
      }

      const tx = issue(txParams, MASTER_SEED)
      const resp = await broadcast(tx, API_BASE)
      expect(resp.type).toEqual(3)
      assetId = tx.id
      await waitForTx(assetId, { apiBase: API_BASE, timeout: TIMEOUT })
    }, TIMEOUT)

    it('Should ReIssue token', async () => {
      const txParams: IReissueParams = {
        reissuable: true,
        assetId,
        quantity: 1000,
        chainId: CHAIN_ID,
      }
      const tx = reissue(txParams, MASTER_SEED)
      const resp = await broadcast(tx, API_BASE)
      expect(resp.type).toEqual(5)
    })

    it('Should BURN token', async () => {
      const burnParams: IBurnParams = {
        assetId,
        quantity: 500,
        chainId: CHAIN_ID,
      }
      const burnTx = burn(burnParams, MASTER_SEED)
      const resp = await broadcast(burnTx, API_BASE)
      expect(resp.type).toEqual(6)
    })

    it('Should transfer asset', async () => {
      const transferParams: ITransferParams = {
        amount: '500',
        assetId,
        recipient: address(recipientSeed, CHAIN_ID),
        attachment: '3MyAGEBuZGDKZDzYn6sbh2noqk9uYHy4kjw',
      }

      const tx = transfer(transferParams, MASTER_SEED)
      const resp = await broadcast(tx, API_BASE)
      expect(resp.type).toEqual(4)
    })

    it('Should masstransfer asset', async () => {
      const massTransferParams: IMassTransferParams = {
        //fee:'200000',
        assetId,
        transfers: [
          {
            recipient: address(recipientSeed, CHAIN_ID),
            amount: '100',
          },
          {
            recipient: address(recipientSeed, CHAIN_ID),
            amount: '100',
          },
        ],
      }

      const tx = massTransfer(massTransferParams, MASTER_SEED)
      const resp = await broadcast(tx, API_BASE)
      expect(resp.type).toEqual(11)
      expect(resp.id).toEqual(tx.id)
    })
  })

  describe('Scripted assets', () => {
    let assetId = ''

    it('Should issue token with script. Should execute token script', async () => {
      // script prohibits burn transaction
      const script = 'AQQAAAAHJG1hdGNoMAUAAAACdHgDCQAAAQAAAAIFAAAAByRtYXRjaDACAAAAD0J1cm5UcmFuc2FjdGlvbgQAAAABdAUAAAAHJG1hdGNoMAcGPmRSDA=='
      const txParams: IIssueParams = {
        name: 'scriptedToken',
        description: 'no description',
        decimals: 3,
        quantity: 10000,
        reissuable: true,
        chainId: CHAIN_ID,
        script,
      }
      const tx = issue(txParams, MASTER_SEED)
      const resp = await broadcast(tx, API_BASE)
      expect(resp.type).toEqual(3)
      assetId = tx.id
      await waitForTx(assetId, { timeout: TIMEOUT, apiBase: API_BASE })

      const burnParams: IBurnParams = {
        assetId,
        quantity: 1000,
        chainId: CHAIN_ID,
      }
      const burnTx = burn(burnParams, MASTER_SEED)
      const respPromise = broadcast(burnTx, API_BASE)
      await expect(respPromise).rejects.toMatchObject({ error: 308 })

    }, TIMEOUT + 20000)

    it('Should set new token script. Should execute new token script', async () => {
      // script allows everything
      const script = 'AQa3b8tH'
      const txParams: ISetAssetScriptParams = {
        assetId,
        chainId: CHAIN_ID,
        script,
      }
      const tx = setAssetScript(txParams, MASTER_SEED)
      const resp = await broadcast(tx, API_BASE)
      expect(resp.type).toEqual(15)
      await waitForTx(tx.id, { timeout: TIMEOUT, apiBase: API_BASE })

      const burnParams: IBurnParams = {
        assetId,
        quantity: '1000',
        chainId: CHAIN_ID,
        additionalFee: 400000,
      }
      const burnTx = burn(burnParams, MASTER_SEED)
      const burnResp = await broadcast(burnTx, API_BASE)
      expect(burnResp.type).toEqual(6)
    }, TIMEOUT + 20000)

  })

  describe('Other', () => {
    it('Should create alias for address', async () => {
      const aliasStr: string = [...randomUint8Array(10)].map(n => n.toString(16)).join('')
      const aliasTx = alias({ alias: aliasStr, chainId: 'T' }, MASTER_SEED)
      const resp = await broadcast(aliasTx, API_BASE)
      expect(resp.type).toEqual(10)
      await waitForTx(aliasTx.id, { timeout: TIMEOUT, apiBase: API_BASE })
      const ttx = transfer({ recipient: `alias:${CHAIN_ID}:${aliasStr}`, amount: 1000 }, MASTER_SEED)
      const ttxResp = await broadcast(ttx, API_BASE)
      expect(ttxResp.type).toEqual(4)
    }, TIMEOUT)

    it('Should perform exchange transaction', async () => {
      // ISSUE ASSET
      let account2 = 'exchange test'
      let assetId: string
      const txParams: IIssueParams = {
        name: 'Test token',
        description: 'no description',
        //decimals: 3,
        quantity: 100000000000,
        chainId: CHAIN_ID,
        reissuable: true,
      }

      const issueTx = issue(txParams, MASTER_SEED)
      assetId = issueTx.id
      await broadcast(issueTx, API_BASE)
      // GIVE WAVES TO TEST ACC
      const transferTx = transfer({ recipient: address(account2, 'T'), amount: 100000000 }, MASTER_SEED)
      await broadcast(transferTx, API_BASE)

      //WAIT BOTH TX TO COMPLETE
      await waitForTx(issueTx.id, { timeout: TIMEOUT, apiBase: API_BASE })
      await waitForTx(transferTx.id, { timeout: TIMEOUT, apiBase: API_BASE })
      /////////////////////////

      //assetId = 'qmhEv7NeL39kDiWBVfzZh6aT1ZwzpD7y1CFxvmiH78U'

      const order1 = order({
        //matcherPublicKey,
        matcherPublicKey: publicKey(MASTER_SEED),
        orderType: 'buy',
        matcherFee: 300000,
        amountAsset: assetId,
        priceAsset: null,
        amount: 1,
        price: 100000000
      }, account2)

      const order2 = order({
        //matcherPublicKey,
        matcherPublicKey: publicKey(MASTER_SEED),
        orderType: 'sell',
        matcherFee: 300000,
        amountAsset: assetId,
        priceAsset: null,
        amount: 1,
        price: 100000000
      }, MASTER_SEED)

      //await submitOrder(order1, matcherUrl)
      //await submitOrder(order2, matcherUrl)

      const exchangeTx = exchange({
        type: 7,
        version: 2,
        order1,
        order2,
        price: 100000000,
        amount: 1,
        buyMatcherFee: order1.matcherFee,
        sellMatcherFee: order2.matcherFee,
        timestamp: Date.now(),
        proofs: [],
        fee: 300000,
        senderPublicKey: publicKey(MASTER_SEED)
      }, MASTER_SEED)

      const resp = await broadcast(exchangeTx, API_BASE)
      expect(resp.type).toEqual(7)
    }, TIMEOUT)
  })
})
