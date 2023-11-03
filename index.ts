// Import
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api'
import { config } from './config'

const WITHDRAW_ERA = 561
const TX_TIP = 3 * 10 ** 18 // 18 decimals

async function main() {
    // Construct
    const wsProvider = new WsProvider('wss://astar.api.onfinality.io/public-ws')
    const api = await ApiPromise.create({ provider: wsProvider })

    // Keyring material
    const keyring = new Keyring({ type: 'sr25519' })
    const keyPair = keyring.addFromUri(config.seedPhrase)

    // Retrieve the chain name
    const chain = await api.rpc.system.chain()

    let isReady = false

    // Subscribe to the new headers
    const unsub = await api.rpc.chain.subscribeNewHeads(async () => {
        const strEra = (await api.query.dappsStaking.currentEra()).toString()
        const era = parseInt(strEra, 10)
        console.log(`${chain} current era: ${era}\n`)

        if (era >= 554) {
            isReady = true
            unsub()

            // Withdraw Era - Prepare for withdrawing funds
            const withdrawTx = api.tx.dappsStaking.withdrawUnbonded()
            console.log(`Redy to withdraw funds.. \n`)

            await withdrawTx.signAndSend(
                keyPair,
                { tip: TX_TIP },
                async (result) => {
                    console.log(`Current status is ${result.status}`)

                    if (result.status.isInBlock) {
                        console.log(
                            `Transaction included at blockHash ${result.status.asInBlock}`
                        )
                        console.log(`Funds correctly withdrawn :) \n`)

                        // Make transfer
                        console.log(
                            `Redy to tranfer funds to address: ${config.recievingAddress}..\n`
                        )

                        const transferTxHash = await api.tx.balances
                            .transferAll(config.recievingAddress, false)
                            .signAndSend(keyPair, { tip: TX_TIP })
                        // Show the hash
                        console.log(`Submitted with hash ${transferTxHash}`)
                        // Exit
                        console.log(`Job DONE :) \nExiting..`)
                        process.exit(0)
                    }
                }
            )
        }
    })
}

main().catch((error) => {
    console.error(error)
    process.exit(-1)
})
