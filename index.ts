// Import
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api'
import { config } from './config'

const WITHDRAW_ERA = 561
const TX_TIP = 3 * 10 ** 18 // 18 decimals

async function main() {
    // Keyring material
    const keyring = new Keyring({ type: 'sr25519' })
    const keyPair = keyring.addFromUri(config.seedPhrase)

    // Construct
    const wsProvider = new WsProvider('wss://astar.api.onfinality.io/public-ws')
    const api = await ApiPromise.create({ provider: wsProvider })

    // Retrieve the chain name
    const chain = await api.rpc.system.chain()

    let isSentWithdraw = false
    let isWithdrawSuccess = false
    let isSentTransfer = false
    let fundsAreSafu = false

    // Subscribe to the new headers
    await api.rpc.chain.subscribeNewHeads(async () => {
        const strEra = (await api.query.dappsStaking.currentEra()).toString()
        const era = parseInt(strEra, 10)
        console.log(`${chain} current era: ${era}\n`)

        if (era >= WITHDRAW_ERA && (!isSentWithdraw || !isSentTransfer)) {
            if (!isSentWithdraw) {
                isSentWithdraw = true
                const withdrawTx = api.tx.dappsStaking.withdrawUnbonded()
                console.log(`Redy to withdraw funds.. \n`)

                await withdrawTx.signAndSend(
                    keyPair,
                    { tip: TX_TIP },
                    ({ events = [], status, txHash }) => {
                        console.log(
                            `Current status is \x1b[32m${status.type}\x1b[0m`
                        )
                        if (status.type === 'InBlock') {
                            // Loop through Vec<EventRecord> and if extrinsic failed, retry
                            events.forEach(
                                ({
                                    phase,
                                    event: { data, method, section },
                                }) => {
                                    if (method === 'ExtrinsicFailed') {
                                        isSentWithdraw = false
                                    }
                                }
                            )
                            if (!isSentWithdraw) {
                                const errorMessage = `Extrinsic failed, retrying...`
                                console.log(`\x1b[31m${errorMessage}\x1b[0m`)
                            } else {
                                isWithdrawSuccess = true
                                console.log(`Funds correctly withdrawn :) \n`)
                            }
                        }
                    }
                )
            }

            if (!isSentTransfer && isWithdrawSuccess) {
                isSentTransfer = true

                const transferTx = api.tx.balances.transferAll(
                    config.recievingAddress,
                    false
                )
                console.log(
                    `Redy to tranfer funds to address: ${config.recievingAddress}..\n`
                )

                await transferTx.signAndSend(
                    keyPair,
                    { tip: TX_TIP },
                    ({ events = [], status, txHash }) => {
                        console.log(
                            `Current status is \x1b[32m${status.type}\x1b[0m`
                        )
                        if (status.type === 'InBlock') {
                            // Loop through Vec<EventRecord> and if extrinsic failed, retry
                            events.forEach(
                                ({
                                    phase,
                                    event: { data, method, section },
                                }) => {
                                    if (method === 'ExtrinsicFailed') {
                                        isSentTransfer = false
                                    }
                                }
                            )
                            if (!isSentTransfer) {
                                const errorMessage = `Extrinsic failed, retrying...`
                                console.log(`\x1b[31m${errorMessage}\x1b[0m`)
                            } else {
                                fundsAreSafu = true
                                console.log(
                                    `FUNDS ARE SAFU, correctly withdrawn to address: ${config.recievingAddress} \n`
                                )
                            }
                        }
                    }
                )
            }

            if (fundsAreSafu) {
                console.log(`Job DONE :) \nExiting..`)
                process.exit(0)
            }
        }
    })
}

main().catch((error) => {
    console.error(error)
    process.exit(-1)
})
